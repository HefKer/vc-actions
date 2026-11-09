/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 hefker and Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/** Where you are: a server id ("@me" for DMs) and the channel open in it, if any. */
export interface Place {
    guildId: string;
    channelId: string | null;
}

/** What findUnread asks Discord, so the walk itself stays pure. */
export interface UnreadSource {
    /** Every place to look, in guild-list order: "@me" (DMs) first, then the servers as the server list shows them. */
    guildIds: readonly string[];
    /** A server's channels in sidebar order (DMs in DM-list order for "@me"). Asked only for servers walked into. */
    channels(guildId: string): readonly string[];
    /** Whether to look in a server at all (false for a muted one); never asked for the server you're in. */
    guildOk(guildId: string): boolean;
    /** Whether a channel counts (unread, mentions...). */
    channelOk(guildId: string, channelId: string): boolean;
}

/**
 * The next (dir 1) or previous (dir -1) channel that counts, walked the way Discord's own alt+shift+down/up does:
 * the channels after (before) the current one in this server, then the other servers in guild-list order
 * (reverse for prev), wrapping around, and last the rest of this server from the other end. The channel you're in
 * never counts. Undefined when nothing does. Pure, so `node --test` can run it.
 */
export function findUnread(src: UnreadSource, at: Place, dir: 1 | -1): Place | undefined {
    for (const p of walk(src, at, dir))
        if (p.channelId !== at.channelId && src.channelOk(p.guildId, p.channelId!)) return p;
    return undefined;
}

function* walk(src: UnreadSource, at: Place, dir: 1 | -1): Generator<Place> {
    const order = src.guildIds.includes(at.guildId) ? [...src.guildIds] : [at.guildId, ...src.guildIds];
    const i = order.indexOf(at.guildId);
    const others = dir > 0
        ? [...order.slice(i + 1), ...order.slice(0, i)]
        : [...order.slice(0, i).reverse(), ...order.slice(i + 1).reverse()];
    const inDir = (list: readonly string[]) => dir > 0 ? list : [...list].reverse();

    const here = inDir(src.channels(at.guildId));
    const ci = at.channelId == null ? -1 : here.indexOf(at.channelId);
    // Unknown current channel: next starts at this server's top; prev goes straight to the previous server.
    const rest = ci < 0 ? (dir > 0 ? here : []) : here.slice(ci + 1);
    for (const c of rest) yield { guildId: at.guildId, channelId: c };

    for (const g of others) {
        if (!src.guildOk(g)) continue;
        for (const c of inDir(src.channels(g))) yield { guildId: g, channelId: c };
    }

    for (const c of ci < 0 ? (dir > 0 ? [] : here) : here.slice(0, ci)) yield { guildId: at.guildId, channelId: c };
}
