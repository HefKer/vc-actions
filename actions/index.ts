/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 hefker and Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import type { Action } from "../registry";
import camera from "./camera";
import deafen from "./deafen";
import focustile from "./focustile";
import goToCall from "./goToCall";
import help from "./help";
import localMute from "./localMute";
import mute from "./mute";
import palette from "./palette";
import popout from "./popout";
import presetNext from "./presetNext";
import retarget from "./retarget";
import soundboard from "./soundboard";
import stopStream from "./stopStream";
import stream from "./stream";
import streamToggle from "./streamToggle";
import unmute from "./unmute";
import unwatch from "./unwatch";
import vcJoin from "./vcJoin";
import vcLeave from "./vcLeave";
import volume from "./volume";
import watch from "./watch";

/** Every action. Adding one: write actions/<name>.ts, import it here, list it below. */
export const actions: Action[] = [
    stream,
    stopStream,
    retarget,
    streamToggle,
    presetNext,
    popout,
    watch,
    unwatch,
    focustile,
    mute,
    unmute,
    deafen,
    volume,
    localMute,
    help,
    camera,
    soundboard,
    vcJoin,
    vcLeave,
    goToCall,
    palette,
];
