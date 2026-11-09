/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 hefker and Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { ResolveError, resolveName } from "../lib/resolve";
import { candidates, ensureSounds, play, soundChannel } from "../lib/soundboard";
import { soundChoices } from "../lib/sounds";
import { defineAction } from "../registry";

function choices(): string[] {
    void ensureSounds();
    return soundChoices(candidates());
}

export default defineAction({
    id: "soundboard",
    command: "soundboard",
    description: "Play a soundboard sound in your voice channel",
    args: [{ name: "sound", description: "Sound name", type: "string", required: true, choices }],
    async run({ args, reply }) {
        const channel = soundChannel();
        await ensureSounds();
        const r = resolveName(args.sound, candidates(), "sound");
        if (!r.ok) throw new ResolveError(r.error);
        play(r.value, channel);
        reply(`Played "${r.value.name}".`, "success");
    }
});
