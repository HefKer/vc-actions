/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 hefker and Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { toggleCurrentFavorite } from "../lib/favoriteGuilds";
import { defineAction } from "../registry";

export default defineAction({
    id: "favtoggle",
    description: "Add the server you're viewing to your favorites, or remove it",
    command: "favtoggle",
    async run({ reply }) {
        const { name, added } = await toggleCurrentFavorite();
        reply(added ? `Added ${name} to favorites.` : `Removed ${name} from favorites.`, "success");
    }
});
