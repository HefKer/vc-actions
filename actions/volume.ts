/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 hefker and Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { myId } from "../lib/discord";
import { isLocalMute, localAmplitude, localVolume, maxVolume, setLocalAmplitude, setLocalMute, setLocalVolume } from "../lib/userAudio";
import { displayName } from "../lib/users";
import { applyVolumeChange, parseVolumeChange } from "../lib/volume";
import { defineAction } from "../registry";

export default defineAction({
    id: "volume",
    description: "Set someone's local volume (80) or adjust it (+20, -20), 0-200%; held, restore it on release",
    command: "volume",
    holdable: true,
    args: [
        { name: "user", description: "Whose volume", type: "user", required: true },
        { name: "level", description: "n sets, +n / -n adjusts (percent, 100 = normal)", type: "string", required: true }
    ],
    run({ args, reply }) {
        const userId = args.user!;
        if (userId === myId()) return reply("You can't set your own volume.", "error");
        const parsed = parseVolumeChange(args.level);
        if (!parsed.ok) return reply(parsed.error, "error");

        const prev = { amplitude: localAmplitude(userId), mute: isLocalMute(userId) };
        const next = applyVolumeChange(localVolume(userId), parsed.change, maxVolume());
        setLocalVolume(userId, next);
        // Like Discord's slider: raising the volume of someone you muted locally unmutes them.
        if (next > 0) setLocalMute(userId, false);
        reply(`${displayName(userId)}: ${next}%.`, "success");

        return () => {
            setLocalAmplitude(userId, prev.amplitude);
            setLocalMute(userId, prev.mute);
        };
    }
});
