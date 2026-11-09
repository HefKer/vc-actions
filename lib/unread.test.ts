/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 hefker and Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import assert from "node:assert/strict";
import { test } from "node:test";

// @ts-expect-error TS5097: node --test needs the .ts extension, Vencord's tsconfig doesn't allow it.
import { findUnread, type UnreadSource } from "./unread.ts";

const CHANNELS: Record<string, string[]> = {
    "@me": ["dm1", "dm2"],
    a: ["a1", "a2", "a3", "a4"],
    b: ["b1", "b2"],
    c: ["c1", "c2"],
};

/** Channels in `unread` count; servers in `muted` are skipped. */
function source(unread: string[], muted: string[] = []): UnreadSource & { asked: string[]; } {
    const asked: string[] = [];
    return {
        asked,
        guildIds: ["@me", "a", "b", "c"],
        channels: g => { asked.push(g); return CHANNELS[g] ?? []; },
        guildOk: g => !muted.includes(g),
        channelOk: (_g, c) => unread.includes(c),
    };
}

test("next: a later channel in the current server comes first", () => {
    assert.deepEqual(findUnread(source(["a3", "b1", "a1"]), { guildId: "a", channelId: "a2" }, 1), { guildId: "a", channelId: "a3" });
});

test("next: then the following servers in guild-list order", () => {
    assert.deepEqual(findUnread(source(["c2", "b2", "a1"]), { guildId: "a", channelId: "a2" }, 1), { guildId: "b", channelId: "b2" });
});

test("next: wraps through DMs, then back to the top of the current server", () => {
    assert.deepEqual(findUnread(source(["dm2"]), { guildId: "c", channelId: "c1" }, 1), { guildId: "@me", channelId: "dm2" });
    assert.deepEqual(findUnread(source(["a1"]), { guildId: "a", channelId: "a3" }, 1), { guildId: "a", channelId: "a1" });
});

test("prev: an earlier channel in the current server, nearest first", () => {
    assert.deepEqual(findUnread(source(["a1", "a2", "a4"]), { guildId: "a", channelId: "a3" }, -1), { guildId: "a", channelId: "a2" });
});

test("prev: then the previous servers, each from its bottom, wrapping to the last server", () => {
    assert.deepEqual(findUnread(source(["dm1", "dm2"]), { guildId: "a", channelId: "a1" }, -1), { guildId: "@me", channelId: "dm2" });
    assert.deepEqual(findUnread(source(["c1"]), { guildId: "a", channelId: "a1" }, -1), { guildId: "c", channelId: "c1" });
    assert.deepEqual(findUnread(source(["a4"]), { guildId: "a", channelId: "a2" }, -1), { guildId: "a", channelId: "a4" });
});

test("muted servers are skipped, but not the one you're in", () => {
    assert.deepEqual(findUnread(source(["b1", "c1"], ["b"]), { guildId: "a", channelId: "a1" }, 1), { guildId: "c", channelId: "c1" });
    assert.deepEqual(findUnread(source(["a1"], ["a"]), { guildId: "a", channelId: "a3" }, 1), { guildId: "a", channelId: "a1" });
});

test("the channel you're in never counts", () => {
    assert.equal(findUnread(source(["a2"]), { guildId: "a", channelId: "a2" }, 1), undefined);
    assert.equal(findUnread(source(["a2"]), { guildId: "a", channelId: "a2" }, -1), undefined);
});

test("nothing unread gives undefined", () => {
    assert.equal(findUnread(source([]), { guildId: "a", channelId: "a1" }, 1), undefined);
});

test("no channel open (server home): next starts at the server's top", () => {
    assert.deepEqual(findUnread(source(["a1", "b1"]), { guildId: "a", channelId: null }, 1), { guildId: "a", channelId: "a1" });
});

test("no channel open: prev goes to the previous server first, this server last", () => {
    assert.deepEqual(findUnread(source(["a1", "dm1"]), { guildId: "a", channelId: null }, -1), { guildId: "@me", channelId: "dm1" });
    assert.deepEqual(findUnread(source(["a1"]), { guildId: "a", channelId: null }, -1), { guildId: "a", channelId: "a1" });
});

test("a server missing from the guild list (e.g. a lurked one) is walked first, then the list", () => {
    const src = source(["x2", "b1"]);
    src.channels = g => g === "x" ? ["x1", "x2"] : CHANNELS[g] ?? [];
    assert.deepEqual(findUnread(src, { guildId: "x", channelId: "x1" }, 1), { guildId: "x", channelId: "x2" });
    assert.deepEqual(findUnread(source(["b1"]), { guildId: "x", channelId: null }, 1), { guildId: "b", channelId: "b1" });
});

test("stops asking for channels once it finds one", () => {
    const src = source(["a3"]);
    findUnread(src, { guildId: "a", channelId: "a1" }, 1);
    assert.deepEqual(src.asked, ["a"]);
});
