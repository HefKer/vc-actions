/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 hefker and Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { UserError } from "../lib/errors";
import { defineAction } from "../registry";

/**
 * The composer's hidden file input, what its "+" → Upload a File clicks. The chat form of the window's channel;
 * in a window with several (a thread beside its channel) the last one, which is the focused-side composer.
 */
function fileInput(doc: Document) {
    const inputs = doc.querySelectorAll<HTMLInputElement>('form input[type="file"]');
    return inputs[inputs.length - 1] as HTMLInputElement | undefined;
}

export default defineAction({
    id: "upload",
    description: "Open the file chooser to upload files to the channel you're in, like the composer's Upload a File",
    run({ win }) {
        const input = fileInput((win ?? window).document);
        if (!input) throw new UserError("No message box here to upload to.");
        // A key press counts as user activation, so Chromium lets this open the file chooser.
        input.click();
    }
});
