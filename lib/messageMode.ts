/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 hefker and Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/**
 * Message mode's state machine: a cursor over the messages shown in a channel, a vim-style count prefix and a
 * multi-selection. It sees message ids only (oldest first, as Discord lists them), so `node --test` can run it;
 * actions/messagemode.tsx feeds it keys and carries out the commands it returns.
 */

/** Most messages one forward sends, spaced out (see lib/messages.ts), so a batch stays clear of rate limits. */
export const MAX_SELECTED = 10;

/** Digits a count keeps; more are ignored, so `99999999j` can't overflow anything. */
const MAX_COUNT_DIGITS = 4;

export interface ModeState {
    /** The highlighted message; null when the channel shows none. */
    cursor: string | null;
    /** Messages marked with space, in the order marked. */
    selected: readonly string[];
    /** Digits typed so far for the next move (`3` of `3k`); "" when none. */
    count: string;
}

/** What the key asks the caller to do besides showing the new state. */
export type ModeCommand =
    | { type: "reply"; id: string; mention: boolean; }
    | { type: "react"; id: string; }
    /** Ids oldest first, the order they're forwarded in. */
    | { type: "forward"; ids: string[]; }
    /** Space on a new message with MAX_SELECTED already marked: nothing changed, say why. */
    | { type: "full"; }
    | { type: "exit"; };

export interface ModeResult {
    state: ModeState;
    command?: ModeCommand;
}

/** Entering the mode: the cursor on the newest message. */
export function startMode(ids: readonly string[]): ModeState {
    return { cursor: ids.at(-1) ?? null, selected: [], count: "" };
}

/** Moving needs a cursor that's in the list; one that isn't counts from the newest. */
function moveBy(state: ModeState, ids: readonly string[], delta: number): string | null {
    if (!ids.length) return null;
    const at = state.cursor == null ? -1 : ids.indexOf(state.cursor);
    const from = at < 0 ? ids.length - 1 : at;
    return ids[Math.min(ids.length - 1, Math.max(0, from + delta))];
}

/**
 * One key (`KeyboardEvent.key`) pressed in the mode, with the ids shown now (oldest first). j/k (or the arrows)
 * move down/up by the count (default 1, clamped at the ends); g/G (or Home/End) go to the oldest/newest shown;
 * r/R reply with/without a ping; e reacts; f forwards the selection, or the cursor's message if none; space marks or
 * unmarks the cursor's message; Esc clears a pending count, else the selection, else exits. Any other key does
 * nothing but drop a pending count. Pure.
 */
export function pressKey(state: ModeState, key: string, ids: readonly string[]): ModeResult {
    const plain = { ...state, count: "" };

    if (/^[0-9]$/.test(key)) {
        // A leading 0 isn't a count (vim's 0 is a motion); after a digit it's one.
        if (key === "0" && !state.count) return { state: plain };
        return { state: { ...state, count: state.count.length < MAX_COUNT_DIGITS ? state.count + key : state.count } };
    }

    const n = Math.max(1, Number(state.count) || 1);
    const cursor = state.cursor != null && ids.includes(state.cursor) ? state.cursor : null;

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
        case "r":
        case "R":
            return cursor ? { state: plain, command: { type: "reply", id: cursor, mention: key === "r" } } : { state: plain };
        case "e":
            return cursor ? { state: plain, command: { type: "react", id: cursor } } : { state: plain };
        case "f": {
            const marked = ids.filter(id => state.selected.includes(id));
            if (marked.length) return { state: plain, command: { type: "forward", ids: marked } };
            return cursor ? { state: plain, command: { type: "forward", ids: [cursor] } } : { state: plain };
        }
        case " ": {
            if (!cursor) return { state: plain };
            if (state.selected.includes(cursor)) return { state: { ...plain, selected: state.selected.filter(id => id !== cursor) } };
            if (state.selected.length >= MAX_SELECTED) return { state: plain, command: { type: "full" } };
            return { state: { ...plain, selected: [...state.selected, cursor] } };
        }
        case "Escape":
            if (state.count) return { state: plain };
            if (state.selected.length) return { state: { ...plain, selected: [] } };
            return { state: plain, command: { type: "exit" } };
        default:
            return { state: plain };
    }
}

/**
 * The state after the shown messages changed from `before` to `after` (new ones arrived, older ones loaded,
 * some deleted). Marked messages that are gone drop out. A cursor whose message is gone moves to the next newer
 * message still shown, else the newest; one still shown stays put. Pure.
 */
export function rebase(state: ModeState, before: readonly string[], after: readonly string[]): ModeState {
    const shown = new Set(after);
    const selected = state.selected.filter(id => shown.has(id));
    let { cursor } = state;
    if (cursor == null || !shown.has(cursor)) {
        const at = cursor == null ? -1 : before.indexOf(cursor);
        cursor = (at < 0 ? undefined : before.slice(at + 1).find(id => shown.has(id))) ?? after.at(-1) ?? null;
    }
    return selected.length === state.selected.length && cursor === state.cursor ? state : { ...state, cursor, selected };
}
