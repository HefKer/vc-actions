/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 hefker and Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import assert from "node:assert/strict";
import { test } from "node:test";

// @ts-expect-error TS5097: node --test needs the .ts extension, Vencord's tsconfig doesn't allow it.
import { nextAfter } from "./cycle.ts";

test("next preset is the one after the current, in list order", () => {
    assert.equal(nextAfter(["Gaming", "Browser", "Code"], "Browser"), "Code");
});

test("next after the last preset wraps to the first", () => {
    assert.equal(nextAfter(["Gaming", "Browser", "Code"], "Code"), "Gaming");
});

test("with no known current preset, next is the first", () => {
    assert.equal(nextAfter(["Gaming", "Browser", "Code"], null), "Gaming");
    assert.equal(nextAfter(["Gaming", "Browser", "Code"], "Deleted"), "Gaming");
});

test("a single preset is its own next", () => {
    assert.equal(nextAfter(["Gaming"], "Gaming"), "Gaming");
});

test("no presets, no next", () => {
    assert.equal(nextAfter([], null), undefined);
});
