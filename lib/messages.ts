/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 hefker and Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { copyToClipboard } from "@utils/clipboard";
import type { Channel, Message } from "@vencord/discord-types";
import { findByCodeLazy, findByPropsLazy, findLazy } from "@webpack";
import {
    ChannelActionCreators, ChannelStore, closeModal, ComponentDispatch, EmojiStore, FluxDispatcher, GuildStore, MessageActions,
    MessageStore, MessageTypeSets, PermissionsBits, PermissionStore, ReadStateStore, SelectedChannelStore, SelectedGuildStore
} from "@webpack/common";

import { logger, myId } from "./discord";
import { parseEmojiArg } from "./emojiArg";
import { UserError } from "./errors";
import { type Candidate, resolveName } from "./resolve";

/** MessageFlags and ChannelType values; @vencord/discord-types/enums doesn't resolve from this symlinked plugin (see lib/streams.ts). */
const HAS_THREAD = 1 << 5;
const EPHEMERAL = 1 << 6;
const IS_VOICE_MESSAGE = 1 << 13;
const GUILD_TEXT = 0;
const GUILD_VOICE = 2;
const GUILD_ANNOUNCEMENT = 5;
const GUILD_STAGE_VOICE = 13;
/** MessageType.AUTO_MODERATION_ACTION: only moderators may delete it. */
const AUTO_MODERATION_ACTION = 24;

/**
 * Discord's message-level actions, as its own UI does them: reply (the hover toolbar's Reply), the reaction
 * picker (the context menu's Add Reaction), forwarding (the toolbar's Forward and its modal), copy text and link,
 * pin, edit, delete and thread (the context menu's items, with their permission checks), jumps (the reply preview's
 * and the new-messages bar's). The ids and calls were read from Discord's web bundle, November 2026.
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

/** The channel `doc` shows messages of, else the selected one (an empty chat); throws if neither. */
export function windowChannel(doc: Document): string {
    const id = channelInWindow(doc) ?? SelectedChannelStore.getChannelId();
    if (!id) throw new UserError("Open a channel first.");
    return id;
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
    const msg = loadedMessages(channelId).findLast(m => !m.hasFlag(EPHEMERAL));
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
    if (!MessageTypeSets.REPLYABLE.has(message.type) || message.hasFlag(EPHEMERAL))
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
 * Open Discord's reaction emoji picker on `message`, like the context menu's Add Reaction or Discord's own `e` on a
 * keyboard-focused message. The picker is anchored in the message's hover toolbar, which Discord only renders while
 * the message is hovered, focused or in a context menu, so the message's element (in `doc`) gets focus first and the
 * picker opens a frame later, once the toolbar is drawn.
 */
export function openReactionPicker(message: Message, doc: Document) {
    const channel = channelOf(message);
    if (channel.guild_id && !PermissionStore.can(PermissionsBits.ADD_REACTIONS, channel))
        throw new UserError("You can't add reactions here.");
    const el = messageElement(doc, channel.id, message.id);
    if (!el) throw new UserError("That message isn't shown.");
    // Discord's list navigation focuses the message's inner [data-list-item-id] (tabindex -1), not the <li>.
    const target = el.querySelector<HTMLElement>("[data-list-item-id]") ?? el;
    target.focus({ preventScroll: true });
    const win = doc.defaultView ?? window;
    win.requestAnimationFrame(() => win.requestAnimationFrame(() =>
        ComponentDispatch.dispatchKeyed("TOGGLE_REACTION_POPOUT", message.id, { emojiPicker: true })));
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
    return MessageTypeSets.FORWARDABLE.has(message.type) && !message.hasFlag(EPHEMERAL);
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

/** What search matches a message by: its text, its author's names, embed titles and texts, attachment names. */
export function messageText(message: Message): string {
    const content = message.getContentMessage?.() ?? message;
    return [
        content.content,
        message.author?.username,
        (message.author as { globalName?: string | null; } | undefined)?.globalName,
        ...content.embeds.flatMap(e => [e.rawTitle, e.rawDescription]),
        ...content.attachments.map(a => a.filename)
    ].filter(Boolean).join("\n");
}

/** Copy to the clipboard from `win`: a pop-out's own clipboard API, since the main document isn't focused then. */
function copy(text: string, win: Window): Promise<void> {
    return win === window ? copyToClipboard(text) : win.navigator.clipboard.writeText(text);
}

/** Copy the text of `messages` (oldest first, a blank line between), like the context menu's Copy Text. */
export async function copyText(messages: Message[], win: Window): Promise<number> {
    const texts = messages.map(m => (m.getContentMessage?.() ?? m).content).filter(t => t?.trim());
    if (!texts.length) throw new UserError(messages.length > 1 ? "Those messages have no text." : "That message has no text.");
    await copy(texts.join("\n\n"), win);
    return texts.length;
}

/** A message's link, as the context menu's Copy Message Link builds it. */
export function messageLink(message: Message): string {
    const guildId = ChannelStore.getChannel(message.channel_id)?.guild_id;
    return `${location.protocol}//${location.host}/channels/${guildId ?? "@me"}/${message.channel_id}/${message.id}`;
}

/** Copy the links of `messages`, one per line. */
export async function copyLinks(messages: Message[], win: Window) {
    await copy(messages.map(messageLink).join("\n"), win);
}

const isSent = (message: Message) => message.state === "SENT";
const isUserMessage = (message: Message) => MessageTypeSets.USER_MESSAGE.has(message.type);
const can = (permission: bigint, channel: Channel) => PermissionStore.can(permission, channel);

/** Discord's pin and delete confirm dialogs (the context menu's; shift-click skips them there, never here). */
const Confirms: {
    confirmPin(channel: Channel, message: Message): void;
    confirmUnpin(channel: Channel, message: Message): void;
    confirmDelete(channel: Channel, message: Message): void;
} = findByPropsLazy("confirmPin", "confirmDelete");

/** Discord's modal stack, to let keys through to a dialog while one is open. */
const Modals: { hasAnyModalOpen(): boolean; } = findByPropsLazy("hasAnyModalOpen", "openModalLazy");

let modalsMissing = false;

/** A Discord dialog is open (our pin or delete confirm, say); false if that can't be told. */
export function isModalOpen(): boolean {
    if (modalsMissing) return false;
    try {
        return Modals.hasAnyModalOpen();
    } catch (e) {
        // Not found: don't search the whole module cache again on every key.
        modalsMissing = true;
        logger.warn("Discord's modal stack not found; keys won't pass to its dialogs in message mode", e);
        return false;
    }
}

/** Pin `message`, or unpin it if it's pinned, through Discord's confirm dialog. Discord's permission check: PIN_MESSAGES in servers. */
export function togglePin(message: Message) {
    const channel = channelOf(message);
    const allowed = !channel.isSystemDM() && isSent(message) && isUserMessage(message)
        && (channel.isPrivate() || (can(PermissionsBits.PIN_MESSAGES, channel) && can(PermissionsBits.READ_MESSAGE_HISTORY, channel)))
        && channel.type !== GUILD_VOICE && channel.type !== GUILD_STAGE_VOICE;
    if (!allowed) throw new UserError("You can't pin that message here.");
    if (message.pinned) Confirms.confirmUnpin(channel, message);
    else Confirms.confirmPin(channel, message);
}

/** Delete `message` through Discord's confirm dialog: your own, or anyone's with Manage Messages, as its menu allows. */
export function deleteMessage(message: Message) {
    const channel = channelOf(message);
    const manage = can(PermissionsBits.MANAGE_MESSAGES, channel);
    const mine = message.canDeleteOwnMessage(myId() ?? "");
    const allowed = message.state !== "SENDING" && (manage || mine) && !MessageTypeSets.UNDELETABLE.has(message.type)
        && (message.type !== AUTO_MODERATION_ACTION || manage);
    if (!allowed) throw new UserError("You can't delete that message.");
    Confirms.confirmDelete(channel, message);
}

/** Start Discord's inline edit of `message` (yours), like its toolbar's Edit; the editor takes focus. */
export function editMessage(message: Message) {
    const channel = channelOf(message);
    const editable = message.author.id === myId() && isSent(message) && isUserMessage(message)
        && !message.hasFlag(IS_VOICE_MESSAGE) && !message.isPoll() && message.referralTrialOfferId == null;
    if (!editable) throw new UserError(message.author.id === myId() ? "That message can't be edited." : "You can only edit your own messages.");
    MessageActions.startEditMessageRecord(channel.id, message);
}

/** Edit your newest editable message in `channelId`, like Up in an empty composer. */
export function editLastMessage(channelId: string) {
    const message = MessageStore.getLastEditableMessage(channelId);
    if (!message) throw new UserError("No message of yours to edit here.");
    MessageActions.startEditMessageRecord(channelId, message);
}

/** Discord's open-thread (its toolbar's Thread on a message that has one): side panel or full view, per your setting. */
const openThreadImpl: (thread: Channel) => void = findByCodeLazy("hideThreadCallUI:!0", "SIDEBAR_CLOSE");
/** Discord's create-thread flow: the side panel's new-thread form for a message. */
const createThreadImpl: (parent: Channel, message: Message, location: string) => void =
    findByCodeLazy("cannot open thread creation sidebar in forums");

/** Open `message`'s thread, or start Discord's create-thread form for it if it has none (with Create Public Threads). */
export function openThread(message: Message) {
    const channel = channelOf(message);
    if (message.hasFlag(HAS_THREAD)) {
        // A thread started from a message has the message's id.
        const thread = ChannelStore.getChannel(message.id);
        if (!thread) throw new UserError("That message's thread isn't loaded.");
        openThreadImpl(thread);
        return;
    }
    const allowed = (channel.type === GUILD_TEXT || channel.type === GUILD_ANNOUNCEMENT) && isUserMessage(message)
        && can(PermissionsBits.CREATE_PUBLIC_THREADS, channel) && can(PermissionsBits.READ_MESSAGE_HISTORY, channel);
    if (!allowed) throw new UserError("You can't start a thread on that message.");
    createThreadImpl(channel, message, "Message");
}

/** The message `message` replies to; throws if it isn't a reply. */
export function repliedTo(message: Message): { channelId: string; messageId: string; } {
    const ref = message.messageReference;
    // Type 1 is a forward, which references a message elsewhere rather than replying to it.
    if (!ref?.message_id || ref.type === 1) throw new UserError("That message isn't a reply.");
    return { channelId: ref.channel_id ?? message.channel_id, messageId: ref.message_id };
}

/** Jump to a message like clicking a reply's preview: Discord loads around it, scrolls there and flashes it. */
export function jumpToMessage(channelId: string, messageId: string, returnMessageId?: string) {
    MessageActions.jumpToMessage({ channelId, messageId, flash: true, returnMessageId });
}

/** The nearest element around `el` that can scroll vertically: the chat's scroller for a message (a short chat's too). */
export function scrollerOf(el: Element): HTMLElement | undefined {
    const win = el.ownerDocument.defaultView ?? window;
    for (let at = el.parentElement; at; at = at.parentElement) {
        const { overflowY } = win.getComputedStyle(at);
        if (overflowY === "auto" || overflowY === "scroll") return at;
    }
}

/** The chat scroller showing `channelId` in `doc`, found from one of its messages. */
function chatScroller(doc: Document, channelId: string): HTMLElement | undefined {
    const el = doc.querySelector(`[id^="${elementId(channelId, "")}"]`);
    return el ? scrollerOf(el) : undefined;
}

/** How many messages a jump to the present loads; Discord's own works out 10–30 from the window height. */
const PRESENT_LIMIT = 30;

/**
 * Scroll the chat of `channelId` (shown in `doc`) to its start, its newest message, or its first unread one like the
 * new-messages bar. What's loaded is scrolled to directly; otherwise Discord's jump loads it (a jump to the channel's
 * own id lands on its first message, as the bar does when you never read it).
 */
export function scrollChannel(where: "top" | "bottom" | "unread", doc: Document, channelId: string) {
    const messages = MessageStore.getMessages(channelId);
    const scroller = chatScroller(doc, channelId);
    switch (where) {
        case "top":
            if (scroller && messages && !messages.hasMoreBefore) scroller.scrollTop = 0;
            else MessageActions.jumpToMessage({ channelId, messageId: channelId, offset: 1 });
            return;
        case "bottom":
            // As the jump-to-present bar, which shows only while newer messages aren't loaded.
            if (messages?.hasMoreAfter) MessageActions.jumpToPresent(channelId, PRESENT_LIMIT);
            else if (scroller) scroller.scrollTop = scroller.scrollHeight;
            return;
        case "unread": {
            if (!ReadStateStore.hasUnread(channelId)) throw new UserError("No unread messages here.");
            const ack = ReadStateStore.ackMessageId(channelId);
            MessageActions.jumpToMessage({ channelId, messageId: ack ?? channelId, offset: 1 });
            return;
        }
    }
}
