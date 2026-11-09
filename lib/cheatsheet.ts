/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 hefker and Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/**
 * The `help` cheatsheet's layout: the current bindings grouped by leader, sequences under a labelled group in a
 * section headed by its label, then the event hooks. Pure, so it's unit tested.
 */

import type { BindingInfo, GroupLabel, HookInfo } from "./bindings";

export interface CheatsheetRow {
    /**
     * The whole trigger for combos (`hold ` first for a hold binding); what follows the leader for sequences, or
     * what follows the section's keys in a section.
     */
    keys: string;
    /** The steps joined as in the setting. */
    steps: string;
}

export interface CheatsheetGroup {
    /** The leader shared by this group's sequences; null for the plain combos. */
    leader: string | null;
    /** The leader's group label, if it has one. */
    label?: GroupLabel;
    /** Bindings under no labelled group past the leader. */
    rows: CheatsheetRow[];
    /** Sequences under a labelled group past the leader, by their longest labelled prefix, in setting order. */
    sections: CheatsheetSection[];
}

export interface CheatsheetSection {
    /** The group's keys after the leader. */
    keys: string;
    label: GroupLabel;
    rows: CheatsheetRow[];
}

/**
 * Group bindings by their trigger's first combo. Plain combos come first, then each leader in setting order. Within
 * a leader, sequences under a labelled group go to that group's section (the longest labelled prefix wins).
 */
export function groupByLeader(bindings: readonly BindingInfo[]): CheatsheetGroup[] {
    const groups = new Map<string | null, CheatsheetGroup>([[null, { leader: null, rows: [], sections: [] }]]);
    for (const { trigger, steps, hold, groups: labels = [] } of bindings) {
        const [first, ...rest] = trigger.trim().split(/\s+/);
        const leader = rest.length ? first : null;
        let group = groups.get(leader);
        if (!group) groups.set(leader, group = { leader, rows: [], sections: [] });
        const leaderLabel = labels.find(l => l.depth === 1)?.label;
        if (leaderLabel && !group.label) group.label = leaderLabel;
        const row = { keys: rest.length ? rest.join(" ") : hold ? `hold ${first}` : first, steps: steps.join("; ") };
        const deepest = labels.at(-1);
        if (!deepest || deepest.depth < 2) {
            group.rows.push(row);
            continue;
        }
        const keys = rest.slice(0, deepest.depth - 1).join(" ");
        let section = group.sections.find(s => s.keys === keys);
        if (!section) group.sections.push(section = { keys, label: deepest.label, rows: [] });
        section.rows.push({ ...row, keys: rest.slice(deepest.depth - 1).join(" ") });
    }
    return [...groups.values()].filter(g => g.rows.length || g.sections.length);
}

/** The event hooks as rows, for their own heading after the bindings: the event as keys. */
export const hookRows = (hooks: readonly HookInfo[]): CheatsheetRow[] =>
    hooks.map(h => ({ keys: h.event, steps: h.steps.join("; ") }));
