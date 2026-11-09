/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 hefker and Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { UserError } from "../lib/errors";
import { toggleNotifMute } from "../lib/notifications";
import { defineAction } from "../registry";

export default defineAction({
    id: "notifmute",
    description: "Mute or unmute notifications of the current channel or server, like its Mute menu item (until you unmute)",
    command: "notifmute",
    args: [{ name: "what", description: "channel or server", type: "string", required: true, choices: () => ["channel", "server"] }],
    run({ args, reply }) {
        const what = args.what?.toLowerCase();
        if (what !== "channel" && what !== "server") throw new UserError(`Unknown "notifmute ${args.what ?? ""}": use channel or server.`);
        const { name, muted } = toggleNotifMute(what);
        reply(`${muted ? "Muted" : "Unmuted"} ${name}.`, "success");
    }
});
