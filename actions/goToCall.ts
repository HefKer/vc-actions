/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 hefker and Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { currentVoiceChannelId, goToCall } from "../lib/voice";
import { defineAction } from "../registry";

export default defineAction({
    id: "gotocall",
    description: "Open the call view of your voice channel",
    run({ reply }) {
        const id = currentVoiceChannelId();
        if (!id) return reply("You're not in voice.", "info");
        goToCall(id);
        reply("Opened the call.", "success");
    }
});
