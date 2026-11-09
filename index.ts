/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 hefker and Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { ApplicationCommandInputType, ApplicationCommandOptionType, sendBotMessage } from "@api/Commands";
import { definePluginSettings } from "@api/Settings";
import { Logger } from "@utils/Logger";
import definePlugin, { OptionType } from "@utils/types";
import { CommandOption } from "@vencord/discord-types";
import { RelationshipStore, UserStore } from "@webpack/common";

import { actions } from "./actions";
import { type BindingEngine, createBindingEngine, type Effect, type KeyInput, type Step } from "./lib/bindings";
import { disposeOverlays, overlay, OverlayKind } from "./lib/overlay";
import { PresetsMissing } from "./lib/presets";
import { decodeStreamKey, isPoppedOut, popOut, StreamError } from "./lib/streams";
import { attachToWindows } from "./lib/windows";
import type { Action, ActionArg, ActionContext } from "./registry";

const logger = new Logger("VcActions");
const byId = new Map(actions.map(a => [a.id, a]));

const defaultHotkeys = actions.filter(a => a.defaultHotkey).map(a => `${a.defaultHotkey} = ${a.id}`).join("\n");

const settings = definePluginSettings({
    hotkeys: {
        type: OptionType.STRING,
        multiline: true,
        description: "In-app hotkeys (Vesktop focused), one per line: `combo = action args`. "
            + `Actions: ${actions.map(a => a.id).join(", ")}. Example: ctrl+alt+p = popout, ctrl+alt+1 = stream Gaming. # starts a comment.`,
        placeholder: "ctrl+alt+p = popout\nctrl+alt+1 = stream Gaming\nctrl+alt+0 = stopstream",
        default: defaultHotkeys,
        onChange: () => reloadBindings(true)
    },
    autoPopout: {
        type: OptionType.BOOLEAN,
        description: "Pop out a friend's stream as soon as you start watching it",
        default: false
    }
});

/** Binding feedback goes to our overlay in the window the key was pressed in (ADR 0001). */
const overlayReply = (doc: Document) => (text: string, kind: OverlayKind = "info") => overlay(doc).show(text, { kind });

async function runAction(action: Action, ctx: ActionContext) {
    try {
        await action.run(ctx);
    } catch (e) {
        // Known failures (missing VcPresets, no stream) get their message; anything else gets logged too.
        if (!(e instanceof PresetsMissing || e instanceof StreamError)) logger.error(`action ${action.id} failed`, e);
        ctx.reply(e instanceof Error ? e.message : String(e), "error");
    }
}

function toOption(arg: ActionArg): CommandOption {
    const opt: CommandOption = {
        name: arg.name,
        description: arg.description,
        type: arg.type === "user" ? ApplicationCommandOptionType.USER : ApplicationCommandOptionType.STRING,
        required: arg.required
    };
    const { choices } = arg;
    if (choices) {
        // A getter, so the list Discord shows is read each time rather than frozen at startup.
        // Empty (VcPresets missing) means free text, so the command still runs and explains why.
        Object.defineProperty(opt, "choices", {
            enumerable: true,
            configurable: true,
            get: () => {
                const list = choices();
                return list.length ? list.map(c => ({ name: c, displayName: c, label: c, value: c })) : undefined;
            }
        });
    }
    return opt;
}

const commands = actions.filter(a => a.command).map(a => ({
    name: a.command!,
    description: a.description,
    inputType: ApplicationCommandInputType.BUILT_IN,
    options: (a.args ?? []).map(toOption),
    execute: (opts: { name: string; value: string; }[], { channel }: { channel: { id: string; }; }) => {
        const args = Object.fromEntries((a.args ?? []).map(arg => [arg.name, opts.find(o => o.name === arg.name)?.value]));
        return runAction(a, {
            args,
            source: "command",
            reply: text => sendBotMessage(channel.id, { content: text })
        });
    }
}));

const actionMeta = actions.map(a => ({ id: a.id, args: (a.args ?? []).map(arg => arg.name) }));
let engine: BindingEngine | null = null;
let detachWindows: (() => void) | undefined;

function reloadBindings(announce = false) {
    engine = createBindingEngine(settings.store.hotkeys ?? "", actionMeta);
    const errors = engine.problems.map(p => `line ${p.line}: ${p.message}`);
    if (errors.length) {
        logger.warn("hotkeys setting:", errors);
        if (announce) overlay().show(`VcActions hotkeys: ${errors[0]}`, { kind: "error" });
    }
}

async function runSteps(steps: Step[], win: Window) {
    const reply = overlayReply(win.document);
    for (const step of steps) {
        await runAction(byId.get(step.actionId)!, { args: step.args, source: "hotkey", reply });
    }
}

function toKeyInput(e: KeyboardEvent): KeyInput {
    const t = e.target as HTMLElement | null;
    return {
        type: e.type === "keyup" ? "keyup" : "keydown",
        key: e.key,
        code: e.code,
        ctrl: e.ctrlKey,
        alt: e.altKey,
        shift: e.shiftKey,
        meta: e.metaKey,
        repeat: e.repeat,
        inTextField: !!t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))
    };
}

function apply(effects: Effect[], e: Event, win: Window) {
    for (const effect of effects) {
        switch (effect.type) {
            case "run":
                runSteps(effect.steps, win);
                break;
            case "swallow":
                e.preventDefault();
                e.stopPropagation();
                break;
        }
    }
}

function onKey(e: KeyboardEvent, win: Window) {
    if (engine) apply(engine.feed(toKeyInput(e)), e, win);
}

function onBlur(e: FocusEvent, win: Window) {
    // Only the window itself losing focus; blur from inner elements doesn't bubble but is seen in capture.
    if (engine && e.target === win) apply(engine.feed({ type: "blur" }), e, win);
}

export default definePlugin({
    name: "VcActions",
    description: "Slash commands and in-app hotkeys for voice/streaming: stream presets (via VcPresets), pop out a stream, and more",
    authors: [{ name: "hefker", id: 0n }],
    dependencies: ["CommandsAPI"],
    settings,
    commands,

    flux: {
        STREAM_WATCH({ streamKey }: { streamKey: string; }) {
            if (!settings.store.autoPopout) return;
            const s = decodeStreamKey(streamKey);
            if (!s || s.ownerId === UserStore.getCurrentUser()?.id || !RelationshipStore.isFriend(s.ownerId)) return;
            // Let the watch land and the tile appear before popping it out.
            setTimeout(() => {
                if (!isPoppedOut(s)) popOut(s);
            }, 750);
        }
    },

    start() {
        reloadBindings();
        detachWindows = attachToWindows({ keydown: onKey, keyup: onKey, blur: onBlur });
    },

    stop() {
        detachWindows?.();
        detachWindows = undefined;
        disposeOverlays();
        engine = null;
    }
});
