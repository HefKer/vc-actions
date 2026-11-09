/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 hefker and Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { ChannelRouter } from "@webpack/common";

import { UserError } from "../lib/errors";
import { openPicker } from "../lib/picker";
import { placeEntries } from "../lib/placePick";
import { allPlaces, currentPlaces } from "../lib/places";
import { defineAction } from "../registry";

export default defineAction({
    id: "channelpick",
    description: "Fuzzy-pick a channel of the server you're viewing (\"all\": of every server and DM) and go there, in the window you're in",
    args: [{ name: "scope", description: "Leave out for the server you're viewing, or all", type: "string" }],
    async run({ args, win = window, reply }) {
        const scope = args.scope?.trim().toLowerCase();
        if (scope && scope !== "all") throw new UserError(`channelpick takes "all" or nothing, not "${args.scope}".`);
        const entries = placeEntries(scope ? allPlaces() : currentPlaces());
        if (!entries.length) return reply("No channels to pick from.", "info");
        await openPicker({
            win,
            entries,
            usage: "channelpick",
            placeholder: scope ? "Go to a channel or DM…" : "Go to a channel…",
            enter: "goes there",
            reply,
            pick: m => {
                // A route change only: a voice channel opens its view, it isn't joined.
                ChannelRouter.transitionToChannel(m.text);
                reply(`Went to ${m.label}.`, "success");
            }
        });
    }
});
