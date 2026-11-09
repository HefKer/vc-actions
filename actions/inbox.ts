/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 hefker and Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { toggleInbox } from "../lib/notifications";
import { defineAction } from "../registry";

export default defineAction({
    id: "inbox",
    description: "Open Discord's notification inbox on its Mentions tab (closes it if open), like Ctrl+I",
    run() {
        toggleInbox();
    }
});
