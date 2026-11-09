/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 hefker and Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import type { Channel } from "@vencord/discord-types";
import {
    ActiveJoinedThreadsStore, ChannelStore, GuildChannelStore, GuildReadStateStore, GuildStore, PrivateChannelSortStore,
    ReadStateStore, SelectedChannelStore, SelectedGuildStore, SortedGuildStore, VoiceStateStore
} from "@webpack/common";

import { ChannelType, type PickPlace, type PickVoice, type Placed, placedDetail, serverPlaces, sidebarOrder, type SideChannel } from "./placePick";
import { isUnread } from "./readState";
import { userNames } from "./users";

// What `channelpick`, `serverpick` and `vcpick` list, read from Discord's stores; the pure parts are in placePick.ts.

const DMS = "@me";

const side = (c: Channel): SideChannel => ({ id: c.id, name: c.name, type: c.type, parentId: c.parent_id ?? null });

/** Snowflakes compared as numbers: a longer id is newer. */
const newestFirst = (a: SideChannel, b: SideChannel) => b.id.length - a.id.length || (a.id < b.id ? 1 : a.id > b.id ? -1 : 0);

/**
 * A server's channels you can view, in sidebar order, categories left out, joined threads after their parent
 * (newest first). GuildChannelStore holds them sorted and permission-filtered, text kinds apart from voice ones.
 * Unlike ChannelListStore's shown channels, this includes channels in collapsed categories and hidden muted ones.
 */
export function guildSidebar(guildId: string): Placed[] {
    const all = GuildChannelStore.getChannels(guildId) as unknown as Record<string, { channel: Channel; }[] | undefined> | undefined;
    const list = (key: string | number) => (all?.[key] ?? []).flatMap(e => e?.channel ? [side(e.channel)] : []);
    const threads = ActiveJoinedThreadsStore.getActiveJoinedThreadsForGuild(guildId) ?? {};
    return sidebarOrder(
        // Its "Uncategorized" placeholder has id "null".
        list(ChannelType.GUILD_CATEGORY).filter(c => c.id !== "null"),
        [...list("SELECTABLE"), ...list("VOCAL")],
        parent => Object.values(threads[parent] ?? {}).map(t => side(t.channel)).sort(newestFirst)
    );
}

/** A DM by the other person's name, a group DM by its name or its members'. */
function dmName(c: Channel): string {
    if (c.isDM()) {
        const other = c.getRecipientId();
        return (other && userNames(other, null)[0]) || c.rawRecipients?.[0]?.username || "DM";
    }
    return c.name || c.rawRecipients?.map(u => u.global_name ?? u.username).join(", ") || "Group DM";
}

const unreadOf = (guildId: string, id: string) => ({ mentions: ReadStateStore.getMentionCount(id), unread: isUnread(guildId, id) });

/** Your DMs and group DMs in DM-list order (latest message first). */
function dmPlaces(detail?: string): PickPlace[] {
    return PrivateChannelSortStore.getPrivateChannelIds().flatMap(id => {
        const c = ChannelStore.getChannel(id);
        return c ? [{ id, name: dmName(c), type: c.type, detail, ...unreadOf(DMS, id) }] : [];
    });
}

function guildPlaces(guildId: string, detail: (p: Placed) => string | undefined): PickPlace[] {
    return guildSidebar(guildId).map(p => ({
        id: p.channel.id, name: p.channel.name, type: p.channel.type, detail: detail(p), ...unreadOf(guildId, p.channel.id)
    }));
}

/** The server you're viewing's channels, category as detail; in DMs, your DMs. */
export function currentPlaces(): PickPlace[] {
    const g = SelectedGuildStore.getGuildId();
    return g ? guildPlaces(g, placedDetail) : dmPlaces();
}

/** Your DMs, then every server's channels in server-list order, the server's name as detail. */
export function allPlaces(): PickPlace[] {
    return [
        ...dmPlaces("DM"),
        ...SortedGuildStore.getFlattenedGuildIds().flatMap(g => {
            const name = GuildStore.getGuild(g)?.name;
            return name ? guildPlaces(g, () => name) : [];
        })
    ];
}

/** Every server in server-list order, folders flattened, with the folder's name and the server's unread state. */
export function serverList(): PickPlace[] {
    return serverPlaces(SortedGuildStore.getGuildFolders(), id => {
        const g = GuildStore.getGuild(id);
        return g && { id, name: g.name, mentions: GuildReadStateStore.getMentionCount(id), unread: GuildReadStateStore.hasUnread(id) };
    });
}

const isVocal = (type: number) => type === ChannelType.GUILD_VOICE || type === ChannelType.GUILD_STAGE_VOICE;

/** Voice channels: the server you're viewing (else the one you're in voice in) first, then the others in server-list order. */
export function voiceList(): PickVoice[] {
    const inVoice = SelectedChannelStore.getVoiceChannelId() ?? null;
    const current = SelectedGuildStore.getGuildId() ?? (inVoice ? ChannelStore.getChannel(inVoice)?.guild_id : null) ?? null;
    const order = SortedGuildStore.getFlattenedGuildIds();
    const guilds = current ? [current, ...order.filter(g => g !== current)] : order;
    return guilds.flatMap(g => {
        const guildName = g === current ? undefined : GuildStore.getGuild(g)?.name ?? g;
        return guildSidebar(g).filter(p => isVocal(p.channel.type)).map(({ channel: c }) => ({
            id: c.id,
            name: c.name,
            type: c.type,
            guildName,
            people: Object.keys(VoiceStateStore.getVoiceStatesForChannel(c.id) ?? {}).map(u => userNames(u, g)[0] ?? "?"),
            here: c.id === inVoice
        }));
    });
}
