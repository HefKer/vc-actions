/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 hefker and Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { UserError } from "../lib/errors";
import { goToUnread, type UnreadMode } from "../lib/readState";
import { defineAction } from "../registry";

const MODES: UnreadMode[] = ["next", "prev", "mention"];

export default defineAction({
    id: "unread",
    description: "Go to the next or previous unread channel, or the next one with mentions",
    command: "unread",
    args: [{ name: "which", description: "next, prev or mention", type: "string", required: true, choices: () => MODES }],
    run({ args, reply }) {
        const mode = args.which?.toLowerCase() as UnreadMode;
        if (!MODES.includes(mode)) throw new UserError(`Unknown "unread ${args.which ?? ""}": use next, prev or mention.`);
        const went = goToUnread(mode);
        if (!went) return reply(mode === "mention" ? "No mentions." : "No unread channels.", "info");
        reply(`Went to ${went}.`, "success");
    }
});
