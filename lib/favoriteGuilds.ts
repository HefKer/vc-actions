/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 hefker and Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import * as DataStore from "@api/DataStore";
import { GuildStore, NavigationRouter, SelectedGuildStore } from "@webpack/common";

import { logger } from "./discord";
import { UserError } from "./errors";
import { type GuildInfo, pickFavorite, toggleFavorite } from "./favorites";
import { ResolveError } from "./resolve";

const KEY = "QuickActions_favoriteGuilds";

/** Favorite server ids in the order added. Kept in memory so choices() can read them synchronously. */
let ids: string[] = [];
/** The load from DataStore; a toggle waits for it so it can't save over favorites not loaded yet. */
let loaded: Promise<void> = Promise.resolve();

export function loadFavorites() {
    loaded = DataStore.get<string[]>(KEY)
        .then(saved => { if (Array.isArray(saved)) ids = saved; })
        .catch(e => logger.error("loading favorite servers failed", e));
}

/** Favorites you're still in; a server you left stays saved and comes back if you rejoin. */
export function favorites(): GuildInfo[] {
    return ids.flatMap(id => {
        const g = GuildStore.getGuild(id);
        return g ? [{ id, name: g.name }] : [];
    });
}

export function favoriteChoices(): string[] {
    try {
        return ["next", "prev", ...favorites().map(f => f.name)];
    } catch {
        return ["next", "prev"];
    }
}

/** Go to the favorite `input` picks (see pickFavorite); returns its name. */
export function goToFavorite(input: string | undefined): string {
    const favs = favorites();
    const r = pickFavorite(input, favs, SelectedGuildStore.getGuildId() ?? null);
    if (!r.ok) throw new ResolveError(r.error);
    NavigationRouter.transitionToGuild(r.value);
    return favs.find(f => f.id === r.value)!.name;
}

/** Add the server you're viewing to the favorites, or remove it; returns its name and which it was. */
export async function toggleCurrentFavorite(): Promise<{ name: string; added: boolean; }> {
    const id = SelectedGuildStore.getGuildId();
    if (!id) throw new UserError("Open a server first: you're not viewing one.");
    await loaded;
    const next = toggleFavorite(ids, id);
    ids = next.favs;
    await DataStore.set(KEY, ids);
    return { name: GuildStore.getGuild(id)?.name ?? "that server", added: next.added };
}
