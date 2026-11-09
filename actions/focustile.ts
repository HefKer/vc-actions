/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 hefker and Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { focusTile, StreamError } from "../lib/streams";
import { displayName } from "../lib/users";
import { defineAction } from "../registry";

export default defineAction({
    id: "focustile",
    command: "focustile",
    description: "Make a user's tile the main view of the call (their stream if they stream), without popping it out",
    args: [{ name: "user", description: "Whose tile", type: "user", required: true }],
    run({ args, reply }) {
        const id = args.user;
        if (!id) throw new StreamError("Whose tile? Give a user.");
        const name = displayName(id);
        focusTile(id, name);
        reply(`Focused ${name}.`, "success");
    }
});
