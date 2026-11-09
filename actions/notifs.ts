/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 hefker and Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { UserError } from "../lib/errors";
import { desktopNotifsOn, setDesktopNotifs } from "../lib/notifications";
import { defineAction } from "../registry";

export default defineAction({
    id: "notifs",
    description: "Turn Discord's desktop notifications on or off (Settings → Notifications), or toggle them",
    command: "notifs",
    args: [{ name: "state", description: "on, off or toggle", type: "string", required: true, choices: () => ["on", "off", "toggle"] }],
    run({ args, reply }) {
        const state = args.state?.toLowerCase();
        if (state !== "on" && state !== "off" && state !== "toggle") throw new UserError(`Unknown "notifs ${args.state ?? ""}": use on, off or toggle.`);
        const on = state === "toggle" ? !desktopNotifsOn() : state === "on";
        setDesktopNotifs(on);
        reply(`Desktop notifications ${on ? "on" : "off"}.`, "success");
    }
});
