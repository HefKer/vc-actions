# QuickActions

Vencord userplugin for Vesktop: slash commands, in-app hotkeys and a palette for voice, streaming and other everyday Discord actions.
It was called VcActions; its saved settings move to the new name on first start (ADR 0003). The repo keeps the old name.
Each action is one file in `actions/`; the same action runs from a slash command, a hotkey, or both.

## Actions

| id | Slash command | What |
|---|---|---|
| `stream` | `/stream <preset>` | Start streaming with a VcPresets preset (choices list the saved presets) |
| `stopstream` | `/stopstream` | Stop your stream |
| `retarget` | `/retarget <preset>` | Mid-stream, move the niri Dynamic Cast Target to that preset's target (VcPresets errors if you're not streaming or the preset has no video) |
| `streamtoggle` | | `streamtoggle <preset>`: start streaming with that preset if you're not live; if you are, stop, whatever preset the stream uses |
| `preset` | | `preset next`: mid-stream, retarget to the preset after the current one in VcPresets' list order, wrapping around. Errors if you're not streaming |
| `popout` | `/popout [user]` | No user: pop out the call view, like its own Pop Out button (every tile in one window). With a user: pop out just their stream tile, watching it first if needed |
| `watch` | | `watch next` / `watch prev`: watch the next / previous stream in your call in tile order (your own skipped), wrapping around; the first stream when you watch none |
| `unwatch` | | Stop watching the stream you're watching (the focused one if you watch several) |
| `focustile` | `/focustile <user>` | Make a user's tile the main view of the call, without popping it out: their stream tile if they stream, else their user (camera) tile |
| `mute` | | Mute your mic. Holdable: released, your mute goes back to what it was (push-to-mute) |
| `unmute` | | Unmute your mic, and undeafen like Discord's own unmute. Holdable: released, both go back (push-to-talk) |
| `deafen` | | Deafen yourself. Holdable: released, deafen goes back to what it was |
| `volume` | `/volume <user> <level>` | `volume alice 80` sets someone's local volume, `+20`/`-20` adjusts it, clamped to 0–200% (100 = normal; VolumeBooster's multiplier raises the ceiling). Holdable: released, the previous volume comes back (hold-to-boost) |
| `localmute` | | `localmute <user>` toggles someone's local mute (only you stop hearing them) |
| `help` | | Show a cheatsheet of your current bindings in the window you pressed it in (pop-outs too), sequences grouped under their leader and, within it, under their [group](#hotkeys) label, hold bindings marked `hold`, then your [event hooks](#event-hooks) under `on event`. Any key closes it; Esc is swallowed |
| `camera` | | Turn your camera on or off (in a voice channel) |
| `soundboard` | `/soundboard <sound>` | Play a soundboard sound in your voice channel. Choices: your voice server's sounds, Discord's defaults, then other servers' as `name (Server)` (first 25). The sound list is fetched on first use, like opening the soundboard picker |
| `vcjoin` | `/vcjoin <channel>` | Join a voice channel by name (see [Names](#names)) or id. `vcjoin last` rejoins the voice channel you were in before the current one (or the one you left), even after a restart; a channel literally named "last" needs its id |
| `vcleave` | | Leave voice; just says so if you're not in voice |
| `gotocall` | | Open the call view of your voice channel |
| `fav` | `/fav <server>` | Go to a favorite server: `fav work` by name (see [Names](#names)) or id, `fav next` / `fav prev` cycle them in the order added from the server you're viewing (the first if it isn't one). Choices, so palette entries too: next, prev, each favorite, a short Ctrl+K of only the servers you use |
| `favtoggle` | `/favtoggle` | Add the server you're viewing to your favorites, or remove it if it's one. Saved in Vencord's DataStore; a server you leave drops out of the list until you rejoin |
| `plugins` | | Open Vencord's Plugins page in Discord's settings |
| `pluginsettings` | | `pluginsettings VcPresets` opens that plugin's settings, like its cog in the Plugins page. Choices (and palette entries) are the enabled plugins; any plugin shown in the Plugins page matches by name |
| `palette` | | Fuzzy command palette in the window you pressed it in (pop-outs too); see [Palette](#palette) |
| `status` | `/status <status> [target]` | `status online` / `idle` / `dnd` / `invisible` sets your status. `status toggle dnd` sets dnd, or if you're already dnd, goes back to the status you had before the toggle (online if unknown, e.g. after a restart). Holdable (`hold <combo> = status dnd`): released, the previous status comes back. Setting **DND while streaming** (off by default) sets dnd when you go live and restores the previous status when the stream ends, unless you changed it meanwhile (already dnd or invisible: left alone) |
| `customstatus` | `/customstatus <text>` | Set your custom status text, no expiry, keeping its emoji. `customstatus clear` clears it; `customstatus \clear` sets the literal text "clear" |
| `favpick` | | Fuzzy-pick one of your favorite servers (see `favtoggle`) and go there; the palette's picker, in the window you pressed it in. See [Pickers](#pickers) |
| `userpick` | | Fuzzy-pick someone from your DMs and friends and open your DM with them; see [Pickers](#pickers) |
| `repeat` | | Run again, in the window you pressed it in, the steps the last binding or palette pick ran (a whole macro, args as typed, so names are matched again). Not kept: hold bindings, [event hooks](#event-hooks), slash commands (no window to run in), and any run with `repeat` in it, so `repeat` never repeats itself. Opening the palette counts as a run until you pick something; left out of the palette, where it would only reopen it. Forgotten when the plugin stops |
| `unread` | `/unread <which>` | `unread next` / `unread prev`: go to the next / previous unread channel, `unread mention`: the next channel with mentions; see [Unread and notifications](#unread-and-notifications). "No unread channels." when there's none |
| `markread` | `/markread <what>` | `markread channel` / `server` / `all`: mark the channel you're in, the server you're viewing, or every server and DM as read, like Discord's own Mark As Read |
| `notifmute` | `/notifmute <what>` | `notifmute channel` / `server`: mute the channel you're in (DMs too) or the server you're viewing until you unmute, like its Mute menu item; unmute if it's muted (a timed mute too) |
| `notifs` | `/notifs <state>` | `notifs on` / `off` / `toggle`: Discord's desktop notifications, the "Enable Desktop Notifications" switch in Settings → Notifications |
| `inbox` | | Open Discord's notification inbox on its Mentions tab, like Ctrl+I (closes it if it's open) |
| `messagemode` | | Pick messages in the channel with the keyboard, in the window you pressed it in, to reply, react or forward (several at once); see [Message mode](#message-mode). Pressed again, it ends |
| `reply` | | `reply last`: reply to the newest message in the channel you're viewing, like Discord's Reply (it pings the author, unless that's you); the composer gets focus |
| `react` | | `react <emoji>` reacts to the newest message in the channel you're viewing: `👍`, `thumbsup` or `:thumbsup:`, `<:name:id>`, or a custom emoji's name (see [Names](#names)). Says so if you already reacted with it |
| `upload` | | Open the file chooser to upload files to the channel shown in the window you pressed it in (pop-outs too), like the composer's **+ → Upload a File**. Picked files land in the composer as attachments, unsent. `upload clipboard` instead attaches the copied image(s), as pasting does; says so if the clipboard holds no image (copied files from a file manager don't count: Chromium only exposes images) |
| `search` | `/search <query>` | `search <text>` searches the messages of the server or DM you're in, like typing it in Discord's search bar and pressing Enter; Discord's filters work (`search from:alice has:image cat`). With no text, focuses the search bar |
| `channelpick` | | Fuzzy-pick a channel of the server you're viewing (your DMs when you're in DMs) and go there; `channelpick all`: every server's channels and your DMs. Unread and mention marks like the sidebar's; see [Pickers](#pickers) |
| `serverpick` | | Fuzzy-pick any of your servers, in server-list order, and go there like clicking its icon; see [Pickers](#pickers) |
| `vcpick` | | Fuzzy-pick a voice channel, showing who's in it, and join it; Shift+Enter just opens its view. See [Pickers](#pickers) |
| `soundpick` | | Fuzzy-pick a soundboard sound and play it in your voice channel, like `soundboard`; see [Pickers](#pickers) |
| `presetpick` | | Fuzzy-pick a VcPresets preset: not live, stream with it like `stream`; live, retarget to it like `retarget`. See [Pickers](#pickers) |

`stream`, `stopstream`, `retarget`, `streamtoggle` and `preset` call the sibling plugin VcPresets (`../vc-presets`) at run time through
`Vencord.Plugins.plugins.VcPresets`; if it's missing or disabled the action says so instead.
VcPresets doesn't say which preset is live, so `preset next` counts from the preset QuickActions last started or
retargeted to (the first preset if none yet); a stream started from VcPresets' own UI isn't seen.

Setting **Auto pop-out**: when you start watching a friend's stream, it's popped out.

## Unread and notifications

`unread` walks the way Discord's own Alt+Shift+Down/Up (and Ctrl+Shift+Alt+Down/Up for mentions) does: the channels
after (prev: before) the one you're in, in sidebar order (`ChannelListStore`'s shown channels, joined threads
included), then the other places in server-list order (DMs first, then every server as the server list shows it,
folders flattened), wrapping around, and last the rest of the current server from the other end. Pure walk in `lib/unread.ts`. What counts as unread follows Discord's predicate: a muted
server is skipped (unless you're in it); a text channel counts if it has a mention, or if it's unread, not muted (nor
its category, which Discord's own shortcut doesn't check) and set to show unread for all messages; DMs and voice
channels count only with a mention (an unread DM is one), or your own voice channel with unread chat. `unread mention`
counts any channel with mentions, muted servers included. Server events and onboarding questions, which Discord's
shortcut also stops at, are skipped.

`markread` dispatches what Discord's Mark As Read does: `channel` a forced `CHANNEL_ACK` (forum channels ack up to
now), `server` a `BULK_ACK` of every channel, joined thread, server events and onboarding questions (what the server
menu's Mark As Read builds), `all` the same for every server plus every DM and group DM. ReadStateStore keeps the
unread ones and syncs them to Discord in batches, so `all` on many servers takes a few seconds to reach other devices.

`notifmute` and `notifs` call Discord's own setting creators: `updateChannelOverrideSettings` /
`updateGuildNotificationSettings` (so a mute syncs to your account like the menu's) and `setDesktopType`. `notifs off`
sets desktop notifications to Never and `on` to All; "only mentions" counts as on for `toggle`. That setting is
per device (not synced) and covers the desktop pop-ups only; sounds and badges have their own settings. `inbox`
toggles the inbox like Ctrl+I, so it needs the inbox button on screen (the title bar's), and switches it to its
Mentions tab.

## Hotkeys

Plugin settings → **Hotkeys**, one binding per line, `#` starts a comment:

```
ctrl+alt+p = popout
ctrl+alt+1 = stream Gaming
ctrl+alt+0 = stopstream
ctrl+alt+2 = retarget Browser
ctrl+alt+s = streamtoggle Gaming
ctrl+alt+n = preset next
ctrl+alt+g = stream Gaming; popout
ctrl+alt+j = watch next
ctrl+alt+k = watch prev
ctrl+alt+w = unwatch
ctrl+alt+f = focustile alice
ctrl+alt+h = help
ctrl+space p a = popout alice
ctrl+space s = stream Gaming; popout
ctrl+alt+space = palette
ctrl+space f = +⭐ favorites
ctrl+space f n = fav next
ctrl+space f w = fav work
ctrl+space f t = favtoggle
ctrl+space f p = favpick
ctrl+space d = userpick
ctrl+space , = +config
ctrl+space , p = plugins
ctrl+space , v = pluginsettings VcPresets
ctrl+space m = messagemode
ctrl+space r = reply last
ctrl+space e = react 👍
```

Grammar: `[hold] <trigger> = <step>[; <step>...]`, a step being `<action id> <args...>`. Words after the action id fill
its args in order; the last arg takes the rest of the step, so preset names can have spaces. `;` always
separates steps, so args can't contain it. A binding with several steps (a macro) runs them in order, each
waiting for the previous one to finish; the first failing step stops the rest and its error names the step.
A bad step (unknown action, empty step) makes the whole line an error. A trigger is a combo or a sequence:
space-separated combos pressed one after another (`ctrl+space v j`). A sequence's first combo (the leader) must
have `ctrl`, `alt` or `meta`, so typing never starts one; the keys after it may be bare and work even in a text
box. After the leader a which-key hint lists the next keys and what they run. It stays up until you press
something: Esc cancels, and a key that doesn't continue the sequence cancels it and is swallowed. `popout` takes a user (see
[Names](#names)). Modifiers:
`ctrl` (or `control`, `mod`), `alt` (or `option`), `shift`, `meta` (or `super`, `win`, `cmd`). Key aliases: `esc`, `space`,
`plus` (or a trailing `+`: `ctrl++`), `del`, `return`; other keys are named as `KeyboardEvent.key` gives them, lowercased
(`f8`, `arrowdown`, `enter`). Letters and digits match by physical key, so `ctrl+shift+1` works. Hotkeys
fire in the main window and in every Discord pop-out (call or stream pop-outs), whichever is focused; global
ones belong in niri binds. None are bound by default. Feedback (success, errors) shows in a small overlay at
the bottom of the window you pressed the key in.

**The editor** (`lib/editor/`): the setting is a code editor over the same plain text as before, so saved bindings
carry over. Triggers, `hold`/`on`, events, action ids, args, `;`, group labels (`= +label`) and comments are coloured
(`lib/highlight.ts`), with line numbers. Once typing settles (0.3 s) the text is checked by the binding engine and
saved, and again when the editor loses focus or closes; problems mark their line number (red error, yellow warning,
hover for the message) and are listed under the editor, where a line number jumps to that line. Autocomplete
(`lib/completion.ts`) offers action ids where a step starts (after `= ` or `; `, or once a letter is typed), then
that action's arg choices (presets, favorites, plugins... the same `choices()` slash commands use), and events after
`on `. Up/Down select, Tab inserts, Enter too once something is typed or selected, Esc closes; a fully typed item
closes the list. Below the editor, **Syntax ▸** sums up this section and **Actions ▸** lists every action with its
args (`<required>`, `[optional]`); clicking one inserts its id at the cursor.

Problems are also logged and shown in the main window's overlay when the plugin starts and after you change the
setting (once typing settles, and only when the problems differ from the ones last shown). A bad line, a trigger already bound on an
earlier line, or an ambiguous one (a combo bound alone and as a leader, or a sequence that starts another) is an error: that line is skipped (the first binding wins), since
the engine can't tell them apart and the later line could never fire. That includes a combo bound once with `hold` and once without: there's no tap-vs-hold timing.
A sequence with Esc after the leader is an error too: Esc cancels a sequence before anything is matched. A trigger that is one of Discord's own
default shortcuts (`ctrl+shift+m`, `ctrl+k`, `alt+arrowdown`...) is a warning: it's still bound and overrides
Discord's. For a sequence only the leader is checked, once per leader. Discord has no readable list of its shortcuts, so they're hard-coded in `lib/discordDefaults.ts`.

**Hold bindings:** `hold ctrl+alt+m = unmute` runs the action on press and undoes it on release: when the key
(not its modifiers) goes up, when the window loses focus, or when the plugin stops. Key repeat while holding is
ignored. `hold` takes a single combo and a single step, and only a holdable action (`mute`, `unmute`, `deafen`, `volume`);
anything else is reported as an error and the line is skipped. Discord's own mute/deafen binds only toggle.

**Groups:** `<prefix> = +<label>` names the keys a set of sequences share, which-key style: `ctrl+space , = +config`
labels every sequence starting `ctrl+space ,`. The prefix is a leader or any longer start of a sequence; the `+`
makes the right side a label, not a step. The hint then shows `,  +config (2)` (the label and how many bindings are
under it, in a group colour) instead of `+ more keys`, and its header shows the label once you're in the group
(`ctrl+space ,  +config`). A label starting with an emoji gets it as an icon before the name (`+⭐ favorites`).
`help` heads the sequences under a group with its label. A group line isn't a binding: it doesn't clash with the
sequences under it, and may come before or after them. A label for a prefix no sequence goes on past (nothing
under it, or it's bound itself), a prefix labelled twice (the first label wins), an empty label or `hold` with a
label is an error and the line is skipped. Comments above lines (`# [c]onfig`) are just comments.

## Event hooks

A line `on <event> = <step>[; <step>...]` in the Hotkeys setting runs its steps when the event fires, with the same
step grammar as a binding (a macro stops at the first failing step):

```
on vcjoin = gotocall
on streamstart = popout
on muted = volume alice 150
```

| event | fires when |
|---|---|
| `vcjoin` | you join a voice channel, or move to another (no `vcleave` then) |
| `vcleave` | you leave voice |
| `streamstart` | your own stream (Go Live) starts, however you started it |
| `streamstop` | your own stream ends |
| `watchstart` | you start watching someone's stream, once per stream |
| `watchstop` | you stop watching one |
| `muted` / `unmuted` | your mic's mute flag changes (deafening alone doesn't count) |

Events are changes of your state as Discord's stores hold it (SelectedChannelStore, ApplicationStreamingStore,
MediaEngineStore), not raw Flux actions (ADR 0004), so nothing fires for the state you're already in when the plugin starts or
the setting changes, and a no-op (muting while muted) fires nothing. A stream re-watched after a reconnect counts again.
Steps run in the main window (`source` "auto"); their feedback and errors, named `on <event>:`, show in its overlay.
One line per event: a second `on` for the same event is an error and the first wins, put all its steps on one line.
An unknown event, `hold on`, or a bad step is an error too. Hooks only listen while at least one is set.

Hooks can set each other off (`on vcjoin = vcleave` is fine, `on muted = unmute` with `on unmuted = mute` loops).
Events come back from Discord's stores after a step rather than inside it, so an event that fires while a hook runs,
or within a second after one finished, counts as caused by it; past 4 hooks deep the next one is skipped with an error.

## Palette

Bind it (`ctrl+alt+space = palette`) and every action is a few letters away without its own key. Entries: your
bindings first, with their trigger shown (hold bindings left out: with no key to let go of they'd stay on), then every action once per choice of its first arg (presets, and for
user args without choices the other people in your voice channel; an entry shows the name but runs the id). An
action whose first arg has no choices (or none right now, e.g. VcPresets missing), or that has more args after
the chosen one, takes free text: type it after the words that match the entry (`vol ali +20` runs
`volume <alice's id> +20`), or press Tab to complete the selected entry first. Matching is fuzzy over labels and
triggers: the letters in order, case and spaces ignored, word starts and runs ranked higher, ties in list order.
Up/Down select, Enter runs (a binding's steps as a macro, feedback in the same window), Esc or leaving the box
closes it and puts focus back. Actions added later appear automatically, with their `choices()`.

Entries you run often and lately rank first (frecency): with an empty box they lead the list; while typing they get
a boost of up to about a word start's worth, enough to reorder close matches but not to beat a clearly better
one (`mute` typed out still beats a much-used `unmute`). Each run adds 1 to an entry's count and counts halve every
week (`lib/frecency.ts`). Counts are per entry (its step text, so `volume alice` counts by alice's id) and saved
in Vencord's DataStore (`QuickActions_uses_palette`), at most 200 entries.

## Pickers

`favpick`, `userpick`, `channelpick`, `serverpick`, `vcpick`, `soundpick` and `presetpick` open the palette's picker
over a list of their own, in the window you pressed the key in: same fuzzy matching (over the name and the dimmed
detail beside it), Up/Down, Enter, Esc, and frecency, counted per picker by id (server, user, channel, sound id, or
preset name) and saved as `QuickActions_uses_<picker>`. All are in the palette too (`channelpick` as an entry taking
free text: type `all` after it). Rows may have an icon before the name (a channel's kind: `#`, 🔊, 🧵...; a sound's
emoji) and a badge after it: a red mention count, or `●` for unread, as the sidebar and server list show them.
Navigation happens in the main window, as with `fav`.

- `favpick`: your favorite servers you're still in, in the order added. Enter goes there like `fav`. No favorites
  yet: it says so instead of opening.
- `userpick`: the other person of each one-to-one DM, in Discord's DM list order (latest message first), then
  friends you have no DM with, by name; group DMs and yourself are left out. Shown by friend nickname, display
  name or username, with the username beside it when that differs. Enter opens your DM with them (Discord's
  `openPrivateChannel` creates it for a friend you never messaged).
- `channelpick`: the channels of the server you're viewing that you can see, in sidebar order: uncategorized first,
  then each category, text kinds (text, announcement, forum) before voice ones, each followed by the threads you've
  joined (newest first); categories themselves left out. Unlike the sidebar it lists channels in collapsed
  categories and muted channels it hides. The detail is the category (a thread's: category › parent). From DMs it
  lists your DMs and group DMs. `channelpick all`: your DMs (detail `DM`), then every server's channels in
  server-list order, the server's name as detail. Enter goes there (`ChannelRouter.transitionToChannel`): a voice
  channel opens its view without joining. The unread mark is `unread`'s predicate (see
  [Unread and notifications](#unread-and-notifications)), the mention count ReadStateStore's.
- `serverpick`: every server in server-list order, folders flattened, a named folder's name as detail. Badges from
  GuildReadStateStore (unread as the server list shows it, mentions). Enter goes there like clicking its icon: the
  channel you last had open there.
- `vcpick`: voice and stage channels you can see, the server you're viewing (else the one you're in voice in) first in
  sidebar order, then the other servers' in server-list order with the server's name as detail. The detail lists who's
  in each (first 3 names, `+N` for the rest; typing a name finds where they are) and the badge counts them; the channel
  you're in has ▶ for its icon. Enter joins like `vcjoin` ("Already in" if you are); Shift+Enter only opens its view,
  like `gotocall`.
- `soundpick`: the sounds `soundboard` matches, in its order (your voice channel's server, Discord's defaults, then
  other servers'), the server (or `default`) as detail and the sound's emoji as icon; a sound you can't play here
  (another server's without Nitro, or the channel forbids it) has a 🔒 badge and is refused if picked. Needs you in
  voice; fetches the sound lists first if nobody has, like opening the soundboard.
- `presetpick`: VcPresets' presets in its list order. Not live, Enter streams with the pick (`stream`); live, it
  retargets to it (`retarget`), the preset QuickActions last went live with or retargeted to marked `live`. Whether
  you're live is checked again on Enter.

## Message mode

Bind it (`ctrl+space m = messagemode`): the newest message in the channel shown in that window (pop-outs with a
chat too) is outlined and scrolled into view, and a hint lists the keys. While it's on, keys without `ctrl`, `alt`
or `meta` are the mode's and never reach the composer; bindings keep working.

| Key | Does |
|---|---|
| `j` / `k` (or Down / Up) | Next newer / older message. A count first moves that many: `3k` |
| `g` / `G` (or Home / End) | Oldest loaded / newest message |
| `r` / `R` | Reply, pinging like Discord's Reply (the author, unless that's you) / reply without a ping. The composer gets focus |
| `e` | Open Discord's reaction picker on the message, as the context menu's Add Reaction does |
| `space` | Select or unselect the message (green bar), up to 10 |
| `f` | Forward the selected messages, or the highlighted one if none is selected |
| `Esc` | Drop a typed count; else clear the selection; else leave |

The mode ends after `r`, `R`, `e` and `f` (the composer, picker or dialog takes the keys from there), on `Esc`,
when you go to another channel, when the window loses focus, and when you press the binding again. The messages it
moves through are the ones Discord has loaded and draws, oldest first; Discord loads older ones as the list
scrolls up, so `g` then `k` reaches further back. A collapsed blocked message isn't drawn, so it's skipped.

**Forwarding several:** `f` with a selection opens Discord's forward dialog, previewing the first selected message
(an overlay note says all of them go). Pick destinations (Discord allows 5) and an optional message, then Send:
QuickActions closes the dialog and forwards each selected message, oldest first, to every destination, 1.1 s apart
(Discord allows about 5 messages per 5 s in a channel), then sends the optional message. Progress and the result
show in the overlay; failures are logged. At most 10 messages per forward; messages Discord can't forward (system
messages, ephemeral ones) are skipped. A single message goes through Discord's dialog untouched, as from its
Forward button.

How: the list is MessageStore's messages for the channel that have a `chat-messages-<channel>-<message>` element
in that window; the highlight is a `<style>` with id selectors, so it survives Discord re-rendering a message.
Reply dispatches `CREATE_PENDING_REPLY` and focuses the composer, as the hover toolbar's Reply does; the picker
opens through `ComponentDispatch`'s `TOGGLE_REACTION_POPOUT` for that message, as the context menu does; forward calls
Discord's `openForwardModal` (found by code), and for several gives it a `customSendHandler` that sends what its own
send does: an empty message with a `message_reference` of type forward. `react` uses Discord's own add-reaction.

## Names

Presets, users, sounds, voice channels, favorite servers and plugins are matched by name the same way: exactly, then
case-insensitively, then by unique prefix; a prefix shared by several, or no match, is an error that lists the
candidates. A user in a binding is an id (or `<@id>`) or a name: nickname, friend nickname, display name or
username, matched against the people in your voice channel first, then your friends, so an exact friend name
still beats an in-call prefix (`ctrl+alt+a = popout alice`). Names never match yourself. A sound matches your voice channel's server's
sounds first, then Discord's defaults, then other servers' (also as `name (Server)`). A voice channel is matched in the server you're viewing
(or, from DMs, the one you're in voice in) first; channels elsewhere are listed as `General (Server)` and answer to
that name too, so `vcjoin general (friends)` picks another server's General. The previous voice channel is tracked by
QuickActions (Discord doesn't keep it) and saved in Vencord's DataStore.

## Adding an action

1. Write `actions/<id>.ts` (`.tsx` if it draws in the overlay, like `help`; a fuzzy list is `openPicker` in `lib/picker.tsx`):
   ```ts
   import { defineAction } from "../registry";

   export default defineAction({
       id: "hello",                 // used in bindings' steps
       command: "hello",            // slash command name; omit for hotkey-only
       description: "Say hello",
       args: [{ name: "who", description: "Who to greet", type: "string" }],
       run({ args, reply }) {
           reply(`Hello ${args.who ?? "world"}`, "success");
       }
   });
   ```
2. Import it in `actions/index.ts` and add it to the list.

`reply` posts a bot message for slash commands and shows the overlay (in the window the key was pressed in) for hotkeys. Throw a `UserError` (`lib/errors.ts`) for an expected failure: its message is the reply. Any other
throw is replied to and logged.
Arg `type: "user"` gives a user picker, and in bindings an id or name that reaches `run` as an id; `choices: () => string[]` offers values while typing, in the slash command and the Hotkeys editor's autocomplete.
`holdable: true` lets hold bindings use the action: its `run` then returns a release callback that undoes it
(a slash command or a plain binding just drops it). `hideInPalette: true` keeps an action out of the palette.

## How pop-out works

Both go through Discord's own action creators, found with `findByCode` (if one moves, the plugin dispatches its
Flux action itself). Discord's PopoutWindowManager answers by `window.open`ing `/popout` with a `DISCORD_*`
frame name, which Vesktop allows as a Discord pop-out and niri floats.

- No user: `openChannelCallPopout(channel)` → `CHANNEL_CALL_POPOUT_WINDOW_OPEN`, what the Pop Out button at the
  bottom right of the call view runs. Window `DISCORD_CHANNEL_CALL_POPOUT`, the whole call grid.
- User: `openCallTilePopout(channelId, streamKey)` → `CALL_TILE_POPOUT_WINDOW_OPEN`, a tile's own pop-out.
  Window `DISCORD_CALL_TILE_POPOUT_<channel>_<streamKey>`. Watching a stream that isn't watched yet uses
  Discord's `watchStream` (the `STREAM_WATCH` creator). Auto pop-out uses this path too.

`watch`, `unwatch` and `focustile` use the same kind of creators: `watchStream` (focuses the tile, and without
"multiple" Discord stops the other watched streams), `closeStream(streamKey)` → `STREAM_CLOSE`, and
`selectParticipant(channelId, id)` → `CHANNEL_RTC_SELECT_PARTICIPANT` (id = stream key for a stream tile, user id
for a user tile). Tile order is `ChannelRTCStore.getStreamParticipants`, the call grid's own sorted list.

Hotkeys reach pop-outs the way Vencord's theme injection does (`src/api/Themes.ts`): `lib/windows.ts` puts the
key listeners (capture phase) on the main window and every window in `PopoutWindowStore` (except the game
overlay), and re-syncs on each store change and each `discordPopoutEvent` "loaded" message, so new pop-outs
attach, reloaded ones re-attach and closed ones drop off; plugin stop detaches all. Feedback goes through
`lib/overlay.tsx`, our own box rendered into that window's document, since Discord's toasts only show in the
main window (ADR 0001). Each window's overlay has three slots stacked at the bottom (panel for `help` and the pickers,
the which-key hint, feedback), so feedback never replaces an open palette.

## Install

**Nix:** copy this repo into Vencord's `src/userplugins/vcActions` and build Vencord; see
[HefKer/nixos-config's `pkgs/vencord-userplugins`](https://github.com/HefKer/nixos-config/tree/main/pkgs/vencord-userplugins).

**By hand:** clone Vencord next to this repo as `../vencord`, symlink this repo to `../vencord/src/userplugins/vcActions`,
`pnpm build` there, then Vesktop Settings → Vesktop → Vencord Location → that tree's `dist`, restart Vesktop, and
enable **QuickActions** (and [VcPresets](https://github.com/HefKer/vc-presets)).

## Building

esbuild follows the `src/userplugins/vcActions` symlink to this repo and reads `tsconfig.json` here, which
extends `../vencord/tsconfig.json` to get the `@api`/`@webpack` aliases, so the Vencord tree must sit next to
this repo as `../vencord`. A symlink to the host inside this repo would make stylelint's `src/**` glob loop.
Building in a copy of Vencord (as the Nix package does) needs no tsconfig here: delete it.

Unit tests (pure modules in `lib/`: binding engine, event hooks, setting editor's colouring and autocomplete, name resolver, cheatsheet, palette entries and ranking, frecency, user picker candidates, channel/server/voice picker rows and sidebar order,
cycling, favorites, unread walk, sound candidates, voice channels, volume conversion, window tracker, message mode keys, `react`'s emoji arg; Node 24, no deps): `node --test 'lib/*.test.ts'` (Node 24 won't take a directory, so `node --test lib/` fails).
Vencord's `pnpm test` is only tsc and lint, but it checks the test files too. Tests import `./x.ts` (Node needs the
real file name) under `// @ts-expect-error` for TS5097; tsc still type-checks the import.

## Limits

- `focustile` only changes the call view's focus; it doesn't open the call view.
- Message mode works on the channel's main message list; a thread open in the side panel isn't reachable. The
  forward dialog is Discord's modal, so from a pop-out it most likely opens in the main window (ADR 0001).
- Pop-out needs you in a voice channel; a user's stream must be in yours, Discord won't watch it from outside.
- The `/stream` and `/retarget` preset choices rely on Discord re-reading a built-in command's `choices`; if they show
  stale or none, type the name: it's still matched.
- `volume` numbers are the percent Discord's user volume slider shows. Discord stores an amplitude instead
  (slider 200% is ~199.5, 50% is ~14.4; `lib/volume.ts` mirrors its conversion), so `/volume` reads back the slider
  value. Only the voice volume, not a stream's audio. Raising a locally muted user's volume unmutes them, as the
  slider does. On Vesktop without VolumeBooster the slider itself stops at 100%; `volume` still allows 200.
- Auto pop-out reacts to every `STREAM_WATCH` of a friend's stream, including Discord re-watching after a
  reconnect; it skips streams already popped out.
- Camera and soundboard use Discord's own `setVideoEnabled` and soundboard play/fetch/lock-check functions, found by
  code at runtime; a Discord update can move them. A sound you can't use (another server's without Nitro, or the
  channel forbids it) is refused before playing, since Discord would play it only for you.
