/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 hefker and Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import assert from "node:assert/strict";
import { test } from "node:test";

// @ts-expect-error TS5097: node --test needs the .ts extension, Vencord's tsconfig doesn't allow it.
import { resolveName } from "./resolve.ts";
// @ts-expect-error TS5097
import { type Sound, soundCandidates, soundChoices } from "./sounds.ts";

const sound = (name: string, guildId: string, soundId = `${guildId}-${name}`): Sound => ({ name, guildId, soundId });
const guilds: Record<string, string> = { here: "Home", far: "Elsewhere" };
const guildName = (id: string) => guilds[id];

const sounds = [
    sound("airhorn", "0"),
    sound("quack", "0"),
    sound("airhorn", "here"),
    sound("airhorn", "far"),
    sound("bonk", "far")
];

const pick = (input: string, inGuild: string | null = "here") =>
    resolveName(input, soundCandidates(sounds, inGuild, guildName), "sound");

test("a sound of your voice channel's server beats a default and another server's of the same name", () => {
    assert.deepEqual(pick("airhorn"), { ok: true, value: sounds[2] });
});

test("with no server sound of that name, a default beats other servers'", () => {
    assert.deepEqual(pick("airhorn", null), { ok: true, value: sounds[0] });
});

test("another server's sound is found by name, or by name and server", () => {
    assert.deepEqual(pick("bonk"), { ok: true, value: sounds[4] });
    assert.deepEqual(pick("airhorn (Elsewhere)"), { ok: true, value: sounds[3] });
});

test("errors label other servers' sounds with their server", () => {
    assert.deepEqual(pick("zzz"), { ok: false, error: "No sound \"zzz\". Sounds: airhorn, airhorn, quack, airhorn (Elsewhere), bonk (Elsewhere)." });
});

test("choices list your server's sounds, then defaults, then others by name and server, each once and resolvable", () => {
    const cands = soundCandidates(sounds, "here", guildName);
    const choices = soundChoices(cands);
    assert.deepEqual(choices, ["airhorn", "quack", "airhorn (Elsewhere)", "bonk (Elsewhere)"]);
    for (const c of choices) assert.equal(resolveName(c, cands, "sound").ok, true, c);
});

test("choices stop at Discord's limit of 25", () => {
    const many = Array.from({ length: 30 }, (_, i) => sound(`s${i}`, "0"));
    assert.equal(soundChoices(soundCandidates(many, null, guildName)).length, 25);
});
