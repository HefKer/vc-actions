/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 hefker and Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { presetNames, presets, resolvePreset } from "../lib/presets";
import { defineAction } from "../registry";

export default defineAction({
    id: "retarget",
    command: "retarget",
    description: "Switch your running stream to another preset's window/screen and audio",
    args: [{ name: "preset", description: "Preset name", type: "string", required: true, choices: presetNames }],
    async run({ args, reply }) {
        const name = resolvePreset(args.preset);
        await presets().retarget(name);
        reply(`Stream switched to "${name}".`, "success");
    }
});
