/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 hefker and Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/** The first image type a clipboard item offers, or undefined. Chromium only exposes image/png, but take any image. */
export function imageType(types: readonly string[]): string | undefined {
    return types.find(t => t.startsWith("image/"));
}

/** File name for the nth clipboard image (from 1), like Discord names pasted images: image.png, image-2.png. */
export function clipboardFileName(type: string, n: number): string {
    const ext = type.slice("image/".length).replace(/\+.*$/, "") || "png";
    return n > 1 ? `image-${n}.${ext}` : `image.${ext}`;
}
