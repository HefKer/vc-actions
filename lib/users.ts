/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 hefker and Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { ChannelStore, GuildMemberStore, RelationshipStore, SelectedChannelStore, UserStore, VoiceStateStore } from "@webpack/common";

import type { Action } from "../registry";
import { type Candidate, ResolveError, resolveUser } from "./resolve";

function userNames(userId: string, guildId: string | null | undefined): string[] {
    const u = UserStore.getUser(userId);
    const names = [
        guildId ? GuildMemberStore.getNick(guildId, userId) : null,
        RelationshipStore.getNickname(userId),
        u?.globalName,
        u?.username
    ];
    return [...new Set(names.filter((n): n is string => !!n))];
}

/** People in your voice channel (tier 0), then friends not in it (tier 1). */
export function userCandidates(): Candidate<string>[] {
    const vcId = SelectedChannelStore.getVoiceChannelId();
    const guildId = vcId ? ChannelStore.getChannel(vcId)?.guild_id : null;
    const inCall = vcId ? Object.keys(VoiceStateStore.getVoiceStatesForChannel(vcId) ?? {}) : [];
    const seen = new Set(inCall);
    const friends = RelationshipStore.getFriendIDs().filter(id => !seen.has(id));
    return [
        ...inCall.map(id => ({ names: userNames(id, guildId), value: id, tier: 0 })),
        ...friends.map(id => ({ names: userNames(id, null), value: id, tier: 1 }))
    ].filter(c => c.names.length);
}

/** The other people in your voice channel as palette choices: their first name shown, their id written. */
export function participantChoices(): { label: string; value: string; }[] {
    const me = UserStore.getCurrentUser()?.id;
    return userCandidates().filter(c => c.tier === 0 && c.value !== me).map(c => ({ label: c.names[0], value: c.value }));
}

/** A user arg (id, mention or name) as a user id, or throws ResolveError listing the candidates. */
export function userId(input: string | undefined): string {
    const r = resolveUser(input, userCandidates());
    if (!r.ok) throw new ResolveError(r.error);
    return r.value;
}

/** `args` with every given `type: "user"` arg of `action` turned into a user id. */
export function resolveUserArgs(action: Action, args: Record<string, string | undefined>) {
    const out = { ...args };
    for (const arg of action.args ?? []) {
        if (arg.type === "user" && out[arg.name] != null) out[arg.name] = userId(out[arg.name]);
    }
    return out;
}
