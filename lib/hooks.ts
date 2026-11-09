/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 hefker and Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/**
 * Event hooks (`on vcjoin = gotocall`): the events, how they follow from your voice state, and the loop guard.
 * Pure: lib/events.ts reads Discord's stores into a HookState and feeds it here.
 */

/** Every event a hook can name, with what fires it (for errors and the docs). */
export const HOOK_EVENTS = {
    vcjoin: "you join a voice channel, or move to another",
    vcleave: "you leave voice",
    streamstart: "your own stream (Go Live) starts",
    streamstop: "your own stream ends",
    watchstart: "you start watching someone's stream (once per stream)",
    watchstop: "you stop watching one",
    muted: "your mic gets muted",
    unmuted: "your mic gets unmuted"
} as const;

export type HookEvent = keyof typeof HOOK_EVENTS;

export const isHookEvent = (s: string): s is HookEvent => Object.hasOwn(HOOK_EVENTS, s);

/** What the events are read from. */
export interface HookState {
    /** Your voice channel id, null when not in voice. */
    voice: string | null;
    /** You're streaming. */
    live: boolean;
    /** Stream keys you watch, your own left out. */
    watching: readonly string[];
    /** Your mic's mute flag as set (not counting deafen). */
    mute: boolean;
}

/** The events that going from `prev` to `next` fires, in a fixed order: leave before join, stop before start. */
export function stateEvents(prev: HookState, next: HookState): HookEvent[] {
    const out: HookEvent[] = [];
    if (prev.voice !== next.voice) {
        if (prev.voice && !next.voice) out.push("vcleave");
        if (next.voice) out.push("vcjoin");
    }
    if (prev.live !== next.live) out.push(next.live ? "streamstart" : "streamstop");
    for (const k of prev.watching) if (!next.watching.includes(k)) out.push("watchstop");
    for (const k of next.watching) if (!prev.watching.includes(k)) out.push("watchstart");
    if (prev.mute !== next.mute) out.push(next.mute ? "muted" : "unmuted");
    return out;
}

export interface HookRun {
    /** 0 for an event you caused, 1 for one a hook caused, and so on. */
    depth: number;
    /** Call when the hook's steps are done (failed or not). */
    done(now: number): void;
}

/**
 * Bounds hooks setting each other off (`on muted = unmute` with `on unmuted = mute`). Events come back from
 * Discord's stores after a step, not inside it, so cause can't be traced: an event that fires while a hook
 * runs, or within `settleMs` after one finished, counts as caused by it, one level deeper. `start` refuses
 * (returns null) past `maxDepth`; the chain then stops.
 */
export function createHookGuard(maxDepth: number, settleMs: number) {
    const runs = new Set<{ depth: number; end: number | null; }>();
    return {
        start(now: number): HookRun | null {
            let depth = 0;
            for (const r of runs) {
                if (r.end != null && now - r.end > settleMs) runs.delete(r);
                else depth = Math.max(depth, r.depth + 1);
            }
            if (depth > maxDepth) return null;
            const run = { depth, end: null as number | null };
            runs.add(run);
            return { depth, done: end => { run.end = end; } };
        }
    };
}
