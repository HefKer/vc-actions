/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 hefker and Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import assert from "node:assert/strict";
import { test } from "node:test";

// @ts-expect-error TS5097: node --test resolves only the real file name; tsc still type-checks the import.
import { createHookGuard, type HookState, isHookEvent, stateEvents } from "./hooks.ts";

const idle: HookState = { voice: null, live: false, watching: [], mute: false };

test("joining, moving and leaving voice", () => {
    assert.deepEqual(stateEvents(idle, { ...idle, voice: "a" }), ["vcjoin"]);
    assert.deepEqual(stateEvents({ ...idle, voice: "a" }, { ...idle, voice: "b" }), ["vcjoin"]);
    assert.deepEqual(stateEvents({ ...idle, voice: "a" }, idle), ["vcleave"]);
});

test("your stream starting and stopping", () => {
    assert.deepEqual(stateEvents(idle, { ...idle, live: true }), ["streamstart"]);
    assert.deepEqual(stateEvents({ ...idle, live: true }, idle), ["streamstop"]);
});

test("watching: one event per stream started or stopped, stops first", () => {
    assert.deepEqual(stateEvents(idle, { ...idle, watching: ["s1", "s2"] }), ["watchstart", "watchstart"]);
    assert.deepEqual(stateEvents({ ...idle, watching: ["s1"] }, { ...idle, watching: ["s2"] }), ["watchstop", "watchstart"]);
    assert.deepEqual(stateEvents({ ...idle, watching: ["s1", "s2"] }, { ...idle, watching: ["s2", "s1"] }), []);
});

test("mute flag", () => {
    assert.deepEqual(stateEvents(idle, { ...idle, mute: true }), ["muted"]);
    assert.deepEqual(stateEvents({ ...idle, mute: true }, idle), ["unmuted"]);
});

test("no change, no events; several changes at once come in a fixed order", () => {
    assert.deepEqual(stateEvents(idle, { ...idle }), []);
    assert.deepEqual(stateEvents({ ...idle, voice: "a", live: true }, { voice: null, live: false, watching: [], mute: true }),
        ["vcleave", "streamstop", "muted"]);
});

test("isHookEvent knows the events and nothing inherited", () => {
    assert.ok(isHookEvent("vcjoin"));
    assert.ok(!isHookEvent("nosuch"));
    assert.ok(!isHookEvent("toString"));
});

test("hook guard: an event with no hook running or settling is depth 0", () => {
    const guard = createHookGuard(2, 1000);
    const a = guard.start(0)!;
    assert.equal(a.depth, 0);
    a.done(10);
    assert.equal(guard.start(2000)!.depth, 0);
});

test("hook guard: events while a hook runs or settles go one deeper, and past maxDepth are refused", () => {
    const guard = createHookGuard(2, 1000);
    const a = guard.start(0)!;
    const b = guard.start(5)!;
    assert.equal(b.depth, 1);
    a.done(10);
    b.done(20);
    const c = guard.start(500)!;
    assert.equal(c.depth, 2);
    c.done(510);
    assert.equal(guard.start(600), null);
    // Once everything has settled, a new chain starts at 0.
    assert.equal(guard.start(1600)!.depth, 0);
});
