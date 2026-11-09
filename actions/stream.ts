/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 hefker and Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { presetNames, presets, resolvePreset, setCurrentPreset } from "../lib/presets";
import { defineAction } from "../registry";

export default defineAction({
    id: "stream",
    command: "stream",
    description: "Start streaming with a VcPresets preset",
    args: [{ name: "preset", description: "Preset name", type: "string", required: true, choices: presetNames }],
    async run({ args, reply }) {
        const name = resolvePreset(args.preset);
        await presets().startPreset(name);
        setCurrentPreset(name);
        reply(`Streaming with "${name}".`, "success");
    }
});
