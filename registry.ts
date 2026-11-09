/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 hefker and Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/** One argument of an action: a slash-command option, or a word after the action id in a hotkey line. */
export interface ActionArg {
    name: string;
    description: string;
    /** "user" becomes a user picker in the slash command; bindings give an id or a name, resolved to an id before run (lib/users.ts). */
    type: "string" | "user";
    required?: boolean;
    /** Values offered while typing the slash command; read every time the option is shown. */
    choices?: () => string[];
}

export interface ActionContext {
    /** Argument values by name; missing ones are undefined. */
    args: Record<string, string | undefined>;
    source: "command" | "hotkey" | "auto";
    /** Report back: a bot message in the channel for commands, a toast otherwise. */
    reply(text: string, kind?: "info" | "success" | "error"): void;
}

export interface Action {
    /** Used in hotkey lines (`ctrl+alt+p = popout`). Lowercase, no spaces. */
    id: string;
    description: string;
    args?: ActionArg[];
    /** Slash command name; omit for a hotkey-only action. */
    command?: string;
    /** Hotkey line suggested in the settings default, e.g. "ctrl+alt+p". Keep clear of Discord's own binds. */
    defaultHotkey?: string;
    run(ctx: ActionContext): void | Promise<void>;
}

export const defineAction = (a: Action) => a;
