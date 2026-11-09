/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 hefker and Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { UserError } from "../lib/errors";
import { editLastMessage, windowChannel } from "../lib/messages";
import { defineAction } from "../registry";

export default defineAction({
    id: "edit",
    description: "Edit a message of yours in the channel you're in: `edit last` the newest one, like Up in an empty message box",
    args: [{ name: "message", description: "Which message: last", type: "string", required: true, choices: () => ["last"] }],
    run({ args, win }) {
        if (args.message?.trim().toLowerCase() !== "last") throw new UserError("Only `edit last` (your newest message) for now.");
        editLastMessage(windowChannel((win ?? window).document));
    }
});
