/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 hefker and Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { presetNames, presets, PresetsMissing, resolvePreset, setCurrentPreset } from "../lib/presets";
import { defineAction } from "../registry";

export default defineAction({
    id: "retarget",
    command: "retarget",
    description: "Move your running stream to another preset's cast target (niri Dynamic Cast Target)",
    args: [{ name: "preset", description: "Preset name", type: "string", required: true, choices: presetNames }],
    async run({ args, reply }) {
        const p = presets();
        if (typeof p.retarget !== "function") throw new PresetsMissing("This VcPresets build has no retarget(); rebuild it.");
        const name = resolvePreset(args.preset);
        await p.retarget(name);
        setCurrentPreset(name);
        reply(`Cast target switched to "${name}".`, "success");
    }
});
