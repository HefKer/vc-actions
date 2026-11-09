/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 hefker and Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { openPluginSettings, pluginChoices } from "../lib/vencordSettings";
import { defineAction } from "../registry";

export default defineAction({
    id: "pluginsettings",
    description: "Open a Vencord plugin's settings",
    args: [{ name: "plugin", description: "Plugin name", type: "string", required: true, choices: pluginChoices }],
    run({ args }) {
        openPluginSettings(args.plugin);
    }
});
