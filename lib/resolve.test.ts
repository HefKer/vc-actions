/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 hefker and Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import assert from "node:assert/strict";
import { test } from "node:test";

// @ts-expect-error TS5097: node --test needs the .ts extension, Vencord's tsconfig doesn't allow it.
import { type Candidate, resolveName, resolveUser } from "./resolve.ts";

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

test("a candidate answers to each of its names, and matching two of them isn't ambiguous", () => {
    const users: Candidate<string>[] = [
        { names: ["Alice", "alice_w", "Ally"], value: "111" },
        { names: ["Bob", "bobby"], value: "222" }
    ];
    assert.deepEqual(resolveName("ally", users, "user"), { ok: true, value: "111" });
    assert.deepEqual(resolveName("al", users, "user"), { ok: true, value: "111" });
    assert.deepEqual(resolveName("Carol", users, "user"), { ok: false, error: `No user "Carol". Users: Alice, Bob.` });
});

test("an earlier tier wins a stage, but a later tier's exact name beats an earlier tier's prefix", () => {
    const users: Candidate<string>[] = [
        { names: ["alex"], value: "in-call", tier: 0 },
        { names: ["alexandra"], value: "friend-1", tier: 1 },
        { names: ["al"], value: "friend-2", tier: 1 }
    ];
    assert.deepEqual(resolveName("alex", users, "user"), { ok: true, value: "in-call" });
    assert.deepEqual(resolveName("ale", users, "user"), { ok: true, value: "in-call" });
    assert.deepEqual(resolveName("al", users, "user"), { ok: true, value: "friend-2" });
    assert.deepEqual(resolveName("alexa", users, "user"), { ok: true, value: "friend-1" });
});

test("candidates listed in an error show their label when they have one", () => {
    const channels: Candidate<string>[] = [
        { names: ["General"], value: "1", tier: 0 },
        { names: ["General"], value: "2", label: "General (Other server)", tier: 1 },
        { names: ["General"], value: "3", label: "General (Third)", tier: 1 }
    ];
    assert.deepEqual(resolveName("General", channels, "voice channel"), { ok: true, value: "1" });
    assert.deepEqual(resolveName("Gen", channels.slice(1), "voice channel"),
        { ok: false, error: `"Gen" matches several voice channels: General (Other server), General (Third).` });
});

test("a long candidate list is cut short", () => {
    const many = presets(...Array.from({ length: 30 }, (_, i) => `p${i}`));
    assert.deepEqual(resolveName("x", many, "preset"),
        { ok: false, error: `No preset "x". Presets: ${Array.from({ length: 15 }, (_, i) => `p${i}`).join(", ")}, and 15 more.` });
});

test("a user arg that is an id is taken as is, even if nobody known has it", () => {
    assert.deepEqual(resolveUser("334442905567756288", []), { ok: true, value: "334442905567756288" });
    assert.deepEqual(resolveUser(" <@334442905567756288> ", []), { ok: true, value: "334442905567756288" });
});

test("a user arg that isn't an id is matched by name", () => {
    const users: Candidate<string>[] = [{ names: ["hefker"], value: "334442905567756288" }, { names: ["123abc"], value: "5" }];
    assert.deepEqual(resolveUser("hef", users), { ok: true, value: "334442905567756288" });
    assert.deepEqual(resolveUser("123", users), { ok: true, value: "5" });
});

test("with no candidates at all, says so", () => {
    assert.deepEqual(resolveName("Gaming", [], "preset"), { ok: false, error: `No preset "Gaming": there are no presets.` });
});
