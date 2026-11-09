/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 hefker and Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { defineAction } from "../registry";

export default defineAction({
    id: "repeat",
    // From the palette it would only reopen the palette: the binding that opened it is the last run.
    hideInPalette: true,
    description: "Run again what the last binding or palette pick ran, in the window you're in",
    async run({ lastRun, runSteps, reply }) {
        if (!runSteps) return reply("repeat only runs from a binding.", "error");
        if (!lastRun) return reply("Nothing to repeat yet.");
        await runSteps(lastRun);
    }
});
