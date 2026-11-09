/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 hefker and Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/** Listeners put on every Discord window; each gets the window the event happened in. */
export interface WindowHandlers {
    keydown?(e: KeyboardEvent, win: Window): void;
    keyup?(e: KeyboardEvent, win: Window): void;
    blur?(e: FocusEvent, win: Window): void;
}

type EventName = keyof WindowHandlers;
const EVENTS: EventName[] = ["keydown", "keyup", "blur"];

interface Attached {
    win: Window;
    doc: Document;
    detach(): void;
}

/**
 * Keeps `handlers` attached to exactly the windows last passed to `sync`, by key.
 * Pure DOM: no Discord imports, so the Discord glue (lib/windows.ts) decides what the windows are.
 */
export function createWindowTracker(handlers: WindowHandlers) {
    const attached = new Map<string, Attached>();

    function attach(win: Window): Attached {
        const bound = EVENTS.filter(n => handlers[n]).map(n => {
            const fn = (e: Event) => (handlers[n] as (e: Event, w: Window) => void)(e, win);
            // Capture phase, so Discord's own handlers don't swallow the key first.
            win.addEventListener(n, fn, true);
            return () => win.removeEventListener(n, fn, true);
        });
        return { win, doc: win.document, detach: () => bound.forEach(f => f()) };
    }

    return {
        sync(windows: Iterable<[string, Window | undefined]>) {
            const seen = new Set<string>();
            for (const [key, win] of windows) {
                if (!win) continue;
                seen.add(key);
                const old = attached.get(key);
                // Same window and document: already listening. A pop-out that loaded a new document lost its listeners.
                if (old?.win === win && old.doc === win.document) continue;
                old?.detach();
                attached.set(key, attach(win));
            }
            for (const [key, a] of attached) {
                if (!seen.has(key)) {
                    a.detach();
                    attached.delete(key);
                }
            }
        },
        clear() {
            attached.forEach(a => a.detach());
            attached.clear();
        }
    };
}
