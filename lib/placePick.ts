/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 hefker and Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

// Type-only, so erased for node --test; tsc takes the .ts extension on it.
import type { Badge, PaletteEntry } from "./palette.ts";

// Pure parts of `channelpick`, `serverpick` and `vcpick`: sidebar order and picker entries. Discord glue is in places.ts.

/** Mirrors @vencord/discord-types/enums ChannelType; that package doesn't resolve from this symlinked plugin (see lib/streams.ts). */
export const ChannelType = {
    GUILD_TEXT: 0, DM: 1, GUILD_VOICE: 2, GROUP_DM: 3, GUILD_CATEGORY: 4, GUILD_ANNOUNCEMENT: 5,
    ANNOUNCEMENT_THREAD: 10, PUBLIC_THREAD: 11, PRIVATE_THREAD: 12, GUILD_STAGE_VOICE: 13, GUILD_FORUM: 15, GUILD_MEDIA: 16
} as const;

const ICONS: Record<number, string> = {
    [ChannelType.GUILD_TEXT]: "#",
    [ChannelType.DM]: "@",
    [ChannelType.GUILD_VOICE]: "🔊",
    [ChannelType.GROUP_DM]: "👥",
    [ChannelType.GUILD_ANNOUNCEMENT]: "📢",
    [ChannelType.ANNOUNCEMENT_THREAD]: "🧵",
    [ChannelType.PUBLIC_THREAD]: "🧵",
    [ChannelType.PRIVATE_THREAD]: "🧵",
    [ChannelType.GUILD_STAGE_VOICE]: "🎙️",
    [ChannelType.GUILD_FORUM]: "💬",
    [ChannelType.GUILD_MEDIA]: "🖼️"
};

/** A channel's kind as a picker icon; "#" for kinds without their own. */
export const channelIcon = (type: number) => ICONS[type] ?? "#";

/** A channel as the sidebar order needs it. */
export interface SideChannel {
    id: string;
    name: string;
    type: number;
    parentId: string | null;
}

/** A channel in sidebar order, with the name of its category and, for a thread, of its parent channel. */
export interface Placed {
    channel: SideChannel;
    category: string | null;
    parent?: string;
}

/**
 * A server's channels as its sidebar lists them: channels without a category first, then each category in order;
 * in each, `channels` keep their order (so pass text channels before voice ones, each sorted as Discord sorts
 * them), each followed by its threads. A channel whose category isn't in `categories` counts as uncategorized.
 */
export function sidebarOrder(categories: readonly SideChannel[], channels: readonly SideChannel[], threads: (parentId: string) => readonly SideChannel[]): Placed[] {
    const names = new Map(categories.map(c => [c.id, c.name]));
    const groups = new Map<string | null, SideChannel[]>([[null, []], ...categories.map(c => [c.id, []] as [string, SideChannel[]])]);
    for (const c of channels) groups.get(c.parentId != null && names.has(c.parentId) ? c.parentId : null)!.push(c);
    return [...groups].flatMap(([catId, list]) => {
        const category = catId == null ? null : names.get(catId)!;
        return list.flatMap(channel => [
            { channel, category },
            ...threads(channel.id).map(t => ({ channel: t, category, parent: channel.name }))
        ]);
    });
}

/** What `channelpick` shows of a sidebar entry: a thread's detail names its category and parent channel. */
export const placedDetail = ({ category, parent }: Placed): string | undefined =>
    parent ? (category ? `${category} › ${parent}` : parent) : category ?? undefined;

/** Discord's sidebar marks: a red mention count, else a dot when unread. */
export function unreadBadge(mentions: number, unread: boolean): Badge | undefined {
    if (mentions > 0) return { text: String(mentions), alert: true };
    return unread ? { text: "●" } : undefined;
}

/** A channel, DM or server as a picker row; `id` is the entry's text (what Enter goes to, and the frecency key). */
export interface PickPlace {
    id: string;
    name: string;
    /** A channel type, for the icon; none for a server. */
    type?: number;
    detail?: string;
    mentions: number;
    unread: boolean;
}

export function placeEntries(places: readonly PickPlace[]): PaletteEntry[] {
    return places.map(p => ({
        label: p.name,
        text: p.id,
        detail: p.detail,
        icon: p.type == null ? undefined : channelIcon(p.type),
        badge: unreadBadge(p.mentions, p.unread),
        open: false
    }));
}

/** A server folder as SortedGuildStore.getGuildFolders gives it: a lone server is a "folder" with no id. */
export interface GuildFolder {
    folderId?: number;
    folderName?: string;
    guildIds: readonly string[];
}

/**
 * Servers in server-list order, folders flattened, each with its folder's name as detail (an unnamed folder: none).
 * `place` reads a server's name and unread state; undefined (not loaded) leaves it out.
 */
export function serverPlaces(folders: readonly GuildFolder[], place: (guildId: string) => Omit<PickPlace, "detail"> | undefined): PickPlace[] {
    return folders.flatMap(f => f.guildIds.flatMap(id => {
        const p = place(id);
        return p ? [{ ...p, detail: f.folderId != null ? f.folderName || undefined : undefined }] : [];
    }));
}

/** A voice channel for `vcpick`. */
export interface PickVoice {
    id: string;
    name: string;
    type: number;
    /** Set for channels outside the server you're in. */
    guildName?: string;
    /** Who's in it, best name each. */
    people: readonly string[];
    /** You're in it. */
    here: boolean;
}

/** Names shown in a voice channel's detail; the rest are counted. */
export const SHOWN_PEOPLE = 3;

/** "Server · alice, bob, carol +2": where it is (if elsewhere) and who's in it. */
export function voiceDetail(guildName: string | undefined, people: readonly string[]): string | undefined {
    const more = people.length - SHOWN_PEOPLE;
    const who = people.length ? people.slice(0, SHOWN_PEOPLE).join(", ") + (more > 0 ? ` +${more}` : "") : "";
    return [guildName, who].filter(Boolean).join(" · ") || undefined;
}

/** Voice channels as rows: who's in it as detail and their count as badge; the channel you're in has ▶ for its icon. */
export function voiceEntries(channels: readonly PickVoice[]): PaletteEntry[] {
    return channels.map(c => ({
        label: c.name,
        text: c.id,
        detail: voiceDetail(c.guildName, c.people),
        icon: c.here ? "▶" : channelIcon(c.type),
        badge: c.people.length ? { text: String(c.people.length) } : undefined,
        open: false
    }));
}
