/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 hefker and Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { NavigationRouter } from "@webpack/common";

import { openPicker } from "../lib/picker";
import { placeEntries } from "../lib/placePick";
import { serverList } from "../lib/places";
import { defineAction } from "../registry";

export default defineAction({
    id: "serverpick",
    description: "Fuzzy-pick any of your servers and go there, in the window you're in",
    async run({ win = window, reply }) {
        const entries = placeEntries(serverList());
        if (!entries.length) return reply("You're in no servers.", "info");
        await openPicker({
            win,
            entries,
            usage: "serverpick",
            placeholder: "Go to a server…",
            enter: "goes there",
            reply,
            pick: m => {
                // Like clicking its icon: Discord opens the channel you last had open there.
                NavigationRouter.transitionToGuild(m.text);
                reply(`Went to ${m.label}.`, "success");
            }
        });
    }
});
