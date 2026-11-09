/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 hefker and Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import type { Action } from "../registry";
import deafen from "./deafen";
import help from "./help";
import mute from "./mute";
import popout from "./popout";
import presetNext from "./presetNext";
import retarget from "./retarget";
import stopStream from "./stopStream";
import stream from "./stream";
import streamToggle from "./streamToggle";
import unmute from "./unmute";

/** Every action. Adding one: write actions/<name>.ts, import it here, list it below. */
export const actions: Action[] = [
    stream,
    stopStream,
    retarget,
    streamToggle,
    presetNext,
    popout,
    mute,
    unmute,
    deafen,
    help,
];
