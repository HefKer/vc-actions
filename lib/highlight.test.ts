/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 hefker and Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import assert from "node:assert/strict";
import { test } from "node:test";

// @ts-expect-error TS5097: node --test resolves only the real file name; tsc still type-checks the import.
import { type Token, tokenize, tokenizeLine } from "./highlight.ts";

/** Tokens without the whitespace, as `type:text`, for short expectations. */
const brief = (tokens: Token[]) => tokens.filter(t => t.type !== "text").map(t => `${t.type}:${t.text}`);

test("a binding: trigger, =, action, args, ; and a comment", () => {
    assert.deepEqual(brief(tokenizeLine("ctrl+alt+g = stream My Preset; popout  # go live")), [
        "trigger:ctrl+alt+g", "eq:=", "action:stream", "arg:My", "arg:Preset", "sep:;", "action:popout", "comment:# go live"
    ]);
});

test("a sequence's combos are each a trigger token", () => {
    assert.deepEqual(brief(tokenizeLine("ctrl+space f n = fav next")), [
        "trigger:ctrl+space", "trigger:f", "trigger:n", "eq:=", "action:fav", "arg:next"
    ]);
});

test("hold and on are keywords, the event after on is an event", () => {
    assert.deepEqual(brief(tokenizeLine("hold ctrl+m = unmute")), ["keyword:hold", "trigger:ctrl+m", "eq:=", "action:unmute"]);
    assert.deepEqual(brief(tokenizeLine("On vcjoin = gotocall")), ["keyword:On", "event:vcjoin", "eq:=", "action:gotocall"]);
    // While typing, before the trigger: still the keyword.
    assert.deepEqual(brief(tokenizeLine("hold ")), ["keyword:hold"]);
    // A lone word named hold is the trigger the parser would read.
    assert.deepEqual(brief(tokenizeLine("hold")), ["trigger:hold"]);
});

test("a right side starting with + is a group label, spaces and all", () => {
    assert.deepEqual(brief(tokenizeLine("ctrl+space c = +config stuff ")), ["trigger:ctrl+space", "trigger:c", "eq:=", "group:+config stuff"]);
});

test("a # anywhere starts the comment, as the parser cuts it", () => {
    assert.deepEqual(brief(tokenizeLine("# just a comment = no")), ["comment:# just a comment = no"]);
    assert.deepEqual(brief(tokenizeLine("ctrl+a = react #1")), ["trigger:ctrl+a", "eq:=", "action:react", "comment:#1"]);
});

test("a line without = is all trigger; only the first = splits", () => {
    assert.deepEqual(brief(tokenizeLine("ctrl+alt")), ["trigger:ctrl+alt"]);
    assert.deepEqual(brief(tokenizeLine("ctrl+a = customstatus a=b")), ["trigger:ctrl+a", "eq:=", "action:customstatus", "arg:a=b"]);
});

test("empty steps leave just the separators", () => {
    assert.deepEqual(brief(tokenizeLine("ctrl+a = ;;")), ["trigger:ctrl+a", "eq:=", "sep:;", "sep:;"]);
});

test("the tokens join back to the text, line by line", () => {
    const text = "  hold  ctrl+m =  unmute \n\n on vcjoin=gotocall;popout#x\nctrl+space c = +cfg\t\n\tctrl+a b = vcjoin General (Friends) ; help ";
    const lines = tokenize(text);
    assert.equal(lines.length, 5);
    assert.equal(lines.map(l => l.map(t => t.text).join("")).join("\n"), text);
    assert.ok(lines.every(l => l.every(t => t.text.length > 0)));
});
