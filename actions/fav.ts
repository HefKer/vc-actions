/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 hefker and Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { favoriteChoices, goToFavorite } from "../lib/favoriteGuilds";
import { defineAction } from "../registry";

export default defineAction({
    id: "fav",
    description: "Go to a favorite server by name, or the next/previous one (favtoggle adds them)",
    command: "fav",
    args: [{ name: "server", description: "Favorite server name, next or prev", type: "string", required: true, choices: favoriteChoices }],
    run({ args, reply }) {
        reply(`Went to ${goToFavorite(args.server)}.`, "success");
    }
});
