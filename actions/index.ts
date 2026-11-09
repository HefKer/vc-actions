/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 hefker and Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import type { Action } from "../registry";
import camera from "./camera";
import channelpick from "./channelpick";
import customstatus from "./customstatus";
import deafen from "./deafen";
import fav from "./fav";
import favpick from "./favpick";
import favtoggle from "./favtoggle";
import focustile from "./focustile";
import gotocall from "./gotocall";
import help from "./help";
import inbox from "./inbox";
import localmute from "./localmute";
import markread from "./markread";
import messagemode from "./messagemode";
import mute from "./mute";
import notifmute from "./notifmute";
import notifs from "./notifs";
import palette from "./palette";
import plugins from "./plugins";
import pluginsettings from "./pluginsettings";
import popout from "./popout";
import preset from "./preset";
import presetpick from "./presetpick";
import react from "./react";
import repeat from "./repeat";
import reply from "./reply";
import retarget from "./retarget";
import search from "./search";
import serverpick from "./serverpick";
import soundboard from "./soundboard";
import soundpick from "./soundpick";
import status from "./status";
import stopstream from "./stopstream";
import stream from "./stream";
import streamtoggle from "./streamtoggle";
import unmute from "./unmute";
import unread from "./unread";
import unwatch from "./unwatch";
import upload from "./upload";
import userpick from "./userpick";
import vcjoin from "./vcjoin";
import vcleave from "./vcleave";
import vcpick from "./vcpick";
import volume from "./volume";
import watch from "./watch";

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
    messagemode,
    reply,
    react,
    upload,
    search,
    channelpick,
    serverpick,
    vcpick,
    soundpick,
    presetpick,
];
