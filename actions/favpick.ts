/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 hefker and Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { favorites, goToFavorite } from "../lib/favoriteGuilds";
import { openPicker } from "../lib/picker";
import { defineAction } from "../registry";

export default defineAction({
    id: "favpick",
    description: "Fuzzy-pick a favorite server and go there, in the window you're in",
    async run({ win = window, reply }) {
        const favs = favorites();
        if (!favs.length) return reply("No favorite servers yet: run favtoggle in a server to add it.", "info");
        await openPicker({
            win,
            entries: favs.map(f => ({ label: f.name, text: f.id, open: false })),
            usage: "favpick",
            placeholder: "Go to a favorite server…",
            enter: "goes there",
            pick: m => {
                try {
                    reply(`Went to ${goToFavorite(m.text)}.`, "success");
                } catch (e) {
                    reply(e instanceof Error ? e.message : String(e), "error");
                }
            }
        });
    }
});
