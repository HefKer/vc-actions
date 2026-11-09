/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 hefker and Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import type { BindingInfo } from "./lib/cheatsheet";

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
    /** Report back: a bot message in the channel for commands, our overlay in the pressed-in window for bindings. */
    reply(text: string, kind?: "info" | "success" | "error"): void;
    /** Bindings only: the window the key was pressed in, pop-outs included. */
    win?: Window;
    /** Bindings only: the bindings currently loaded, as written. */
    bindings?: readonly BindingInfo[];
    /** Bindings only: every action, for the palette. */
    actions?: readonly Action[];
    /** Bindings only: run step text (`;` between steps) in `win` as a binding would, for the palette. */
    runSteps?(text: string): Promise<void>;
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
