/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 hefker and Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { addReaction, newestMessage, resolveEmoji } from "../lib/messages";
import { defineAction } from "../registry";

export default defineAction({
    id: "react",
    description: "React to the newest message in the channel you're viewing with an emoji (👍, thumbsup or a custom emoji's name)",
    args: [{ name: "emoji", description: "👍, :thumbsup:, thumbsup, <:name:id> or a custom emoji's name", type: "string", required: true }],
    async run({ args, reply }) {
        const message = newestMessage();
        const emoji = resolveEmoji(args.emoji);
        if (await addReaction(message, emoji) === "already") reply("Already reacted with that.");
    }
});
