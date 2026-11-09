/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 hefker and Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/**
 * Autocomplete for the Hotkeys setting editor: what to offer at the cursor. Action ids where a step starts,
 * an action's arg choices after it, events after `on`. Pure: the editor draws the list and applies the pick.
 */

// @ts-expect-error TS5097: node --test resolves only the real file name; tsc still type-checks the import.
import { HOOK_EVENTS } from "./hooks.ts";

/** What completion needs of an action; the registry's Action fits. */
export interface CompletionAction {
    id: string;
    description: string;
    args?: readonly { name: string; description: string; choices?: () => string[]; }[];
}

export interface CompletionItem {
    label: string;
    detail?: string;
    /** Replaces the text from `from` to `to`. */
    insert: string;
}

export interface Completion {
    /** Text offsets the picked item replaces. */
    from: number;
    to: number;
    /** What's typed so far (from `from` to the cursor). */
    prefix: string;
    /** What's being completed, for the list's header. */
    title: string;
    items: CompletionItem[];
}

/** Prefix matches first, then other substring matches, case-insensitive; nothing when the prefix is already a full item. */
function finish(c: Omit<Completion, "items">, items: CompletionItem[]): Completion | null {
    const p = c.prefix.toLowerCase();
    const starts = items.filter(i => i.label.toLowerCase().startsWith(p));
    const inside = p ? items.filter(i => !i.label.toLowerCase().startsWith(p) && i.label.toLowerCase().includes(p)) : [];
    const out = [...starts, ...inside];
    // Typed out in full: nothing left to complete, and Enter should be a newline again.
    if (!out.length || out.some(i => i.label === c.prefix)) return null;
    return { ...c, items: out };
}

/** What to offer at `cursor` in the setting `text`, or null for nothing. */
export function complete(text: string, cursor: number, actions: readonly CompletionAction[]): Completion | null {
    const lineStart = text.lastIndexOf("\n", cursor - 1) + 1;
    const lineEnd = (i => i < 0 ? text.length : i)(text.indexOf("\n", cursor));
    const before = text.slice(lineStart, cursor);
    if (before.includes("#")) return null;
    // The rest of the word under the cursor is replaced too.
    const to = cursor + /^[^\s;#=]*/.exec(text.slice(cursor, lineEnd))![0].length;

    const eq = before.indexOf("=");
    if (eq < 0) {
        const on = /^\s*on\s+(\S*)$/i.exec(before);
        if (!on) return null;
        const hasEq = /^\s*=/.test(text.slice(to, lineEnd));
        const items = Object.entries(HOOK_EVENTS).map(([event, what]) => ({ label: event, detail: what as string, insert: hasEq ? event : `${event} = ` }));
        return finish({ from: cursor - on[1].length, to, prefix: on[1], title: "event" }, items);
    }

    const rhs = before.slice(eq + 1);
    const semi = rhs.lastIndexOf(";");
    const step = rhs.slice(semi + 1);
    // A group label (`= +config`) is a name, not a step.
    if (semi < 0 && step.trimStart().startsWith("+")) return null;

    const first = /^(\s*)(\S*)$/.exec(step);
    if (first) {
        // Right after `=` or `;` with no space yet: wait for one.
        if (!first[1] && !first[2]) return null;
        const items = actions.map(a => ({ label: a.id, detail: a.description, insert: a.args?.length ? `${a.id} ` : a.id }));
        return finish({ from: cursor - first[2].length, to, prefix: first[2], title: "action" }, items);
    }

    const m = /^\s*(\S+)\s+(.*)$/s.exec(step)!;
    const args = actions.find(a => a.id === m[1])?.args;
    if (!args?.length) return null;
    const argText = m[2];
    const argFrom = cursor - argText.length;
    const starts = [...argText.matchAll(/\S+/g)].map(w => w.index!);
    /** The word the cursor is in; past a space, a new one. */
    const current = !argText || /\s$/.test(argText) ? starts.length : starts.length - 1;
    // Words past the last arg belong to it: it takes the rest of the step, spaces and all.
    const index = Math.min(current, args.length - 1);
    const last = index === args.length - 1;
    const start = starts[index] ?? argText.length;
    const arg = args[index];
    let choices: string[] = [];
    try {
        choices = arg.choices?.() ?? [];
    } catch {
        // A choice list reading a missing plugin or store: offer nothing.
    }
    // The last arg runs to the end of the step, so replace up to there (trailing spaces kept).
    const end = last ? cursor + /^[^;#]*/.exec(text.slice(cursor, lineEnd))![0].trimEnd().length : to;
    const items = choices.map(c => ({ label: c, insert: last ? c : `${c} ` }));
    return finish({ from: argFrom + start, to: end, prefix: argText.slice(start), title: `${m[1]} <${arg.name}>: ${arg.description}` }, items);
}

/** The text and cursor after picking `item`. */
export function applyCompletion(text: string, c: Completion, item: CompletionItem): { text: string; cursor: number; } {
    return { text: text.slice(0, c.from) + item.insert + text.slice(c.to), cursor: c.from + item.insert.length };
}
