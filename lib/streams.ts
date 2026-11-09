/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 hefker and Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Logger } from "@utils/Logger";
import { findByCodeLazy } from "@webpack";
import { ApplicationStreamingStore, ChannelRTCStore, ChannelStore, FluxDispatcher, PopoutWindowStore, SelectedChannelStore } from "@webpack/common";

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
