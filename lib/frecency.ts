/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 hefker and Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/**
 * Frecency: how often and how lately something was picked, as one number. Each pick adds 1 and the total halves
 * every HALF_LIFE, so ten picks a month ago weigh less than two today. Pure; storage is in usage.ts.
 */

/** Its frecency `score` as of time `at` (ms). */
export interface Use {
    score: number;
    at: number;
}

/** Uses by key: an entry's step text, a server id, a user id. */
export type Uses = Record<string, Use>;

export const HALF_LIFE = 7 * 24 * 60 * 60 * 1000;
/** Keys kept; past this the lowest-scoring are dropped, so storage stays small. */
export const MAX_USES = 200;

/** `use`'s score decayed to `now`; 0 for never used. */
export function frecency(use: Use | undefined, now: number): number {
    return use ? use.score * 2 ** (-Math.max(0, now - use.at) / HALF_LIFE) : 0;
}

/** `uses` after picking `key` at `now`, keeping only the MAX_USES highest-scoring keys. */
export function recordUse(uses: Uses, key: string, now: number, max = MAX_USES): Uses {
    const next: Uses = { ...uses, [key]: { score: frecency(uses[key], now) + 1, at: now } };
    const others = Object.keys(next).filter(k => k !== key);
    if (others.length < max) return next;
    // The key just picked always stays, even if older keys outscore it.
    const keep = others.sort((a, b) => frecency(next[b], now) - frecency(next[a], now)).slice(0, max - 1);
    return Object.fromEntries([key, ...keep].map(k => [k, next[k]]));
}
