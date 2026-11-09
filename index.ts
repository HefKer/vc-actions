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
import { RelationshipStore, showToast, UserStore } from "@webpack/common";

import { actions } from "./actions";
import { type BindingEngine, createBindingEngine, type Effect, type KeyInput, type Step } from "./lib/bindings";
import { PresetsMissing } from "./lib/presets";
import { decodeStreamKey, isPoppedOut, popOut, StreamError } from "./lib/streams";
import type { Action, ActionArg, ActionContext, Release } from "./registry";

const logger = new Logger("VcActions");
const byId = new Map(actions.map(a => [a.id, a]));

const defaultHotkeys = actions.filter(a => a.defaultHotkey).map(a => `${a.defaultHotkey} = ${a.id}`).join("\n");

const settings = definePluginSettings({
    hotkeys: {
        type: OptionType.STRING,
        multiline: true,
        description: "In-app hotkeys (Vesktop focused), one per line: `combo = action args`, or `hold combo = action` to undo it on release. "
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

const toastVariant = { info: "default", success: "success", error: "critical" } as const;

function toastReply(text: string, kind: "info" | "success" | "error" = "info") {
    showToast({ text, variant: toastVariant[kind], duration: kind === "error" ? 5000 : 2500 });
}

/** Runs an action, reporting failures through ctx.reply; resolves to its release callback if it returned one. */
async function runAction(action: Action, ctx: ActionContext): Promise<Release | void> {
    try {
        return await action.run(ctx);
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

function reloadBindings(announce = false) {
    engine = createBindingEngine(settings.store.hotkeys ?? "", actionMeta);
    const errors = engine.problems.map(p => `line ${p.line}: ${p.message}`);
    if (errors.length) {
        logger.warn("hotkeys setting:", errors);
        if (announce) toastReply(`VcActions hotkeys: ${errors[0]}`, "error");
    }
}

async function runSteps(steps: Step[]) {
    for (const step of steps) {
        await runAction(byId.get(step.actionId)!, { args: step.args, source: "hotkey", reply: toastReply });
    }
}

/** Active holds by trigger: the running step, resolving to its release callback. */
const holds = new Map<string, Promise<Release | void>>();

function hold(trigger: string, step: Step) {
    holds.set(trigger, runAction(byId.get(step.actionId)!, { args: step.args, source: "hotkey", reply: toastReply }));
}

/** Calls a hold's release once its step has finished (a quick tap may let go before the step resolves). */
async function release(trigger: string) {
    const pending = holds.get(trigger);
    holds.delete(trigger);
    try {
        await (await pending)?.();
    } catch (e) {
        logger.error(`releasing ${trigger} failed`, e);
        toastReply(`Release of ${trigger} failed: ${e instanceof Error ? e.message : String(e)}`, "error");
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

function apply(effects: Effect[], e: Event) {
    for (const effect of effects) {
        switch (effect.type) {
            case "run":
                runSteps(effect.steps);
                break;
            case "hold":
                hold(effect.trigger, effect.step);
                break;
            case "release":
                release(effect.trigger);
                break;
            case "swallow":
                e.preventDefault();
                e.stopPropagation();
                break;
        }
    }
}

function onKey(e: KeyboardEvent) {
    if (engine) apply(engine.feed(toKeyInput(e)), e);
}

function onBlur(e: FocusEvent) {
    if (engine) apply(engine.feed({ type: "blur" }), e);
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
        // Capture phase, so Discord's own handlers don't swallow the combo first.
        document.addEventListener("keydown", onKey, true);
        document.addEventListener("keyup", onKey, true);
        window.addEventListener("blur", onBlur);
    },

    stop() {
        document.removeEventListener("keydown", onKey, true);
        document.removeEventListener("keyup", onKey, true);
        window.removeEventListener("blur", onBlur);
        for (const trigger of [...holds.keys()]) release(trigger);
        engine = null;
    }
});
