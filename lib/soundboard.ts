/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 hefker and Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import type { Channel, SoundboardSound, User } from "@vencord/discord-types";
import { findByCodeLazy } from "@webpack";
import { ChannelStore, GuildStore, SelectedChannelStore, SoundboardStore, UserStore } from "@webpack/common";

import { logger } from "./discord";
import { UserError } from "./errors";
import { soundCandidates } from "./sounds";

// Discord glue for `soundboard` and `soundpick`; the pure ordering is in sounds.ts.

/*
 * Discord's own soundboard functions (found live, see README "Limits"):
 * fetchSounds() is what opening the soundboard picker runs: defaults (GET) plus your servers' sounds (gateway).
 * playSound(sound, channelId) is a picker click: POST SEND_SOUNDBOARD_SOUND, play locally, track usage.
 * canUse(user, sound, channel) is the picker's lock check: Nitro for other servers' sounds, channel permission, available.
 */
const fetchSounds: () => Promise<unknown> = findByCodeLazy("SOUNDBOARD_FETCH_DEFAULT_SOUNDS");
const playSound: (sound: SoundboardSound, channelId: string) => void =
    findByCodeLazy("SEND_SOUNDBOARD_SOUND(", "SOUNDBOARD_TRACK_USAGE");
const canUse: (user: User, sound: SoundboardSound, channel: Channel) => boolean =
    findByCodeLazy(".canUseSoundboardEverywhere(e)||t.guildId===n?.guild_id");

const loaded = () => !SoundboardStore.shouldFetchDefaultSounds() && SoundboardStore.hasFetchedAllSounds();

/** Fetch the sound lists if nobody has (Discord does it on first opening the picker). */
export async function ensureSounds() {
    if (loaded() || SoundboardStore.isFetchingAnySounds()) return;
    try {
        await fetchSounds();
    } catch (e) {
        logger.warn("fetching soundboard sounds failed", e);
    }
}

/** Your voice channel, or throws. */
export function soundChannel(): Channel {
    const vc = SelectedChannelStore.getVoiceChannelId();
    const channel = vc ? ChannelStore.getChannel(vc) : null;
    if (!channel) throw new UserError("You're not in a voice channel.");
    return channel;
}

export const guildName = (id: string) => GuildStore.getGuild(id)?.name;

/** Every loaded sound as name candidates, your voice channel's server first (see soundCandidates). */
export function candidates() {
    const vc = SelectedChannelStore.getVoiceChannelId();
    const guildId = vc ? ChannelStore.getChannel(vc)?.guild_id ?? null : null;
    const sounds = [...SoundboardStore.getSounds().values()].flat();
    return soundCandidates(sounds, guildId, guildName);
}

/** Whether you may play `sound` in `channel`, as the soundboard picker's lock says. */
export const usable = (sound: SoundboardSound, channel: Channel) => canUse(UserStore.getCurrentUser(), sound, channel);

/** Play `sound` in `channel`; refuses one you can't use, which Discord would play only for you. */
export function play(sound: SoundboardSound, channel: Channel) {
    if (!usable(sound, channel)) {
        throw new UserError(`You can't play "${sound.name}" here (another server's sound needs Nitro, or the channel doesn't allow the soundboard).`);
    }
    playSound(sound, channel.id);
}
