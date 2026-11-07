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
import { Binding, matches, parseBindings, splitArgs } from "./lib/hotkeys";
import { PresetsMissing } from "./lib/presets";
import { decodeStreamKey, isPoppedOut, popOut, StreamError } from "./lib/streams";
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

const toastVariant = { info: "default", success: "success", error: "critical" } as const;

function toastReply(text: string, kind: "info" | "success" | "error" = "info") {
    showToast({ text, variant: toastVariant[kind], duration: kind === "error" ? 5000 : 2500 });
}

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

let bindings: Binding[] = [];

function reloadBindings(announce = false) {
    const { bindings: b, errors } = parseBindings(settings.store.hotkeys ?? "", new Set(byId.keys()));
    bindings = b;
    if (errors.length) {
        logger.warn("hotkeys setting:", errors);
        if (announce) toastReply(`VcActions hotkeys: ${errors[0]}`, "error");
    }
}

function onKeyDown(e: KeyboardEvent) {
    if (e.repeat || !bindings.length) return;
    const hit = bindings.find(b => matches(b.combo, e));
    if (!hit) return;
    // A bare key (no ctrl/alt/meta) shouldn't fire while typing.
    const bare = !hit.combo.ctrl && !hit.combo.alt && !hit.combo.meta;
    const t = e.target as HTMLElement | null;
    if (bare && t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;

    e.preventDefault();
    e.stopPropagation();
    const action = byId.get(hit.actionId)!;
    const names = (action.args ?? []).map(a => a.name);
    runAction(action, { args: splitArgs(hit.rest, names), source: "hotkey", reply: toastReply });
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
        document.addEventListener("keydown", onKeyDown, true);
    },

    stop() {
        document.removeEventListener("keydown", onKeyDown, true);
        bindings = [];
    }
});
