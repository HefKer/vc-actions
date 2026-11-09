/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 hefker and Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/** The `help` cheatsheet's layout: the current bindings grouped by leader. Pure, so it's unit tested. */

import type { BindingInfo } from "./bindings";

export interface CheatsheetRow {
    /** The whole trigger for combos (`hold ` first for a hold binding); what follows the leader for sequences. */
    keys: string;
    /** The steps joined as in the setting. */
    steps: string;
}

export interface CheatsheetGroup {
    /** The leader shared by this group's sequences; null for the plain combos. */
    leader: string | null;
    rows: CheatsheetRow[];
}

/** Group bindings by their trigger's first combo. Plain combos come first, then each leader in setting order. */
export function groupByLeader(bindings: readonly BindingInfo[]): CheatsheetGroup[] {
    const groups = new Map<string | null, CheatsheetRow[]>([[null, []]]);
    for (const { trigger, steps, hold } of bindings) {
        const [first, ...rest] = trigger.trim().split(/\s+/);
        const leader = rest.length ? first : null;
        if (!groups.has(leader)) groups.set(leader, []);
        groups.get(leader)!.push({ keys: rest.length ? rest.join(" ") : hold ? `hold ${first}` : first, steps: steps.join("; ") });
    }
    return [...groups].filter(([, rows]) => rows.length).map(([leader, rows]) => ({ leader, rows }));
}
