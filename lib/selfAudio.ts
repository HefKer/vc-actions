/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 hefker and Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Logger } from "@utils/Logger";
import { findByPropsLazy } from "@webpack";
import { FluxDispatcher, MediaEngineStore } from "@webpack/common";

import type { Release } from "../registry";

const logger = new Logger("VcActions");

/**
 * Discord's media engine action creators (the module behind its mute/deafen buttons).
 * setSelfMute(context, mute) dispatches AUDIO_SET_SELF_MUTE; there's no deafen setter, only toggleSelfDeaf()
 * (AUDIO_TOGGLE_SELF_DEAF), so deafen is toggled only when it differs.
 */
const AudioActions: {
    setSelfMute(context: string, mute: boolean): void;
    toggleSelfDeaf(opts?: { context?: string; }): void;
} = findByPropsLazy("setSelfMute", "toggleSelfDeaf");

const CONTEXT = "default";

export interface SelfAudio {
    mute: boolean;
    deaf: boolean;
}

/** Your own mute and deafen flags as set (isSelfMute() would also say muted when deafened or not in voice). */
export function selfAudio(): SelfAudio {
    const { mute, deaf } = MediaEngineStore.getSettings();
    return { mute, deaf };
}

/** Sets the given flags, touching only those that differ. */
export function setSelfAudio(want: Partial<SelfAudio>) {
    const cur = selfAudio();
    if (want.mute != null && want.mute !== cur.mute) {
        try {
            AudioActions.setSelfMute(CONTEXT, want.mute);
        } catch (e) {
            logger.warn("setSelfMute not found, dispatching AUDIO_SET_SELF_MUTE directly", e);
            FluxDispatcher.dispatch({ type: "AUDIO_SET_SELF_MUTE", context: CONTEXT, mute: want.mute, playSoundEffect: true });
        }
    }
    if (want.deaf != null && want.deaf !== cur.deaf) {
        try {
            AudioActions.toggleSelfDeaf({ context: CONTEXT });
        } catch (e) {
            logger.warn("toggleSelfDeaf not found, dispatching AUDIO_TOGGLE_SELF_DEAF directly", e);
            FluxDispatcher.dispatch({ type: "AUDIO_TOGGLE_SELF_DEAF", context: CONTEXT, syncRemote: true });
        }
    }
}

/** Sets the given flags and returns a Release that puts back the ones it may have changed. */
export function holdSelfAudio(want: Partial<SelfAudio>): Release {
    const prev = selfAudio();
    setSelfAudio(want);
    return () => setSelfAudio({
        mute: want.mute != null ? prev.mute : undefined,
        deaf: want.deaf != null ? prev.deaf : undefined
    });
}
