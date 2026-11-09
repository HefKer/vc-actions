/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 hefker and Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import assert from "node:assert/strict";
import { test } from "node:test";

// @ts-expect-error TS5097: node --test needs the .ts extension, Vencord's tsconfig doesn't allow it.
import { ChannelType, placedDetail, placeEntries, serverPlaces, sidebarOrder, type SideChannel, unreadBadge, voiceDetail, voiceEntries } from "./placePick.ts";

const ch = (id: string, parentId: string | null = null, type: number = ChannelType.GUILD_TEXT): SideChannel => ({ id, name: id, type, parentId });
const cat = (id: string) => ch(id, null, ChannelType.GUILD_CATEGORY);
const noThreads = () => [];

test("uncategorized channels first, then each category's in order", () => {
    const order = sidebarOrder([cat("B"), cat("A")], [ch("a1", "A"), ch("b1", "B"), ch("top"), ch("a2", "A")], noThreads);
    assert.deepEqual(order.map(p => [p.channel.id, p.category]), [["top", null], ["b1", "B"], ["a1", "A"], ["a2", "A"]]);
});

test("in a category, channels keep the order given (text before voice when passed so)", () => {
    const order = sidebarOrder([cat("A")], [ch("t", "A"), ch("v", "A", ChannelType.GUILD_VOICE), ch("t2", "A")], noThreads);
    assert.deepEqual(order.map(p => p.channel.id), ["t", "v", "t2"]);
});

test("a channel whose category isn't listed counts as uncategorized", () => {
    const order = sidebarOrder([cat("A")], [ch("a1", "A"), ch("lost", "hidden")], noThreads);
    assert.deepEqual(order.map(p => [p.channel.id, p.category]), [["lost", null], ["a1", "A"]]);
});

test("threads follow their parent, with the parent's name and category", () => {
    const threads = (id: string) => id === "a1" ? [ch("th", "a1", ChannelType.PUBLIC_THREAD)] : [];
    const order = sidebarOrder([cat("A")], [ch("a1", "A"), ch("a2", "A")], threads);
    assert.deepEqual(order.map(p => p.channel.id), ["a1", "th", "a2"]);
    assert.equal(placedDetail(order[1]), "A › a1");
    assert.equal(placedDetail(order[0]), "A");
    assert.equal(placedDetail({ channel: ch("x"), category: null }), undefined);
    assert.equal(placedDetail({ channel: ch("x"), category: null, parent: "p" }), "p");
});

test("mentions show as a red count, else unread as a dot", () => {
    assert.deepEqual(unreadBadge(3, true), { text: "3", alert: true });
    assert.deepEqual(unreadBadge(0, true), { text: "●" });
    assert.equal(unreadBadge(0, false), undefined);
});

test("a place entry goes to its id, with the channel kind as icon; servers have none", () => {
    assert.deepEqual(placeEntries([
        { id: "1", name: "general", type: ChannelType.GUILD_TEXT, detail: "Text", mentions: 0, unread: false },
        { id: "2", name: "Server", mentions: 1, unread: true }
    ]), [
        { label: "general", text: "1", detail: "Text", icon: "#", badge: undefined, open: false },
        { label: "Server", text: "2", detail: undefined, icon: undefined, badge: { text: "1", alert: true }, open: false }
    ]);
});

test("servers in folder order, flattened, named folders as detail, unloaded ones left out", () => {
    const names: Record<string, string> = { a: "A", b: "B", c: "C", d: "D" };
    const place = (id: string) => names[id] ? { id, name: names[id], mentions: 0, unread: false } : undefined;
    const got = serverPlaces([
        { guildIds: ["a"] },
        { folderId: 1, folderName: "Work", guildIds: ["b", "gone", "c"] },
        { folderId: 2, folderName: "", guildIds: ["d"] }
    ], place);
    assert.deepEqual(got.map(p => [p.name, p.detail]), [["A", undefined], ["B", "Work"], ["C", "Work"], ["D", undefined]]);
});

test("a voice channel's detail: its server if elsewhere, then the first few people and how many more", () => {
    assert.equal(voiceDetail(undefined, []), undefined);
    assert.equal(voiceDetail("Srv", []), "Srv");
    assert.equal(voiceDetail(undefined, ["a", "b"]), "a, b");
    assert.equal(voiceDetail("Srv", ["a", "b", "c", "d", "e"]), "Srv · a, b, c +2");
});

test("voice entries: people count as badge, ▶ for the channel you're in", () => {
    const [here, empty] = voiceEntries([
        { id: "1", name: "Lounge", type: ChannelType.GUILD_VOICE, people: ["a", "b"], here: true },
        { id: "2", name: "Stage", type: ChannelType.GUILD_STAGE_VOICE, guildName: "Srv", people: [], here: false }
    ]);
    assert.deepEqual(here, { label: "Lounge", text: "1", detail: "a, b", icon: "▶", badge: { text: "2" }, open: false });
    assert.deepEqual(empty, { label: "Stage", text: "2", detail: "Srv", icon: "🎙️", badge: undefined, open: false });
});
