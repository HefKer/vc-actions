/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 hefker and Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { openPicker } from "../lib/picker";
import { currentPreset, presets, PresetsMissing, setCurrentPreset } from "../lib/presets";
import { isLive } from "../lib/streams";
import { defineAction } from "../registry";

export default defineAction({
    id: "presetpick",
    description: "Fuzzy-pick a VcPresets preset and stream with it, or retarget to it if you're live, in the window you're in",
    async run({ win = window, reply }) {
        const p = presets();
        const names = p.listPresets().map(x => x.name);
        if (!names.length) throw new PresetsMissing("No presets saved yet: add one in VcPresets.");
        const live = isLive();
        const current = live ? currentPreset() : null;
        await openPicker({
            win,
            entries: names.map(name => ({ label: name, text: name, badge: name === current ? { text: "live" } : undefined, open: false })),
            usage: "presetpick",
            placeholder: live ? "Retarget your stream to…" : "Stream with…",
            enter: live ? "retargets" : "streams",
            reply,
            pick: async m => {
                // Live or not is checked again: the stream may have started or ended while picking.
                if (isLive()) {
                    if (typeof p.retarget !== "function") throw new PresetsMissing("This VcPresets build has no retarget(); rebuild it.");
                    await p.retarget(m.text);
                    setCurrentPreset(m.text);
                    reply(`Cast target switched to "${m.text}".`, "success");
                } else {
                    await p.startPreset(m.text);
                    setCurrentPreset(m.text);
                    reply(`Streaming with "${m.text}".`, "success");
                }
            }
        });
    }
});
