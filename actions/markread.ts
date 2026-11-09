/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 hefker and Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { UserError } from "../lib/errors";
import { markRead, type ReadScope } from "../lib/readState";
import { defineAction } from "../registry";

const SCOPES: ReadScope[] = ["channel", "server", "all"];

export default defineAction({
    id: "markread",
    description: "Mark the current channel, the current server, or everything (all servers and DMs) as read",
    command: "markread",
    args: [{ name: "what", description: "channel, server or all", type: "string", required: true, choices: () => SCOPES }],
    run({ args, reply }) {
        const scope = args.what?.toLowerCase() as ReadScope;
        if (!SCOPES.includes(scope)) throw new UserError(`Unknown "markread ${args.what ?? ""}": use channel, server or all.`);
        reply(`Marked ${markRead(scope)} as read.`, "success");
    }
});
