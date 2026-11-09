/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 hefker and Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { isPluginEnabled, plugins } from "@api/PluginManager";
import { openPluginModal } from "@components/settings/tabs";
import { SettingsRouter } from "@webpack/common";

import { ResolveError, resolveName } from "./resolve";

/** Vencord's Plugins tab in Discord's settings (its sidebar entry key + "_panel", see _core/settings.tsx). */
export const openPluginsPage = () => SettingsRouter.openUserSettings("vencord_plugins_panel");

/** Plugins a user can see in the Plugins tab. */
const visible = () => Object.values(plugins).filter(p => !p.hidden).sort((a, b) => a.name.localeCompare(b.name));

/** Choices: enabled plugins only (hundreds otherwise); any visible plugin still resolves. */
export function pluginChoices(): string[] {
    try {
        return visible().filter(p => isPluginEnabled(p.name)).map(p => p.name);
    } catch {
        return [];
    }
}

/** Open a plugin's settings modal, the one its cog in the Plugins tab opens; returns its name. */
export function openPluginSettings(input: string | undefined): string {
    const list = visible();
    const r = resolveName(input, list.map(p => ({ names: [p.name], value: p })), "plugin");
    if (!r.ok) throw new ResolveError(r.error);
    openPluginModal(r.value);
    return r.value.name;
}
