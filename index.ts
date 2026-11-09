/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 hefker and Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { ApplicationCommandInputType, ApplicationCommandOptionType, sendBotMessage } from "@api/Commands";
import { definePluginSettings, migratePluginSettings } from "@api/Settings";
import definePlugin, { OptionType } from "@utils/types";
import { CommandOption } from "@vencord/discord-types";
import { React, RelationshipStore } from "@webpack/common";

import { actions } from "./actions";
import { type BindingEngine, createBindingEngine, type Effect, type KeyInput, type Step } from "./lib/bindings";
import { logger, myId } from "./lib/discord";
import { UserError } from "./lib/errors";
import { watchEvents } from "./lib/events";
import { loadFavorites } from "./lib/favoriteGuilds";
import { WhichKeyHint } from "./lib/hint";
import { createHookGuard, type HookEvent } from "./lib/hooks";
import { disposeOverlays, overlay, OverlayKind } from "./lib/overlay";
import { decodeStreamKey, isPoppedOut, popOut } from "./lib/streams";
import { startStreamDnd, stopStreamDnd } from "./lib/status";
import { resolveUserArgs } from "./lib/users";
import { startVoiceTracking, stopVoiceTracking } from "./lib/voice";
import { attachToWindows } from "./lib/windows";
import type { Action, ActionArg, ActionContext, Release } from "./registry";

// Was VcActions until it grew past voice (ADR 0003): carry over saved bindings and the enabled flag.
migratePluginSettings("QuickActions", "VcActions");

const byId = new Map(actions.map(a => [a.id, a]));

const settings = definePluginSettings({
    hotkeys: {
        type: OptionType.STRING,
        multiline: true,
        description: "In-app bindings (Vesktop focused), one per line: `[hold] trigger = step; step`. A trigger is a combo (`ctrl+alt+p`) or a sequence of space-separated combos (`ctrl+space p a`); a step is `action args`; `hold` (one combo, one step) undoes the action on release. "
            + "`on event = step; step` runs steps when an event fires (vcjoin, vcleave, streamstart, streamstop, watchstart, watchstop, muted, unmuted). "
            + `Actions: ${actions.map(a => a.id).join(", ")}. Example: ctrl+alt+g = stream Gaming; popout. # starts a comment.`,
        placeholder: "ctrl+alt+p = popout\nctrl+alt+1 = stream Gaming\nctrl+alt+0 = stopstream",
        // No bindings by default (AGENTS.md).
        default: "",
        // Settings can change while the plugin is stopped; then there's nothing to reload.
        onChange: () => {
            if (running) reloadBindings(ANNOUNCE_DELAY);
        }
    },
    autoPopout: {
        type: OptionType.BOOLEAN,
        description: "Pop out a friend's stream as soon as you start watching it",
        default: false
    },
    dndWhileStreaming: {
        type: OptionType.BOOLEAN,
        description: "Set Do Not Disturb while you stream; the previous status comes back when it ends, unless you changed it meanwhile",
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
        // Expected failures (missing VcPresets, no stream, unknown name) get their message; anything else gets logged too.
        if (!(e instanceof UserError)) logger.error(`action ${action.id} failed`, e);
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
let running = false;
let detachWindows: (() => void) | undefined;

/** Typing in the setting reloads on every keystroke; problems wait this long after the last one. */
const ANNOUNCE_DELAY = 1500;
let announceTimer: ReturnType<typeof setTimeout> | undefined;
/** The problems last shown, so the same set isn't shown again. */
let announced = "";

/** Load the setting now; show its problems after `delay` ms, once per change of the problems found. */
function reloadBindings(delay = 0) {
    endHint();
    // The new engine doesn't know the old one's holds, so their keyup would never release them: let go now.
    for (const trigger of [...holds.keys()]) release(trigger);
    engine = createBindingEngine(settings.store.hotkeys ?? "", actionMeta);
    // Only listen while some hook wants an event; resubscribing also rereads the state events are diffed against.
    stopEvents?.();
    stopEvents = engine.hooks.length ? watchEvents(onEvent) : undefined;
    const { problems } = engine;
    clearTimeout(announceTimer);
    announceTimer = setTimeout(() => {
        const lines = problems.map(p => `line ${p.line} ${p.severity}: ${p.message}`);
        const text = lines.join("; ");
        if (text === announced) return;
        announced = text;
        if (!lines.length) return;
        logger.warn("hotkeys setting:", lines);
        // Errors skip their line; warnings are still bound.
        overlay().show(`QuickActions hotkeys: ${text}`, { kind: problems.some(p => p.severity === "error") ? "error" : "info" });
    }, delay);
}

/**
 * Run a binding's steps in order, each waiting for the last; the first failure stops the rest and names its step.
 * `label` goes before errors (which hook failed).
 */
async function runSteps(steps: Step[], win: Window, source: "hotkey" | "auto" = "hotkey", label = "") {
    const reply = overlayReply(win.document);
    for (const [i, step] of steps.entries()) {
        const prefix = label + (steps.length > 1 ? `step ${i + 1} (${step.text}) failed: ` : "");
        const ctx: ActionContext = {
            args: step.args, source, reply, win, bindings: engine?.bindings, hooks: engine?.hooks, actions, runSteps: text => runText(text, win)
        };
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

/** Run step text (from the palette) in `win` like a binding's steps. */
async function runText(text: string, win: Window) {
    const steps = engine?.parseSteps(text);
    if (!steps) return;
    if (typeof steps === "string") overlayReply(win.document)(steps, "error");
    else await runSteps(steps, win);
}

/** Hooks set off by hooks go at most this deep (`on muted = unmute` + `on unmuted = mute` would loop). */
const MAX_HOOK_DEPTH = 4;
/** An event this long after a hook's steps finished still counts as caused by it. */
const HOOK_SETTLE = 1000;
let hookGuard = createHookGuard(MAX_HOOK_DEPTH, HOOK_SETTLE);
let stopEvents: (() => void) | undefined;

/** An event fired: run its hook in the main window (`source` "auto"), errors in the main window's overlay. */
function onEvent(event: HookEvent) {
    const steps = engine?.hookSteps(event);
    if (!steps) return;
    const run = hookGuard.start(Date.now());
    if (!run) {
        logger.warn(`on ${event}: skipped, hooks set each other off more than ${MAX_HOOK_DEPTH} deep`);
        overlayReply(document)(`on ${event} skipped: hooks set each other off more than ${MAX_HOOK_DEPTH} deep (a loop?)`, "error");
        return;
    }
    // Events come from store change listeners, inside Discord's dispatch: let it finish before a step dispatches.
    setTimeout(() => {
        runSteps(steps, window, "auto", `on ${event}: `).finally(() => run.done(Date.now()));
    });
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
                hideHint = overlay(win.document, "hint").show(React.createElement(WhichKeyHint, { keys: effect.keys, next: effect.next }), { duration: null });
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
    name: "QuickActions",
    description: "Slash commands, in-app hotkeys and a palette for Discord actions: voice and streaming (stream presets via VcPresets, pop-outs), favorite servers, Vencord settings and more",
    authors: [{ name: "hefker", id: 334442905567756288n }],
    dependencies: ["CommandsAPI", "UserSettingsAPI"],
    settings,
    commands,

    flux: {
        STREAM_WATCH({ streamKey }: { streamKey: string; }) {
            if (!settings.store.autoPopout) return;
            const s = decodeStreamKey(streamKey);
            if (!s || s.ownerId === myId() || !RelationshipStore.isFriend(s.ownerId)) return;
            // Let the watch land and the tile appear before popping it out.
            setTimeout(() => {
                if (!isPoppedOut(s)) popOut(s);
            }, 750);
        }
    },

    start() {
        running = true;
        reloadBindings();
        startVoiceTracking();
        loadFavorites();
        startStreamDnd(() => !!settings.store.dndWhileStreaming);
        detachWindows = attachToWindows({ keydown: onKey, keyup: onKey, blur: onBlur });
    },

    stop() {
        running = false;
        detachWindows?.();
        detachWindows = undefined;
        hideHint = undefined;
        clearTimeout(announceTimer);
        announced = "";
        stopEvents?.();
        stopEvents = undefined;
        hookGuard = createHookGuard(MAX_HOOK_DEPTH, HOOK_SETTLE);
        stopVoiceTracking();
        stopStreamDnd();
        for (const trigger of [...holds.keys()]) release(trigger);
        disposeOverlays();
        engine = null;
    }
});
