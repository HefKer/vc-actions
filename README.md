# VcActions

Vencord userplugin for Vesktop: slash commands and in-app hotkeys for voice and streaming.
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

`stream`, `stopstream`, `retarget`, `streamtoggle` and `preset` call the sibling plugin VcPresets (`../vc-presets`) at run time through
`Vencord.Plugins.plugins.VcPresets`; if it's missing or disabled the action says so instead.
Preset names match exactly, then case-insensitively, then by unique prefix.
VcPresets doesn't say which preset is live, so `preset next` counts from the preset VcActions last started or
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
```

Grammar: `<combo> = <step>[; <step>...]`, a step being `<action id> <args...>`. Words after the action id fill
its args in order; the last arg takes the rest of the step, so preset names can have spaces. `;` always
separates steps, so args can't contain it. A binding with several steps (a macro) runs them in order, each
waiting for the previous one to finish; the first failing step stops the rest and its error names the step.
A bad step (unknown action, empty step) makes the whole line an error. `popout` takes a user id. Modifiers:
`ctrl`, `alt`, `shift`, `meta`. Letters and digits match by physical key, so `ctrl+shift+1` works. Hotkeys
fire in the main window and in every Discord pop-out (call or stream pop-outs), whichever is focused; global
ones belong in niri binds. None are bound by default. Feedback (success, errors) shows in a small overlay at
the bottom of the window you pressed the key in.

## Adding an action

1. Write `actions/<name>.ts`:
   ```ts
   import { defineAction } from "../registry";

   export default defineAction({
       id: "hello",                 // used in hotkey lines
       command: "hello",            // slash command name; omit for hotkey-only
       description: "Say hello",
       args: [{ name: "who", description: "Who to greet", type: "string" }],
       run({ args, reply }) {
           reply(`Hello ${args.who ?? "world"}`, "success");
       }
   });
   ```
2. Import it in `actions/index.ts` and add it to the list.

`reply` posts a bot message for slash commands and shows the overlay (in the window the key was pressed in) for hotkeys. Throw an `Error` to report a failure.
Arg `type: "user"` gives a user picker; `choices: () => string[]` offers values while typing.

## How pop-out works

Both go through Discord's own action creators, found with `findByCode` (if one moves, the plugin dispatches its
Flux action itself). Discord's PopoutWindowManager answers by `window.open`ing `/popout` with a `DISCORD_*`
frame name, which Vesktop allows as a Discord pop-out and niri floats.

- No user: `openChannelCallPopout(channel)` → `CHANNEL_CALL_POPOUT_WINDOW_OPEN`, what the Pop Out button at the
  bottom right of the call view runs. Window `DISCORD_CHANNEL_CALL_POPOUT`, the whole call grid.
- User: `openCallTilePopout(channelId, streamKey)` → `CALL_TILE_POPOUT_WINDOW_OPEN`, a tile's own pop-out.
  Window `DISCORD_CALL_TILE_POPOUT_<channel>_<streamKey>`. Watching a stream that isn't watched yet uses
  Discord's `watchStream` (the `STREAM_WATCH` creator). Auto pop-out uses this path too.

Hotkeys reach pop-outs the way Vencord's theme injection does (`src/api/Themes.ts`): `lib/windows.ts` puts the
key listeners (capture phase) on the main window and every window in `PopoutWindowStore` (except the game
overlay), and re-syncs on each store change and each `discordPopoutEvent` "loaded" message, so new pop-outs
attach, reloaded ones re-attach and closed ones drop off; plugin stop detaches all. Feedback goes through
`lib/overlay.tsx`, our own box rendered into that window's document, since Discord's toasts only show in the
main window (ADR 0001).

## Install

**Nix:** copy this repo into Vencord's `src/userplugins/vcActions` and build Vencord; see
[HefKer/nixos-config's `pkgs/vencord-userplugins`](https://github.com/HefKer/nixos-config/tree/main/pkgs/vencord-userplugins).

**By hand:** clone Vencord next to this repo as `../vencord`, symlink this repo to `../vencord/src/userplugins/vcActions`,
`pnpm build` there, then Vesktop Settings → Vesktop → Vencord Location → that tree's `dist`, restart Vesktop, and
enable **VcActions** (and [VcPresets](https://github.com/HefKer/vc-presets)).

## Building

esbuild follows the `src/userplugins/vcActions` symlink to this repo and reads `tsconfig.json` here, which
extends `../vencord/tsconfig.json` to get the `@api`/`@webpack` aliases, so the Vencord tree must sit next to
this repo as `../vencord`. A symlink to the host inside this repo would make stylelint's `src/**` glob loop.
Building in a copy of Vencord (as the Nix package does) needs no tsconfig here: delete it.

Unit tests (pure modules in `lib/`, Node 24, no deps): `node --test 'lib/*.test.ts'` (Node 24 won't take a directory, so `node --test lib/` fails).
Vencord's `pnpm test` is only tsc and lint, but it checks the test files too. Tests import `./x.ts` (Node needs the
real file name) under `// @ts-expect-error` for TS5097; tsc still type-checks the import.

## Limits

- Pop-out needs you in a voice channel; a user's stream must be in yours, Discord won't watch it from outside.
- The `/stream` and `/retarget` preset choices rely on Discord re-reading a built-in command's `choices`; if they show
  stale or none, type the name: it's still matched.
- Auto pop-out reacts to every `STREAM_WATCH` of a friend's stream, including Discord re-watching after a
  reconnect; it skips streams already popped out.
