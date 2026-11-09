/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 hefker and Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { PopoutWindowStore } from "@webpack/common";

import { createWindowTracker, WindowHandlers } from "./windowTracker";

export type { WindowHandlers };

// The game overlay window isn't a place to bind keys (Vencord's theme injection skips it too).
const SKIP = new Set(["DISCORD_OutOfProcessOverlay"]);

/**
 * Put `handlers` on the main window and every Discord pop-out, now and as pop-outs open, reload and close.
 * Same discovery as Vencord's theme injection (src/api/Themes.ts): enumerate PopoutWindowStore, and catch
 * the pop-out's `discordPopoutEvent` "loaded" message, when its real document is in place. Returns the
 * function that detaches everything (call it from the plugin's stop).
 */
export function attachToWindows(handlers: WindowHandlers): () => void {
    const tracker = createWindowTracker(handlers);

    function* windows(): Generator<[string, Window | undefined]> {
        yield ["main", window];
        for (const key of PopoutWindowStore?.getWindowKeys() ?? []) {
            if (SKIP.has(key)) continue;
            const win = PopoutWindowStore.getWindow(key);
            yield [key, win && !win.closed ? win : undefined];
        }
    }
    const sync = () => tracker.sync(windows());

    function onMessage(e: MessageEvent) {
        if (e.data?.discordPopoutEvent?.type === "loaded") sync();
    }

    sync();
    window.addEventListener("message", onMessage);
    // Opens and closes both change the store; a closed pop-out drops out of the next sync.
    PopoutWindowStore?.addChangeListener(sync);

    return () => {
        window.removeEventListener("message", onMessage);
        PopoutWindowStore?.removeChangeListener(sync);
        tracker.clear();
    };
}
