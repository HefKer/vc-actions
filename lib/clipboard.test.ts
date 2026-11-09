/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 hefker and Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import assert from "node:assert/strict";
import { test } from "node:test";

// @ts-expect-error TS5097: node --test needs the .ts extension, Vencord's tsconfig doesn't allow it.
import { clipboardFileName, imageType } from "./clipboard.ts";

test("imageType picks the first image type", () => {
    assert.equal(imageType(["text/html", "image/png"]), "image/png");
    assert.equal(imageType(["text/plain"]), undefined);
    assert.equal(imageType([]), undefined);
});

test("clipboardFileName", () => {
    assert.equal(clipboardFileName("image/png", 1), "image.png");
    assert.equal(clipboardFileName("image/svg+xml", 2), "image-2.svg");
});
