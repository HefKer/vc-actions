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
| `help` | | Show a cheatsheet of your current bindings in the window you pressed it in (pop-outs too), sequences grouped under their leader, hold bindings marked `hold`. Any key closes it; Esc is swallowed |
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

`stream`, `stopstream`, `retarget`, `streamtoggle` and `preset` call the sibling plugin VcPresets (`../vc-presets`) at run time through
`Vencord.Plugins.plugins.VcPresets`; if it's missing or disabled the action says so instead.
VcPresets doesn't say which preset is live, so `preset next` counts from the preset QuickActions last started or
retargeted to (the first preset if none yet); a stream started from VcPresets' own UI isn't seen.

Setting **Auto pop-out**: when you start watching a friend's stream, it's popped out.

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
ctrl+space f n = fav next
ctrl+space f w = fav work
ctrl+space f t = favtoggle
ctrl+space f p = favpick
ctrl+space d = userpick
ctrl+space , p = plugins
ctrl+space , v = pluginsettings VcPresets
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

Problems are logged and shown in the main window's overlay when the plugin starts and after you change the
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

`favpick` and `userpick` open the palette's picker over a list of their own, in the window you pressed the key in:
same fuzzy matching (over the name, and a user's username), Up/Down, Enter, Esc, and frecency (counted per
picker by server or user id, `QuickActions_uses_favpick`/`_userpick`). Both are in the palette too.

- `favpick`: your favorite servers you're still in, in the order added. Enter goes there like `fav`. No favorites
  yet: it says so instead of opening.
- `userpick`: the other person of each one-to-one DM, in Discord's DM list order (latest message first), then
  friends you have no DM with, by name; group DMs and yourself are left out. Shown by friend nickname, display
  name or username, with the username beside it when that differs. Enter opens your DM with them (Discord's
  `openPrivateChannel` creates it for a friend you never messaged). Navigation happens in the main window, as with
  `fav`.

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
Arg `type: "user"` gives a user picker, and in bindings an id or name that reaches `run` as an id; `choices: () => string[]` offers values while typing.
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

Unit tests (pure modules in `lib/`: binding engine, name resolver, cheatsheet, palette entries and ranking, frecency, user picker candidates,
cycling, favorites, sound candidates, voice channels, volume conversion, window tracker; Node 24, no deps): `node --test 'lib/*.test.ts'` (Node 24 won't take a directory, so `node --test lib/` fails).
Vencord's `pnpm test` is only tsc and lint, but it checks the test files too. Tests import `./x.ts` (Node needs the
real file name) under `// @ts-expect-error` for TS5097; tsc still type-checks the import.

## Limits

- `focustile` only changes the call view's focus; it doesn't open the call view.
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
