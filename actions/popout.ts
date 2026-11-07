/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 hefker and Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { UserStore } from "@webpack/common";

import { popOut, popOutCall, userStream } from "../lib/streams";
import { defineAction } from "../registry";

export default defineAction({
    id: "popout",
    command: "popout",
    description: "Pop out the call view (like its Pop Out button), or with a user, just their stream",
    args: [{ name: "user", description: "Pop out only this user's stream tile", type: "user" }],
    async run({ args, reply }) {
        if (!args.user) {
            popOutCall();
            return reply("Call popped out.", "success");
        }
        const user = UserStore.getUser(args.user);
        popOut(await userStream(args.user, user?.globalName ?? user?.username ?? args.user));
        reply("Popped out.", "success");
    }
});
