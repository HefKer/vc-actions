/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 hefker and Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import assert from "node:assert/strict";
import { test } from "node:test";

// @ts-expect-error TS5097: node --test needs the .ts extension, Vencord's tsconfig doesn't allow it.
import { MAX_SELECTED, type ModeState, pressKey, rebase, startMode } from "./messageMode.ts";

const ids = ["m1", "m2", "m3", "m4", "m5"];

/** Press each key in turn, returning the last result. */
function keys(state: ModeState, pressed: string[], list: readonly string[] = ids) {
    let result = { state } as ReturnType<typeof pressKey>;
    for (const k of pressed) result = pressKey(result.state, k, list);
    return result;
}

test("entering puts the cursor on the newest message", () => {
    assert.deepEqual(startMode(ids), { cursor: "m5", selected: [], count: "" });
});

test("entering a channel with nothing shown has no cursor", () => {
    assert.equal(startMode([]).cursor, null);
});

test("k moves up to older messages, j back down", () => {
    assert.equal(keys(startMode(ids), ["k"]).state.cursor, "m4");
    assert.equal(keys(startMode(ids), ["k", "k", "j"]).state.cursor, "m4");
});

test("arrow keys move like j and k", () => {
    assert.equal(keys(startMode(ids), ["ArrowUp", "ArrowUp", "ArrowDown"]).state.cursor, "m4");
});

test("moves stop at either end", () => {
    assert.equal(keys(startMode(ids), ["j"]).state.cursor, "m5");
    assert.equal(keys(startMode(ids), ["9", "k"]).state.cursor, "m1");
});

test("a count prefix repeats the move and is used up by it", () => {
    const r = keys(startMode(ids), ["3", "k"]);
    assert.equal(r.state.cursor, "m2");
    assert.equal(r.state.count, "");
    assert.equal(keys(r.state, ["j"]).state.cursor, "m3");
});

test("counts take several digits, and 0 after a digit", () => {
    const many = Array.from({ length: 30 }, (_, i) => `m${i}`);
    assert.equal(keys(startMode(many), ["1", "0", "k"], many).state.cursor, "m19");
});

test("a leading 0 is not a count", () => {
    assert.equal(keys(startMode(ids), ["0"]).state.count, "");
});

test("g goes to the oldest shown message, G to the newest, ignoring a count", () => {
    assert.equal(keys(startMode(ids), ["g"]).state.cursor, "m1");
    assert.equal(keys(startMode(ids), ["g", "2", "G"]).state.cursor, "m5");
    assert.equal(keys(startMode(ids), ["Home"]).state.cursor, "m1");
});

test("an unknown key drops a pending count", () => {
    const r = keys(startMode(ids), ["3", "x", "k"]);
    assert.equal(r.state.cursor, "m4");
});

test("r replies with a ping, R without, to the cursor's message", () => {
    assert.deepEqual(keys(startMode(ids), ["k", "r"]).command, { type: "reply", id: "m4", mention: true });
    assert.deepEqual(keys(startMode(ids), ["R"]).command, { type: "reply", id: "m5", mention: false });
});

test("e reacts to the cursor's message", () => {
    assert.deepEqual(keys(startMode(ids), ["g", "e"]).command, { type: "react", id: "m1" });
});

test("f with nothing selected forwards the cursor's message", () => {
    assert.deepEqual(keys(startMode(ids), ["f"]).command, { type: "forward", ids: ["m5"] });
});

test("space marks and unmarks the cursor's message", () => {
    const marked = keys(startMode(ids), [" "]);
    assert.deepEqual(marked.state.selected, ["m5"]);
    assert.deepEqual(keys(marked.state, [" "]).state.selected, []);
});

test("f with a selection forwards it oldest first, whatever the marking order", () => {
    const r = keys(startMode(ids), [" ", "3", "k", " ", "j", " ", "f"]);
    assert.deepEqual(r.command, { type: "forward", ids: ["m2", "m3", "m5"] });
});

test("the selection stops at MAX_SELECTED and says so", () => {
    const many = Array.from({ length: MAX_SELECTED + 2 }, (_, i) => `m${i}`);
    let state = startMode(many);
    for (let i = 0; i < MAX_SELECTED; i++) state = keys(state, [" ", "k"], many).state;
    const r = pressKey(state, " ", many);
    assert.deepEqual(r.command, { type: "full" });
    assert.equal(r.state.selected.length, MAX_SELECTED);
    // Unmarking still works when full.
    assert.equal(keys(state, ["j", " "], many).state.selected.length, MAX_SELECTED - 1);
});

test("Esc clears a pending count first, then the selection, then exits", () => {
    const counted = keys(startMode(ids), [" ", "3"]);
    const cleared = pressKey(counted.state, "Escape", ids);
    assert.equal(cleared.state.count, "");
    assert.deepEqual(cleared.state.selected, ["m5"]);
    assert.equal(cleared.command, undefined);
    const unselected = pressKey(cleared.state, "Escape", ids);
    assert.deepEqual(unselected.state.selected, []);
    assert.equal(unselected.command, undefined);
    assert.deepEqual(pressKey(unselected.state, "Escape", ids).command, { type: "exit" });
});

test("with nothing shown, commands do nothing", () => {
    for (const k of ["r", "e", "f", " "]) assert.equal(pressKey(startMode([]), k, []).command, undefined);
});

test("a cursor no longer shown doesn't reply, react or forward", () => {
    const state = { cursor: "gone", selected: [], count: "" };
    assert.equal(pressKey(state, "r", ids).command, undefined);
    assert.equal(pressKey(state, "f", ids).command, undefined);
});

test("moving from a cursor no longer shown starts at the newest", () => {
    assert.equal(pressKey({ cursor: "gone", selected: [], count: "" }, "k", ids).state.cursor, "m4");
});

test("new messages arriving leave the cursor where it is", () => {
    const { state } = keys(startMode(ids), ["k"]);
    assert.equal(rebase(state, ids, [...ids, "m6"]), state);
});

test("a deleted cursor message moves the cursor to the next newer one still shown", () => {
    const { state } = keys(startMode(ids), ["3", "k"]);
    assert.equal(rebase(state, ids, ["m1", "m4", "m5"]).cursor, "m4");
});

test("a deleted newest cursor message falls back to the new newest", () => {
    assert.equal(rebase(startMode(ids), ids, ["m1", "m2"]).cursor, "m2");
});

test("deleted messages drop out of the selection", () => {
    const { state } = keys(startMode(ids), [" ", "k", " "]);
    assert.deepEqual(rebase(state, ids, ["m1", "m2", "m3", "m4"]).selected, ["m4"]);
});

test("everything gone leaves no cursor", () => {
    assert.equal(rebase(startMode(ids), ids, []).cursor, null);
});
