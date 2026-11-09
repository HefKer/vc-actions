/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 hefker and Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { openPrivateChannel } from "@utils/discord";
import { ChannelStore, NavigationRouter, PrivateChannelSortStore, RelationshipStore, UserStore } from "@webpack/common";

import { logger, myId } from "../lib/discord";
import { openPicker } from "../lib/picker";
import { type PickUser, userPickEntries } from "../lib/userPick";
import { userNames } from "../lib/users";
import { defineAction } from "../registry";

const pickUser = (id: string): PickUser => ({ id, names: userNames(id, null), username: UserStore.getUser(id)?.username });

/** The other person of each one-to-one DM, in Discord's DM list order (latest message first); group DMs left out. */
function dmUsers(): PickUser[] {
    return PrivateChannelSortStore.getPrivateChannelIds().flatMap(id => {
        const c = ChannelStore.getChannel(id);
        const other = c?.isDM() ? c.getRecipientId() : undefined;
        return other ? [pickUser(other)] : [];
    });
}

/** Go to your DM with `userId`: the open one directly, else Discord opens (or creates) it. */
function openDm(userId: string) {
    const channelId = ChannelStore.getDMFromUserId(userId);
    if (channelId) NavigationRouter.transitionTo(`/channels/@me/${channelId}`);
    else openPrivateChannel(userId);
}

export default defineAction({
    id: "userpick",
    description: "Fuzzy-pick someone from your DMs and friends and open your DM with them, in the window you're in",
    async run({ win = window, reply }) {
        const entries = userPickEntries(dmUsers(), RelationshipStore.getFriendIDs().map(pickUser), myId());
        if (!entries.length) return reply("No DMs or friends to pick from.", "info");
        await openPicker({
            win,
            entries,
            usage: "userpick",
            placeholder: "Open a DM with…",
            enter: "opens the DM",
            pick: m => {
                try {
                    openDm(m.text);
                    reply(`Opened your DM with ${m.label}.`, "success");
                } catch (e) {
                    logger.error("opening a DM failed", e);
                    reply(`Couldn't open the DM: ${e instanceof Error ? e.message : String(e)}`, "error");
                }
            }
        });
    }
});
