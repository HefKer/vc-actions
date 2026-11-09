/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 hefker and Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { getUserSettingLazy } from "@api/UserSettings";
import { ApplicationStreamingStore } from "@webpack/common";

import { UserError } from "./errors";
import { isStatus, type Status, STATUSES, streamStatusChange, toggleStatus } from "./statusLogic";

/** Discord's synced presence setting ("online" | "idle" | "dnd" | "invisible"); needs the UserSettingsAPI plugin. */
const StatusSetting = getUserSettingLazy<string>("status", "status")!;

/** Discord's custom status proto: ids and times are strings (int64), "0" meaning none / never. */
interface CustomStatus {
    text: string;
    emojiId: string;
    emojiName: string;
    expiresAtMs: string;
    createdAtMs: string;
}
const CustomStatusSetting = getUserSettingLazy<CustomStatus | undefined>("status", "customStatus")!;

export const currentStatus = () => StatusSetting.getSetting();
export const setStatus = (s: string) => StatusSetting.updateSetting(s);

export function parseStatus(s: string | undefined): Status {
    const v = s?.trim().toLowerCase();
    if (!isStatus(v)) throw new UserError(`Unknown status "${s ?? ""}": use ${STATUSES.join(", ")}.`);
    return v;
}

/** The status `status toggle` goes back to; module-level, so forgotten on restart (then online). */
let previous: string | null = null;

/** Toggle between `target` and the status before the last toggle onto it; resolves to the status set. */
export async function toggle(target: Status): Promise<string> {
    const { set, remember } = toggleStatus(currentStatus(), target, previous);
    previous = remember;
    await setStatus(set);
    return set;
}

/** Sets a custom status text with no expiry, keeping its emoji; empty text clears it. */
export async function setCustomStatus(text: string) {
    if (!text) return CustomStatusSetting.updateSetting(undefined);
    await CustomStatusSetting.updateSetting(old => ({
        emojiId: old?.emojiId ?? "0",
        emojiName: old?.emojiName ?? "",
        text,
        expiresAtMs: "0",
        createdAtMs: String(Date.now())
    }));
}

/* DND while streaming: watches ApplicationStreamingStore for your own stream starting and ending. */

let enabled: () => boolean = () => false;
let live = false;
let saved: string | null = null;

function onStreamChange() {
    const now = ApplicationStreamingStore.getCurrentUserActiveStream() != null;
    if (now === live) return;
    live = now;
    // Turned off mid-stream: still restore on stream end what we changed.
    if (live && !enabled()) return;
    const r = streamStatusChange(live, currentStatus(), saved);
    saved = r.saved;
    if (r.set) setStatus(r.set);
}

export function startStreamDnd(isEnabled: () => boolean) {
    enabled = isEnabled;
    live = ApplicationStreamingStore.getCurrentUserActiveStream() != null;
    ApplicationStreamingStore.addChangeListener(onStreamChange);
}

export function stopStreamDnd() {
    ApplicationStreamingStore.removeChangeListener(onStreamChange);
    saved = null;
}
