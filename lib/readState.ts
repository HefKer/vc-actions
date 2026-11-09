/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 hefker and Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { ChannelType, ReadStateType } from "@vencord/discord-types/enums";
import { findStoreLazy } from "@webpack";
import {
    ActiveJoinedThreadsStore, ChannelRouter, ChannelStore, FluxDispatcher, GuildChannelStore, GuildStore, PrivateChannelSortStore,
    ReadStateStore, SelectedChannelStore, SelectedGuildStore, SnowflakeUtils, SortedGuildStore, UserGuildSettingsStore
} from "@webpack/common";

import { logger } from "./discord";
import { UserError } from "./errors";
import { findUnread, type Place } from "./unread";

const DMS = "@me";
/** UserGuildSettingsStore.resolveUnreadSetting: unread for every message, not only mentions. */
const UNREAD_ALL_MESSAGES = 1;

/** The sidebar's own channel list (shown channels: collapsed categories and hidden muted channels left out, threads in). */
const ChannelListStore: {
    getGuildWithoutChangingGuildActionRows(guildId: string): {
        guildChannels: { forEachShownChannel(cb: (c: { id: string; type: number; }) => void): void; };
    };
} = findStoreLazy("ChannelListStore");

const GuildOnboardingPromptsStore: { ackIdForGuild(guildId: string): string; } = findStoreLazy("GuildOnboardingPromptsStore");

function sidebarChannels(guildId: string): string[] {
    if (guildId === DMS) return PrivateChannelSortStore.getPrivateChannelIds();
    try {
        const ids: string[] = [];
        ChannelListStore.getGuildWithoutChangingGuildActionRows(guildId).guildChannels
            .forEachShownChannel(c => { if (c.type !== ChannelType.GUILD_CATEGORY) ids.push(c.id); });
        return ids;
    } catch (e) {
        logger.warn("ChannelListStore unusable, falling back to GuildChannelStore order", e);
        return [...GuildChannelStore.getSelectableChannelIds(guildId), ...GuildChannelStore.getVocalChannelIds(guildId)];
    }
}

/**
 * Discord's unread dot, as its alt+shift+down predicate sees it: DMs and voice channels only by mentions (an unread DM
 * is a mention), plus unread messages in your own voice channel; other channels unread when not muted (channel or
 * its category) and set to notify unread for all messages, or with a mention even when muted.
 */
function isUnread(guildId: string, id: string): boolean {
    const ch = ChannelStore.getChannel(id);
    if (!ch) return false;
    const mentions = ReadStateStore.getMentionCount(id) > 0;
    if (ch.isPrivate() || ch.isGuildVocal())
        return mentions || (id === SelectedChannelStore.getVoiceChannelId() && ReadStateStore.hasUnread(id));
    if (mentions) return true;
    const muted = UserGuildSettingsStore.isChannelMuted(guildId, id) || UserGuildSettingsStore.isCategoryMuted(guildId, id);
    return !muted && ReadStateStore.hasUnread(id) && UserGuildSettingsStore.resolveUnreadSetting(ch) === UNREAD_ALL_MESSAGES;
}

const hasMention = (_g: string, id: string) => ReadStateStore.getMentionCount(id) > 0;

const here = (): Place => ({ guildId: SelectedGuildStore.getGuildId() ?? DMS, channelId: SelectedChannelStore.getChannelId() ?? null });

export type UnreadMode = "next" | "prev" | "mention";

/** Go to the next/previous unread channel, or the next one with mentions; returns its name, undefined if none. */
export function goToUnread(mode: UnreadMode): string | undefined {
    const found = findUnread({
        guildIds: [DMS, ...SortedGuildStore.getFlattenedGuildIds()],
        channels: sidebarChannels,
        // Muted servers keep their mentions, like Discord's own mention jump.
        guildOk: mode === "mention" ? () => true : g => g === DMS || !UserGuildSettingsStore.isMuted(g),
        channelOk: mode === "mention" ? hasMention : isUnread,
    }, here(), mode === "prev" ? -1 : 1);
    if (!found) return undefined;
    ChannelRouter.transitionToChannel(found.channelId!);
    return placeName(found);
}

function placeName({ guildId, channelId }: Place): string {
    const ch = ChannelStore.getChannel(channelId!);
    if (guildId === DMS) {
        const name = ch?.name || ch?.rawRecipients?.map(u => u.global_name ?? u.username).join(", ");
        return name ? `DM ${name}` : "a DM";
    }
    return `#${ch?.name ?? "?"} (${GuildStore.getGuild(guildId)?.name ?? "?"})`;
}

interface Ack { channelId: string; readStateType: ReadStateType; messageId: string | null; }

function bulkAck(channels: Ack[]) {
    // What Discord's own bulk ack creator dispatches; ReadStateStore keeps only unread ones and posts them in batches.
    FluxDispatcher.dispatch({ type: "BULK_ACK", context: "APP", channels });
}

/** A server's acks, as Discord's server "Mark As Read" builds them: every channel and joined thread, events, onboarding. */
function guildAcks(guildId: string): Ack[] {
    const selectable = GuildChannelStore.getSelectableChannelIds(guildId);
    const threads = ActiveJoinedThreadsStore.getActiveJoinedThreadsForGuild(guildId);
    const ids = [...selectable, ...GuildChannelStore.getVocalChannelIds(guildId), ...selectable.flatMap(p => Object.keys(threads[p] ?? {}))];
    const acks: Ack[] = ids.map(channelId => ({ channelId, readStateType: ReadStateType.CHANNEL, messageId: ReadStateStore.lastMessageId(channelId) }));
    acks.push({ channelId: guildId, readStateType: ReadStateType.GUILD_EVENT, messageId: ReadStateStore.lastMessageId(guildId, ReadStateType.GUILD_EVENT) });
    try {
        acks.push({ channelId: guildId, readStateType: ReadStateType.GUILD_ONBOARDING_QUESTION, messageId: GuildOnboardingPromptsStore.ackIdForGuild(guildId) });
    } catch (e) {
        logger.warn("GuildOnboardingPromptsStore not found, onboarding questions stay unread", e);
    }
    return acks;
}

export type ReadScope = "channel" | "server" | "all";

/** Mark the current channel, the current server, or every server and DM read; returns what was marked. */
export function markRead(scope: ReadScope): string {
    if (scope === "channel") {
        const id = SelectedChannelStore.getChannelId();
        const ch = id ? ChannelStore.getChannel(id) : undefined;
        if (!ch) throw new UserError("Open a channel first.");
        // Discord's channel "Mark As Read": a forced, immediate ack; forums ack up to now.
        FluxDispatcher.dispatch({
            type: "CHANNEL_ACK", channelId: ch.id, immediate: true, force: true, context: "APP",
            messageId: ch.isForumLikeChannel() ? SnowflakeUtils.fromTimestamp(Date.now()) : undefined,
        });
        return placeName({ guildId: ch.guild_id ?? DMS, channelId: ch.id });
    }
    if (scope === "server") {
        const g = SelectedGuildStore.getGuildId();
        if (!g) throw new UserError("Open a server first: you're not viewing one.");
        bulkAck(guildAcks(g));
        return GuildStore.getGuild(g)?.name ?? "the server";
    }
    const dms = PrivateChannelSortStore.getPrivateChannelIds()
        .map(channelId => ({ channelId, readStateType: ReadStateType.CHANNEL, messageId: ReadStateStore.lastMessageId(channelId) }));
    bulkAck([...Object.keys(GuildStore.getGuilds()).flatMap(guildAcks), ...dms]);
    return "everything";
}
