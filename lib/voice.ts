/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 hefker and Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import * as DataStore from "@api/DataStore";
import { findByPropsLazy } from "@webpack";
import { ChannelStore, GuildChannelStore, GuildStore, NavigationRouter, SelectedChannelStore, SelectedGuildStore } from "@webpack/common";

import { logger } from "./discord";
import { ResolveError } from "./resolve";
import { channelChoices, resolveVoiceChannel, trackVoice, type VoiceChannelInfo, type VoiceTrack } from "./voiceChannels";

/** Discord's channel actions (confirmed live): selectVoiceChannel(id) joins, disconnect() leaves. */
const ChannelActions: {
    selectVoiceChannel(channelId: string | null): void;
    disconnect(): void;
} = findByPropsLazy("selectVoiceChannel", "selectChannel");

// Old plugin name kept so the saved channel survives the rename (ADR 0003).
const LAST_KEY = "VcActions_lastVoiceChannel";

export const currentVoiceChannelId = (): string | null => SelectedChannelStore.getVoiceChannelId() ?? null;

/** "General (hefker dev)", or a DM call's name. */
export function voiceChannelName(id: string): string {
    const ch = ChannelStore.getChannel(id);
    if (!ch) return "that voice channel";
    const guild = ch.guild_id ? GuildStore.getGuild(ch.guild_id)?.name : null;
    return guild ? `${ch.name} (${guild})` : ch.name || "the DM call";
}

/** The server to match names in first: the one you're viewing, else the one you're in voice in. */
function currentGuildId(): string | null {
    const vc = currentVoiceChannelId();
    return SelectedGuildStore.getGuildId() ?? (vc ? ChannelStore.getChannel(vc)?.guild_id ?? null : null);
}

function allVoiceChannels(): VoiceChannelInfo[] {
    return Object.values(GuildStore.getGuilds()).flatMap(g =>
        ((GuildChannelStore.getChannels(g.id) as any)?.VOCAL ?? []).map(({ channel }: { channel: { id: string; name: string; }; }) =>
            ({ id: channel.id, name: channel.name, guildId: g.id, guildName: g.name })));
}

/** Voice channel id for a typed name or id; throws ResolveError listing the channels. */
export function resolveChannel(input: string | undefined): string {
    const r = resolveVoiceChannel(input, allVoiceChannels(), currentGuildId());
    if (!r.ok) throw new ResolveError(r.error);
    return r.value;
}

export function voiceChoices(): string[] {
    try {
        return channelChoices(allVoiceChannels(), currentGuildId());
    } catch {
        return ["last"];
    }
}

export const joinVoice = (id: string) => ChannelActions.selectVoiceChannel(id);
export const leaveVoice = () => ChannelActions.disconnect();

/** Open the call view of voice channel `id` (what Discord's own join does after selecting it). */
export function goToCall(id: string) {
    const guildId = ChannelStore.getChannel(id)?.guild_id;
    NavigationRouter.transitionTo(`/channels/${guildId ?? "@me"}/${id}`);
}

/*
 * The previous voice channel. No Discord store has it, so we watch SelectedChannelStore and keep it in
 * DataStore so `vcjoin last` survives a restart.
 */
let track: VoiceTrack = { current: null, last: null };
let tracking = false;

export const lastVoiceChannelId = () => track.last;

function onChange() {
    const next = trackVoice(track, currentVoiceChannelId());
    if (next === track) return;
    const lastChanged = next.last !== track.last;
    track = next;
    if (lastChanged) DataStore.set(LAST_KEY, track.last).catch(e => logger.error("saving last voice channel failed", e));
}

export function startVoiceTracking() {
    if (tracking) return;
    tracking = true;
    track = { current: currentVoiceChannelId(), last: null };
    SelectedChannelStore.addChangeListener(onChange);
    DataStore.get<string | null>(LAST_KEY).then(saved => {
        // A change seen before the load finished is newer than the saved one.
        if (tracking && track.last == null && saved && saved !== track.current) track = { ...track, last: saved };
    }).catch(e => logger.error("loading last voice channel failed", e));
}

export function stopVoiceTracking() {
    if (!tracking) return;
    tracking = false;
    SelectedChannelStore.removeChangeListener(onChange);
}
