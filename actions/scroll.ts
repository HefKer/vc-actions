/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 hefker and Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { UserError } from "../lib/errors";
import { scrollChannel, windowChannel } from "../lib/messages";
import { defineAction } from "../registry";

const WHERE = ["top", "bottom", "unread"] as const;

export default defineAction({
    id: "scroll",
    description: "Scroll the channel you're in to its first message (top), newest (bottom) or first unread (unread), like the new-messages bar",
    args: [{ name: "where", description: "top, bottom or unread", type: "string", required: true, choices: () => [...WHERE] }],
    run({ args, win }) {
        const where = WHERE.find(w => w === args.where?.trim().toLowerCase());
        if (!where) throw new UserError("Scroll where? top, bottom or unread.");
        const doc = (win ?? window).document;
        scrollChannel(where, doc, windowChannel(doc));
    }
});
