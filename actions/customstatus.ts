/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 hefker and Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { setCustomStatus } from "../lib/status";
import { defineAction } from "../registry";

export default defineAction({
    id: "customstatus",
    description: "Set your custom status text (no expiry); `clear` clears it, `\\clear` sets the text \"clear\"",
    command: "customstatus",
    args: [{ name: "text", description: "Status text, or clear", type: "string", required: true }],
    async run({ args, reply }) {
        const raw = args.text?.trim() ?? "";
        if (!raw || raw.toLowerCase() === "clear") {
            await setCustomStatus("");
            reply("Custom status cleared.", "success");
            return;
        }
        const text = raw.toLowerCase() === "\\clear" ? raw.slice(1) : raw;
        await setCustomStatus(text);
        reply(`Custom status: ${text}`, "success");
    }
});
