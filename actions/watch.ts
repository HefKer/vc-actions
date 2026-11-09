/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 hefker and Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { StreamError, watchStep } from "../lib/streams";
import { defineAction } from "../registry";

export default defineAction({
    id: "watch",
    description: "Watch the next or previous stream in your call, in tile order, wrapping around",
    args: [{ name: "which", description: "next or prev", type: "string", required: true, choices: () => ["next", "prev"] }],
    run({ args, reply }) {
        const which = args.which?.toLowerCase();
        if (which !== "next" && which !== "prev") throw new StreamError(`Unknown "watch ${args.which ?? ""}": use "watch next" or "watch prev".`);
        reply(`Watching ${watchStep(which)}.`, "success");
    }
});
