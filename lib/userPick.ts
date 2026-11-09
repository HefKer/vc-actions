/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 hefker and Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

// Type-only, so erased for node --test; tsc takes the .ts extension on it.
import type { PaletteEntry } from "./palette.ts";

// `userpick`'s candidates, pure; reading them from Discord is in actions/userpick.ts.

export interface PickUser {
    id: string;
    /** Best first, as users.ts userNames gives them; none means the user isn't loaded. */
    names: readonly string[];
    username?: string;
}

/**
 * Picker entries for `userpick`: the people you have a DM with, most recent first (Discord's DM list order),
 * then friends you have none with, by name. Each once, never yourself or someone with no name loaded. An entry
 * shows the best name, the username beside it if that differs, and has the user id as its text.
 */
export function userPickEntries(dms: readonly PickUser[], friends: readonly PickUser[], me: string | undefined): PaletteEntry[] {
    const seen = new Set<string>(me ? [me] : []);
    const once = (users: readonly PickUser[]) => users.filter(u => u.names.length && !seen.has(u.id) && seen.add(u.id));
    const first = once(dms);
    const rest = once(friends).sort((a, b) => a.names[0].localeCompare(b.names[0]));
    return [...first, ...rest].map(u => ({
        label: u.names[0],
        text: u.id,
        detail: u.username && u.username !== u.names[0] ? u.username : undefined,
        open: false
    }));
}
