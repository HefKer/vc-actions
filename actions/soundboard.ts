/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 hefker and Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Logger } from "@utils/Logger";
import type { Channel, SoundboardSound, User } from "@vencord/discord-types";
import { findByCodeLazy } from "@webpack";
import { ChannelStore, GuildStore, SelectedChannelStore, SoundboardStore, UserStore } from "@webpack/common";

import { ResolveError, resolveName } from "../lib/resolve";
import { soundCandidates, soundChoices } from "../lib/sounds";
import { defineAction } from "../registry";

const logger = new Logger("VcActions");

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
async function ensureSounds() {
    if (loaded() || SoundboardStore.isFetchingAnySounds()) return;
    try {
        await fetchSounds();
    } catch (e) {
        logger.warn("fetching soundboard sounds failed", e);
    }
}

function candidates() {
    const vc = SelectedChannelStore.getVoiceChannelId();
    const guildId = vc ? ChannelStore.getChannel(vc)?.guild_id ?? null : null;
    const sounds = [...SoundboardStore.getSounds().values()].flat();
    return soundCandidates(sounds, guildId, id => GuildStore.getGuild(id)?.name);
}

function choices(): string[] {
    void ensureSounds();
    return soundChoices(candidates());
}

export default defineAction({
    id: "soundboard",
    command: "soundboard",
    description: "Play a soundboard sound in your voice channel",
    args: [{ name: "sound", description: "Sound name", type: "string", required: true, choices }],
    async run({ args, reply }) {
        const vc = SelectedChannelStore.getVoiceChannelId();
        const channel = vc ? ChannelStore.getChannel(vc) : null;
        if (!channel) return reply("You're not in a voice channel.", "error");

        await ensureSounds();
        const r = resolveName(args.sound, candidates(), "sound");
        if (!r.ok) throw new ResolveError(r.error);
        const sound = r.value;
        if (!canUse(UserStore.getCurrentUser(), sound, channel)) {
            return reply(`You can't play "${sound.name}" here (another server's sound needs Nitro, or the channel doesn't allow the soundboard).`, "error");
        }
        playSound(sound, channel.id);
        reply(`Played "${sound.name}".`, "success");
    }
});
