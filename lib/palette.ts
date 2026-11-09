/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 hefker and Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/**
 * The `palette`'s entries and the fuzzy, frecency-boosted ranking that it, `favpick` and `userpick` share. Pure, so
 * it's unit tested; lib/picker.tsx draws it.
 */

import type { BindingInfo } from "./bindings";

/** One choice for an arg: shown as `label`, written into the step as `value` (a user's id, a preset's name). */
export interface PaletteChoice {
    label: string;
    value: string;
}

/** What the palette needs to know about an action: its args in order, with their choices read just now. */
export interface PaletteAction {
    id: string;
    description?: string;
    /** `choices` absent or empty: the arg takes free text. */
    args: { name: string; choices?: readonly PaletteChoice[]; }[];
}

export interface PaletteEntry {
    /** What's shown and matched. */
    label: string;
    /** The step(s) it runs, in binding syntax. */
    text: string;
    /** Shown dimmed beside it and matched too: a binding's trigger, a user's username. */
    detail?: string;
    description?: string;
    /** Takes free text typed after it, appended to `text` (args without choices). */
    open: boolean;
}

/**
 * Your bindings first (with their triggers), then every action × its first arg's choices. Hold bindings are left
 * out: run from the palette there's no key to let go of, so they'd stay on.
 */
export function buildEntries(bindings: readonly BindingInfo[], actions: readonly PaletteAction[]): PaletteEntry[] {
    const out: PaletteEntry[] = bindings.filter(b => !b.hold).map(b => {
        const text = b.steps.join("; ");
        return { label: text, text, detail: b.trigger, open: false };
    });
    for (const { id, description, args } of actions) {
        const [first, ...rest] = args;
        if (!first) {
            out.push({ label: id, text: id, description, open: false });
        } else if (!first.choices?.length) {
            out.push({ label: id, text: id, description, open: true });
        } else {
            for (const c of first.choices) {
                out.push({ label: `${id} ${c.label}`, text: `${id} ${c.value}`, description, open: rest.length > 0 });
            }
        }
    }
    return out;
}

export interface PaletteMatch {
    entry: PaletteEntry;
    /** The entry's label, plus any free text. */
    label: string;
    /** The step(s) Enter runs: the entry's text, plus any free text. */
    text: string;
    /** Fuzzy score plus frecency boost. */
    score: number;
    /** How often and lately it was picked (lib/frecency.ts); 0 if never. */
    frecency: number;
}

const WORD_START = /[\s;+_\-./:]/;

/**
 * How well `query` (lowercase, no spaces) fuzzy-matches `target`: its letters must appear in order. Each letter
 * scores, more at a word start or right after the previous one; gaps, a late start and length cost a little.
 * null when it doesn't match.
 */
function fuzzyScore(query: string, target: string): number | null {
    if (!query) return 0;
    const t = target.toLowerCase();
    const bonus = (j: number) => 1 + (j === 0 || WORD_START.test(target[j - 1])
        || (target[j] !== t[j] && target[j - 1] === t[j - 1]) ? 3 : 0);
    // prev[j]: best score with the previous query letter matched at t[j].
    let prev: (number | null)[] = [...t].map((c, j) => c === query[0] ? bonus(j) - 0.05 * j : null);
    for (let i = 1; i < query.length; i++) {
        const cur: (number | null)[] = Array(t.length).fill(null);
        for (let j = i; j < t.length; j++) {
            if (t[j] !== query[i]) continue;
            let best: number | null = null;
            for (let k = 0; k < j; k++) {
                const p = prev[k];
                if (p == null) continue;
                const s = p + (k === j - 1 ? 3 : -0.05 * (j - k - 1));
                if (best == null || s > best) best = s;
            }
            if (best != null) cur[j] = best + bonus(j);
        }
        prev = cur;
    }
    const hits = prev.filter((s): s is number => s != null);
    return hits.length ? Math.max(...hits) - 0.01 * t.length : null;
}

/**
 * Most frecency adds to a fuzzy score (reached at ~7 recent picks): it reorders close matches, but a clearly better
 * match still wins (`mute` typed out beats a much-used `unmute`).
 */
export const MAX_BOOST = 3;

/** What frecency adds to a match's score: grows with its log, so the first picks count most. */
export const usageBoost = (frecency: number) => Math.min(MAX_BOOST, Math.log2(1 + frecency));

function matchEntry(words: string[], entry: PaletteEntry, frecency: number): PaletteMatch | null {
    // An open entry may leave trailing words over as free text; prefer giving the match as many words as it takes.
    for (let i = words.length; i >= (entry.open ? Math.min(1, words.length) : words.length); i--) {
        const head = words.slice(0, i).join("").toLowerCase();
        const scores = [fuzzyScore(head, entry.label), entry.detail ? fuzzyScore(head, entry.detail) : null]
            .filter((s): s is number => s != null);
        if (!scores.length) continue;
        const tail = words.slice(i).join(" ");
        return {
            entry,
            label: tail ? `${entry.label} ${tail}` : entry.label,
            text: tail ? `${entry.text} ${tail}` : entry.text,
            score: Math.max(...scores) + usageBoost(frecency),
            frecency
        };
    }
    return null;
}

/**
 * The entries `query` fuzzy-matches, best first. `frecency` (default: none used) boosts entries picked often and
 * lately; with an empty query that's the whole order. Equal scores go by frecency, then entry order (bindings first).
 */
export function rankEntries(query: string, entries: readonly PaletteEntry[], frecency: (e: PaletteEntry) => number = () => 0): PaletteMatch[] {
    const words = query.trim().split(/\s+/).filter(Boolean);
    return entries
        .map(e => matchEntry(words, e, frecency(e)))
        .filter((m): m is PaletteMatch => m != null)
        .sort((a, b) => b.score - a.score || b.frecency - a.frecency);
}
