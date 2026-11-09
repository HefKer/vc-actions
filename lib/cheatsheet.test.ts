/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 hefker and Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import assert from "node:assert/strict";
import { test } from "node:test";

// @ts-expect-error TS5097: node --test resolves only the real file name; tsc still type-checks the import.
import { groupByLeader, hookRows } from "./cheatsheet.ts";

test("combo bindings form one group with no leader, in setting order", () => {
    assert.deepEqual(groupByLeader([
        { trigger: "ctrl+alt+p", steps: ["popout"] },
        { trigger: "ctrl+alt+1", steps: ["stream Gaming"] }
    ]), [
        { leader: null, sections: [], rows: [{ keys: "ctrl+alt+p", steps: "popout" }, { keys: "ctrl+alt+1", steps: "stream Gaming" }] }
    ]);
});

test("sequences group under their leader, after the plain combos, leaders in setting order", () => {
    assert.deepEqual(groupByLeader([
        { trigger: "ctrl+space v j", steps: ["stream Gaming"] },
        { trigger: "f8", steps: ["stopstream"] },
        { trigger: "ctrl+b p", steps: ["popout"] },
        { trigger: "ctrl+space  v k", steps: ["stopstream"] }
    ]), [
        { leader: null, sections: [], rows: [{ keys: "f8", steps: "stopstream" }] },
        { leader: "ctrl+space", sections: [], rows: [{ keys: "v j", steps: "stream Gaming" }, { keys: "v k", steps: "stopstream" }] },
        { leader: "ctrl+b", sections: [], rows: [{ keys: "p", steps: "popout" }] }
    ]);
});

test("a macro's steps show joined by ;", () => {
    assert.deepEqual(groupByLeader([{ trigger: "ctrl+alt+g", steps: ["stream Gaming", "popout"] }]), [
        { leader: null, sections: [], rows: [{ keys: "ctrl+alt+g", steps: "stream Gaming; popout" }] }
    ]);
});

test("a hold binding shows hold before its combo", () => {
    assert.deepEqual(groupByLeader([{ trigger: "ctrl+alt+m", steps: ["unmute"], hold: true }]), [
        { leader: null, sections: [], rows: [{ keys: "hold ctrl+alt+m", steps: "unmute" }] }
    ]);
});

test("no bindings, no groups", () => {
    assert.deepEqual(groupByLeader([]), []);
});

test("hooks become rows keyed by their event, steps joined by ;", () => {
    assert.deepEqual(hookRows([
        { event: "vcjoin", steps: ["gotocall"] },
        { event: "streamstart", steps: ["popout", "watch next"] }
    ]), [
        { keys: "vcjoin", steps: "gotocall" },
        { keys: "streamstart", steps: "popout; watch next" }
    ]);
});

test("sequences under a labelled group form its section, by the longest labelled prefix; a labelled leader carries its label", () => {
    const leader = { label: "leader", name: "leader" };
    const config = { label: "⚙️ config", name: "config", icon: "⚙️" };
    const theme = { label: "theme", name: "theme" };
    assert.deepEqual(groupByLeader([
        { trigger: "ctrl+space c p", steps: ["plugins"], groups: [{ depth: 1, label: leader }, { depth: 2, label: config }] },
        { trigger: "ctrl+space m", steps: ["messagemode"], groups: [{ depth: 1, label: leader }] },
        { trigger: "ctrl+space c t d", steps: ["dark"], groups: [{ depth: 1, label: leader }, { depth: 2, label: config }, { depth: 3, label: theme }] },
        { trigger: "ctrl+space c v", steps: ["pluginsettings VcPresets"], groups: [{ depth: 1, label: leader }, { depth: 2, label: config }] },
        { trigger: "ctrl+b x y", steps: ["popout"], groups: [{ depth: 2, label: theme }] }
    ]), [
        {
            leader: "ctrl+space", label: leader, rows: [{ keys: "m", steps: "messagemode" }], sections: [
                { keys: "c", label: config, rows: [{ keys: "p", steps: "plugins" }, { keys: "v", steps: "pluginsettings VcPresets" }] },
                { keys: "c t", label: theme, rows: [{ keys: "d", steps: "dark" }] }
            ]
        },
        { leader: "ctrl+b", rows: [], sections: [{ keys: "x", label: theme, rows: [{ keys: "y", steps: "popout" }] }] }
    ]);
});
