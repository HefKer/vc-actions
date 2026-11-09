/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 hefker and Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/** Presence statuses you can pick in Discord, as its status setting stores them. Pure, so `node --test` can run it. */
export const STATUSES = ["online", "idle", "dnd", "invisible"] as const;
export type Status = typeof STATUSES[number];

export const isStatus = (s: string | undefined): s is Status => (STATUSES as readonly string[]).includes(s ?? "");

/**
 * `status toggle <target>`: what to set. Not on target: the target (remember `current` to come back to).
 * On target: the remembered status, or online if none (or it's the target itself).
 */
export function toggleStatus(current: string, target: Status, previous: string | null): { set: string; remember: string | null; } {
    if (current !== target) return { set: target, remember: current };
    return { set: previous && previous !== target ? previous : "online", remember: null };
}

/**
 * DND while streaming. Stream started: set dnd unless already dnd or invisible, saving the status to restore.
 * Stream ended: restore the saved status only if it's still dnd (the user didn't change it meanwhile).
 */
export function streamStatusChange(live: boolean, current: string, saved: string | null): { set?: string; saved: string | null; } {
    if (live) {
        if (saved != null || current === "dnd" || current === "invisible") return { saved };
        return { set: "dnd", saved: current };
    }
    if (saved == null) return { saved: null };
    return current === "dnd" ? { set: saved, saved: null } : { saved: null };
}
