/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 hefker and Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/** Something a typed name can pick: a preset, voice channel, user or sound. */
export interface Candidate<T> {
    /** Every name it answers to (a user: nickname, display name, username). The first is shown in errors. */
    names: readonly string[];
    value: T;
    /** Shown in errors instead of the first name, e.g. "General (Other server)". */
    label?: string;
    /** Lower tiers are tried first within each stage (voice-channel participants 0, friends 1). Default 0. */
    tier?: number;
}

/** A name that matched nothing, or several; the message lists the candidates. */
export class ResolveError extends Error { }

export type Resolved<T> = { ok: true; value: T; } | { ok: false; error: string; };

const MAX_LISTED = 15;

const shown = (c: Candidate<unknown>) => c.label ?? c.names[0];

function listOf(cs: readonly Candidate<unknown>[]) {
    const names = cs.slice(0, MAX_LISTED).map(shown).join(", ");
    return cs.length > MAX_LISTED ? `${names}, and ${cs.length - MAX_LISTED} more` : names;
}

/**
 * Pick the candidate `input` names. Stages, in order: exact name, case-insensitive name, unique
 * case-insensitive prefix; within a stage the lowest tier with any hit decides. Several hits in that
 * tier is an error (no guessing). Every error names the candidates. Pure.
 */
export function resolveName<T>(input: string | undefined, candidates: readonly Candidate<T>[], what: string): Resolved<T> {
    const typed = input?.trim() ?? "";
    const plural = `${what[0].toUpperCase()}${what.slice(1)}s`;
    if (!typed) return { ok: false, error: `Name a ${what}. ${plural}: ${listOf(candidates)}.` };
    if (!candidates.length) return { ok: false, error: `No ${what} "${typed}": there are no ${what}s.` };

    const lower = typed.toLowerCase();
    const stages: ((name: string) => boolean)[] = [
        n => n === typed,
        n => n.toLowerCase() === lower,
        n => n.toLowerCase().startsWith(lower)
    ];
    const tiers = [...new Set(candidates.map(c => c.tier ?? 0))].sort((a, b) => a - b);
    for (const matches of stages) {
        for (const tier of tiers) {
            const hits = candidates.filter(c => (c.tier ?? 0) === tier && c.names.some(matches));
            if (hits.length === 1) return { ok: true, value: hits[0].value };
            if (hits.length > 1) return { ok: false, error: `"${typed}" matches several ${what}s: ${listOf(hits)}.` };
        }
    }
    return { ok: false, error: `No ${what} "${typed}". ${plural}: ${listOf(candidates)}.` };
}

/** A user arg: a user id (or `<@id>` mention) is taken as is; anything else is a name, see resolveName. */
export function resolveUser(input: string | undefined, candidates: readonly Candidate<string>[]): Resolved<string> {
    const id = input?.trim().match(/^(?:<@!?)?(\d{17,20})>?$/)?.[1];
    return id ? { ok: true, value: id } : resolveName(input, candidates, "user");
}
