/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 hefker and Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Logger } from "@utils/Logger";
import { FluxDispatcher, UserStore } from "@webpack/common";

/** The plugin's one logger. */
export const logger = new Logger("VcActions");

/** Your own user id (undefined before login). */
export const myId = (): string | undefined => UserStore.getCurrentUser()?.id;

/**
 * Run one of Discord's action creators (`name`, for the log). If it moved (its lazy find throws), dispatch the
 * Flux action it would have dispatched instead: that's still Discord's own code path.
 */
export function callOrDispatch(name: string, call: () => void, action: { type: string; [key: string]: unknown; }) {
    try {
        call();
    } catch (e) {
        logger.warn(`${name} not found, dispatching ${action.type} directly`, e);
        FluxDispatcher.dispatch(action);
    }
}
