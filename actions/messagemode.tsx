/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 hefker and Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { createRoot, MessageStore, ReactDOM, SelectedChannelStore } from "@webpack/common";
import type { ReactNode } from "react";

import { logger } from "../lib/discord";
import { UserError } from "../lib/errors";
import {
    acceptsRepeat, MAX_SELECTED, type ModeCommand, type ModeState, moveTo, pressKey, rebase, searchMatches, setGoal, showLabels, startMode
} from "../lib/messageMode";
import {
    channelInWindow, copyLinks, copyText, deleteMessage, editMessage, forwardMessages, getMessage, isModalOpen, jumpToMessage,
    messageElement, messagesShown, messageText, openReactionPicker, openThread, repliedTo, replyTo, scrollerOf, togglePin
} from "../lib/messages";
import { HINT_GAP, type HintSide, hintSide, marginsFor, onScreen, scrollFor, type Span } from "../lib/messageView";
import { OverlayBox, type OverlayKind } from "../lib/overlay";
import { type ActionContext, defineAction } from "../registry";

/** Keys shown in the mode's hint, which-key style but compact, so it covers little of the chat. */
const KEYS: [string, string][] = [
    ["j/k", "down/up (3k)"],
    ["g/G", "oldest/newest"],
    ["z", "centre"],
    ["/ n N", "search"],
    [";", "labels"],
    ["o", "replied-to"],
    ["r/R", "reply/no ping"],
    ["e", "react"],
    ["E", "edit"],
    ["t", "thread"],
    ["c/l", "copy text/link"],
    ["p", "pin"],
    ["d", "delete"],
    ["space", `select (${MAX_SELECTED})`],
    ["f", "forward"],
    ["Esc", "back, exit"]
];

const kbd = { fontFamily: "var(--font-code, monospace)", fontWeight: 700, whiteSpace: "nowrap" } as const;

function ModeHint({ state, matches }: { state: ModeState; matches: number; }) {
    let body: ReactNode;
    if (state.search) {
        body = <>
            Search <kbd style={kbd}>/{state.search.query}▏</kbd>{" "}
            · {state.search.query ? `${matches} match${matches === 1 ? "" : "es"}` : "older first"} · <kbd style={kbd}>Enter</kbd> keep · <kbd style={kbd}>Esc</kbd> back
        </>;
    } else if (state.labels) {
        body = <>Type a label{state.labels.typed ? ` (${state.labels.typed}…)` : ""} · <kbd style={kbd}>Esc</kbd> cancel</>;
    } else {
        const status = [
            state.selected.length ? `${state.selected.length} selected` : "",
            state.count ? `count ${state.count}` : "",
            state.lastSearch ? `/${state.lastSearch}: ${matches} match${matches === 1 ? "" : "es"}` : "",
            state.goal ? "jumping…" : ""
        ].filter(Boolean).join(" · ");
        body = <>
            <div style={{ opacity: 0.7, marginBottom: 2 }}>Message mode{status ? ` · ${status}` : ""}</div>
            <div style={{ display: "flex", flexWrap: "wrap", columnGap: 12, rowGap: 0, fontSize: 12 }}>
                {KEYS.map(([key, what]) => <span key={key} style={{ whiteSpace: "nowrap" }}><kbd style={kbd}>{key}</kbd> {what}</span>)}
            </div>
        </>;
    }
    return <OverlayBox kind="info"><div style={{ whiteSpace: "normal", fontSize: 13 }}>{body}</div></OverlayBox>;
}

interface LabelSpot {
    label: string;
    left: number;
    top: number;
}

/** Vimium-style label badges at the top left of each labelled message; the typed part is dimmed. */
function LabelBadges({ spots, typed }: { spots: LabelSpot[]; typed: string; }) {
    return <>
        {spots.map(({ label, left, top }) => (
            <span key={label} style={{
                position: "fixed", left, top, padding: "0 4px", borderRadius: 3,
                background: "var(--status-warning, #f0b232)", color: "#000", boxShadow: "0 1px 3px rgba(0,0,0,.5)",
                font: "700 12px/16px var(--font-code, monospace)", textTransform: "uppercase"
            }}>
                <span style={{ opacity: 0.4 }}>{typed}</span>{label.slice(typed.length)}
            </span>
        ))}
    </>;
}

/** The cursor's, the selection's and the search's look, as CSS by element id, so it survives Discord re-rendering a message. */
function highlightCss(channelId: string, state: ModeState, matches: readonly string[]) {
    const sel = (id: string) => `#chat-messages-${channelId}-${id}`;
    const rules: string[] = [];
    if (state.search?.query) {
        // Typing a search: everything that doesn't match fades.
        const not = matches.length ? `:not(${matches.map(sel).join(",")})` : "";
        rules.push(`[id^="chat-messages-${channelId}-"]${not}{opacity:.35}`);
    } else if (state.lastSearch && matches.length) {
        rules.push(`${matches.map(sel).join(",")}{background:color-mix(in srgb,var(--status-warning,#f0b232) 14%,transparent)!important}`);
    }
    if (state.selected.length) {
        rules.push(`${state.selected.map(sel).join(",")}{box-shadow:inset 4px 0 0 var(--status-positive,#23a55a)!important;`
            + "background:color-mix(in srgb,var(--status-positive,#23a55a) 12%,transparent)!important}");
    }
    if (state.cursor) {
        rules.push(`${sel(state.cursor)}{outline:2px solid var(--brand-500,#5865f2)!important;outline-offset:-2px;opacity:1!important;`
            + "background-color:var(--background-modifier-selected,rgba(78,80,88,.6))!important}");
    }
    return rules.join("\n");
}

const MODIFIER_KEYS = new Set(["Shift", "Control", "Alt", "Meta", "CapsLock", "AltGraph"]);

const spanOf = (el: Element): Span => {
    const r = el.getBoundingClientRect();
    return { top: r.top, bottom: r.bottom };
};

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

type Scroll = "nearest" | "center" | null;

function enter(win: Window, reply: ActionContext["reply"]) {
    const doc = win.document;
    const found = channelInWindow(doc);
    if (!found) throw new UserError("No messages in this window.");
    const channelId = found;
    const ids = messagesShown(channelId, doc).map(m => m.id);
    if (!ids.length) throw new UserError("No messages in this window.");

    const style = doc.createElement("style");
    style.id = "quick-actions-message-mode-style";
    doc.head.appendChild(style);

    // Our own layer rather than the overlay's hint slot: it sits inside the chat, at whichever edge doesn't cover the
    // cursor, and holds the labels.
    const layer = doc.createElement("div");
    layer.id = "quick-actions-message-mode";
    Object.assign(layer.style, { position: "fixed", inset: "0", zIndex: "100000", pointerEvents: "none" });
    const hintBox = doc.createElement("div");
    Object.assign(hintBox.style, { position: "fixed", transform: "translateX(-50%)" });
    const labelBox = doc.createElement("div");
    layer.append(hintBox, labelBox);
    doc.body.appendChild(layer);
    const hintRoot = createRoot(hintBox);
    const labelRoot = createRoot(labelBox);
    let side: HintSide = "bottom";

    const s: Session = { win, channelId, state: startMode(ids), ids, reply, end };
    session = s;

    // Search text per message, until the messages change.
    const texts = new Map<string, string>();
    const textOf = (id: string) => {
        let t = texts.get(id);
        if (t == null) {
            const m = getMessage(channelId, id);
            texts.set(id, t = m ? messageText(m) : "");
        }
        return t;
    };

    /** Render synchronously, so the hint's height can be measured right after. */
    function renderNow(root: ReturnType<typeof createRoot>, node: ReactNode) {
        try {
            ReactDOM.flushSync(() => root.render(node));
        } catch {
            root.render(node);
        }
    }

    function render(scroll: Scroll) {
        const query = s.state.search?.query ?? s.state.lastSearch;
        const matches = searchMatches(query, s.ids, textOf);
        style.textContent = highlightCss(channelId, s.state, matches);

        const el = s.state.cursor ? messageElement(doc, channelId, s.state.cursor) : null;
        const anyMessage = el ?? (s.ids.length ? messageElement(doc, channelId, s.ids.at(-1)!) : null);
        const scroller = anyMessage ? scrollerOf(anyMessage) : undefined;
        if (!scroller) {
            Object.assign(hintBox.style, { left: "50%", top: "", bottom: `${HINT_GAP * 4}px`, maxWidth: "calc(100vw - 32px)" });
            renderNow(hintRoot, <ModeHint state={s.state} matches={matches.length} />);
            renderNow(labelRoot, null);
            return;
        }
        const box = scroller.getBoundingClientRect();
        const view = { top: box.top, bottom: box.bottom };
        // Width first, so the height measured after rendering is the one it will have.
        Object.assign(hintBox.style, { left: `${box.left + box.width / 2}px`, maxWidth: `${Math.max(240, box.width - 32)}px` });
        renderNow(hintRoot, <ModeHint state={s.state} matches={matches.length} />);
        const height = hintBox.offsetHeight;
        if (scroll && el) {
            const newest = s.state.cursor === s.ids.at(-1) && !MessageStore.getMessages(channelId)?.hasMoreAfter;
            scroller.scrollTop = scrollFor({
                item: spanOf(el),
                view,
                scrollTop: scroller.scrollTop,
                maxScrollTop: scroller.scrollHeight - scroller.clientHeight,
                margin: marginsFor(side, height),
                // The newest message: all the way down, so nothing below it (its reactions, the end of the chat) hides.
                align: scroll === "center" ? "center" : newest ? "bottom" : "nearest"
            });
        }
        side = hintSide(side, el ? spanOf(el) : null, view, height);
        Object.assign(hintBox.style, {
            top: side === "top" ? `${view.top + HINT_GAP}px` : "",
            bottom: side === "bottom" ? `${win.innerHeight - view.bottom + HINT_GAP}px` : ""
        });

        const { labels } = s.state;
        const spots: LabelSpot[] = [];
        if (labels) {
            for (const [label, id] of Object.entries(labels.targets)) {
                if (!label.startsWith(labels.typed)) continue;
                const r = messageElement(doc, channelId, id)?.getBoundingClientRect();
                if (r && r.bottom > view.top && r.top < view.bottom) spots.push({ label, left: r.left + 4, top: Math.max(view.top, r.top) + 2 });
            }
        }
        renderNow(labelRoot, spots.length ? <LabelBadges spots={spots} typed={labels!.typed} /> : null);
    }

    /** Ids of the messages at least partly on screen in the chat, oldest first. */
    function visibleIds(): string[] {
        const any = s.ids.length ? messageElement(doc, channelId, s.ids.at(-1)!) : null;
        const scroller = any ? scrollerOf(any) : undefined;
        if (!scroller) return [];
        const items = s.ids.flatMap(id => {
            const el = messageElement(doc, channelId, id);
            return el ? [{ id, span: spanOf(el) }] : [];
        });
        return onScreen(items, spanOf(scroller));
    }

    /** Re-read the shown messages; false (and the mode ends) when the window no longer shows the channel. */
    function refresh(): boolean {
        const now = messagesShown(channelId, doc).map(m => m.id);
        if (!now.length) {
            end();
            return false;
        }
        texts.clear();
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
        // A Discord dialog (the pin or delete confirm `p`/`d` opened) takes the keys until it closes.
        if (isModalOpen()) return;
        // Swallowed, so letters don't land in the composer.
        e.preventDefault();
        e.stopPropagation();
        if (e.repeat && !acceptsRepeat(s.state, e.key)) return;
        if (!refresh()) return;
        const before = s.state.cursor;
        const { state, command } = pressKey(s.state, e.key, s.ids, textOf);
        s.state = state;
        let scroll: Scroll = state.cursor !== before ? "nearest" : null;
        if (command) scroll = run(command) ?? scroll;
        if (session === s) render(scroll);
    }

    /** Carry out a command; returns how to scroll when it moved or centred the cursor. */
    function run(command: ModeCommand): Scroll {
        const say = (text: string, kind?: OverlayKind) => s.reply(text, kind);
        const message = (id: string) => {
            const msg = getMessage(channelId, id);
            if (!msg) throw new UserError("That message is gone.");
            return msg;
        };
        const messages = (ids: string[]) => {
            const msgs = ids.map(id => getMessage(channelId, id)).filter(m => m != null);
            if (!msgs.length) throw new UserError(ids.length > 1 ? "Those messages are gone." : "That message is gone.");
            return msgs;
        };
        const failed = (e: unknown) => {
            if (!(e instanceof UserError)) logger.error(`message mode ${command.type} failed`, e);
            say(e instanceof Error ? e.message : String(e), "error");
        };
        try {
            switch (command.type) {
                case "exit":
                    end();
                    return null;
                case "full":
                    say(`At most ${MAX_SELECTED} messages per forward.`, "error");
                    return null;
                case "notFound":
                    say(command.query ? `No match for "${command.query}".` : "No search yet: / starts one.", "error");
                    return null;
                case "center":
                    return "center";
                case "labels":
                    s.state = showLabels(s.state, visibleIds());
                    return null;
                // Discord's UI takes the keys from here on: the composer, the picker, the inline editor, the thread.
                // The mode ends once that worked, so a refusal (not yours to edit, say) leaves it on.
                case "reply":
                    replyTo(message(command.id), command.mention);
                    end();
                    return null;
                case "react":
                    openReactionPicker(message(command.id), doc);
                    end();
                    return null;
                case "edit":
                    editMessage(message(command.id));
                    end();
                    return null;
                case "thread":
                    openThread(message(command.id));
                    end();
                    return null;
                // Discord's confirm dialog: keys pass to it while it's open (onKey), the mode stays.
                case "pin":
                    togglePin(message(command.id));
                    return null;
                case "delete":
                    deleteMessage(message(command.id));
                    return null;
                case "parent": {
                    const msg = message(command.id);
                    const ref = repliedTo(msg);
                    if (ref.channelId === channelId && s.ids.includes(ref.messageId)) {
                        s.state = moveTo(s.state, ref.messageId, s.ids);
                        return "nearest";
                    }
                    if (ref.channelId !== channelId) end();
                    else s.state = setGoal(s.state, ref.messageId);
                    // Discord loads around it and scrolls there; the cursor follows once it's shown (rebase).
                    jumpToMessage(ref.channelId, ref.messageId, msg.id);
                    return null;
                }
                case "copy":
                    copyText(messages(command.ids), win).then(
                        n => say(n > 1 ? `Copied the text of ${n} messages.` : "Copied the text.", "success"), failed);
                    return null;
                case "link": {
                    const msgs = messages(command.ids);
                    copyLinks(msgs, win).then(() => say(msgs.length > 1 ? `Copied ${msgs.length} links.` : "Copied the link.", "success"), failed);
                    return null;
                }
                case "forward": {
                    const msgs = messages(command.ids);
                    end();
                    forwardMessages(msgs, say);
                    return null;
                }
            }
        } catch (e) {
            failed(e);
        }
        return null;
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
    // Scrolling or resizing moves the labels and the hint with it.
    let frame = 0;
    function redraw() {
        if (frame) return;
        frame = win.requestAnimationFrame(() => {
            frame = 0;
            if (session === s && refresh()) render(null);
        });
    }
    function onScroll() {
        if (s.state.labels) redraw();
    }

    function end() {
        if (session !== s) return;
        session = undefined;
        win.removeEventListener("keydown", onKey, true);
        win.removeEventListener("blur", onBlur, true);
        win.removeEventListener("resize", redraw);
        doc.removeEventListener("scroll", onScroll, true);
        SelectedChannelStore.removeChangeListener(onChannel);
        MessageStore.removeChangeListener(redraw);
        if (frame) win.cancelAnimationFrame(frame);
        style.remove();
        try {
            hintRoot.unmount();
            labelRoot.unmount();
        } catch { /* its window is gone */ }
        layer.remove();
    }

    win.addEventListener("keydown", onKey, true);
    win.addEventListener("blur", onBlur, true);
    win.addEventListener("resize", redraw);
    // Element scrolls don't bubble, but they reach a capturing listener on the document.
    doc.addEventListener("scroll", onScroll, { capture: true, passive: true });
    SelectedChannelStore.addChangeListener(onChannel);
    MessageStore.addChangeListener(redraw);
    render("nearest");
}

export default defineAction({
    id: "messagemode",
    description: "Pick messages in the channel with the keyboard (j/k, search, labels) to reply, react, copy, pin, edit, delete or forward; Esc exits",
    run({ win = window, reply }) {
        // Pressed again: leave (and in another window, start there instead).
        const wasHere = session?.win === win;
        stopMessageMode();
        if (!wasHere) enter(win, reply);
    }
});
