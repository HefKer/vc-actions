/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 hefker and Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Logger } from "@utils/Logger";
import { ParticipantType } from "@vencord/discord-types/enums";
import { findByCodeLazy, findByPropsLazy } from "@webpack";
import { ApplicationStreamingStore, ChannelRTCStore, ChannelStore, FluxDispatcher, PopoutWindowStore, SelectedChannelStore, UserStore } from "@webpack/common";

import { nextAfter, prevBefore } from "./cycle";

const logger = new Logger("VcActions");

interface StreamRef {
    streamType: string;
    guildId: string | null;
    channelId: string;
    ownerId: string;
}

/*
 * Discord's own action creators, from the module that also holds POPOUT_WINDOW_OPEN.
 * openCallTilePopout(channelId, participantId) is what the "Pop Out" button on a call tile runs;
 * PopoutWindowManager answers it by window.open-ing /popout with frame name
 * DISCORD_CALL_TILE_POPOUT_<channelId>_<participantId>, which Vesktop lets through as a Discord pop-out.
 * For a stream tile the participant id is the stream key.
 */
const openCallTilePopout: (channelId: string, participantId: string) => void =
    findByCodeLazy('type:"CALL_TILE_POPOUT_WINDOW_OPEN"');
/** openChannelCallPopout(channel): the "Pop Out" button at the bottom right of the call view; the whole call grid. */
const openChannelCallPopout: (channel: object) => void =
    findByCodeLazy('type:"CHANNEL_CALL_POPOUT_WINDOW_OPEN"');
/** watchStream(stream, { noFocus, forceFocus, forceMultiple }): what clicking "Watch Stream" runs. */
const watchStream: (stream: StreamRef, opts?: { noFocus?: boolean; forceMultiple?: boolean; }) => void =
    findByCodeLazy('type:"STREAM_WATCH",streamKey:');
/** closeStream(streamKey, canShowFeedback): what a stream tile's "Stop Watching" runs. */
const closeStream: (streamKey: string, canShowFeedback?: boolean) => void =
    findByCodeLazy('type:"STREAM_CLOSE"');
/** ChannelRTC actions: selectParticipant(channelId, id) makes a tile the main view; id = user id or stream key, null = grid. */
const RTCActions: { selectParticipant(channelId: string, id: string | null): void; } =
    findByPropsLazy("selectParticipant", "popoutParticipant");

export class StreamError extends Error { }

export function encodeStreamKey(s: StreamRef): string {
    return s.guildId != null
        ? ["guild", s.guildId, s.channelId, s.ownerId].join(":")
        : ["call", s.channelId, s.ownerId].join(":");
}

export function decodeStreamKey(key: string): StreamRef | null {
    const parts = key.split(":");
    if (parts[0] === "guild" && parts.length === 4) return { streamType: "guild", guildId: parts[1], channelId: parts[2], ownerId: parts[3] };
    if (parts[0] === "call" && parts.length === 3) return { streamType: "call", guildId: null, channelId: parts[1], ownerId: parts[2] };
    return null;
}

export const popoutWindowKey = (channelId: string, participantId: string) =>
    `DISCORD_CALL_TILE_POPOUT_${channelId}_${participantId}`;

export function isPoppedOut(s: StreamRef): boolean {
    const key = encodeStreamKey(s);
    try {
        return PopoutWindowStore.getWindowOpen(popoutWindowKey(s.channelId, key))
            || ChannelRTCStore.isParticipantPoppedOut(s.channelId, key);
    } catch {
        return false;
    }
}

export function popOut(s: StreamRef) {
    const key = encodeStreamKey(s);
    try {
        openCallTilePopout(s.channelId, key);
    } catch (e) {
        // The action creator moved; the Flux action it dispatches is still Discord's own code path.
        logger.warn("openCallTilePopout not found, dispatching CALL_TILE_POPOUT_WINDOW_OPEN directly", e);
        FluxDispatcher.dispatch({ type: "CALL_TILE_POPOUT_WINDOW_OPEN", channelId: s.channelId, participantId: key });
    }
}

/** Pop out the call view of your voice channel, like the call view's own Pop Out button. */
export function popOutCall() {
    const channel = ChannelStore.getChannel(myVoiceChannel());
    if (!channel) throw new StreamError("Can't find your voice channel.");
    try {
        openChannelCallPopout(channel);
    } catch (e) {
        logger.warn("openChannelCallPopout not found, dispatching CHANNEL_CALL_POPOUT_WINDOW_OPEN directly", e);
        FluxDispatcher.dispatch({ type: "CHANNEL_CALL_POPOUT_WINDOW_OPEN", channel });
    }
}

/** Whether you're streaming (Go Live) right now, whoever started it. */
export const isLive = () => ApplicationStreamingStore.getCurrentUserActiveStream() != null;

function myVoiceChannel(): string {
    const id = SelectedChannelStore.getVoiceChannelId();
    if (!id) throw new StreamError("You're not in a voice channel.");
    return id;
}

const waitFor = (check: () => boolean, ms: number) => new Promise<boolean>(resolve => {
    const end = Date.now() + ms;
    const tick = () => check() ? resolve(true) : Date.now() > end ? resolve(false) : setTimeout(tick, 100);
    tick();
});

/** A user's stream in your voice channel, watching it first if you aren't yet. */
export async function userStream(userId: string, name: string): Promise<StreamRef> {
    const vc = myVoiceChannel();
    const active = ApplicationStreamingStore.getActiveStreamForUser(userId) as StreamRef | null;
    if (active && active.channelId === vc) return active;

    const any = ApplicationStreamingStore.getAnyStreamForUser(userId) as StreamRef | null;
    if (!any) throw new StreamError(`${name} isn't streaming.`);
    if (any.channelId !== vc) throw new StreamError(`${name} is streaming in another channel: join it first.`);

    watchStream(any, { noFocus: true });
    const ok = await waitFor(() => ApplicationStreamingStore.getActiveStreamForUser(userId) != null, 3000);
    if (!ok) logger.warn("stream watch didn't show up within 3s, popping out anyway", any);
    return any;
}

const isWatching = (key: string) => ApplicationStreamingStore.getActiveStreamForStreamKey(key) != null;

/** The stream you're watching: the focused tile if it's a watched stream, else the first watched one in `keys`. */
function watchedKey(channelId: string, keys: string[]): string | undefined {
    const selected = ChannelRTCStore.getSelectedParticipantId(channelId);
    if (selected != null && keys.includes(selected) && isWatching(selected)) return selected;
    return keys.find(isWatching);
}

/**
 * Watch the stream after (or before) the one you're watching, in the call's tile order, wrapping around;
 * the first stream when you watch none. Your own stream is skipped. Returns the streamer's name.
 */
export function watchStep(dir: "next" | "prev"): string {
    const vc = myVoiceChannel();
    const me = UserStore.getCurrentUser()?.id;
    // getStreamParticipants is the call grid's own sorted index filtered to stream tiles, so it's tile order.
    const tiles = ChannelRTCStore.getStreamParticipants(vc).filter(p => p.stream.ownerId !== me);
    const keys = tiles.map(p => p.id);
    const key = (dir === "next" ? nextAfter : prevBefore)(keys, watchedKey(vc, keys));
    const tile = tiles.find(p => p.id === key);
    if (!tile) throw new StreamError("Nobody in your voice channel is streaming.");
    watchStream(tile.stream);
    return tile.userNick || tile.user.globalName || tile.user.username;
}

/** Stop watching the stream you're watching (the focused one if you watch several). */
export function unwatch() {
    const me = UserStore.getCurrentUser()?.id;
    const keys = ApplicationStreamingStore.getAllActiveStreams()
        .filter(s => s.ownerId !== me)
        .map(s => encodeStreamKey(s));
    const vc = SelectedChannelStore.getVoiceChannelId();
    const key = (vc && watchedKey(vc, keys)) || keys[0];
    if (!key) throw new StreamError("You're not watching a stream.");
    try {
        closeStream(key);
    } catch (e) {
        logger.warn("closeStream not found, dispatching STREAM_CLOSE directly", e);
        FluxDispatcher.dispatch({ type: "STREAM_CLOSE", streamKey: key, canShowFeedback: true });
    }
}

/** Make a user's tile the main view of the call: their stream tile if they stream, else their user (camera) tile. */
export function focusTile(userId: string, name: string) {
    const vc = myVoiceChannel();
    const parts = ChannelRTCStore.getParticipants(vc);
    const tile = parts.find(p => p.type === ParticipantType.STREAM && p.user.id === userId)
        ?? parts.find(p => p.type === ParticipantType.USER && p.id === userId);
    if (!tile) throw new StreamError(`${name} isn't in your voice channel.`);
    try {
        RTCActions.selectParticipant(vc, tile.id);
    } catch (e) {
        logger.warn("selectParticipant not found, dispatching CHANNEL_RTC_SELECT_PARTICIPANT directly", e);
        FluxDispatcher.dispatch({ type: "CHANNEL_RTC_SELECT_PARTICIPANT", channelId: vc, id: tile.id });
    }
}
