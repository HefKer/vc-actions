/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 hefker and Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { UserError } from "../lib/errors";
import { newestMessage, replyTo } from "../lib/messages";
import { defineAction } from "../registry";

export default defineAction({
    id: "reply",
    description: "Reply to a message in the channel you're viewing: `reply last` the newest (pinging like Discord's Reply)",
    args: [{ name: "message", description: "Which message: last", type: "string", required: true, choices: () => ["last"] }],
    run({ args }) {
        if (args.message?.trim().toLowerCase() !== "last") throw new UserError("Only `reply last` (the newest message) for now.");
        replyTo(newestMessage(), true);
    }
});
