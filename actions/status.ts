/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 hefker and Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { currentStatus, parseStatus, setStatus, toggle } from "../lib/status";
import { STATUSES } from "../lib/statusLogic";
import { defineAction } from "../registry";

export default defineAction({
    id: "status",
    description: "Set your status (online, idle, dnd, invisible), or `status toggle dnd` to flip between it and your previous one; held, the previous status comes back on release",
    command: "status",
    holdable: true,
    args: [
        { name: "status", description: "online, idle, dnd, invisible, or toggle", type: "string", required: true, choices: () => [...STATUSES, "toggle"] },
        { name: "target", description: "With toggle: the status to toggle", type: "string" }
    ],
    async run({ args, reply }) {
        if (args.status?.trim().toLowerCase() === "toggle") {
            const set = await toggle(parseStatus(args.target));
            reply(`Status: ${set}.`, "success");
            return;
        }
        const want = parseStatus(args.status);
        const prev = currentStatus();
        await setStatus(want);
        reply(`Status: ${want}.`, "success");
        return () => setStatus(prev);
    }
});
