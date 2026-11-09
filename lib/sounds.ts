/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 hefker and Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import type { Candidate } from "./resolve";

/** The fields of a SoundboardStore sound we use; Discord's defaults have guildId "0". */
export interface Sound {
    name: string;
    soundId: string;
    guildId: string;
}

/** Discord rejects a slash-command option with more choices than this. */
const MAX_CHOICES = 25;

/**
 * Sounds as names to resolve: your voice channel's server first (tier 0), then Discord's defaults (1),
 * then other servers' (2), which also answer to and show as "name (Server)". Pure.
 */
export function soundCandidates<S extends Sound>(sounds: readonly S[], guildId: string | null, guildName: (id: string) => string | undefined): Candidate<S>[] {
    const tier = (s: Sound) => s.guildId === guildId ? 0 : s.guildId === "0" ? 1 : 2;
    return sounds
        .map(s => {
            const t = tier(s);
            if (t < 2) return { names: [s.name], value: s, tier: t };
            const label = `${s.name} (${guildName(s.guildId) ?? s.guildId})`;
            return { names: [s.name, label], value: s, tier: t, label };
        })
        .sort((a, b) => a.tier - b.tier);
}

/** Slash-command choices for these candidates, in tier order: each shown name once, at most 25. */
export function soundChoices(candidates: readonly Candidate<unknown>[]): string[] {
    return [...new Set(candidates.map(c => c.label ?? c.names[0]))].slice(0, MAX_CHOICES);
}
