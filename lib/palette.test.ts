/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 hefker and Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import assert from "node:assert/strict";
import { test } from "node:test";

// @ts-expect-error TS5097: node --test resolves only the real file name; tsc still type-checks the import.
import { buildEntries, type PaletteEntry, rankEntries } from "./palette.ts";

const entry = (label: string, more: Partial<PaletteEntry> = {}): PaletteEntry => ({ label, text: label, open: false, ...more });
const labels = (query: string, entries: PaletteEntry[]) => rankEntries(query, entries).map(m => m.label);

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

test("an empty query lists every entry in order", () => {
    assert.deepEqual(labels("", [entry("popout"), entry("help")]), ["popout", "help"]);
});

test("a query matches entries containing its letters in order, case-insensitively; others drop out", () => {
    assert.deepEqual(labels("SGm", [entry("stream Gaming"), entry("stopstream"), entry("popout")]), ["stream Gaming"]);
});

test("word starts and runs of letters rank above scattered matches", () => {
    assert.deepEqual(labels("sg", [entry("stopstream go"), entry("stream Gaming")]), ["stream Gaming", "stopstream go"]);
    assert.deepEqual(labels("pop", [entry("preset Office Pc"), entry("popout")]), ["popout", "preset Office Pc"]);
});

test("spaces in the query are ignored", () => {
    assert.deepEqual(labels("str gam", [entry("streamGaming")]), ["streamGaming"]);
});

test("a binding matches on its trigger too", () => {
    assert.deepEqual(labels("ctrl+alt+g", [entry("popout"), entry("stream Gaming", { trigger: "ctrl+alt+g" })]), ["stream Gaming"]);
});

test("equal matches keep entry order, so bindings stay ahead of actions", () => {
    const ranked = rankEntries("stream", [entry("stream Gaming", { trigger: "ctrl+alt+1" }), entry("stream Gaming")]);
    assert.deepEqual(ranked.map(m => m.entry.trigger), ["ctrl+alt+1", undefined]);
});

test("a match runs the entry's text", () => {
    assert.deepEqual(rankEntries("vol al", [entry("volume alice", { text: "volume 111" })]).map(m => m.text), ["volume 111"]);
});

test("an open entry takes the words after the ones that match it as free text", () => {
    const open = [entry("volume alice", { text: "volume 111", open: true }), entry("vcjoin", { open: true })];
    assert.deepEqual(rankEntries("vol ali +20", open).map(m => [m.label, m.text]), [["volume alice +20", "volume 111 +20"]]);
    assert.deepEqual(rankEntries("vcjoin General Chat", open).map(m => [m.label, m.text]), [["vcjoin General Chat", "vcjoin General Chat"]]);
});

test("a closed entry takes no free text", () => {
    assert.deepEqual(labels("popout alice", [entry("popout")]), []);
});
