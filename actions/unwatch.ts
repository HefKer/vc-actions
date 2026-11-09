/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 hefker and Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { unwatch } from "../lib/streams";
import { defineAction } from "../registry";

export default defineAction({
    id: "unwatch",
    description: "Stop watching the stream you're watching",
    run({ reply }) {
        unwatch();
        reply("Stopped watching.", "success");
    }
});
