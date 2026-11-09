/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 hefker and Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import assert from "node:assert/strict";
import { test } from "node:test";

// @ts-expect-error TS5097: node --test resolves only the real file name; tsc still type-checks the import.
import { type ActionMeta, createBindingEngine, type KeyInput } from "./bindings.ts";

const actions: ActionMeta[] = [
    { id: "popout", args: ["user"] },
    { id: "stream", args: ["preset"] },
    { id: "stopstream", args: [] },
    { id: "volume", args: ["user", "level"] }
];

/** A keydown for a combo written like a binding, e.g. "ctrl+alt+p", with code/key as a US keyboard gives them. */
function down(combo: string, extra: Partial<KeyInput> = {}): KeyInput {
    const parts = combo.split("+");
    const key = parts.pop()!;
    const code = /^[a-z]$/.test(key) ? `Key${key.toUpperCase()}` : /^\d$/.test(key) ? `Digit${key}` : key;
    return {
        type: "keydown", key, code,
        ctrl: parts.includes("ctrl"), alt: parts.includes("alt"), shift: parts.includes("shift"), meta: parts.includes("meta"),
        ...extra
    } as KeyInput;
}

test("a combo binding runs its step and swallows the key", () => {
    const engine = createBindingEngine("ctrl+alt+p = popout", actions);
    assert.deepEqual(engine.problems, []);
    assert.deepEqual(engine.feed(down("ctrl+alt+p")), [
        { type: "run", trigger: "ctrl+alt+p", steps: [{ actionId: "popout", args: { user: undefined }, text: "popout" }] },
        { type: "swallow" }
    ]);
});

test("key repeat of a bound combo does nothing", () => {
    const engine = createBindingEngine("ctrl+alt+p = popout", actions);
    assert.deepEqual(engine.feed(down("ctrl+alt+p", { repeat: true })), []);
});

test("a bare-key binding passes through while typing in a text field", () => {
    const engine = createBindingEngine("f8 = stopstream\nshift+f9 = stopstream", actions);
    assert.deepEqual(engine.feed(down("f8", { inTextField: true })), []);
    assert.deepEqual(engine.feed(down("shift+f9", { inTextField: true })), []);
    assert.equal(engine.feed(down("f8"))[0].type, "run");
});

test("a combo with ctrl, alt or meta fires in a text field", () => {
    const engine = createBindingEngine("ctrl+alt+p = popout\nmeta+s = stopstream", actions);
    assert.equal(engine.feed(down("ctrl+alt+p", { inTextField: true }))[0].type, "run");
    assert.equal(engine.feed(down("meta+s", { inTextField: true }))[0].type, "run");
});

test("letters and digits match by physical key, whatever shift or the layout types", () => {
    const engine = createBindingEngine("ctrl+shift+1 = stopstream\nctrl+alt+q = popout", actions);
    assert.equal(engine.feed(down("ctrl+shift+1", { key: "!" }))[0].type, "run");
    // AZERTY: the physical Q key types "a".
    assert.equal(engine.feed(down("ctrl+alt+q", { key: "a" }))[0].type, "run");
    assert.equal(engine.feed(down("ctrl+shift+1", { code: "Numpad1", key: "1" }))[0].type, "run");
});

test("modifiers must match exactly; unbound keys pass through", () => {
    const engine = createBindingEngine("ctrl+alt+p = popout", actions);
    assert.deepEqual(engine.feed(down("ctrl+p")), []);
    assert.deepEqual(engine.feed(down("ctrl+alt+shift+p")), []);
    assert.deepEqual(engine.feed(down("ctrl+alt+o")), []);
});

test("keyup and blur pass through", () => {
    const engine = createBindingEngine("ctrl+alt+p = popout", actions);
    assert.deepEqual(engine.feed({ ...down("ctrl+alt+p"), type: "keyup" } as KeyInput), []);
    assert.deepEqual(engine.feed({ type: "blur" }), []);
});

test("combos accept modifier synonyms, key aliases and any case", () => {
    const engine = createBindingEngine([
        "Control+Option+Space = stopstream",
        "cmd+esc = stopstream",
        "ctrl++ = stopstream",
        "mod+alt+plus = stopstream"
    ].join("\n"), actions);
    assert.deepEqual(engine.problems, []);
    assert.equal(engine.feed(down("ctrl+alt+plus", { key: "+", code: "Equal" }))[0].type, "run");
    assert.equal(engine.feed(down("ctrl+alt+ ", { code: "Space" }))[0].type, "run");
    assert.equal(engine.feed(down("meta+Escape", { code: "Escape" }))[0].type, "run");
    assert.equal(engine.feed(down("ctrl+plus", { key: "+", code: "Equal" }))[0].type, "run");
});

test("words after the action id fill its args in order; the last arg takes the rest", () => {
    const engine = createBindingEngine("ctrl+alt+1 = stream  Gaming  Night\nctrl+alt+2 = volume alice +20 extra", actions);
    const [run1] = engine.feed(down("ctrl+alt+1"));
    const [run2] = engine.feed(down("ctrl+alt+2"));
    assert.deepEqual(run1.type === "run" && run1.steps[0].args, { preset: "Gaming Night" });
    assert.deepEqual(run2.type === "run" && run2.steps[0].args, { user: "alice", level: "+20 extra" });
});

test("comments and blank lines are ignored", () => {
    const engine = createBindingEngine("# my binds\n\n   \nctrl+alt+0 = stopstream # stop it\n", actions);
    assert.deepEqual(engine.problems, []);
    assert.deepEqual(engine.feed(down("ctrl+alt+0")), [
        { type: "run", trigger: "ctrl+alt+0", steps: [{ actionId: "stopstream", args: {}, text: "stopstream" }] },
        { type: "swallow" }
    ]);
});

test("bad lines are reported as errors with their line and skipped; good lines still load", () => {
    const engine = createBindingEngine([
        "ctrl+alt+p popout",
        "ctrl+alt+x+y = popout",
        "ctrl+alt = popout",
        "ctrl+alt+n = nosuch",
        "ctrl+alt+0 = stopstream"
    ].join("\n"), actions);
    assert.deepEqual(engine.problems.map(p => [p.severity, p.line]), [["error", 1], ["error", 2], ["error", 3], ["error", 4]]);
    assert.match(engine.problems[0].message, /ctrl\+alt\+p popout/);
    assert.match(engine.problems[1].message, /ctrl\+alt\+x\+y/);
    assert.match(engine.problems[3].message, /nosuch/);
    assert.deepEqual(engine.feed(down("ctrl+alt+p")), []);
    assert.equal(engine.feed(down("ctrl+alt+0"))[0].type, "run");
});

test("a macro splits on ; into steps in order, each with its own args", () => {
    const engine = createBindingEngine("ctrl+alt+g = stream Gaming Night ;popout;  stopstream ", actions);
    assert.deepEqual(engine.problems, []);
    assert.deepEqual(engine.feed(down("ctrl+alt+g")), [
        {
            type: "run", trigger: "ctrl+alt+g", steps: [
                { actionId: "stream", args: { preset: "Gaming Night" }, text: "stream Gaming Night" },
                { actionId: "popout", args: { user: undefined }, text: "popout" },
                { actionId: "stopstream", args: {}, text: "stopstream" }
            ]
        },
        { type: "swallow" }
    ]);
});

test("a macro with an unknown action or an empty step is an error naming the step, and isn't bound", () => {
    const engine = createBindingEngine([
        "ctrl+alt+g = stream Gaming; nosuch x",
        "ctrl+alt+h = popout;; stopstream",
        "ctrl+alt+j = popout;"
    ].join("\n"), actions);
    assert.deepEqual(engine.problems.map(p => [p.severity, p.line]), [["error", 1], ["error", 2], ["error", 3]]);
    assert.match(engine.problems[0].message, /step 2.*nosuch/);
    assert.match(engine.problems[1].message, /step 2/);
    assert.match(engine.problems[2].message, /step 2/);
    for (const k of ["ctrl+alt+g", "ctrl+alt+h", "ctrl+alt+j"]) assert.deepEqual(engine.feed(down(k)), []);
});

test("a trigger bound twice is an error on the later line; the first binding wins", () => {
    const engine = createBindingEngine("ctrl+alt+p = popout\nControl+Alt+P = stopstream", actions);
    assert.deepEqual(engine.problems.map(p => [p.severity, p.line]), [["error", 2]]);
    assert.match(engine.problems[0].message, /line 1/);
    const [run] = engine.feed(down("ctrl+alt+p"));
    assert.equal(run.type === "run" && run.steps[0].actionId, "popout");
});

test("a trigger that is one of Discord's default shortcuts is a warning naming it, and still bound", () => {
    const engine = createBindingEngine("ctrl+alt+p = popout\nmod+shift+M = stopstream\nalt+arrowdown = popout", actions);
    assert.deepEqual(engine.problems.map(p => [p.severity, p.line]), [["warning", 2], ["warning", 3]]);
    assert.match(engine.problems[0].message, /toggle mute/i);
    assert.match(engine.problems[1].message, /next channel/i);
    const [run] = engine.feed(down("ctrl+shift+m"));
    assert.equal(run.type === "run" && run.steps[0].actionId, "stopstream");
    assert.equal(engine.feed(down("alt+ArrowDown"))[0].type, "run");
});
