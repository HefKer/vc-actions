/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 hefker and Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import assert from "node:assert/strict";
import { test } from "node:test";

// @ts-expect-error TS5097: node --test needs the .ts extension, Vencord's tsconfig doesn't allow it.
import { isStatus, streamStatusChange, toggleStatus } from "./statusLogic.ts";

test("isStatus accepts the four statuses only", () => {
    assert.ok(isStatus("dnd"));
    assert.ok(!isStatus("offline"));
    assert.ok(!isStatus(undefined));
});

test("toggle onto a status remembers the current one", () => {
    assert.deepEqual(toggleStatus("idle", "dnd", null), { set: "dnd", remember: "idle" });
});

test("toggle off a status restores the remembered one", () => {
    assert.deepEqual(toggleStatus("dnd", "dnd", "idle"), { set: "idle", remember: null });
});

test("toggle off with nothing remembered goes online", () => {
    assert.deepEqual(toggleStatus("dnd", "dnd", null), { set: "online", remember: null });
    assert.deepEqual(toggleStatus("dnd", "dnd", "dnd"), { set: "online", remember: null });
});

test("going live sets dnd and saves the status", () => {
    assert.deepEqual(streamStatusChange(true, "online", null), { set: "dnd", saved: "online" });
});

test("going live while dnd or invisible changes nothing", () => {
    assert.deepEqual(streamStatusChange(true, "dnd", null), { saved: null });
    assert.deepEqual(streamStatusChange(true, "invisible", null), { saved: null });
});

test("going live again while saved keeps the first saved status", () => {
    assert.deepEqual(streamStatusChange(true, "dnd", "idle"), { saved: "idle" });
});

test("stream end restores the saved status if still dnd", () => {
    assert.deepEqual(streamStatusChange(false, "dnd", "idle"), { set: "idle", saved: null });
});

test("stream end leaves a status the user changed meanwhile", () => {
    assert.deepEqual(streamStatusChange(false, "online", "idle"), { saved: null });
});

test("stream end with nothing saved does nothing", () => {
    assert.deepEqual(streamStatusChange(false, "dnd", null), { saved: null });
});
