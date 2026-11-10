/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 hefker and Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/**
 * Message mode's state machine: a cursor over the messages shown in a channel, a vim-style count prefix, a
 * multi-selection, an incremental search and Vimium-style labels. It sees message ids (oldest first, as Discord lists
 * them) and, for search, a message's text through a callback, so `node --test` can run it; actions/messagemode.tsx
 * feeds it keys and carries out the commands it returns.
 */

/** Most messages one forward sends, spaced out (see lib/messages.ts), so a batch stays clear of rate limits. */
export const MAX_SELECTED = 10;

/** Digits a count keeps; more are ignored, so `99999999j` can't overflow anything. */
const MAX_COUNT_DIGITS = 4;

/** Letters labels are made of, home row first (Vimium's default). */
export const LABEL_ALPHABET = "sadfjklewcmpgh";

export interface SearchInput {
    /** Typed so far. */
    query: string;
    /** The cursor when `/` was pressed: where Esc goes back to and where matching starts. */
    from: string | null;
}

export interface Labels {
    /** Letters typed so far. */
    typed: string;
    /** Label → message id. */
    targets: Readonly<Record<string, string>>;
}

export interface ModeState {
    /** The highlighted message; null when the channel shows none. */
    cursor: string | null;
    /** Messages marked with space, in the order marked. */
    selected: readonly string[];
    /** Digits typed so far for the next move (`3` of `3k`); "" when none. */
    count: string;
    /** Non-null while a search is being typed after `/`. */
    search: SearchInput | null;
    /** The last search accepted with Enter, for n/N and its highlight; "" when none. */
    lastSearch: string;
    /** Non-null while labels are shown after `;`. */
    labels: Labels | null;
    /** A message being jumped to (`o` on a reply to one not loaded): the cursor moves there once it's shown. */
    goal: string | null;
}

/** What the key asks the caller to do besides showing the new state. */
export type ModeCommand =
    | { type: "reply"; id: string; mention: boolean; }
    /** One message, opened in a Discord UI that takes the keys from there (picker, inline editor, thread). */
    | { type: "react" | "edit" | "thread"; id: string; }
    /** One message, through Discord's confirm dialog. */
    | { type: "pin" | "delete"; id: string; }
    /** The replied-to message of `id`: move there if it's shown (`moveTo`), else jump with Discord (`setGoal`). */
    | { type: "parent"; id: string; }
    /** Ids oldest first: the selection, else the cursor's message. */
    | { type: "forward" | "copy" | "link"; ids: string[]; }
    /** `d` with a selection: delete the selected messages, ids oldest first (one confirm for all). */
    | { type: "deleteMany"; ids: string[]; }
    /** Scroll the cursor's message to the middle. */
    | { type: "center"; }
    /** Show labels on the messages on screen: call `showLabels` with their ids. */
    | { type: "labels"; }
    /** n/N or a search found nothing for `query` ("" when there was no search to repeat). */
    | { type: "notFound"; query: string; }
    /** Space on a new message with MAX_SELECTED already marked: nothing changed, say why. */
    | { type: "full"; }
    | { type: "exit"; };

export interface ModeResult {
    state: ModeState;
    command?: ModeCommand;
}

/** Entering the mode: the cursor on the newest message. */
export function startMode(ids: readonly string[]): ModeState {
    return { cursor: ids.at(-1) ?? null, selected: [], count: "", search: null, lastSearch: "", labels: null, goal: null };
}

/** Moving needs a cursor that's in the list; one that isn't counts from the newest. */
function moveBy(state: ModeState, ids: readonly string[], delta: number): string | null {
    if (!ids.length) return null;
    const at = state.cursor == null ? -1 : ids.indexOf(state.cursor);
    const from = at < 0 ? ids.length - 1 : at;
    return ids[Math.min(ids.length - 1, Math.max(0, from + delta))];
}

/** Vim's smartcase: a query with a capital letter matches case-sensitively, an all-lowercase one doesn't. */
export function matchesQuery(query: string, text: string): boolean {
    if (!query) return false;
    return query === query.toLowerCase() ? text.toLowerCase().includes(query) : text.includes(query);
}

/** The shown messages matching `query`, oldest first. */
export function searchMatches(query: string, ids: readonly string[], text: (id: string) => string): string[] {
    return query ? ids.filter(id => matchesQuery(query, text(id))) : [];
}

/**
 * The next match for `query` after `from`, going `dir` (-1: older, up; 1: newer, down) and wrapping around, so `from`
 * itself comes last. A `from` not shown starts past the end it's going away from. Undefined when nothing matches.
 */
function findMatch(query: string, from: string | null, dir: -1 | 1, ids: readonly string[], text: (id: string) => string): string | undefined {
    if (!query || !ids.length) return undefined;
    let at = from == null ? -1 : ids.indexOf(from);
    if (at < 0) at = dir < 0 ? ids.length : -1;
    for (let step = 1; step <= ids.length; step++) {
        const id = ids[(((at + dir * step) % ids.length) + ids.length) % ids.length];
        if (matchesQuery(query, text(id))) return id;
    }
    return undefined;
}

/**
 * `count` short labels from `alphabet`, none a prefix of another, as short as they can be (Vimium's scheme): up to
 * `alphabet.length` messages get one letter each, more turn the first letters into two-letter prefixes.
 */
export function labelStrings(count: number, alphabet = LABEL_ALPHABET): string[] {
    if (count <= 0) return [];
    const labels = [""];
    let offset = 0;
    while (labels.length - offset < count || labels.length === 1) {
        const prefix = labels[offset++];
        for (const ch of alphabet) labels.push(prefix + ch);
    }
    return labels.slice(offset, offset + count);
}

/** Show labels on `visible` (ids of the messages on screen, oldest first); with none on screen, nothing changes. */
export function showLabels(state: ModeState, visible: readonly string[]): ModeState {
    if (!visible.length) return state;
    const names = labelStrings(visible.length);
    return { ...state, count: "", labels: { typed: "", targets: Object.fromEntries(visible.map((id, i) => [names[i], id])) } };
}

/** Put the cursor on `id` if it's shown (`o` on a reply whose message is loaded). */
export function moveTo(state: ModeState, id: string, ids: readonly string[]): ModeState {
    return ids.includes(id) ? { ...state, cursor: id, count: "", goal: null } : state;
}

/** Wait for `id` to be shown, then put the cursor there (rebase does it). */
export function setGoal(state: ModeState, id: string): ModeState {
    return { ...state, goal: id };
}

/** Keys whose key repeat (holding it down) counts, rather than being ignored. */
export function acceptsRepeat(state: ModeState, key: string): boolean {
    if (state.search) return key === "Backspace" || key.length === 1;
    if (state.labels) return false;
    return ["j", "k", "ArrowDown", "ArrowUp", "n", "N"].includes(key);
}

/** A key typed while labels are shown: letters narrow them down, a whole label moves there, anything else cancels. */
function labelKey(state: ModeState, labels: Labels, key: string): ModeResult {
    if (key === "Backspace") {
        return { state: { ...state, labels: labels.typed ? { ...labels, typed: labels.typed.slice(0, -1) } : null } };
    }
    if (key.length !== 1) return { state: { ...state, labels: null } };
    const typed = labels.typed + key.toLowerCase();
    const hit = labels.targets[typed];
    if (hit) return { state: { ...state, cursor: hit, labels: null } };
    if (Object.keys(labels.targets).some(l => l.startsWith(typed))) return { state: { ...state, labels: { ...labels, typed } } };
    return { state: { ...state, labels: null } };
}

/**
 * A key typed in the search after `/`: text goes into the query and the cursor jumps to the nearest older match from
 * where the search began (back there while nothing matches); Enter keeps the cursor and the query for n/N; Esc, or
 * Backspace on an empty query, goes back to where it began.
 */
function searchKey(state: ModeState, search: SearchInput, key: string, ids: readonly string[], text: (id: string) => string): ModeResult {
    const back = search.from ?? state.cursor;
    const typing = (query: string): ModeResult =>
        ({ state: { ...state, search: { ...search, query }, cursor: findMatch(query, search.from, -1, ids, text) ?? back } });
    switch (key) {
        case "Escape":
            return { state: { ...state, search: null, cursor: back } };
        case "Enter": {
            if (search.query) return { state: { ...state, search: null, lastSearch: search.query } };
            // Empty: search again for the last query, like vim's `/<Enter>`.
            const done = { ...state, search: null };
            const hit = findMatch(state.lastSearch, search.from, -1, ids, text);
            return hit ? { state: { ...done, cursor: hit } } : { state: done, command: { type: "notFound", query: state.lastSearch } };
        }
        case "Backspace":
            return search.query ? typing(search.query.slice(0, -1)) : { state: { ...state, search: null, cursor: back } };
        default:
            return key.length === 1 ? typing(search.query + key) : { state };
    }
}

/**
 * One key (`KeyboardEvent.key`) pressed in the mode, with the ids shown now (oldest first) and their text for search.
 * j/k (or the arrows) move down/up by the count (default 1, clamped at the ends); g/G (or Home/End) go to the
 * oldest/newest shown; z centres; r/R reply with/without a ping; e reacts; E edits; p pins; d deletes; t opens the
 * thread; o goes to the replied-to message; c/l copy the text/link and f forwards, of the selection or else the
 * cursor's message; space marks or unmarks the cursor's message; `/` starts a search, n/N go to the next older/newer
 * match of the last one (by the count); `;` asks for labels; Esc clears a pending count, else the search highlight,
 * else the selection, else exits. Any other key does nothing but drop a pending count. While a search is typed or
 * labels are shown, keys go there (searchKey, labelKey). Pure.
 */
export function pressKey(state: ModeState, key: string, ids: readonly string[], text: (id: string) => string = () => ""): ModeResult {
    if (state.search) return searchKey(state, state.search, key, ids, text);
    if (state.labels) return labelKey(state, state.labels, key);

    const plain = { ...state, count: "" };

    if (/^[0-9]$/.test(key)) {
        // A leading 0 isn't a count (vim's 0 is a motion); after a digit it's one.
        if (key === "0" && !state.count) return { state: plain };
        return { state: { ...state, count: state.count.length < MAX_COUNT_DIGITS ? state.count + key : state.count } };
    }

    const n = Math.max(1, Number(state.count) || 1);
    const cursor = state.cursor != null && ids.includes(state.cursor) ? state.cursor : null;
    const one = (type: "react" | "edit" | "thread" | "pin" | "delete" | "parent"): ModeResult =>
        cursor ? { state: plain, command: { type, id: cursor } } : { state: plain };
    const many = (type: "forward" | "copy" | "link"): ModeResult => {
        const marked = ids.filter(id => state.selected.includes(id));
        if (marked.length) return { state: plain, command: { type, ids: marked } };
        return cursor ? { state: plain, command: { type, ids: [cursor] } } : { state: plain };
    };
    const next = (dir: -1 | 1): ModeResult => {
        let at = state.cursor;
        for (let i = 0; i < n; i++) {
            const hit = findMatch(state.lastSearch, at, dir, ids, text);
            if (!hit) return { state: plain, command: { type: "notFound", query: state.lastSearch } };
            at = hit;
        }
        return { state: { ...plain, cursor: at } };
    };

    switch (key) {
        case "j":
        case "ArrowDown":
            return { state: { ...plain, cursor: moveBy(state, ids, n) } };
        case "k":
        case "ArrowUp":
            return { state: { ...plain, cursor: moveBy(state, ids, -n) } };
        case "g":
        case "Home":
            return { state: { ...plain, cursor: ids[0] ?? null } };
        case "G":
        case "End":
            return { state: { ...plain, cursor: ids.at(-1) ?? null } };
        case "z":
            return cursor ? { state: plain, command: { type: "center" } } : { state: plain };
        case "r":
        case "R":
            return cursor ? { state: plain, command: { type: "reply", id: cursor, mention: key === "r" } } : { state: plain };
        case "e":
            return one("react");
        case "E":
            return one("edit");
        case "p":
            return one("pin");
        case "d": {
            const marked = ids.filter(id => state.selected.includes(id));
            return marked.length ? { state: plain, command: { type: "deleteMany", ids: marked } } : one("delete");
        }
        case "t":
            return one("thread");
        case "o":
            return one("parent");
        case "c":
            return many("copy");
        case "l":
            return many("link");
        case "f":
            return many("forward");
        case "/":
            return ids.length ? { state: { ...plain, search: { query: "", from: cursor } } } : { state: plain };
        case "n":
            return next(-1);
        case "N":
            return next(1);
        case ";":
            return ids.length ? { state: plain, command: { type: "labels" } } : { state: plain };
        case " ": {
            if (!cursor) return { state: plain };
            if (state.selected.includes(cursor)) return { state: { ...plain, selected: state.selected.filter(id => id !== cursor) } };
            if (state.selected.length >= MAX_SELECTED) return { state: plain, command: { type: "full" } };
            return { state: { ...plain, selected: [...state.selected, cursor] } };
        }
        case "Escape":
            if (state.count) return { state: plain };
            if (state.lastSearch) return { state: { ...plain, lastSearch: "" } };
            if (state.selected.length) return { state: { ...plain, selected: [] } };
            return { state: plain, command: { type: "exit" } };
        default:
            return { state: plain };
    }
}

/**
 * The state after the shown messages changed from `before` to `after` (new ones arrived, older ones loaded,
 * some deleted, a jump loaded others). A goal now shown takes the cursor. Marked messages that are gone drop out,
 * and labels go if anything changed (they point at places on screen). A cursor whose message is gone moves to the
 * next newer message still shown, else the newest; one still shown stays put. Pure.
 */
export function rebase(state: ModeState, before: readonly string[], after: readonly string[]): ModeState {
    const shown = new Set(after);
    const selected = state.selected.filter(id => shown.has(id));
    let { cursor, goal } = state;
    if (goal != null && shown.has(goal)) {
        cursor = goal;
        goal = null;
    }
    if (cursor == null || !shown.has(cursor)) {
        const at = cursor == null ? -1 : before.indexOf(cursor);
        cursor = (at < 0 ? undefined : before.slice(at + 1).find(id => shown.has(id))) ?? after.at(-1) ?? null;
    }
    const labels = state.labels && after.join() !== before.join() ? null : state.labels;
    const same = selected.length === state.selected.length && cursor === state.cursor && goal === state.goal && labels === state.labels;
    return same ? state : { ...state, cursor, selected, goal, labels };
}
