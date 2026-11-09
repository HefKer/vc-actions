/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 hefker and Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { findByPropsLazy } from "@webpack";
import { MediaEngineStore, SelectedChannelStore } from "@webpack/common";

import { defineAction } from "../registry";

/** Discord's media-engine actions; setVideoEnabled(enabled) is what the call bar's camera button dispatches. */
const MediaEngineActions: { setVideoEnabled(enabled: boolean): void; } = findByPropsLazy("setVideoEnabled", "toggleLocalMute");

export default defineAction({
    id: "camera",
    description: "Turn your camera on or off in your voice channel",
    run({ reply }) {
        if (!SelectedChannelStore.getVoiceChannelId()) return reply("You're not in a voice channel.", "error");
        const on = !MediaEngineStore.isVideoEnabled();
        if (on && !Object.keys(MediaEngineStore.getVideoDevices()).length) return reply("No camera found.", "error");
        MediaEngineActions.setVideoEnabled(on);
        reply(on ? "Camera on." : "Camera off.", "success");
    }
});
