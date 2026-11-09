/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 hefker and Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import type { GroupLabel, HintEntry } from "./bindings";

/** Groups (labels, "+ more keys") in the overlay's brand tint; what a key runs in the normal text colour. */
const GROUP_COLOR = "var(--text-brand, #949cf7)";
const ACTION_COLOR = "var(--text-normal, #dbdee1)";

/** A group label as the hint and `help` show it: icon, then `+name`, then the binding count when given. */
export function GroupName({ group, count }: { group: GroupLabel; count?: number; }) {
    return (
        <span style={{ color: GROUP_COLOR, fontWeight: 600 }}>
            {group.icon && `${group.icon} `}+{group.name}
            {count !== undefined && <span style={{ opacity: 0.7, fontWeight: 400 }}> ({count})</span>}
        </span>
    );
}

/**
 * The which-key hint: the keys typed so far (and their group label), then each next key and what it runs or the
 * group it leads into. Drawn into our overlay.
 */
export function WhichKeyHint({ keys, group, next }: { keys: string; group?: GroupLabel; next: HintEntry[]; }) {
    return (
        <div style={{ whiteSpace: "normal" }}>
            <div style={{ marginBottom: 4 }}>
                <span style={{ opacity: 0.7 }}>{keys}</span>
                {group && <span style={{ marginLeft: 12 }}><GroupName group={group} /></span>}
                <span style={{ opacity: 0.7 }}> … (Esc cancels)</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", columnGap: 12, rowGap: 2 }}>
                {next.map(({ key, steps, group, count }) => [
                    <kbd key={`k${key}`} style={{ fontFamily: "var(--font-code, monospace)", fontWeight: 700 }}>{key}</kbd>,
                    <span key={`s${key}`}>
                        {steps
                            ? <span style={{ color: ACTION_COLOR }}>{steps.map(s => s.text).join("; ")}</span>
                            : group
                                ? <GroupName group={group} count={count} />
                                : <span style={{ color: GROUP_COLOR, opacity: 0.7 }}>+ more keys</span>}
                    </span>
                ])}
            </div>
        </div>
    );
}
