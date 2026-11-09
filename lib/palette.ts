/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 hefker and Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/** The `palette`'s entries and fuzzy ranking. Pure, so it's unit tested; actions/palette.tsx draws it. */

import type { BindingInfo } from "./cheatsheet";

/** One choice for an arg: shown as `label`, written into the step as `value` (a user's id, a preset's name). */
export interface PaletteChoice {
    label: string;
    value: string;
}

/** What the palette needs to know about an action: its args in order, with their choices read just now. */
export interface PaletteAction {
    id: string;
    description?: string;
    /** `choices` absent or empty: the arg takes free text. */
    args: { name: string; choices?: readonly PaletteChoice[]; }[];
}

export interface PaletteEntry {
    /** What's shown and matched. */
    label: string;
    /** The step(s) it runs, in binding syntax. */
    text: string;
    /** Bindings only: the trigger, shown beside it and matched too. */
    trigger?: string;
    description?: string;
    /** Takes free text typed after it, appended to `text` (args without choices). */
    open: boolean;
}

/** Your bindings first (with their triggers), then every action × its first arg's choices. */
export function buildEntries(bindings: readonly BindingInfo[], actions: readonly PaletteAction[]): PaletteEntry[] {
    const out: PaletteEntry[] = bindings.map(b => {
        const text = b.steps.join("; ");
        return { label: text, text, trigger: b.trigger, open: false };
    });
    for (const { id, description, args } of actions) {
        const [first, ...rest] = args;
        if (!first) {
            out.push({ label: id, text: id, description, open: false });
        } else if (!first.choices?.length) {
            out.push({ label: id, text: id, description, open: true });
        } else {
            for (const c of first.choices) {
                out.push({ label: `${id} ${c.label}`, text: `${id} ${c.value}`, description, open: rest.length > 0 });
            }
        }
    }
    return out;
}
