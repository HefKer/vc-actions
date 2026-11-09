/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 hefker and Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/**
 * Discord's default in-app shortcuts, so a binding that overrides one gets a warning.
 * Hard-coded: Discord keeps no runtime list we can read. Dumped live (2026-11) from its keybind maps
 * (`find(m => m?.QUICKSWITCHER_SHOW?.binds && m?.TOGGLE_MUTE)` and `find(m => m?.TOGGLE_CHANNEL_PINS?.binds)`),
 * "mod" = ctrl on Linux. Written in binding syntax; keys are named as the engine matches them (`arrowdown`, and the
 * shifted character for shift+punctuation, with the unshifted spelling too). Left out: typing itself (any
 * character, enter to send) and the focused-message keys (p, r, backspace...).
 */
export const discordDefaults: [combo: string, what: string][] = [
    ["ctrl+alt+arrowdown", "next server"], ["ctrl+alt+arrowup", "previous server"],
    ["ctrl+shift+]", "next server"], ["ctrl+shift+}", "next server"],
    ["ctrl+shift+[", "previous server"], ["ctrl+shift+{", "previous server"],
    ["ctrl+tab", "next server"], ["ctrl+shift+tab", "previous server"],
    ["alt+arrowdown", "next channel"], ["alt+arrowup", "previous channel"],
    ["alt+arrowleft", "navigate back"], ["alt+arrowright", "navigate forward"],
    ["alt+shift+arrowdown", "next unread channel"], ["alt+shift+arrowup", "previous unread channel"],
    ["ctrl+shift+alt+arrowdown", "next unread mention"], ["ctrl+shift+alt+arrowup", "previous unread mention"],
    ["ctrl+alt+arrowright", "last server"], ["ctrl+alt+arrowleft", "return to voice channel"],
    ...[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => [`ctrl+${n}`, `jump to server ${n}`] as [string, string]),
    ["esc", "mark channel read"], ["shift+pagedown", "mark channel read"], ["shift+esc", "mark server read"],
    ["ctrl+shift+m", "toggle mute"], ["ctrl+shift+d", "toggle deafen"],
    ["ctrl+shift+a", "collapse category"],
    ["pageup", "scroll chat"], ["pagedown", "scroll chat"], ["shift+pageup", "jump to oldest unread"],
    ["ctrl+e", "emoji picker"],
    ["ctrl+/", "keyboard shortcuts"], ["ctrl+shift+/", "keyboard shortcuts"], ["ctrl+shift+?", "keyboard shortcuts"],
    ["ctrl+enter", "answer call"],
    ["ctrl+'", "start call"], ["ctrl+shift+'", "start call"], ["ctrl+shift+\"", "start call"],
    ["ctrl+k", "quick switcher"], ["ctrl+t", "quick switcher"],
    ["ctrl+p", "pinned messages"], ["ctrl+i", "inbox"], ["ctrl+u", "member list"],
    ["ctrl+shift+h", "help"], ["f1", "help"],
    ["ctrl+shift+b", "soundboard search"], ["ctrl+shift+t", "new group DM"],
    ["ctrl+shift+alt+n", "new thread"], ["ctrl+w", "close channel tab"], ["ctrl+shift+p", "pin channel tab"],
    ["ctrl+shift+n", "create server"], ["ctrl+shift+u", "upload file"],
    ["ctrl+f", "search"], ["ctrl+shift+f", "search"],
    ["ctrl+shift+alt+v", "jump to current call"],
    ["ctrl+alt+i", "devtools"], ["shift+f10", "context menu"], ["ctrl+shift+l", "copy channel link"],
    ["ctrl+alt+shift+w", "vibe with Wumpus"]
];
