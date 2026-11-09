/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 hefker and Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { buildEntries, type PaletteAction, type PaletteChoice } from "../lib/palette";
import { openPicker } from "../lib/picker";
import { participantChoices } from "../lib/users";
import { type Action, defineAction } from "../registry";

/** Each action with its args' choices read now; user args without choices offer the people in your voice channel. */
function paletteActions(actions: readonly Action[]): PaletteAction[] {
    const read = (f: () => PaletteChoice[]) => {
        try {
            return f();
        } catch {
            return [];
        }
    };
    return actions.filter(a => !a.hideInPalette).map(a => ({
        id: a.id,
        description: a.description,
        args: (a.args ?? []).map(arg => ({
            name: arg.name,
            choices: arg.choices
                ? read(() => arg.choices!().map(c => ({ label: c, value: c })))
                : arg.type === "user" ? read(participantChoices) : undefined
        }))
    }));
}

export default defineAction({
    id: "palette",
    hideInPalette: true,
    description: "Fuzzy-find and run any binding or action × choice, in the window you're in",
    async run({ win = window, bindings = [], actions = [], runSteps, reply }) {
        if (!runSteps) return reply("The palette only opens from a binding.", "error");
        await openPicker({
            win,
            entries: buildEntries(bindings, paletteActions(actions)),
            usage: "palette",
            placeholder: "Run a binding or action…",
            enter: "runs",
            complete: true,
            pick: m => { runSteps(m.text); }
        });
    }
});
