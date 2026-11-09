/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 hefker and Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { openPicker } from "../lib/picker";
import { candidates, ensureSounds, guildName, play, soundChannel, usable } from "../lib/soundboard";
import { soundEntries } from "../lib/sounds";
import { defineAction } from "../registry";

export default defineAction({
    id: "soundpick",
    description: "Fuzzy-pick a soundboard sound and play it in your voice channel, in the window you're in",
    async run({ win = window, reply }) {
        const channel = soundChannel();
        await ensureSounds();
        const sounds = candidates();
        if (!sounds.length) return reply("No soundboard sounds loaded.", "info");
        const byId = new Map(sounds.map(c => [c.value.soundId, c.value]));
        await openPicker({
            win,
            entries: soundEntries(sounds, guildName, s => !usable(s, channel)),
            usage: "soundpick",
            placeholder: "Play a sound…",
            enter: "plays",
            reply,
            pick: m => {
                const sound = byId.get(m.text)!;
                // You may have left voice while picking.
                play(sound, soundChannel());
                reply(`Played "${sound.name}".`, "success");
            }
        });
    }
});
