/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 hefker and Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { UserStore } from "@webpack/common";

import { focusedStream, popOut, userStream } from "../lib/streams";
import { defineAction } from "../registry";

export default defineAction({
    id: "popout",
    command: "popout",
    description: "Pop out a stream you're watching (the focused one, or that user's) into its own window",
    args: [{ name: "user", description: "Whose stream; default: the focused one", type: "user" }],
    async run({ args, reply }) {
        const user = args.user ? UserStore.getUser(args.user) : null;
        const stream = args.user
            ? await userStream(args.user, user?.globalName ?? user?.username ?? args.user)
            : focusedStream();
        popOut(stream);
        reply("Popped out.", "success");
    }
});
