/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 hefker and Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/**
 * Message mode's geometry, pure so `node --test` can run it: where to scroll the chat so the cursor's message is in
 * full view, clear of the mode's hint, and which edge of the chat the hint sits at. Spans are viewport pixels
 * (getBoundingClientRect), top < bottom.
 */

export interface Span {
    top: number;
    bottom: number;
}

export type HintSide = "top" | "bottom";

/** Space between the hint and the chat's edge, and between the hint and the cursor's message. */
export const HINT_GAP = 8;

export interface ScrollRequest {
    /** The cursor's message. */
    item: Span;
    /** The chat scroller's visible box. */
    view: Span;
    scrollTop: number;
    /** scrollHeight - clientHeight. */
    maxScrollTop: number;
    /** Room to keep clear at each edge (the hint's side gets its height). */
    margin: Span;
    /** nearest: scroll only as far as needed to show it in full; center: put it in the middle; bottom: the very end. */
    align: "nearest" | "center" | "bottom";
}

/** The scrollTop that shows `item` as asked, clamped to what the scroller can do. */
export function scrollFor({ item, view, scrollTop, maxScrollTop, margin, align }: ScrollRequest): number {
    if (align === "bottom") return maxScrollTop;
    let band = { top: view.top + margin.top, bottom: view.bottom - margin.bottom };
    // Margins bigger than the chat: ignore them rather than scroll somewhere odd.
    if (band.bottom <= band.top) band = view;
    let delta = 0;
    if (align === "center") {
        delta = (item.top + item.bottom) / 2 - (band.top + band.bottom) / 2;
    } else if (item.bottom - item.top > band.bottom - band.top || item.top < band.top) {
        // Taller than the room left: show its start.
        delta = item.top - band.top;
    } else if (item.bottom > band.bottom) {
        delta = item.bottom - band.bottom;
    }
    return Math.min(maxScrollTop, Math.max(0, Math.round(scrollTop + delta)));
}

/** Where a hint `height` tall sits at `side` of `view`. */
export function hintSpan(side: HintSide, view: Span, height: number): Span {
    return side === "top"
        ? { top: view.top + HINT_GAP, bottom: view.top + HINT_GAP + height }
        : { top: view.bottom - HINT_GAP - height, bottom: view.bottom - HINT_GAP };
}

/** Room scrolling keeps clear at each edge with the hint at `side`. */
export function marginsFor(side: HintSide, height: number): Span {
    const room = height + 2 * HINT_GAP;
    return side === "top" ? { top: room, bottom: HINT_GAP } : { top: HINT_GAP, bottom: room };
}

const overlaps = (a: Span, b: Span) => a.top < b.bottom && b.top < a.bottom;

/**
 * The hint's side: it stays where it is unless it covers the cursor's message (scrolled as far as it goes, e.g. the
 * newest message at the very bottom) and the other side wouldn't.
 */
export function hintSide(side: HintSide, cursor: Span | null, view: Span, height: number): HintSide {
    if (!cursor || !overlaps(hintSpan(side, view, height), cursor)) return side;
    const other: HintSide = side === "top" ? "bottom" : "top";
    return overlaps(hintSpan(other, view, height), cursor) ? side : other;
}

/** Which of `items` (by id) show at least partly inside `view`. */
export function onScreen(items: readonly { id: string; span: Span; }[], view: Span): string[] {
    return items.filter(i => overlaps(i.span, view)).map(i => i.id);
}
