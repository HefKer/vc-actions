/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 hefker and Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/**
 * Syntax colouring of the Hotkeys setting: splits each line into tokens the editor colours.
 * Pure and forgiving: it never rejects a line (lib/bindings.ts reports the errors), it only labels the parts.
 */

export type TokenType =
    /** `hold`, `on` */
    | "keyword"
    /** The combos of a binding's trigger. */
    | "trigger"
    /** The event of an `on <event>` line. */
    | "event"
    | "eq"
    /** A step's first word. */
    | "action"
    /** The words after a step's action. */
    | "arg"
    /** `;` between steps. */
    | "sep"
    /** A right-hand side starting with `+`: a group label (`ctrl+space c = +config`). */
    | "group"
    | "comment"
    /** Whitespace and anything else. */
    | "text";

export interface Token {
    type: TokenType;
    text: string;
}

/** Split into words and the whitespace between them, keeping both. */
const words = (s: string) => s.split(/(\s+)/).filter(Boolean);
const isSpace = (s: string) => /^\s/.test(s);

function leftSide(lhs: string, out: Token[]) {
    const parts = words(lhs);
    let i = 0;
    const skipSpace = () => {
        while (i < parts.length && isSpace(parts[i])) out.push({ type: "text", text: parts[i++] });
    };
    skipSpace();
    // `hold` counts once something follows it, as the parser wants whitespace after it.
    if (parts[i]?.toLowerCase() === "hold" && i + 1 < parts.length) {
        out.push({ type: "keyword", text: parts[i++] });
        skipSpace();
    }
    let rest: TokenType = "trigger";
    if (parts[i]?.toLowerCase() === "on") {
        out.push({ type: "keyword", text: parts[i++] });
        rest = "event";
    }
    for (; i < parts.length; i++) out.push({ type: isSpace(parts[i]) ? "text" : rest, text: parts[i] });
}

function rightSide(rhs: string, out: Token[]) {
    // A group label names a leader's keys; its text is a label, not steps.
    if (rhs.trimStart().startsWith("+")) {
        const [, lead, label, trail] = /^(\s*)(.*?)(\s*)$/s.exec(rhs)!;
        if (lead) out.push({ type: "text", text: lead });
        out.push({ type: "group", text: label });
        if (trail) out.push({ type: "text", text: trail });
        return;
    }
    rhs.split(/(;)/).forEach(part => {
        if (part === ";") return out.push({ type: "sep", text: part });
        let first = true;
        for (const w of words(part)) {
            if (isSpace(w)) out.push({ type: "text", text: w });
            else {
                out.push({ type: first ? "action" : "arg", text: w });
                first = false;
            }
        }
    });
}

/** The tokens of one line, in order; their texts joined give the line back. */
export function tokenizeLine(line: string): Token[] {
    const out: Token[] = [];
    // The parser cuts everything from the first `#`.
    const hash = line.indexOf("#");
    const code = hash < 0 ? line : line.slice(0, hash);
    const eq = code.indexOf("=");
    leftSide(eq < 0 ? code : code.slice(0, eq), out);
    if (eq >= 0) {
        out.push({ type: "eq", text: "=" });
        rightSide(code.slice(eq + 1), out);
    }
    if (hash >= 0) out.push({ type: "comment", text: line.slice(hash) });
    return out;
}

/** Tokens per line of the whole setting. */
export const tokenize = (text: string): Token[][] => text.split("\n").map(tokenizeLine);
