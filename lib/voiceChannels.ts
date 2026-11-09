/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 hefker and Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

// @ts-expect-error TS5097: node --test needs the .ts extension, Vencord's tsconfig doesn't allow it.
import { type Candidate, type Resolved, resolveName } from "./resolve.ts";

// Pure voice-channel logic: the last-channel tracker and name matching. Discord glue is in voice.ts.

/** Your voice channel now, and the one you were in before it (what `vcjoin last` rejoins). */
export interface VoiceTrack {
    current: string | null;
    last: string | null;
}

/** The track after your voice channel became `now` (null = not in voice). */
export function trackVoice(t: VoiceTrack, now: string | null): VoiceTrack {
    if (now === t.current) return t;
    return { current: now, last: t.current ?? t.last };
}

/** A voice channel as a name can pick it. */
export interface VoiceChannelInfo {
    id: string;
    name: string;
    guildId: string;
    guildName: string;
}

const labelled = (c: VoiceChannelInfo) => `${c.name} (${c.guildName})`;

/** Current server's channels first (tier 0, plain name), then the rest, labelled and also named "Name (Server)". */
function candidates(channels: readonly VoiceChannelInfo[], currentGuildId: string | null): Candidate<string>[] {
    const here = channels.filter(c => c.guildId === currentGuildId);
    const others = channels.filter(c => c.guildId !== currentGuildId);
    return [
        ...here.map(c => ({ names: [c.name], value: c.id, tier: 0 })),
        ...others.map(c => ({ names: [c.name, labelled(c)], value: c.id, label: labelled(c), tier: 1 }))
    ];
}

/** A channel id, or a name per resolveName: current server first, then others labelled with their server. */
export function resolveVoiceChannel(input: string | undefined, channels: readonly VoiceChannelInfo[], currentGuildId: string | null): Resolved<string> {
    const typed = input?.trim();
    if (typed && channels.some(c => c.id === typed)) return { ok: true, value: typed };
    return resolveName(input, candidates(channels, currentGuildId), "voice channel");
}

/** Slash-command choices: "last", then each channel as resolveVoiceChannel shows it. */
export function channelChoices(channels: readonly VoiceChannelInfo[], currentGuildId: string | null): string[] {
    return ["last", ...candidates(channels, currentGuildId).map(c => c.label ?? c.names[0])];
}
