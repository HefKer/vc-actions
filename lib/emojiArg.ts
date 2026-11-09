/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 hefker and Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/** How `react`'s emoji arg was written, before looking anything up. */
export type EmojiArg =
    /** A custom emoji as Discord writes it in messages: `<:name:id>`, `<a:name:id>` for animated. */
    | { kind: "custom"; id: string; name: string; animated: boolean; }
    /** A name, `:thumbsup:` or `thumbsup`: Discord's unicode name first, else a custom emoji you can use. */
    | { kind: "name"; name: string; }
    /** Anything else is taken as the emoji itself, e.g. 👍. */
    | { kind: "unicode"; text: string; };

/** Parse `react`'s emoji arg; undefined for an empty one. Pure. */
export function parseEmojiArg(input: string | undefined): EmojiArg | undefined {
    const text = input?.trim() ?? "";
    if (!text) return undefined;
    const custom = text.match(/^<(a?):(\w+):(\d+)>$/);
    if (custom) return { kind: "custom", id: custom[3], name: custom[2], animated: custom[1] === "a" };
    const name = text.match(/^:?([\w+-]+):?$/);
    if (name) return { kind: "name", name: name[1] };
    return { kind: "unicode", text };
}
