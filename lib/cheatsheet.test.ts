/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 hefker and Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import assert from "node:assert/strict";
import { test } from "node:test";

// @ts-expect-error TS5097: node --test resolves only the real file name; tsc still type-checks the import.
import { groupByLeader } from "./cheatsheet.ts";

test("combo bindings form one group with no leader, in setting order", () => {
    assert.deepEqual(groupByLeader([
        { trigger: "ctrl+alt+p", steps: ["popout"] },
        { trigger: "ctrl+alt+1", steps: ["stream Gaming"] }
    ]), [
        { leader: null, rows: [{ keys: "ctrl+alt+p", steps: "popout" }, { keys: "ctrl+alt+1", steps: "stream Gaming" }] }
    ]);
});

test("sequences group under their leader, after the plain combos, leaders in setting order", () => {
    assert.deepEqual(groupByLeader([
        { trigger: "ctrl+space v j", steps: ["stream Gaming"] },
        { trigger: "f8", steps: ["stopstream"] },
        { trigger: "ctrl+b p", steps: ["popout"] },
        { trigger: "ctrl+space  v k", steps: ["stopstream"] }
    ]), [
        { leader: null, rows: [{ keys: "f8", steps: "stopstream" }] },
        { leader: "ctrl+space", rows: [{ keys: "v j", steps: "stream Gaming" }, { keys: "v k", steps: "stopstream" }] },
        { leader: "ctrl+b", rows: [{ keys: "p", steps: "popout" }] }
    ]);
});

test("a macro's steps show joined by ;", () => {
    assert.deepEqual(groupByLeader([{ trigger: "ctrl+alt+g", steps: ["stream Gaming", "popout"] }]), [
        { leader: null, rows: [{ keys: "ctrl+alt+g", steps: "stream Gaming; popout" }] }
    ]);
});

test("no bindings, no groups", () => {
    assert.deepEqual(groupByLeader([]), []);
});
