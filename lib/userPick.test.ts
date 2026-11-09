/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 hefker and Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import assert from "node:assert/strict";
import { test } from "node:test";

// @ts-expect-error TS5097: node --test needs the .ts extension, Vencord's tsconfig doesn't allow it.
import { type PickUser, userPickEntries } from "./userPick.ts";

const user = (id: string, name: string, username = name): PickUser => ({ id, names: [name], username });
const labels = (dms: PickUser[], friends: PickUser[], me?: string) => userPickEntries(dms, friends, me).map(e => e.label);

test("DMs come first in their order, then friends without a DM by name", () => {
    assert.deepEqual(labels([user("2", "zed"), user("1", "amy")], [user("4", "dan"), user("3", "bob")]), ["zed", "amy", "bob", "dan"]);
});

test("a friend you have a DM with is listed once, where the DM is", () => {
    assert.deepEqual(labels([user("1", "amy")], [user("2", "bob"), user("1", "amy")]), ["amy", "bob"]);
});

test("yourself and users with no name loaded are left out", () => {
    assert.deepEqual(labels([user("9", "me"), { id: "5", names: [] }], [user("1", "amy")], "9"), ["amy"]);
});

test("an entry runs on the user id and shows the username when it isn't the name shown", () => {
    assert.deepEqual(userPickEntries([user("1", "Amy", "amy_99"), user("2", "bob")], [], undefined), [
        { label: "Amy", text: "1", detail: "amy_99", open: false },
        { label: "bob", text: "2", detail: undefined, open: false }
    ]);
});
