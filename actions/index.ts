/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 hefker and Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import type { Action } from "../registry";
import camera from "./camera";
import deafen from "./deafen";
import fav from "./fav";
import favpick from "./favpick";
import favtoggle from "./favtoggle";
import focustile from "./focustile";
import gotocall from "./gotocall";
import help from "./help";
import localmute from "./localmute";
import mute from "./mute";
import palette from "./palette";
import plugins from "./plugins";
import pluginsettings from "./pluginsettings";
import popout from "./popout";
import preset from "./preset";
import repeat from "./repeat";
import retarget from "./retarget";
import soundboard from "./soundboard";
import stopstream from "./stopstream";
import stream from "./stream";
import streamtoggle from "./streamtoggle";
import unmute from "./unmute";
import unwatch from "./unwatch";
import userpick from "./userpick";
import vcjoin from "./vcjoin";
import vcleave from "./vcleave";
import volume from "./volume";
import watch from "./watch";
import status from "./status";
import customstatus from "./customstatus";
import unread from "./unread";
import markread from "./markread";
import notifmute from "./notifmute";
import notifs from "./notifs";
import inbox from "./inbox";

/** Every action. Adding one: write actions/<id>.ts (or .tsx), import it here, list it below. */
export const actions: Action[] = [
    stream,
    stopstream,
    retarget,
    streamtoggle,
    preset,
    popout,
    watch,
    unwatch,
    focustile,
    mute,
    unmute,
    deafen,
    volume,
    localmute,
    help,
    camera,
    soundboard,
    vcjoin,
    vcleave,
    gotocall,
    fav,
    favtoggle,
    plugins,
    pluginsettings,
    palette,
    status,
    customstatus,
    favpick,
    userpick,
    repeat,
    unread,
    markread,
    notifmute,
    notifs,
    inbox,
];
