/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 hefker and Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { openPicker } from "../lib/picker";
import { voiceEntries } from "../lib/placePick";
import { voiceList } from "../lib/places";
import { currentVoiceChannelId, goToCall, joinVoice, voiceChannelName } from "../lib/voice";
import { defineAction } from "../registry";

export default defineAction({
    id: "vcpick",
    description: "Fuzzy-pick a voice channel (the server you're viewing first) and join it, or Shift+Enter to just open it, in the window you're in",
    async run({ win = window, reply }) {
        const entries = voiceEntries(voiceList());
        if (!entries.length) return reply("No voice channels to pick from.", "info");
        await openPicker({
            win,
            entries,
            usage: "vcpick",
            placeholder: "Join a voice channel…",
            enter: "joins",
            reply,
            pick: m => {
                if (m.text === currentVoiceChannelId()) return reply(`Already in ${voiceChannelName(m.text)}.`, "info");
                joinVoice(m.text);
                reply(`Joined ${voiceChannelName(m.text)}.`, "success");
            },
            alt: {
                enter: "opens it",
                pick: m => {
                    goToCall(m.text);
                    reply(`Opened ${voiceChannelName(m.text)}.`, "success");
                }
            }
        });
    }
});
