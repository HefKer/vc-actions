/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 hefker and Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/**
 * The item after `current` in `list`, wrapping from the last to the first. An unknown or missing
 * `current` gives the first; an empty list gives undefined. Pure, so `node --test` can run it.
 */
export function nextAfter<T>(list: readonly T[], current: T | null | undefined): T | undefined {
    if (!list.length) return undefined;
    return list[(current == null ? 0 : list.indexOf(current) + 1) % list.length];
}

/**
 * The item before `current` in `list`, wrapping from the first to the last. Like nextAfter, an unknown or
 * missing `current` gives the first (so `watch prev` with nothing watched starts at the first stream).
 */
export function prevBefore<T>(list: readonly T[], current: T | null | undefined): T | undefined {
    if (!list.length) return undefined;
    const i = current == null ? -1 : list.indexOf(current);
    return list[i < 0 ? 0 : (i - 1 + list.length) % list.length];
}
