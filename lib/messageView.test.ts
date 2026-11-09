/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 hefker and Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import assert from "node:assert/strict";
import { test } from "node:test";

// @ts-expect-error TS5097: node --test needs the .ts extension, Vencord's tsconfig doesn't allow it.
import { HINT_GAP, hintSide, hintSpan, marginsFor, onScreen, scrollFor, type ScrollRequest } from "./messageView.ts";

/** A chat from y=100 to y=700, scrolled to 1000 of at most 5000, hint 80 tall at the bottom. */
const base: Omit<ScrollRequest, "item" | "align"> = {
    view: { top: 100, bottom: 700 },
    scrollTop: 1000,
    maxScrollTop: 5000,
    margin: marginsFor("bottom", 80)
};

test("a message already in full view doesn't scroll", () => {
    assert.equal(scrollFor({ ...base, item: { top: 300, bottom: 360 }, align: "nearest" }), 1000);
});

test("a message under the bottom hint scrolls up until it clears the hint", () => {
    // Band bottom: 700 - (80 + 2 gaps) = 604.
    assert.equal(scrollFor({ ...base, item: { top: 580, bottom: 640 }, align: "nearest" }), 1036);
});

test("a message above the top scrolls down to show it with a gap", () => {
    assert.equal(scrollFor({ ...base, item: { top: 60, bottom: 120 }, align: "nearest" }), 1000 - 40 - HINT_GAP);
});

test("a message taller than the room shows its start", () => {
    assert.equal(scrollFor({ ...base, item: { top: 400, bottom: 1400 }, align: "nearest" }), 1000 + 300 - HINT_GAP);
});

test("center puts the message in the middle of the room left", () => {
    // Band 108..604, middle 356; message middle 230.
    assert.equal(scrollFor({ ...base, item: { top: 200, bottom: 260 }, align: "center" }), 1000 - 126);
});

test("bottom scrolls to the very end", () => {
    assert.equal(scrollFor({ ...base, item: { top: 300, bottom: 360 }, align: "bottom" }), 5000);
});

test("scrolling is clamped to what the scroller can do", () => {
    assert.equal(scrollFor({ ...base, scrollTop: 10, item: { top: -500, bottom: -400 }, align: "nearest" }), 0);
    assert.equal(scrollFor({ ...base, scrollTop: 4990, item: { top: 900, bottom: 960 }, align: "nearest" }), 5000);
});

test("margins bigger than the chat are ignored", () => {
    const r = scrollFor({ ...base, margin: { top: 400, bottom: 400 }, item: { top: 750, bottom: 800 }, align: "nearest" });
    assert.equal(r, 1100);
});

test("the hint sits inside the chat at its side", () => {
    assert.deepEqual(hintSpan("top", base.view, 80), { top: 108, bottom: 188 });
    assert.deepEqual(hintSpan("bottom", base.view, 80), { top: 612, bottom: 692 });
    assert.deepEqual(marginsFor("top", 80), { top: 96, bottom: HINT_GAP });
});

test("the hint stays put while it doesn't cover the cursor", () => {
    assert.equal(hintSide("bottom", { top: 300, bottom: 360 }, base.view, 80), "bottom");
    assert.equal(hintSide("top", { top: 300, bottom: 360 }, base.view, 80), "top");
    assert.equal(hintSide("bottom", null, base.view, 80), "bottom");
});

test("the hint flips when it covers the cursor (newest message at the very bottom)", () => {
    assert.equal(hintSide("bottom", { top: 640, bottom: 690 }, base.view, 80), "top");
    assert.equal(hintSide("top", { top: 110, bottom: 150 }, base.view, 80), "bottom");
});

test("the hint doesn't flip when it would cover the cursor on the other side too", () => {
    assert.equal(hintSide("bottom", { top: 120, bottom: 690 }, base.view, 80), "bottom");
});

test("onScreen keeps messages at least partly in view", () => {
    const items = [
        { id: "above", span: { top: 20, bottom: 100 } },
        { id: "cut", span: { top: 80, bottom: 140 } },
        { id: "in", span: { top: 300, bottom: 360 } },
        { id: "below", span: { top: 700, bottom: 760 } }
    ];
    assert.deepEqual(onScreen(items, base.view), ["cut", "in"]);
});
