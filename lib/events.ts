/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 hefker and Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { ApplicationStreamingStore, MediaEngineStore, SelectedChannelStore } from "@webpack/common";

import { myId } from "./discord";
import { type HookEvent, type HookState, stateEvents } from "./hooks";
import { encodeStreamKey } from "./streams";

/** Your voice state as hooks see it; lib/hooks.ts turns changes of it into events. */
function readState(): HookState {
    const me = myId();
    return {
        voice: SelectedChannelStore.getVoiceChannelId() ?? null,
        live: ApplicationStreamingStore.getCurrentUserActiveStream() != null,
        watching: ApplicationStreamingStore.getAllActiveStreams().filter(s => s.ownerId !== me).map(s => encodeStreamKey(s)),
        mute: MediaEngineStore.getSettings().mute
    };
}

/**
 * Call `onEvent` for each hook event from now on; returns the unsubscribe. Events are edges of store state
 * rather than raw Flux actions, so a repeated or no-op dispatch (a reconnect re-watch of the same stream, a mute
 * that was already on) fires nothing, and starting doesn't fire for the state you're already in.
 */
export function watchEvents(onEvent: (event: HookEvent) => void): () => void {
    let state = readState();
    const stores = [SelectedChannelStore, ApplicationStreamingStore, MediaEngineStore];
    const onChange = () => {
        const next = readState();
        const events = stateEvents(state, next);
        state = next;
        events.forEach(onEvent);
    };
    for (const s of stores) s.addChangeListener(onChange);
    return () => {
        for (const s of stores) s.removeChangeListener(onChange);
    };
}
