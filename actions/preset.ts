/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 hefker and Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { nextAfter } from "../lib/cycle";
import { currentPreset, presets, PresetsMissing, setCurrentPreset } from "../lib/presets";
import { isLive, StreamError } from "../lib/streams";
import { defineAction } from "../registry";

export default defineAction({
    id: "preset",
    description: "Mid-stream, retarget to the next VcPresets preset in list order, wrapping around",
    args: [{ name: "which", description: "next", type: "string", required: true, choices: () => ["next"] }],
    async run({ args, reply }) {
        if (args.which?.toLowerCase() !== "next") throw new StreamError(`Unknown "preset ${args.which ?? ""}": use "preset next".`);
        if (!isLive()) throw new StreamError("You're not streaming.");
        const p = presets();
        if (typeof p.retarget !== "function") throw new PresetsMissing("This VcPresets build has no retarget(); rebuild it.");
        const name = nextAfter(p.listPresets().map(x => x.name), currentPreset());
        if (!name) throw new PresetsMissing("No presets saved yet: add one in VcPresets.");
        await p.retarget(name);
        setCurrentPreset(name);
        reply(`Cast target switched to "${name}".`, "success");
    }
});
