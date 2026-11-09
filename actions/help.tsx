/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 hefker and Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { type CheatsheetGroup, type CheatsheetRow, groupByLeader, hookRows } from "../lib/cheatsheet";
import { GroupName } from "../lib/hint";
import { overlay } from "../lib/overlay";
import { defineAction } from "../registry";

const kbd = { fontFamily: "var(--font-code, monospace)", paddingRight: 16, whiteSpace: "nowrap" } as const;

function Rows({ rows, indent }: { rows: CheatsheetRow[]; indent: number; }) {
    return (
        <table style={{ borderCollapse: "collapse", marginLeft: indent }}>
            <tbody>
                {rows.map((r, i) => (
                    <tr key={i}>
                        <td style={kbd}>{r.keys}</td>
                        <td>{r.steps}</td>
                    </tr>
                ))}
            </tbody>
        </table>
    );
}

function Cheatsheet({ groups, hooks }: { groups: CheatsheetGroup[]; hooks: CheatsheetRow[]; }) {
    return (
        <div>
            <div style={{ fontWeight: 700, marginBottom: 4 }}>QuickActions bindings</div>
            {groups.map(g => (
                <div key={g.leader ?? ""} style={{ marginTop: 6 }}>
                    {g.leader && (
                        <div>
                            <span style={{ ...kbd, opacity: 0.7 }}>{g.leader} …</span>
                            {g.label && <GroupName group={g.label} />}
                        </div>
                    )}
                    {g.rows.length > 0 && <Rows rows={g.rows} indent={g.leader ? 12 : 0} />}
                    {g.sections.map(s => (
                        <div key={s.keys} style={{ marginLeft: 12, marginTop: 2 }}>
                            <div>
                                <span style={{ ...kbd, opacity: 0.7 }}>{s.keys}</span>
                                <GroupName group={s.label} />
                            </div>
                            <Rows rows={s.rows} indent={12} />
                        </div>
                    ))}
                </div>
            ))}
            {hooks.length > 0 && (
                <div style={{ marginTop: 6 }}>
                    <div style={{ ...kbd, opacity: 0.7 }}>on event</div>
                    <Rows rows={hooks} indent={12} />
                </div>
            )}
            <div style={{ marginTop: 6, opacity: 0.6, fontSize: 12 }}>Any key closes</div>
        </div>
    );
}

export default defineAction({
    id: "help",
    description: "Show a cheatsheet of the current bindings, grouped by leader and group label, and event hooks, until the next key",
    run({ win = window, bindings = [], hooks = [], reply }) {
        if (!bindings.length && !hooks.length) return reply("No bindings set.");
        const sheet = <Cheatsheet groups={groupByLeader(bindings)} hooks={hookRows(hooks)} />;
        const hide = overlay(win.document, "panel").show(sheet, { duration: null });
        // Added while the help key is being dispatched on this same target, so that key doesn't close it.
        const onKey = (e: KeyboardEvent) => {
            win.removeEventListener("keydown", onKey, true);
            hide();
            if (e.key === "Escape") {
                e.preventDefault();
                e.stopPropagation();
            }
        };
        win.addEventListener("keydown", onKey, true);
    }
});
