# VcActions

Vencord userplugin for Vesktop: slash commands and in-app hotkeys for voice and streaming.
Each action is one file in `actions/`; the same action runs from a slash command, a hotkey, or both.

## Actions

| id | Slash command | What |
|---|---|---|
| `stream` | `/stream <preset>` | Start streaming with a VcPresets preset (choices list the saved presets) |
| `stopstream` | `/stopstream` | Stop your stream |
| `retarget` | `/retarget <preset>` | Switch the running stream to another preset |
| `popout` | `/popout [user]` | Pop out a stream you're watching: the focused one, or that user's (it starts watching if needed) |

`stream`, `stopstream` and `retarget` call the sibling plugin VcPresets (`../vc-presets`) at run time through
`Vencord.Plugins.plugins.VcPresets`; if it's missing or disabled the action says so instead.
Preset names match exactly, then case-insensitively, then by unique prefix.

Setting **Auto pop-out**: when you start watching a friend's stream, it's popped out.

## Hotkeys

Plugin settings → **Hotkeys**, one binding per line, `#` starts a comment:

```
ctrl+alt+p = popout
ctrl+alt+1 = stream Gaming
ctrl+alt+0 = stopstream
```

Words after the action id fill its args in order; the last arg takes the rest of the line, so preset names can
have spaces. `popout` takes a user id. Modifiers: `ctrl`, `alt`, `shift`, `meta`. Letters and digits match by
physical key, so `ctrl+shift+1` works. Hotkeys only fire while the Vesktop main window is focused; global
ones belong in niri binds. None are bound by default.

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

`reply` posts a bot message for slash commands and a toast for hotkeys. Throw an `Error` to report a failure.
Arg `type: "user"` gives a user picker; `choices: () => string[]` offers values while typing.

## How pop-out works

Discord's call tiles have a "Pop Out" button that runs the action creator dispatching
`CALL_TILE_POPOUT_WINDOW_OPEN` (found with `findByCode`; if it moves, the plugin dispatches that Flux action
itself). Discord's PopoutWindowManager then `window.open`s `/popout` with the frame name
`DISCORD_CALL_TILE_POPOUT_<channel>_<streamKey>`, which Vesktop allows as a Discord pop-out and niri floats.
Watching a stream that isn't watched yet uses Discord's own `watchStream` (the `STREAM_WATCH` creator).

## Install

The installed build is the combined tree `../vencord` (both plugins symlinked into `src/userplugins/`):
`pnpm build` there, then Vesktop Settings → Vesktop → Vencord Location → `~/dev/vesktop-mods/vencord/dist`,
restart Vesktop, enable **VcActions** (and VcPresets).

## Building

esbuild follows the `src/userplugins/vcActions` symlink to this repo and reads `tsconfig.json` here, which
extends `../vencord/tsconfig.json` to get the `@api`/`@webpack` aliases. So a build in another host such as
`../.vencord-vc-actions` compiles (good for `pnpm build` / `pnpm test` checks) but bundles a second copy of
Vencord's modules from `../vencord`: don't install that dist.

## Limits

- Pop-out needs you in the stream's voice channel; Discord won't watch a stream from outside it.
- The slash-command preset choices rely on Discord re-reading a built-in command's `choices`; if they show
  stale or none, type the name: it's still matched.
- Auto pop-out reacts to every `STREAM_WATCH` of a friend's stream, including Discord re-watching after a
  reconnect; it skips streams already popped out.
- Hotkeys don't fire inside pop-out windows, only in the main window.
