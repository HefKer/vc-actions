/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 hefker and Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/** Something a typed name can pick: a preset, voice channel, user or sound. */
export interface Candidate<T> {
    /** Every name it answers to (a user: nickname, display name, username). */
    names: readonly string[];
    value: T;
}

export type Resolved<T> = { ok: true; value: T; } | { ok: false; error: string; };

/** Pick the candidate `input` names: exact, then case-insensitive, then unique prefix. Pure. */
export function resolveName<T>(input: string | undefined, candidates: readonly Candidate<T>[], what: string): Resolved<T> {
    const typed = input?.trim() ?? "";
    const plural = `${what[0].toUpperCase()}${what.slice(1)}s`;
    const list = () => `${plural}: ${candidates.map(c => c.names[0]).join(", ")}.`;
    if (!typed) return { ok: false, error: `Name a ${what}. ${list()}` };
    if (!candidates.length) return { ok: false, error: `No ${what} "${typed}": there are no ${what}s.` };
    const lower = typed.toLowerCase();
    const stages: ((name: string) => boolean)[] = [
        n => n === typed,
        n => n.toLowerCase() === lower,
        n => n.toLowerCase().startsWith(lower)
    ];
    for (const matches of stages) {
        const hits = candidates.filter(c => c.names.some(matches));
        if (hits.length === 1) return { ok: true, value: hits[0].value };
        if (hits.length > 1) return { ok: false, error: `"${typed}" matches several ${what}s: ${hits.map(c => c.names[0]).join(", ")}.` };
    }
    return { ok: false, error: `No ${what} "${typed}". ${list()}` };
}
