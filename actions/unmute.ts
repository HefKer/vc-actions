/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 hefker and Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { holdSelfAudio } from "../lib/selfAudio";
import { defineAction } from "../registry";

export default defineAction({
    id: "unmute",
    description: "Unmute your mic (and undeafen, as Discord's unmute does); held, restore both on release (push-to-talk)",
    holdable: true,
    run: () => holdSelfAudio({ mute: false, deaf: false })
});
