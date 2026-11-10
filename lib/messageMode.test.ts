/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 hefker and Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import assert from "node:assert/strict";
import { test } from "node:test";

// @ts-expect-error TS5097: node --test needs the .ts extension, Vencord's tsconfig doesn't allow it.
import { labelStrings, matchesQuery, MAX_SELECTED, type ModeState, moveTo, pressKey, rebase, searchMatches, setGoal, showLabels, startMode } from "./messageMode.ts";

const ids = ["m1", "m2", "m3", "m4", "m5"];

/** Press each key in turn, returning the last result. */
function keys(state: ModeState, pressed: string[], list: readonly string[] = ids, text?: (id: string) => string) {
    let result = { state } as ReturnType<typeof pressKey>;
    for (const k of pressed) result = pressKey(result.state, k, list, text);
    return result;
}

test("entering puts the cursor on the newest message", () => {
    assert.deepEqual(startMode(ids), { cursor: "m5", selected: [], count: "", search: null, lastSearch: "", labels: null, goal: null });
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
    const state = { ...startMode(ids), cursor: "gone" };
    assert.equal(pressKey(state, "r", ids).command, undefined);
    assert.equal(pressKey(state, "f", ids).command, undefined);
});

test("moving from a cursor no longer shown starts at the newest", () => {
    assert.equal(pressKey({ ...startMode(ids), cursor: "gone" }, "k", ids).state.cursor, "m4");
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

test("one-message commands act on the cursor's message", () => {
    const expect: Record<string, string> = { E: "edit", p: "pin", d: "delete", t: "thread", o: "parent" };
    for (const [key, type] of Object.entries(expect)) assert.deepEqual(keys(startMode(ids), ["k", key]).command, { type, id: "m4" });
});

test("c and l copy the selection oldest first, else the cursor's message", () => {
    assert.deepEqual(keys(startMode(ids), ["c"]).command, { type: "copy", ids: ["m5"] });
    assert.deepEqual(keys(startMode(ids), [" ", "k", "k", " ", "l"]).command, { type: "link", ids: ["m3", "m5"] });
});

test("d with a selection deletes the selection oldest first, else the cursor's message", () => {
    assert.deepEqual(keys(startMode(ids), [" ", "k", "k", " ", "d"]).command, { type: "deleteMany", ids: ["m3", "m5"] });
    assert.deepEqual(keys(startMode(ids), ["d"]).command, { type: "delete", id: "m5" });
});

test("z asks to centre the cursor", () => {
    assert.deepEqual(keys(startMode(ids), ["z"]).command, { type: "center" });
});

test("with nothing shown, the new commands do nothing", () => {
    for (const k of ["E", "p", "d", "t", "o", "c", "l", "z", "/", ";"]) {
        const r = pressKey(startMode([]), k, []);
        assert.equal(r.command, undefined);
        assert.equal(r.state.search, null);
    }
});

const texts: Record<string, string> = { m1: "Hello world", m2: "lunch?", m3: "hello again", m4: "nope", m5: "HELLO" };
const text = (id: string) => texts[id] ?? "";

test("smartcase: lowercase matches any case, a capital matches exactly", () => {
    assert.ok(matchesQuery("hello", "HELLO there"));
    assert.ok(!matchesQuery("Hello", "hello there"));
    assert.ok(matchesQuery("Hello", "Hello there"));
    assert.ok(!matchesQuery("", "anything"));
    assert.deepEqual(searchMatches("hello", ids, text), ["m1", "m3", "m5"]);
});

test("typing a search moves to the nearest older match, skipping where it began", () => {
    const r = keys(startMode(ids), ["/", "h", "e", "l"], ids, text);
    assert.equal(r.state.cursor, "m3");
    assert.deepEqual(r.state.search, { query: "hel", from: "m5" });
});

test("a search that matches nothing goes back to where it began", () => {
    assert.equal(keys(startMode(ids), ["/", "l", "x"], ids, text).state.cursor, "m5");
    assert.equal(keys(startMode(ids), ["/", "u"], ids, text).state.cursor, "m2");
});

test("search letters don't run commands, and digits aren't counts", () => {
    const r = keys(startMode(ids), ["/", "d", "3", "j", "q"], ids, text);
    assert.equal(r.command, undefined);
    assert.equal(r.state.search?.query, "d3jq");
    assert.equal(r.state.count, "");
});

test("Enter keeps the match and the query; Esc goes back and forgets the typing", () => {
    const kept = keys(startMode(ids), ["/", "h", "e", "Enter"], ids, text);
    assert.equal(kept.state.search, null);
    assert.equal(kept.state.cursor, "m3");
    assert.equal(kept.state.lastSearch, "he");
    const cancelled = keys(startMode(ids), ["k", "/", "h", "e", "Escape"], ids, text);
    assert.equal(cancelled.state.search, null);
    assert.equal(cancelled.state.cursor, "m4");
    assert.equal(cancelled.state.lastSearch, "");
});

test("Backspace edits the query and leaves the search when it's empty", () => {
    const r = keys(startMode(ids), ["/", "l", "u", "Backspace"], ids, text);
    assert.equal(r.state.search?.query, "l");
    assert.equal(keys(r.state, ["Backspace", "Backspace"], ids, text).state.search, null);
});

test("n goes to the next older match, N to the next newer, wrapping", () => {
    const { state } = keys(startMode(ids), ["/", "h", "e", "l", "l", "o", "Enter"], ids, text);
    assert.equal(state.cursor, "m3");
    assert.equal(keys(state, ["n"], ids, text).state.cursor, "m1");
    assert.equal(keys(state, ["n", "n"], ids, text).state.cursor, "m5");
    assert.equal(keys(state, ["N"], ids, text).state.cursor, "m5");
    assert.equal(keys(state, ["2", "n"], ids, text).state.cursor, "m5");
});

test("n with no search, or no match left, says so", () => {
    assert.deepEqual(keys(startMode(ids), ["n"], ids, text).command, { type: "notFound", query: "" });
    const { state } = keys(startMode(ids), ["/", "w", "o", "r", "l", "d", "Enter"], ids, text);
    assert.equal(keys(state, ["n"], ids, text).state.cursor, "m1");
    // Its message edited since: nothing matches any more.
    assert.deepEqual(keys(state, ["n"], ids, () => "").command, { type: "notFound", query: "world" });
});

test("an empty search repeats the last one", () => {
    const { state } = keys(startMode(ids), ["/", "h", "e", "l", "l", "o", "Enter", "G"], ids, text);
    assert.equal(keys(state, ["/", "Enter"], ids, text).state.cursor, "m3");
});

test("Esc clears the search highlight before the selection", () => {
    const { state } = keys(startMode(ids), [" ", "/", "h", "Enter"], ids, text);
    const r = pressKey(state, "Escape", ids, text);
    assert.equal(r.state.lastSearch, "");
    assert.deepEqual(r.state.selected, ["m5"]);
});

test("labels are unique, prefix-free and as short as they can be", () => {
    assert.deepEqual(labelStrings(3, "ab"), ["b", "aa", "ab"]);
    assert.deepEqual(labelStrings(0), []);
    for (const n of [1, 5, 14, 15, 40, 200]) {
        const labels = labelStrings(n);
        assert.equal(labels.length, n);
        assert.equal(new Set(labels).size, n);
        for (const a of labels) for (const b of labels) if (a !== b) assert.ok(!b.startsWith(a), `${a} prefixes ${b}`);
    }
    assert.ok(labelStrings(14).every(l => l.length === 1));
    assert.ok(labelStrings(40).every(l => l.length <= 2));
});

test("; asks for labels; typing one moves the cursor there", () => {
    assert.deepEqual(keys(startMode(ids), [";"]).command, { type: "labels" });
    const shown = showLabels(startMode(ids), ["m2", "m3", "m4"]);
    assert.deepEqual(shown.labels, { typed: "", targets: { s: "m2", a: "m3", d: "m4" } });
    const r = pressKey(shown, "a", ids);
    assert.equal(r.state.cursor, "m3");
    assert.equal(r.state.labels, null);
    assert.equal(r.command, undefined);
});

test("two-letter labels take both letters; a wrong letter or Esc cancels", () => {
    const many = Array.from({ length: 20 }, (_, i) => `m${i}`);
    const shown = showLabels(startMode(many), many);
    const [twoLetter, id] = Object.entries(shown.labels!.targets).find(([l]) => l.length === 2)!;
    const half = pressKey(shown, twoLetter[0], many);
    assert.equal(half.state.labels?.typed, twoLetter[0]);
    assert.equal(pressKey(half.state, twoLetter[1].toUpperCase(), many).state.cursor, id);
    assert.equal(pressKey(shown, "z", many).state.labels, null);
    assert.equal(pressKey(shown, "Escape", many).state.labels, null);
    assert.equal(pressKey(shown, "Escape", many).state.cursor, shown.cursor);
});

test("no labels when nothing is on screen", () => {
    const state = startMode(ids);
    assert.equal(showLabels(state, []), state);
});

test("moveTo moves only to a shown message", () => {
    assert.equal(moveTo(startMode(ids), "m2", ids).cursor, "m2");
    const state = startMode(ids);
    assert.equal(moveTo(state, "old", ids), state);
});

test("a goal takes the cursor once it's shown", () => {
    const waiting = setGoal(startMode(ids), "m0");
    assert.equal(rebase(waiting, ids, ids), waiting);
    const arrived = rebase(waiting, ids, ["m0", ...ids]);
    assert.equal(arrived.cursor, "m0");
    assert.equal(arrived.goal, null);
});

test("labels go when the shown messages change", () => {
    const shown = showLabels(startMode(ids), ids);
    assert.equal(rebase(shown, ids, ids), shown);
    assert.equal(rebase(shown, ids, [...ids, "m6"]).labels, null);
});
