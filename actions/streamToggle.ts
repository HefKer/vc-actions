/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 hefker and Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { presetNames, presets, resolvePreset, setCurrentPreset } from "../lib/presets";
import { isLive } from "../lib/streams";
import { defineAction } from "../registry";

export default defineAction({
    id: "streamtoggle",
    description: "Start streaming with a VcPresets preset, or stop your stream if you're live (whatever preset it uses)",
    args: [{ name: "preset", description: "Preset name", type: "string", required: true, choices: presetNames }],
    async run({ args, reply }) {
        if (isLive()) {
            presets().stopStream();
            setCurrentPreset(null);
            reply("Stream stopped.", "success");
            return;
        }
        const name = resolvePreset(args.preset);
        await presets().startPreset(name);
        setCurrentPreset(name);
        reply(`Streaming with "${name}".`, "success");
    }
});
