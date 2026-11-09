/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 hefker and Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import assert from "node:assert/strict";
import { test } from "node:test";

// @ts-expect-error TS5097: node --test needs the .ts extension, Vencord's tsconfig doesn't allow it.
import { parseEmojiArg } from "./emojiArg.ts";

test("a custom emoji in message form gives its id and name", () => {
    assert.deepEqual(parseEmojiArg("<:pog:123456789012345678>"), { kind: "custom", id: "123456789012345678", name: "pog", animated: false });
    assert.deepEqual(parseEmojiArg("<a:dance:42>"), { kind: "custom", id: "42", name: "dance", animated: true });
});

test("a name, with or without colons, is a name", () => {
    assert.deepEqual(parseEmojiArg(":thumbsup:"), { kind: "name", name: "thumbsup" });
    assert.deepEqual(parseEmojiArg("thumbsup"), { kind: "name", name: "thumbsup" });
    assert.deepEqual(parseEmojiArg("+1"), { kind: "name", name: "+1" });
});

test("anything else is the emoji itself", () => {
    assert.deepEqual(parseEmojiArg(" 👍 "), { kind: "unicode", text: "👍" });
    assert.deepEqual(parseEmojiArg("❤️"), { kind: "unicode", text: "❤️" });
});

test("nothing is no emoji", () => {
    assert.equal(parseEmojiArg(undefined), undefined);
    assert.equal(parseEmojiArg("  "), undefined);
});
