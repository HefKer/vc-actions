/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 hefker and Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { currentVoiceChannelId, leaveVoice, voiceChannelName } from "../lib/voice";
import { defineAction } from "../registry";

export default defineAction({
    id: "vcleave",
    description: "Leave your voice channel",
    run({ reply }) {
        const id = currentVoiceChannelId();
        if (!id) return reply("You're not in voice.", "info");
        leaveVoice();
        reply(`Left ${voiceChannelName(id)}.`, "success");
    }
});
