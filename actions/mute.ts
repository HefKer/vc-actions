/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 hefker and Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { holdSelfAudio } from "../lib/selfAudio";
import { defineAction } from "../registry";

export default defineAction({
    id: "mute",
    description: "Mute your mic; held, unmute again on release (push-to-mute)",
    holdable: true,
    run: () => holdSelfAudio({ mute: true })
});
