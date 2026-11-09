/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 hefker and Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { isPluginEnabled } from "@api/PluginManager";
import { Settings } from "@api/Settings";
import { findByPropsLazy } from "@webpack";
import { MediaEngineStore, UserStore } from "@webpack/common";

import { amplitudeToPercent, percentToAmplitude } from "./volume";

/**
 * Discord's media engine action creators (behind the user volume slider in a user's context menu).
 * setLocalVolume(userId, amplitude, context) dispatches AUDIO_SET_LOCAL_VOLUME; toggleLocalMute(userId, context)
 * AUDIO_TOGGLE_LOCAL_MUTE. Both confirmed live (CDP, 2026-11-08).
 */
const AudioActions: {
    setLocalVolume(userId: string, volume: number, context?: string): void;
    toggleLocalMute(userId: string, context?: string): void;
} = findByPropsLazy("setLocalVolume", "toggleLocalMute");

/** The user's voice (not their stream's audio, which is context "stream"). */
const CONTEXT = "default" as const;

/** Highest slider percent: 200, times VolumeBooster's multiplier when it's on (it raises the slider the same way). */
export function maxVolume(): number {
    const mult = isPluginEnabled("VolumeBooster") ? Number(Settings.plugins.VolumeBooster?.multiplier) || 1 : 1;
    return 200 * mult;
}

/** Stored amplitude, for restoring exactly. */
export const localAmplitude = (userId: string) => MediaEngineStore.getLocalVolume(userId, CONTEXT);
export const setLocalAmplitude = (userId: string, amplitude: number) => AudioActions.setLocalVolume(userId, amplitude, CONTEXT);

/** Volume as the slider shows it, in percent. */
export const localVolume = (userId: string) => amplitudeToPercent(localAmplitude(userId));
export const setLocalVolume = (userId: string, percent: number) => setLocalAmplitude(userId, percentToAmplitude(percent));

export const isLocalMute = (userId: string) => MediaEngineStore.isLocalMute(userId, CONTEXT);
export function setLocalMute(userId: string, mute: boolean) {
    if (isLocalMute(userId) !== mute) AudioActions.toggleLocalMute(userId, CONTEXT);
}

export const isSelf = (userId: string) => userId === UserStore.getCurrentUser()?.id;

export function displayName(userId: string): string {
    const u = UserStore.getUser(userId);
    return u?.globalName || u?.username || userId;
}
