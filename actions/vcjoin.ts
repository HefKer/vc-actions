/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 hefker and Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { ChannelStore } from "@webpack/common";

import { currentVoiceChannelId, joinVoice, lastVoiceChannelId, resolveChannel, voiceChannelName, voiceChoices } from "../lib/voice";
import { defineAction } from "../registry";

export default defineAction({
    id: "vcjoin",
    description: "Join a voice channel by name (current server first), or \"last\" to rejoin the one you were in before",
    command: "vcjoin",
    args: [{ name: "channel", description: "Voice channel name, or last", type: "string", required: true, choices: voiceChoices }],
    run({ args, reply }) {
        let id: string;
        if (args.channel?.trim().toLowerCase() === "last") {
            const last = lastVoiceChannelId();
            if (!last || !ChannelStore.getChannel(last)) return reply("No previous voice channel to rejoin.", "error");
            id = last;
        } else {
            id = resolveChannel(args.channel);
        }
        if (id === currentVoiceChannelId()) return reply(`Already in ${voiceChannelName(id)}.`, "info");
        joinVoice(id);
        reply(`Joined ${voiceChannelName(id)}.`, "success");
    }
});
