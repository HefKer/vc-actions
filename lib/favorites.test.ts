/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 hefker and Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import assert from "node:assert/strict";
import { test } from "node:test";

// @ts-expect-error TS5097: node --test needs the .ts extension, Vencord's tsconfig doesn't allow it.
import { pickFavorite, toggleFavorite } from "./favorites.ts";

const favs = [{ id: "1", name: "Friends" }, { id: "2", name: "Work" }, { id: "3", name: "Fraggers" }];

test("toggling a server that isn't a favorite adds it at the end", () => {
    assert.deepEqual(toggleFavorite(["1", "2"], "3"), { favs: ["1", "2", "3"], added: true });
});

test("toggling a favorite removes it", () => {
    assert.deepEqual(toggleFavorite(["1", "2", "3"], "2"), { favs: ["1", "3"], added: false });
});

test("a favorite is picked by name, case-insensitively, or by unique prefix", () => {
    assert.deepEqual(pickFavorite("work", favs, null), { ok: true, value: "2" });
    assert.deepEqual(pickFavorite("Frie", favs, null), { ok: true, value: "1" });
});

test("a prefix shared by two favorites is an error naming both", () => {
    const r = pickFavorite("fr", favs, null);
    assert.equal(r.ok, false);
    assert.match((r as { error: string; }).error, /Friends, Fraggers/);
});

test("a favorite is picked by id", () => {
    assert.deepEqual(pickFavorite("3", favs, null), { ok: true, value: "3" });
});

test("next and prev cycle the favorites from the server you're viewing, wrapping", () => {
    assert.deepEqual(pickFavorite("next", favs, "3"), { ok: true, value: "1" });
    assert.deepEqual(pickFavorite("Prev", favs, "1"), { ok: true, value: "3" });
});

test("next from a server that isn't a favorite goes to the first", () => {
    assert.deepEqual(pickFavorite("next", favs, "99"), { ok: true, value: "1" });
    assert.deepEqual(pickFavorite("next", favs, null), { ok: true, value: "1" });
});

test("no favorites is an error that says how to add one", () => {
    const r = pickFavorite("next", [], null);
    assert.equal(r.ok, false);
    assert.match((r as { error: string; }).error, /favtoggle/);
});
