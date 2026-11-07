/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 hefker and Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { presets } from "../lib/presets";
import { defineAction } from "../registry";

export default defineAction({
    id: "stopstream",
    command: "stopstream",
    description: "Stop your stream",
    run({ reply }) {
        presets().stopStream();
        reply("Stream stopped.", "success");
    }
});
