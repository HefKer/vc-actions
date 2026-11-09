/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 hefker and Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import assert from "node:assert/strict";
import { test } from "node:test";

// @ts-expect-error TS5097: node --test needs the .ts extension, Vencord's tsconfig doesn't allow it.
import { frecency, HALF_LIFE, recordUse, type Uses } from "./frecency.ts";

const NOW = 1_000_000_000_000;

test("never used scores 0; one pick just now scores 1", () => {
    assert.equal(frecency(undefined, NOW), 0);
    assert.equal(frecency(recordUse({}, "popout", NOW).popout, NOW), 1);
});

test("a score halves every half-life", () => {
    const uses = recordUse({}, "popout", NOW);
    assert.equal(frecency(uses.popout, NOW + HALF_LIFE), 0.5);
    assert.equal(frecency(uses.popout, NOW + 2 * HALF_LIFE), 0.25);
});

test("each pick adds 1 to the decayed score", () => {
    let uses = recordUse({}, "popout", NOW);
    uses = recordUse(uses, "popout", NOW + HALF_LIFE);
    assert.deepEqual(uses.popout, { score: 1.5, at: NOW + HALF_LIFE });
});

test("often but long ago weighs less than a couple of picks today", () => {
    let uses: Uses = {};
    for (let i = 0; i < 10; i++) uses = recordUse(uses, "old", NOW - 30 * 24 * 3600e3);
    uses = recordUse(recordUse(uses, "new", NOW), "new", NOW);
    assert.ok(frecency(uses.new, NOW) > frecency(uses.old, NOW));
});

test("past the cap the lowest-scoring keys are dropped, never the one just picked", () => {
    let uses = recordUse(recordUse({}, "a", NOW), "a", NOW);
    uses = recordUse(uses, "b", NOW - HALF_LIFE);
    uses = recordUse(uses, "c", NOW, 2);
    assert.deepEqual(Object.keys(uses).sort(), ["a", "c"]);
    let busy = recordUse(recordUse({}, "a", NOW), "a", NOW);
    busy = recordUse(recordUse(busy, "b", NOW), "b", NOW);
    assert.deepEqual(Object.keys(recordUse(busy, "c", NOW, 2)).sort(), ["a", "c"]);
});

test("recording leaves the given uses untouched", () => {
    const uses = recordUse({}, "a", NOW);
    recordUse(uses, "a", NOW);
    assert.equal(uses.a.score, 1);
});
