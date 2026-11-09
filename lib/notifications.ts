/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 hefker and Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { findByPropsLazy } from "@webpack";
import { ChannelStore, ComponentDispatch, GuildStore, NotificationSettingsStore, SelectedChannelStore, SelectedGuildStore, UserGuildSettingsStore } from "@webpack/common";

import { callOrDispatch } from "./discord";
import { UserError } from "./errors";

/** Discord's notification-settings creators, what the Mute Channel / Mute Server context menu items call. */
const NotificationActions: {
    updateGuildNotificationSettings(guildId: string, settings: { muted: boolean; }, label?: string): void;
    updateChannelOverrideSettings(o: { guildId: string | null; channelId: string; settings: { muted: boolean; }; label?: string; }): void;
} = findByPropsLazy("updateGuildNotificationSettings", "updateChannelOverrideSettings");

/** setDesktopType is what the "Enable Desktop Notifications" switch in Settings → Notifications calls. */
const NotificationSettingsActions: { setDesktopType(type: string): void; } = findByPropsLazy("setDesktopType", "setTTSType");

/** Toggle the mute of the current channel (DMs too) or server, indefinitely like the menu's top item; returns the new state. */
export function toggleNotifMute(scope: "channel" | "server"): { name: string; muted: boolean; } {
    if (scope === "server") {
        const g = SelectedGuildStore.getGuildId();
        if (!g) throw new UserError("Open a server first: you're not viewing one.");
        const muted = !UserGuildSettingsStore.isMuted(g);
        NotificationActions.updateGuildNotificationSettings(g, { muted }, muted ? "muted" : "unmuted");
        return { name: GuildStore.getGuild(g)?.name ?? "the server", muted };
    }
    const id = SelectedChannelStore.getChannelId();
    const ch = id ? ChannelStore.getChannel(id) : undefined;
    if (!ch) throw new UserError("Open a channel first.");
    const guildId = ch.guild_id ?? null;
    const muted = !UserGuildSettingsStore.isChannelMuted(guildId, ch.id);
    NotificationActions.updateChannelOverrideSettings({ guildId, channelId: ch.id, settings: { muted }, label: muted ? "muted" : "unmuted" });
    return { name: ch.name ? (guildId ? `#${ch.name}` : ch.name) : "this DM", muted };
}

/** Desktop notifications are on unless the type is NEVER (the settings switch reads it so; ONLY_MENTIONS counts as on). */
export const desktopNotifsOn = () => NotificationSettingsStore.getDesktopType() !== "NEVER";

/** Turn desktop notifications on (ALL) or off (NEVER), as the settings switch does. */
export function setDesktopNotifs(on: boolean) {
    const desktopType = on ? "ALL" : "NEVER";
    callOrDispatch("setDesktopType", () => NotificationSettingsActions.setDesktopType(desktopType),
        { type: "NOTIFICATIONS_SET_DESKTOP_TYPE", desktopType });
}

/** The inbox's Mentions tab, in Discord's inbox-tab enum. */
const INBOX_MENTIONS = 1;

/** Open (or close, if open) the notification inbox on its Mentions tab, like Ctrl+I. */
export function toggleInbox() {
    ComponentDispatch.dispatch("TOGGLE_INBOX", INBOX_MENTIONS);
}
