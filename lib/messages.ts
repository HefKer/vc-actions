/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 hefker and Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import type { Channel, Message } from "@vencord/discord-types";
import { MessageFlags } from "@vencord/discord-types/enums";
import { findByCodeLazy, findByPropsLazy, findLazy } from "@webpack";
import {
    ChannelActionCreators, ChannelStore, closeModal, ComponentDispatch, EmojiStore, FluxDispatcher, GuildStore, MessageActions,
    MessageStore, MessageTypeSets, PermissionsBits, PermissionStore, SelectedChannelStore, SelectedGuildStore
} from "@webpack/common";

import { logger, myId } from "./discord";
import { parseEmojiArg } from "./emojiArg";
import { UserError } from "./errors";
import { type Candidate, resolveName } from "./resolve";

/**
 * Discord's message-level actions, as its own UI does them: reply (the hover toolbar's Reply), the reaction
 * picker (the context menu's Add Reaction), forwarding (the toolbar's Forward and its modal). The ids and
 * calls were read from Discord's web bundle, November 2026.
 */

/** Message `li` ids in the chat list: `chat-messages-<channel>-<message>`. */
const elementId = (channelId: string, messageId: string) => `chat-messages-${channelId}-${messageId}`;

export function messageElement(doc: Document, channelId: string, messageId: string) {
    return doc.getElementById(elementId(channelId, messageId));
}

/**
 * The channel whose messages `doc` shows: the selected channel if they're there, else the first channel with
 * messages on the page (a pop-out's chat). Undefined when the window shows no messages.
 */
export function channelInWindow(doc: Document): string | undefined {
    const selected = SelectedChannelStore.getChannelId();
    if (selected && doc.querySelector(`[id^="chat-messages-${selected}-"]`)) return selected;
    for (const el of doc.querySelectorAll('[id^="chat-messages-"]')) {
        const id = el.id.match(/^chat-messages-(\d+)-\d+$/)?.[1];
        if (id) return id;
    }
}

/** The channel's loaded messages, oldest first. */
function loadedMessages(channelId: string): Message[] {
    return MessageStore.getMessages(channelId)?._array ?? [];
}

/** The loaded messages that `doc` actually shows, oldest first (a collapsed blocked message isn't drawn, so it's left out). */
export function messagesShown(channelId: string, doc: Document): Message[] {
    return loadedMessages(channelId).filter(m => messageElement(doc, channelId, m.id));
}

export function getMessage(channelId: string, messageId: string): Message | undefined {
    return MessageStore.getMessage(channelId, messageId) ?? undefined;
}

/** The newest message in the channel you're viewing, for one-shot actions. */
export function newestMessage(): Message {
    const channelId = SelectedChannelStore.getChannelId();
    if (!channelId) throw new UserError("Open a channel first.");
    const msg = loadedMessages(channelId).findLast(m => !m.hasFlag(MessageFlags.EPHEMERAL));
    if (!msg) throw new UserError("No messages here.");
    return msg;
}

function channelOf(message: Message): Channel {
    const channel = ChannelStore.getChannel(message.channel_id);
    if (!channel) throw new UserError("That message's channel isn't loaded.");
    return channel;
}

/**
 * Reply to `message` like the hover toolbar's Reply: a pending reply in the composer, which gets focus. Discord pings
 * the author unless it's yourself (`mention: false` never pings); the ping toggle shows outside DMs.
 */
export function replyTo(message: Message, mention: boolean) {
    const channel = channelOf(message);
    if (!MessageTypeSets.REPLYABLE.has(message.type) || message.hasFlag(MessageFlags.EPHEMERAL))
        throw new UserError("Can't reply to that message.");
    if (channel.guild_id && !PermissionStore.can(PermissionsBits.SEND_MESSAGES, channel))
        throw new UserError("You can't send messages here.");
    const isMe = message.author.id === myId();
    FluxDispatcher.dispatch({
        type: "CREATE_PENDING_REPLY",
        channel,
        message,
        shouldMention: mention && !isMe,
        showMentionToggle: !channel.isPrivate() && !isMe
    });
    ComponentDispatch.dispatch("FOCUS_CHANNEL_TEXT_AREA", { channelId: channel.id });
}

/**
 * Open Discord's reaction emoji picker on `message`, like the context menu's Add Reaction. The message must be drawn:
 * its own component listens for this.
 */
export function openReactionPicker(message: Message) {
    const channel = channelOf(message);
    if (channel.guild_id && !PermissionStore.can(PermissionsBits.ADD_REACTIONS, channel))
        throw new UserError("You can't add reactions here.");
    ComponentDispatch.dispatchKeyed("TOGGLE_REACTION_POPOUT", message.id, { emojiPicker: true });
}

/** An emoji as reactions take it. */
interface ReactionEmoji {
    id: string | null;
    name: string;
    animated: boolean;
}

/** Discord's own add-reaction (optimistic update, then the request), what the picker and context menu call. */
const addReactionImpl: (channelId: string, messageId: string, emoji: ReactionEmoji, location?: string) => Promise<void> =
    findByCodeLazy(".userHasReactedWithEmoji(", '"MESSAGE_REACTION_ADD"');

/** Discord's unicode emoji names (`thumbsup` → 👍). */
const EmojiUtils: { convertNameToSurrogate(name: string): string | undefined; } = findByPropsLazy("convertNameToSurrogate");

/** Custom emoji you can use, as names to resolve: the server you're viewing first, then the others. */
function customEmojiCandidates(): Candidate<ReactionEmoji>[] {
    const here = SelectedGuildStore.getGuildId();
    return Object.keys(EmojiStore.getGuilds()).flatMap(guildId => {
        const tier = guildId === here ? 0 : 1;
        const server = GuildStore.getGuild(guildId)?.name ?? guildId;
        return EmojiStore.getUsableGuildEmoji(guildId).map(e => {
            const label = `${e.name} (${server})`;
            return { names: [e.name, label], label, tier, value: { id: e.id, name: e.name, animated: !!e.animated } };
        });
    }).sort((a, b) => a.tier - b.tier);
}

/** `react`'s emoji arg as a reaction: an emoji, `<:name:id>`, a unicode name (`thumbsup`), or a custom emoji's name (see Names). */
export function resolveEmoji(input: string | undefined): ReactionEmoji {
    const arg = parseEmojiArg(input);
    if (!arg) throw new UserError("Name an emoji: 👍, thumbsup, :thumbsup: or a custom emoji's name.");
    if (arg.kind === "custom") return { id: arg.id, name: arg.name, animated: arg.animated };
    if (arg.kind === "unicode") return { id: null, name: arg.text, animated: false };
    const surrogate = EmojiUtils.convertNameToSurrogate(arg.name);
    if (surrogate) return { id: null, name: surrogate, animated: false };
    const r = resolveName(arg.name, customEmojiCandidates(), "emoji");
    if (!r.ok) throw new UserError(r.error);
    return r.value;
}

/** React to `message` with `emoji`; says so instead if you already have (Discord would pop up an alert). */
export async function addReaction(message: Message, emoji: ReactionEmoji): Promise<"added" | "already"> {
    const channel = channelOf(message);
    if (channel.guild_id && !PermissionStore.can(PermissionsBits.ADD_REACTIONS, channel))
        throw new UserError("You can't add reactions here.");
    if ((message as any).userHasReactedWithEmoji?.(emoji, false)) return "already";
    await addReactionImpl(channel.id, message.id, emoji, "Message");
    return "added";
}

/** Where to forward, as the forward modal's destination picker gives it: a channel, or a user (their DM). */
interface Destination {
    type: "channel" | "user";
    id: string;
}

interface ForwardModalOptions {
    message: Message;
    source: string;
    /** Replaces the modal's send: gets the picked destinations and the optional context message. */
    customSendHandler?(destinations: Destination[], opts: { withMessage?: string; }, setSending: (sending: boolean) => void): Promise<void>;
}

/** Discord's `openForwardModal`: the Forward button's modal, lazily loaded. Its key is "forward-modal". */
const openForwardModal: (opts: ForwardModalOptions) => void = findByCodeLazy("ForwardModal", "customSendHandler");
const FORWARD_MODAL_KEY = "forward-modal";

/** Message reference type 1 is a forward. */
const FORWARD = 1;
/** Pause between forwarded messages of one batch; Discord allows about 5 messages per 5 s per channel. */
export const FORWARD_SPACING_MS = 1100;

/** Discord's message parser (`:emoji:` and mentions in the context message), or plain text if it moved. */
const MessageParser: { parse(channel: Channel, text: string): object; } =
    findLazy(m => typeof m?.parse === "function" && Function.prototype.toString.call(m.parse).includes("validNonShortcutEmojis"));

function parseText(channel: Channel, content: string): object {
    try {
        return MessageParser.parse(channel, content);
    } catch (e) {
        logger.warn("message parser not found, sending plain text", e);
        return { content, tts: false, invalidEmojis: [], validNonShortcutEmojis: [] };
    }
}

async function channelIdOf(dest: Destination): Promise<string | undefined> {
    if (dest.type === "channel") return dest.id;
    return ChannelStore.getDMFromUserId(dest.id) ?? await ChannelActionCreators.getOrEnsurePrivateChannel(dest.id);
}

/** Forward one message to one channel, as the forward modal's own send does: an empty message referencing it. */
async function sendForward(message: Message, destId: string) {
    const source = ChannelStore.getChannel(message.channel_id);
    const dest = ChannelStore.getChannel(destId);
    if (!dest) throw new Error(`destination ${destId} not loaded`);
    await MessageActions.sendMessage(destId, parseText(dest, ""), false, {
        messageReference: { guild_id: source?.guild_id ?? undefined, channel_id: message.channel_id, message_id: message.id, type: FORWARD },
        location: "forwarding",
        eagerDispatch: false,
        flags: 0
    });
}

export function canForward(message: Message) {
    return MessageTypeSets.FORWARDABLE.has(message.type) && !message.hasFlag(MessageFlags.EPHEMERAL);
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

/**
 * Forward `messages` (oldest first) through Discord's forward modal. One message: the modal does everything, as from
 * its Forward button. Several: the modal (previewing the first) only picks destinations and the context message;
 * then each message goes to every destination in order, FORWARD_SPACING_MS apart, and the context message last.
 * `report` gets progress and the outcome.
 */
export function forwardMessages(messages: Message[], report: (text: string, kind?: "info" | "success" | "error") => void) {
    const forwardable = messages.filter(canForward);
    if (!forwardable.length) throw new UserError(messages.length > 1 ? "None of those messages can be forwarded." : "That message can't be forwarded.");
    const skipped = messages.length - forwardable.length;
    const [first] = forwardable;
    try {
        if (forwardable.length === 1 && !skipped) {
            openForwardModal({ message: first, source: "message-actions" });
            return;
        }
        openForwardModal({
            message: first,
            source: "message-actions",
            async customSendHandler(destinations, { withMessage }, setSending) {
                setSending(true);
                const ids = (await Promise.all(destinations.map(d => channelIdOf(d).catch(() => undefined)))).filter((id): id is string => !!id);
                closeModal(FORWARD_MODAL_KEY);
                await sendBatch(forwardable, ids, withMessage, report);
            }
        });
    } catch (e) {
        logger.error("forward modal not found", e);
        throw new UserError("Discord's forward dialog wasn't found (Discord update?).");
    }
    report(`Forwarding ${forwardable.length} messages${skipped ? ` (${skipped} can't be forwarded)` : ""}: the dialog previews the first, all go to the destinations you pick.`);
}

async function sendBatch(messages: Message[], destIds: string[], withMessage: string | undefined, report: (text: string, kind?: "info" | "success" | "error") => void) {
    if (!destIds.length) return report("No destination to forward to.", "error");
    let failed = 0;
    for (const [i, message] of messages.entries()) {
        if (i) await sleep(FORWARD_SPACING_MS);
        report(`Forwarding ${i + 1}/${messages.length}…`);
        const results = await Promise.allSettled(destIds.map(id => sendForward(message, id)));
        for (const r of results) if (r.status === "rejected") { failed++; logger.error("forward failed", r.reason); }
    }
    if (withMessage?.trim()) {
        await sleep(FORWARD_SPACING_MS);
        const results = await Promise.allSettled(destIds.map(id => {
            const dest = ChannelStore.getChannel(id);
            return dest ? MessageActions.sendMessage(id, parseText(dest, withMessage), false, { location: "forwarding", flags: 0 }) : Promise.reject(new Error("not loaded"));
        }));
        for (const r of results) if (r.status === "rejected") { failed++; logger.error("forward context message failed", r.reason); }
    }
    const where = destIds.length > 1 ? `${destIds.length} destinations` : "1 destination";
    if (failed) report(`Forwarded ${messages.length} messages to ${where}; ${failed} sends failed (see the console).`, "error");
    else report(`Forwarded ${messages.length} messages to ${where}.`, "success");
}
