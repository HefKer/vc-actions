/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 hefker and Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import assert from "node:assert/strict";
import { test } from "node:test";

// @ts-expect-error TS5097: node --test resolves only the real file name; tsc still type-checks the import.
import { buildEntries } from "./palette.ts";

test("bindings come first, showing their trigger, then each action", () => {
    const entries = buildEntries(
        [{ trigger: "ctrl+alt+g", steps: ["stream Gaming", "popout"] }],
        [{ id: "stopstream", args: [] }]
    );
    assert.deepEqual(entries.map(e => [e.label, e.trigger, e.text, e.open]), [
        ["stream Gaming; popout", "ctrl+alt+g", "stream Gaming; popout", false],
        ["stopstream", undefined, "stopstream", false]
    ]);
});

test("an action's first arg with choices gives one entry per choice; later args stay open for free text", () => {
    const entries = buildEntries([], [
        { id: "stream", args: [{ name: "preset", choices: [{ label: "Gaming", value: "Gaming" }, { label: "Browser", value: "Browser" }] }] },
        { id: "volume", args: [{ name: "user", choices: [{ label: "alice", value: "111" }] }, { name: "level" }] }
    ]);
    assert.deepEqual(entries.map(e => [e.label, e.text, e.open]), [
        ["stream Gaming", "stream Gaming", false],
        ["stream Browser", "stream Browser", false],
        ["volume alice", "volume 111", true]
    ]);
});

test("an arg without choices (or with none right now) makes one open entry for the action", () => {
    const entries = buildEntries([], [
        { id: "vcjoin", args: [{ name: "channel" }] },
        { id: "stream", args: [{ name: "preset", choices: [] }] }
    ]);
    assert.deepEqual(entries.map(e => [e.label, e.text, e.open]), [
        ["vcjoin", "vcjoin", true],
        ["stream", "stream", true]
    ]);
});
