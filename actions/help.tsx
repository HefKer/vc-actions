/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 hefker and Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { type CheatsheetGroup, groupByLeader } from "../lib/cheatsheet";
import { overlay } from "../lib/overlay";
import { defineAction } from "../registry";

const kbd = { fontFamily: "var(--font-code, monospace)", paddingRight: 16, whiteSpace: "nowrap" } as const;

function Cheatsheet({ groups }: { groups: CheatsheetGroup[]; }) {
    return (
        <div>
            <div style={{ fontWeight: 700, marginBottom: 4 }}>VcActions bindings</div>
            {groups.map(g => (
                <div key={g.leader ?? ""} style={{ marginTop: 6 }}>
                    {g.leader && <div style={{ ...kbd, opacity: 0.7 }}>{g.leader} …</div>}
                    <table style={{ borderCollapse: "collapse", marginLeft: g.leader ? 12 : 0 }}>
                        <tbody>
                            {g.rows.map((r, i) => (
                                <tr key={i}>
                                    <td style={kbd}>{r.keys}</td>
                                    <td>{r.steps}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ))}
            <div style={{ marginTop: 6, opacity: 0.6, fontSize: 12 }}>Any key closes</div>
        </div>
    );
}

export default defineAction({
    id: "help",
    description: "Show a cheatsheet of the current bindings, grouped by leader, until the next key",
    run({ win = window, bindings = [], reply }) {
        if (!bindings.length) return reply("No bindings set.");
        const hide = overlay(win.document, "panel").show(<Cheatsheet groups={groupByLeader(bindings)} />, { duration: null });
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
