/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 hefker and Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { myId } from "../lib/discord";
import { isLocalMute, setLocalMute } from "../lib/userAudio";
import { displayName } from "../lib/users";
import { defineAction } from "../registry";

export default defineAction({
    id: "localmute",
    description: "Toggle someone's local mute (only you stop hearing them)",
    args: [{ name: "user", description: "Who to mute or unmute", type: "user", required: true }],
    run({ args, reply }) {
        const userId = args.user!;
        if (userId === myId()) return reply("You can't locally mute yourself.", "error");
        const mute = !isLocalMute(userId);
        setLocalMute(userId, mute);
        // Discord's toggle is a no-op behind one of its guards; the dispatch is synchronous, so read it back.
        if (isLocalMute(userId) !== mute) return reply(`Discord didn't change ${displayName(userId)}'s local mute.`, "error");
        reply(`${displayName(userId)} ${mute ? "muted" : "unmuted"} locally.`, "success");
    }
});
