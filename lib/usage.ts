/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 hefker and Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import * as DataStore from "@api/DataStore";

import { logger } from "./discord";
import { frecency, recordUse, type Uses } from "./frecency";

/** Which picker the picks were made in; each counts its own, saved under its own DataStore key. */
export type UsageList = "palette" | "favpick" | "userpick" | "channelpick" | "serverpick" | "vcpick" | "soundpick" | "presetpick";

const storeKey = (list: UsageList) => `QuickActions_uses_${list}`;

/** Each list's uses, loaded from DataStore on first open; a pick chains onto it, so picks never overwrite each other. */
const lists = new Map<UsageList, Promise<Uses>>();

function load(list: UsageList): Promise<Uses> {
    let uses = lists.get(list);
    if (!uses) {
        uses = DataStore.get<Uses>(storeKey(list))
            .then(saved => saved && typeof saved === "object" ? saved : {})
            .catch(e => {
                logger.error(`loading ${list} uses failed`, e);
                return {};
            });
        lists.set(list, uses);
    }
    return uses;
}

/** `list`'s frecency of each key (an entry's text), as of now. */
export async function frecencyOf(list: UsageList): Promise<(key: string) => number> {
    const uses = await load(list);
    const now = Date.now();
    return key => frecency(uses[key], now);
}

/** Count a pick of `key` in `list` and save it. */
export function recordPick(list: UsageList, key: string) {
    const uses = load(list).then(u => recordUse(u, key, Date.now()));
    lists.set(list, uses);
    uses.then(u => DataStore.set(storeKey(list), u))
        .catch(e => logger.error(`saving ${list} uses failed`, e));
}
