/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 hefker and Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { openPluginsPage } from "../lib/vencordSettings";
import { defineAction } from "../registry";

export default defineAction({
    id: "plugins",
    description: "Open Vencord's Plugins page in settings",
    async run() {
        await openPluginsPage();
    }
});
