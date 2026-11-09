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
import { React, RelationshipStore, UserStore } from "@webpack/common";

import { actions } from "./actions";
import { type BindingEngine, createBindingEngine, type Effect, type KeyInput, type Step } from "./lib/bindings";
import { WhichKeyHint } from "./lib/hint";
import { disposeOverlays, overlay, OverlayKind } from "./lib/overlay";
import { PresetsMissing } from "./lib/presets";
import { ResolveError } from "./lib/resolve";
import { decodeStreamKey, isPoppedOut, popOut, StreamError } from "./lib/streams";
import { resolveUserArgs } from "./lib/users";
import { startVoiceTracking, stopVoiceTracking } from "./lib/voice";
import { attachToWindows } from "./lib/windows";
import type { Action, ActionArg, ActionContext, Release } from "./registry";

const logger = new Logger("VcActions");
const byId = new Map(actions.map(a => [a.id, a]));

const defaultHotkeys = actions.filter(a => a.defaultHotkey).map(a => `${a.defaultHotkey} = ${a.id}`).join("\n");

const settings = definePluginSettings({
    hotkeys: {
        type: OptionType.STRING,
        multiline: true,
        description: "In-app hotkeys (Vesktop focused), one per line: `combo = action args`, `;` between steps, a sequence as space-separated combos (`ctrl+space p a = popout alice`), `hold combo = action` to undo it on release. "
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

/**
 * Run an action, replying with its error; `prefix` goes before any error. Resolves to whether it succeeded
 * (a throw or an error reply both count as failure) and, for a holdable action, the release it returned.
 */
async function runAction(action: Action, ctx: ActionContext, prefix = ""): Promise<{ ok: boolean; release?: Release; }> {
    let failed = false;
    const reply: ActionContext["reply"] = (text, kind) => {
        if (kind === "error") { failed = true; text = prefix + text; }
        ctx.reply(text, kind);
    };
    try {
        // User args may be names in bindings; slash commands' pickers already give ids, which pass through.
        const release = await action.run({ ...ctx, args: resolveUserArgs(action, ctx.args), reply }) ?? undefined;
        return failed ? { ok: false, release } : { ok: true, release };
    } catch (e) {
        // Known failures (missing VcPresets, no stream, unknown name) get their message; anything else gets logged too.
        if (!(e instanceof PresetsMissing || e instanceof StreamError || e instanceof ResolveError)) logger.error(`action ${action.id} failed`, e);
        ctx.reply(prefix + (e instanceof Error ? e.message : String(e)), "error");
        return { ok: false };
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
    execute: async (opts: { name: string; value: string; }[], { channel }: { channel: { id: string; }; }) => {
        const args = Object.fromEntries((a.args ?? []).map(arg => [arg.name, opts.find(o => o.name === arg.name)?.value]));
        // A slash command has no key to let go of, so a release is dropped.
        await runAction(a, {
            args,
            source: "command",
            reply: text => sendBotMessage(channel.id, { content: text })
        });
    }
}));

const actionMeta = actions.map(a => ({ id: a.id, args: (a.args ?? []).map(arg => arg.name), holdable: a.holdable }));
let engine: BindingEngine | null = null;
let detachWindows: (() => void) | undefined;

function reloadBindings(announce = false) {
    endHint();
    engine =createBindingEngine(settings.store.hotkeys ?? "", actionMeta);
    const { problems } = engine;
    if (!problems.length) return;
    const lines = problems.map(p => `line ${p.line} ${p.severity}: ${p.message}`);
    logger.warn("hotkeys setting:", lines);
    // Once per settings change, not per keypress. Errors skip their line; warnings are still bound.
    if (announce) overlay().show(`VcActions hotkeys: ${lines.join("; ")}`, { kind: problems.some(p => p.severity === "error") ? "error" : "info" });
}

/** Run a binding's steps in order, each waiting for the last; the first failure stops the rest and names its step. */
async function runSteps(steps: Step[], win: Window) {
    const reply = overlayReply(win.document);
    for (const [i, step] of steps.entries()) {
        const prefix = steps.length > 1 ? `step ${i + 1} (${step.text}) failed: ` : "";
        const ctx: ActionContext = { args: step.args, source: "hotkey", reply, win, bindings: engine?.bindings };
        if (!(await runAction(byId.get(step.actionId)!, ctx, prefix)).ok) return;
    }
}

/** Active holds by trigger: the running step, resolving to its release (none if it failed). */
const holds = new Map<string, Promise<Release | undefined>>();

function hold(trigger: string, step: Step, win: Window) {
    const ctx: ActionContext = { args: step.args, source: "hotkey", reply: overlayReply(win.document), win, bindings: engine?.bindings };
    holds.set(trigger, runAction(byId.get(step.actionId)!, ctx).then(r => r.release));
}

/** Call a hold's release once its step has finished (a quick tap can let go before it resolves). */
async function release(trigger: string, win?: Window) {
    const pending = holds.get(trigger);
    holds.delete(trigger);
    try {
        await (await pending)?.();
    } catch (e) {
        logger.error(`releasing ${trigger} failed`, e);
        if (win) overlayReply(win.document)(`release of ${trigger} failed: ${e instanceof Error ? e.message : String(e)}`, "error");
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

/** Hides the which-key hint, in whichever window it was drawn. */
let hideHint: (() => void) | undefined;

function endHint() {
    hideHint?.();
    hideHint = undefined;
}

function apply(effects: Effect[], e: Event, win: Window) {
    for (const effect of effects) {
        switch (effect.type) {
            case "run":
                endHint();
                runSteps(effect.steps, win);
                break;
            case "hint":
                endHint();
                // No timeout: it stays until the sequence runs or is cancelled (#15 story 8).
                hideHint = overlay(win.document).show(React.createElement(WhichKeyHint, { keys: effect.keys, next: effect.next }), { duration: null });
                break;
            case "cancel":
                endHint();
                break;
            case "hold":
                hold(effect.trigger, effect.step, win);
                break;
            case "release":
                release(effect.trigger, win);
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
        startVoiceTracking();
        detachWindows = attachToWindows({ keydown: onKey, keyup: onKey, blur: onBlur });
    },

    stop() {
        detachWindows?.();
        detachWindows = undefined;
        hideHint = undefined;
        stopVoiceTracking();
        for (const trigger of [...holds.keys()]) release(trigger);
        disposeOverlays();
        engine = null;
    }
});
