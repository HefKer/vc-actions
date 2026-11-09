/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 hefker and Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { ComponentDispatch } from "@webpack/common";

import { UserError } from "../lib/errors";
import { defineAction } from "../registry";

// The search bar's ComponentDispatch events (Discord's ComponentActions), mirrored: discord-types enums don't resolve.
const SET_SEARCH_QUERY = "SET_SEARCH_QUERY";
const FOCUS_SEARCH = "FOCUS_SEARCH";

export default defineAction({
    id: "search",
    description: "Search the messages of the server or DM you're in, filters included (`search from:alice cat`); no text just focuses the search bar",
    command: "search",
    args: [{ name: "query", description: "What to search, with Discord's filters (from:, in:, has:, before:...)", type: "string" }],
    run({ args }) {
        // The header's search bar subscribes to these while it's mounted; without it there's nothing to search from.
        if (!ComponentDispatch.hasSubscribers(SET_SEARCH_QUERY)) throw new UserError("No search bar here.");
        const query = args.query?.trim().replace(/\s+/g, " ");
        if (!query) {
            // Like Ctrl+Shift+F: focus without prefilling in:<current channel>.
            ComponentDispatch.dispatch(FOCUS_SEARCH, { prefillCurrentChannel: false });
            return;
        }
        // What the search results' hints do: replace the bar's text and run it, as pressing Enter would.
        ComponentDispatch.dispatch(SET_SEARCH_QUERY, { query, replace: true, performSearch: true, searchQuerySource: "search_text_input" });
    }
});
