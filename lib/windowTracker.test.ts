/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 hefker and Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import { createWindowTracker } from "./windowTracker.ts";

/**
 * A stand-in Window. `reload` gives it a new document and drops its listeners, as a real pop-out's
 * inner window does when it navigates.
 */
function fakeWindow(name: string) {
    let target = new EventTarget();
    const win = {
        name,
        document: { name },
        // Options dropped: there's no tree to capture through, and Node's EventTarget won't remove a
        // listener added with capture: true.
        addEventListener: (type: string, fn: EventListener) => target.addEventListener(type, fn),
        removeEventListener: (type: string, fn: EventListener) => target.removeEventListener(type, fn),
        dispatchEvent: (e: Event) => target.dispatchEvent(e),
        reload() {
            target = new EventTarget();
            win.document = { name };
        }
    };
    return win as unknown as Window & { reload(): void; };
}

const press = (win: Window, type = "keydown") => win.dispatchEvent(new Event(type));

test("keydown in any synced window reaches the handler with that window", () => {
    const seen: string[] = [];
    const tracker = createWindowTracker({ keydown: (_e, w) => seen.push(w.name) });
    const main = fakeWindow("main"), pop = fakeWindow("pop");
    tracker.sync([["main", main], ["pop", pop]]);
    press(pop);
    press(main);
    assert.deepEqual(seen, ["pop", "main"]);
});

test("syncing the same windows again doesn't fire handlers twice", () => {
    let n = 0;
    const tracker = createWindowTracker({ keydown: () => n++ });
    const pop = fakeWindow("pop");
    tracker.sync([["pop", pop]]);
    tracker.sync([["pop", pop]]);
    press(pop);
    assert.equal(n, 1);
});

test("a closed pop-out (gone from the next sync) stops reaching the handler", () => {
    let n = 0;
    const tracker = createWindowTracker({ keydown: () => n++ });
    const main = fakeWindow("main"), pop = fakeWindow("pop");
    tracker.sync([["main", main], ["pop", pop]]);
    tracker.sync([["main", main], ["pop", undefined]]);
    press(pop);
    press(main);
    assert.equal(n, 1);
});

test("a pop-out that loaded a new document is listened to again on the next sync", () => {
    let n = 0;
    const tracker = createWindowTracker({ keydown: () => n++ });
    const pop = fakeWindow("pop");
    tracker.sync([["pop", pop]]);
    pop.reload();
    tracker.sync([["pop", pop]]);
    press(pop);
    assert.equal(n, 1);
});

test("clear detaches keydown, keyup and blur from every window", () => {
    let n = 0;
    const tracker = createWindowTracker({ keydown: () => n++, keyup: () => n++, blur: () => n++ });
    const main = fakeWindow("main"), pop = fakeWindow("pop");
    tracker.sync([["main", main], ["pop", pop]]);
    press(pop, "keyup");
    press(main, "blur");
    tracker.clear();
    const all = ["keydown", "keyup", "blur"].flatMap(t => [press(main, t), press(pop, t)]);
    assert.equal(all.length, 6);
    assert.equal(n, 2);
});
