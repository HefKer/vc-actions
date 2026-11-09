/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 hefker and Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import assert from "node:assert/strict";
import { test } from "node:test";

// @ts-expect-error TS5097: node --test needs the .ts extension, Vencord's tsconfig doesn't allow it.
import { type Candidate, resolveName } from "./resolve.ts";

const presets = (...names: string[]): Candidate<string>[] => names.map(n => ({ names: [n], value: n }));

test("an exact name wins", () => {
    assert.deepEqual(resolveName("Gaming", presets("Gaming", "gaming", "Gaming 2"), "preset"), { ok: true, value: "Gaming" });
});

test("with no exact name, a case-insensitive one wins", () => {
    assert.deepEqual(resolveName("gaming", presets("GAMING", "Gaming 2"), "preset"), { ok: true, value: "GAMING" });
});

test("with no full name, a unique case-insensitive prefix wins", () => {
    assert.deepEqual(resolveName("bro", presets("Gaming", "Browser"), "preset"), { ok: true, value: "Browser" });
});

test("a prefix shared by several doesn't guess, and lists the ones it matches", () => {
    assert.deepEqual(resolveName("ga", presets("Gaming", "Game night", "Browser"), "preset"),
        { ok: false, error: `"ga" matches several presets: Gaming, Game night.` });
});

test("no match lists every candidate", () => {
    assert.deepEqual(resolveName("Code", presets("Gaming", "Browser"), "preset"),
        { ok: false, error: `No preset "Code". Presets: Gaming, Browser.` });
});

test("no name given asks for one and lists the candidates", () => {
    assert.deepEqual(resolveName(undefined, presets("Gaming"), "preset"), { ok: false, error: "Name a preset. Presets: Gaming." });
    assert.deepEqual(resolveName("  ", presets("Gaming"), "preset"), { ok: false, error: "Name a preset. Presets: Gaming." });
});

test("with no candidates at all, says so", () => {
    assert.deepEqual(resolveName("Gaming", [], "preset"), { ok: false, error: `No preset "Gaming": there are no presets.` });
});
