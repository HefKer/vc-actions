/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 hefker and Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

// @ts-expect-error TS5097: node --test needs the .ts extension, Vencord's tsconfig doesn't allow it.
import { nextAfter, prevBefore } from "./cycle.ts";
// @ts-expect-error TS5097
import { type Resolved, resolveName } from "./resolve.ts";

// Pure favorite-server logic; Discord glue and storage are in favoriteGuilds.ts.

/** A favorite server as a name can pick it. */
export interface GuildInfo {
    id: string;
    name: string;
}

/** The favorites after adding `id` (at the end) or, if it's there, removing it. */
export function toggleFavorite(favs: readonly string[], id: string): { favs: string[]; added: boolean; } {
    return favs.includes(id)
        ? { favs: favs.filter(f => f !== id), added: false }
        : { favs: [...favs, id], added: true };
}

/**
 * The favorite `fav <input>` goes to: `next`/`prev` cycle in the order they were added from the server you're
 * viewing (the first if it isn't a favorite), anything else is an id or a name per resolveName.
 */
export function pickFavorite(input: string | undefined, favs: readonly GuildInfo[], currentGuildId: string | null): Resolved<string> {
    if (!favs.length) return { ok: false, error: "No favorite servers yet: run favtoggle in a server to add it." };
    const typed = input?.trim() ?? "";
    const ids = favs.map(f => f.id);
    const which = typed.toLowerCase();
    if (which === "next" || which === "prev") {
        const id = (which === "next" ? nextAfter : prevBefore)(ids, currentGuildId);
        return { ok: true, value: id! };
    }
    if (ids.includes(typed)) return { ok: true, value: typed };
    return resolveName(typed, favs.map(f => ({ names: [f.name], value: f.id })), "favorite server");
}
