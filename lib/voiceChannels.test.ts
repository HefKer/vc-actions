/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 hefker and Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import assert from "node:assert/strict";
import { test } from "node:test";

// @ts-expect-error TS5097: node --test needs the .ts extension, Vencord's tsconfig doesn't allow it.
import { channelChoices, resolveVoiceChannel, trackVoice, type VoiceChannelInfo } from "./voiceChannels.ts";

test("moving from one voice channel to another makes the first the last channel", () => {
    assert.deepEqual(trackVoice({ current: "a", last: null }, "b"), { current: "b", last: "a" });
});

test("leaving voice keeps the channel left as the last channel", () => {
    assert.deepEqual(trackVoice({ current: "a", last: "x" }, null), { current: null, last: "a" });
});

test("joining from no voice keeps the last channel", () => {
    assert.deepEqual(trackVoice({ current: null, last: "a" }, "b"), { current: "b", last: "a" });
});

test("no change in voice channel changes nothing", () => {
    assert.deepEqual(trackVoice({ current: "a", last: "x" }, "a"), { current: "a", last: "x" });
});

const here = "1";
const channels: VoiceChannelInfo[] = [
    { id: "10", name: "General", guildId: "1", guildName: "hefker dev" },
    { id: "11", name: "Gaming", guildId: "1", guildName: "hefker dev" },
    { id: "20", name: "General", guildId: "2", guildName: "Friends" },
    { id: "21", name: "Lounge", guildId: "2", guildName: "Friends" }
];

test("a channel name in the current server wins over the same name elsewhere", () => {
    assert.deepEqual(resolveVoiceChannel("General", channels, here), { ok: true, value: "10" });
});

test("a channel in another server is picked by its server-labelled name", () => {
    assert.deepEqual(resolveVoiceChannel("general (friends)", channels, here), { ok: true, value: "20" });
});

test("a channel only in another server is found by its plain name", () => {
    assert.deepEqual(resolveVoiceChannel("lou", channels, here), { ok: true, value: "21" });
});

test("a channel id is taken as is when it is a known voice channel", () => {
    assert.deepEqual(resolveVoiceChannel("20", channels, here), { ok: true, value: "20" });
});

test("no match lists channels, others labelled with their server", () => {
    const r = resolveVoiceChannel("Music", channels, here);
    assert.equal(r.ok, false);
    assert.match((r as { error: string; }).error, /General, Gaming, General \(Friends\), Lounge \(Friends\)/);
});

test("choices offer last, then current-server channels by name, then others labelled", () => {
    assert.deepEqual(channelChoices(channels, here), ["last", "General", "Gaming", "General (Friends)", "Lounge (Friends)"]);
});
