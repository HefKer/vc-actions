/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 hefker and Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { MessageStore, SelectedChannelStore } from "@webpack/common";

import { logger } from "../lib/discord";
import { UserError } from "../lib/errors";
import { MAX_SELECTED, type ModeCommand, type ModeState, pressKey, rebase, startMode } from "../lib/messageMode";
import {
    channelInWindow, forwardMessages, getMessage, messageElement, messagesShown, openReactionPicker, replyTo
} from "../lib/messages";
import { overlay, type OverlayKind } from "../lib/overlay";
import { type ActionContext, defineAction } from "../registry";

/** Keys shown in the mode's hint, which-key style. */
const KEYS: [string, string][] = [
    ["j / k", "down / up (3k: by 3)"],
    ["g / G", "oldest / newest"],
    ["r / R", "reply / without ping"],
    ["e", "react"],
    ["space", `select (up to ${MAX_SELECTED})`],
    ["f", "forward (the selection)"],
    ["Esc", "clear selection, then exit"]
];

const kbd = { fontFamily: "var(--font-code, monospace)", fontWeight: 700, whiteSpace: "nowrap" } as const;

function ModeHint({ state }: { state: ModeState; }) {
    const status = [
        state.selected.length ? `${state.selected.length} selected` : "",
        state.count ? `count ${state.count}` : ""
    ].filter(Boolean).join(" · ");
    return (
        <div style={{ whiteSpace: "normal" }}>
            <div style={{ opacity: 0.7, marginBottom: 4 }}>Message mode{status ? ` · ${status}` : ""}</div>
            <div style={{ display: "grid", gridTemplateColumns: "auto 1fr auto 1fr", columnGap: 12, rowGap: 2 }}>
                {KEYS.map(([key, what]) => [
                    <kbd key={`k${key}`} style={kbd}>{key}</kbd>,
                    <span key={`s${key}`}>{what}</span>
                ])}
            </div>
        </div>
    );
}

/** The cursor's and the selection's look, as CSS by element id, so it survives Discord re-rendering a message. */
function highlightCss(channelId: string, state: ModeState) {
    const sel = (id: string) => `#chat-messages-${channelId}-${id}`;
    const rules: string[] = [];
    if (state.selected.length) {
        rules.push(`${state.selected.map(sel).join(",")}{box-shadow:inset 4px 0 0 var(--status-positive,#23a55a)!important;`
            + "background:color-mix(in srgb,var(--status-positive,#23a55a) 12%,transparent)!important}");
    }
    if (state.cursor) {
        rules.push(`${sel(state.cursor)}{outline:2px solid var(--brand-500,#5865f2)!important;outline-offset:-2px;`
            + "background-color:var(--background-modifier-selected,rgba(78,80,88,.6))!important}");
    }
    return rules.join("\n");
}

const MODIFIER_KEYS = new Set(["Shift", "Control", "Alt", "Meta", "CapsLock", "AltGraph"]);

/** The one running message mode: there's at most one, in the window it was entered in. */
interface Session {
    win: Window;
    channelId: string;
    state: ModeState;
    /** Ids shown at the last refresh, oldest first. */
    ids: string[];
    reply: ActionContext["reply"];
    end(): void;
}

let session: Session | undefined;

/** Leave message mode, wherever it runs (plugin stop too). */
export function stopMessageMode() {
    session?.end();
}

function enter(win: Window, reply: ActionContext["reply"]) {
    const doc = win.document;
    const found = channelInWindow(doc);
    if (!found) throw new UserError("No messages in this window.");
    const channelId = found;
    const ids = messagesShown(channelId, doc).map(m => m.id);
    if (!ids.length) throw new UserError("No messages in this window.");

    const style = doc.createElement("style");
    style.id = "quick-actions-message-mode";
    doc.head.appendChild(style);
    const hint = overlay(doc, "hint");
    let hideHint: (() => void) | undefined;

    const s: Session = { win, channelId, state: startMode(ids), ids, reply, end };
    session = s;

    function render(scroll: boolean) {
        style.textContent = highlightCss(channelId, s.state);
        hideHint = hint.show(<ModeHint state={s.state} />, { duration: null });
        if (scroll && s.state.cursor) messageElement(doc, channelId, s.state.cursor)?.scrollIntoView({ block: "nearest" });
    }

    /** Re-read the shown messages; false (and the mode ends) when the window no longer shows the channel. */
    function refresh(): boolean {
        const now = messagesShown(channelId, doc).map(m => m.id);
        if (!now.length) {
            end();
            return false;
        }
        s.state = rebase(s.state, s.ids, now);
        s.ids = now;
        return true;
    }

    function onKey(e: KeyboardEvent) {
        // Bindings (leaders need ctrl/alt/meta) and Discord's own shortcuts keep working; typing in our palette too.
        if (e.ctrlKey || e.altKey || e.metaKey || MODIFIER_KEYS.has(e.key)) return;
        // Swallowed by the binding engine (a key of a sequence after its leader): that's the binding's, not ours.
        if (e.defaultPrevented) return;
        if ((e.target as Element | null)?.closest?.("#quick-actions-overlay")) return;
        // Swallowed, so letters don't land in the composer.
        e.preventDefault();
        e.stopPropagation();
        if (e.repeat && !["j", "k", "ArrowDown", "ArrowUp"].includes(e.key)) return;
        if (!refresh()) return;
        const before = s.state.cursor;
        const { state, command } = pressKey(s.state, e.key, s.ids);
        s.state = state;
        if (command) run(command);
        if (session === s) render(state.cursor !== before);
    }

    function run(command: ModeCommand) {
        const say = (text: string, kind?: OverlayKind) => s.reply(text, kind);
        try {
            switch (command.type) {
                case "exit":
                    end();
                    return;
                case "full":
                    say(`At most ${MAX_SELECTED} messages per forward.`, "error");
                    return;
                case "reply":
                case "react": {
                    const msg = getMessage(channelId, command.id);
                    if (!msg) throw new UserError("That message is gone.");
                    // The composer or the picker takes the keys from here on.
                    end();
                    if (command.type === "reply") replyTo(msg, command.mention);
                    else openReactionPicker(msg, doc);
                    return;
                }
                case "forward": {
                    const msgs = command.ids.map(id => getMessage(channelId, id)).filter(m => m != null);
                    if (!msgs.length) throw new UserError("Those messages are gone.");
                    end();
                    forwardMessages(msgs, say);
                    return;
                }
            }
        } catch (e) {
            if (!(e instanceof UserError)) logger.error(`message mode ${command.type} failed`, e);
            say(e instanceof Error ? e.message : String(e), "error");
        }
    }

    function onBlur(e: FocusEvent) {
        if (e.target === win) end();
    }

    // Going to another channel ends the mode. A pop-out's chat (not the selected channel) ends it once its
    // messages are gone instead (refresh).
    const followsSelected = SelectedChannelStore.getChannelId() === channelId;
    function onChannel() {
        if (followsSelected && SelectedChannelStore.getChannelId() !== channelId) end();
    }

    // New, edited, deleted or older loaded messages: keep the cursor and selection on what's shown, once drawn.
    let frame = 0;
    function onMessages() {
        if (frame) return;
        frame = win.requestAnimationFrame(() => {
            frame = 0;
            if (session === s && refresh()) render(false);
        });
    }

    function end() {
        if (session !== s) return;
        session = undefined;
        win.removeEventListener("keydown", onKey, true);
        win.removeEventListener("blur", onBlur, true);
        SelectedChannelStore.removeChangeListener(onChannel);
        MessageStore.removeChangeListener(onMessages);
        if (frame) win.cancelAnimationFrame(frame);
        style.remove();
        // Only our hint: a which-key hint shown since stays.
        hideHint?.();
    }

    win.addEventListener("keydown", onKey, true);
    win.addEventListener("blur", onBlur, true);
    SelectedChannelStore.addChangeListener(onChannel);
    MessageStore.addChangeListener(onMessages);
    render(true);
}

export default defineAction({
    id: "messagemode",
    description: "Select messages in the channel with the keyboard (j/k, g/G, count) to reply, react or forward; Esc exits",
    run({ win = window, reply }) {
        // Pressed again: leave (and in another window, start there instead).
        const wasHere = session?.win === win;
        stopMessageMode();
        if (!wasHere) enter(win, reply);
    }
});
