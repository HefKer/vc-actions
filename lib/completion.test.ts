/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 hefker and Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import assert from "node:assert/strict";
import { test } from "node:test";

// @ts-expect-error TS5097: node --test resolves only the real file name; tsc still type-checks the import.
import { applyCompletion, complete, type CompletionAction } from "./completion.ts";

const actions: CompletionAction[] = [
    { id: "stream", description: "Start streaming", args: [{ name: "preset", description: "Preset name", choices: () => ["Gaming", "Browser", "Gaming Wide"] }] },
    { id: "stopstream", description: "Stop your stream" },
    { id: "streamtoggle", description: "Toggle", args: [{ name: "preset", description: "Preset name", choices: () => ["Gaming"] }] },
    { id: "volume", description: "Volume", args: [{ name: "user", description: "User" }, { name: "level", description: "Level", choices: () => ["+20", "-20"] }] },
    { id: "status", description: "Status", args: [{ name: "status", description: "Status", choices: () => ["online", "dnd", "toggle"] }, { name: "target", description: "Target", choices: () => ["online", "dnd"] }] },
    { id: "broken", description: "Choices throw", args: [{ name: "x", description: "X", choices: () => { throw new Error("no store"); } }] }
];

/** Complete at the `|` in `text`. */
function at(textWithBar: string) {
    const cursor = textWithBar.indexOf("|");
    const text = textWithBar.replace("|", "");
    return { text, c: complete(text, cursor, actions) };
}

const labels = (s: string) => at(s).c?.items.map(i => i.label);

test("action ids after `= ` and `; `, prefix matches first, then substrings", () => {
    assert.deepEqual(labels("ctrl+a = |"), actions.map(a => a.id));
    assert.deepEqual(labels("ctrl+a = st|"), ["stream", "stopstream", "streamtoggle", "status"]);
    assert.deepEqual(labels("ctrl+a = stream Gaming; str|"), ["stream", "streamtoggle", "stopstream"]);
    const { c } = at("ctrl+a = sto|");
    assert.deepEqual(c?.items[0], { label: "stopstream", detail: "Stop your stream", insert: "stopstream" });
});

test("nothing right after = or ; until a space or a letter", () => {
    assert.equal(at("ctrl+a =|").c, null);
    assert.equal(at("ctrl+a = popout;|").c, null);
    assert.deepEqual(labels("ctrl+a =str|"), ["stream", "streamtoggle", "stopstream"]);
});

test("nothing on the trigger side, in comments, or for a group label", () => {
    assert.equal(at("ctrl+|").c, null);
    assert.equal(at("ctrl+a = stream # st|").c, null);
    assert.equal(at("ctrl+space c = +|").c, null);
    assert.equal(at("ctrl+space c = +con|").c, null);
});

test("a typed-out item closes the list, so Enter is a newline again", () => {
    assert.equal(at("ctrl+a = stream|").c, null);
    assert.equal(at("ctrl+a = stream Gaming|").c, null);
});

test("an action with args inserts a trailing space, then its choices follow", () => {
    const { text, c } = at("ctrl+a = strea|");
    const item = c!.items.find(i => i.label === "stream")!;
    assert.equal(item.insert, "stream ");
    const next = applyCompletion(text, c!, item);
    assert.deepEqual(next, { text: "ctrl+a = stream ", cursor: 16 });
    assert.deepEqual(complete(next.text, next.cursor, actions)?.items.map(i => i.label), ["Gaming", "Browser", "Gaming Wide"]);
});

test("the last arg takes the rest of the step, spaces included", () => {
    const { text, c } = at("ctrl+a = stream gaming w|");
    assert.deepEqual(c?.items.map(i => i.label), ["Gaming Wide"]);
    assert.equal(c?.prefix, "gaming w");
    assert.deepEqual(applyCompletion(text, c!, c!.items[0]), { text: "ctrl+a = stream Gaming Wide", cursor: 27 });
});

test("the last arg replaces up to the end of its step", () => {
    const { text, c } = at("ctrl+a = stream gam|ing w ; popout");
    assert.deepEqual(c?.items.map(i => i.label), ["Gaming", "Gaming Wide"]);
    assert.equal(applyCompletion(text, c!, c!.items[1]).text, "ctrl+a = stream Gaming Wide ; popout");
});

test("args fill in order; a non-last arg's choice gets a trailing space", () => {
    assert.equal(at("ctrl+a = volume |").c, null, "user has no choices");
    assert.deepEqual(labels("ctrl+a = volume alice |"), ["+20", "-20"]);
    const { text, c } = at("ctrl+a = status to|");
    assert.equal(c?.items[0].insert, "toggle ");
    assert.equal(c?.title, "status <status>: Status");
    const next = applyCompletion(text, c!, c!.items[0]);
    assert.deepEqual(complete(next.text, next.cursor, actions)?.items.map(i => i.label), ["online", "dnd"]);
});

test("the rest of the word under the cursor is replaced", () => {
    const { text, c } = at("ctrl+a = sto|pxx; help");
    assert.equal(applyCompletion(text, c!, c!.items[0]).text, "ctrl+a = stopstream; help");
});

test("no args, unknown action or throwing choices offer nothing", () => {
    assert.equal(at("ctrl+a = stopstream |").c, null);
    assert.equal(at("ctrl+a = nope |").c, null);
    assert.equal(at("ctrl+a = broken |").c, null);
});

test("events after `on `, with ` = ` added unless one follows", () => {
    assert.deepEqual(labels("on vc|"), ["vcjoin", "vcleave"]);
    const { text, c } = at("on vc|");
    assert.equal(applyCompletion(text, c!, c!.items[0]).text, "on vcjoin = ");
    const after = at("on |  = gotocall");
    assert.equal(after.c?.items[0].insert, "vcjoin");
    assert.equal(at("on|").c, null);
});

test("works on any line of the text, by the cursor's line", () => {
    assert.deepEqual(labels("ctrl+a = help\non stream|\nctrl+b = x"), ["streamstart", "streamstop"]);
});
