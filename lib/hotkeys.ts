/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 hefker and Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

export interface Combo {
    ctrl: boolean;
    alt: boolean;
    shift: boolean;
    meta: boolean;
    key: string;
}

export interface Binding {
    combo: Combo;
    /** The combo as written, for messages. */
    text: string;
    actionId: string;
    /** Rest of the line, split over the action's args; the last arg takes what's left. */
    rest: string;
}

const MODS: Record<string, keyof Omit<Combo, "key">> = {
    ctrl: "ctrl", control: "ctrl",
    alt: "alt", option: "alt",
    shift: "shift",
    meta: "meta", super: "meta", win: "meta", cmd: "meta", mod: "ctrl"
};

const ALIASES: Record<string, string> = { esc: "escape", space: " ", plus: "+", del: "delete", return: "enter" };

export function parseCombo(text: string): Combo | null {
    const parts = text.toLowerCase().split("+").map(p => p.trim());
    // "ctrl+plus" or a trailing "+" key: "ctrl++"
    if (text.endsWith("++")) parts.splice(-2, 2, "+");
    const combo: Combo = { ctrl: false, alt: false, shift: false, meta: false, key: "" };
    for (const p of parts) {
        if (!p) return null;
        if (MODS[p]) combo[MODS[p]] = true;
        else if (combo.key) return null;
        else combo.key = ALIASES[p] ?? p;
    }
    return combo.key ? combo : null;
}

/** The key of an event, layout-independent for letters and digits so shift doesn't change it. */
export function eventKey(e: Pick<KeyboardEvent, "key" | "code">): string {
    if (/^Key[A-Z]$/.test(e.code)) return e.code.slice(3).toLowerCase();
    if (/^Digit\d$/.test(e.code)) return e.code.slice(5);
    if (/^Numpad\d$/.test(e.code)) return e.code.slice(6);
    return e.key.toLowerCase();
}

export function matches(c: Combo, e: Pick<KeyboardEvent, "key" | "code" | "ctrlKey" | "altKey" | "shiftKey" | "metaKey">): boolean {
    return c.ctrl === e.ctrlKey && c.alt === e.altKey && c.shift === e.shiftKey && c.meta === e.metaKey
        && c.key === eventKey(e);
}

/**
 * Parse the hotkeys setting: one `combo = action args...` per line, `#` starts a comment.
 * Returns the bindings plus a message per bad line.
 */
export function parseBindings(text: string, knownIds: Set<string>): { bindings: Binding[]; errors: string[]; } {
    const bindings: Binding[] = [];
    const errors: string[] = [];
    text.split("\n").forEach((raw, i) => {
        const line = raw.replace(/#.*/, "").trim();
        if (!line) return;
        const eq = line.indexOf("=");
        if (eq < 0) return errors.push(`line ${i + 1}: expected "combo = action", got "${line}"`);
        const comboText = line.slice(0, eq).trim();
        const [actionId = "", ...rest] = line.slice(eq + 1).trim().split(/\s+/);
        const combo = parseCombo(comboText);
        if (!combo) return errors.push(`line ${i + 1}: can't read hotkey "${comboText}"`);
        if (!knownIds.has(actionId)) return errors.push(`line ${i + 1}: no action "${actionId}"`);
        bindings.push({ combo, text: comboText, actionId, rest: rest.join(" ") });
    });
    return { bindings, errors };
}

/** Spread the words after the action id over its args; the last arg takes the remainder. */
export function splitArgs(rest: string, names: string[]): Record<string, string | undefined> {
    const words = rest ? rest.split(/\s+/) : [];
    const out: Record<string, string | undefined> = {};
    names.forEach((n, i) => {
        out[n] = i === names.length - 1 ? (words.slice(i).join(" ") || undefined) : words[i];
    });
    return out;
}
