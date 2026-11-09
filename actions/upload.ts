/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 hefker and Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { ChannelStore, DraftType, UploadHandler } from "@webpack/common";

import { clipboardFileName, imageType } from "../lib/clipboard";
import { UserError } from "../lib/errors";
import { channelInWindow } from "../lib/messages";
import { defineAction } from "../registry";

/**
 * The composer's hidden file input, what its "+" → Upload a File clicks. The chat form of the window's channel;
 * in a window with several (a thread beside its channel) the last one, which is the focused-side composer.
 */
function fileInput(doc: Document) {
    const inputs = doc.querySelectorAll<HTMLInputElement>('form input[type="file"]');
    return inputs[inputs.length - 1] as HTMLInputElement | undefined;
}

/** The clipboard's images as Files. Vesktop sets no permission handler on Linux, so Electron grants clipboard-read. */
async function clipboardImages(win: Window): Promise<File[]> {
    let items: ClipboardItems;
    try {
        items = await win.navigator.clipboard.read();
    } catch (e) {
        throw new UserError(`Couldn't read the clipboard: ${(e as Error).message}`);
    }
    const files: File[] = [];
    for (const item of items) {
        const type = imageType(item.types);
        if (!type) continue;
        const blob = await item.getType(type);
        files.push(new File([blob], clipboardFileName(type, files.length + 1), { type }));
    }
    return files;
}

export default defineAction({
    id: "upload",
    description: "Open the file chooser to upload files to the channel you're in, like the composer's Upload a File; `upload clipboard` attaches the clipboard's image instead",
    args: [{ name: "from", description: "clipboard: attach the copied image, like pasting it", type: "string", choices: () => ["clipboard"] }],
    async run({ args, win }) {
        const w = win ?? window;
        const doc = w.document;
        const input = fileInput(doc);
        if (!input) throw new UserError("No message box here to upload to.");
        if (args.from === undefined) {
            // A key press counts as user activation, so Chromium lets this open the file chooser.
            input.click();
            return;
        }
        if (args.from !== "clipboard") throw new UserError(`Unknown source "${args.from}"; try upload clipboard.`);
        const channel = ChannelStore.getChannel(channelInWindow(doc) ?? "");
        if (!channel) throw new UserError("No channel here to upload to.");
        const files = await clipboardImages(w);
        if (!files.length) throw new UserError("No image on the clipboard.");
        // What pasting into the composer calls: the files land as attachments, unsent (with the upload-limit checks).
        UploadHandler.promptToUpload(files, channel, DraftType.ChannelMessage);
    }
});
