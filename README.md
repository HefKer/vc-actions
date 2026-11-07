# VcActions

Vencord userplugin for Vesktop: slash commands and in-app hotkeys for voice and streaming.
Each action is one file in `actions/`; the same action runs from a slash command, a hotkey, or both.

## Actions

| id | Slash command | What |
|---|---|---|
| `stream` | `/stream <preset>` | Start streaming with a VcPresets preset (choices list the saved presets) |
| `stopstream` | `/stopstream` | Stop your stream |
| `popout` | `/popout [user]` | No user: pop out the call view, like its own Pop Out button (every tile in one window). With a user: pop out just their stream tile, watching it first if needed |

`stream` and `stopstream` call the sibling plugin VcPresets (`../vc-presets`) at run time through
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

Both go through Discord's own action creators, found with `findByCode` (if one moves, the plugin dispatches its
Flux action itself). Discord's PopoutWindowManager answers by `window.open`ing `/popout` with a `DISCORD_*`
frame name, which Vesktop allows as a Discord pop-out and niri floats.

- No user: `openChannelCallPopout(channel)` → `CHANNEL_CALL_POPOUT_WINDOW_OPEN`, what the Pop Out button at the
  bottom right of the call view runs. Window `DISCORD_CHANNEL_CALL_POPOUT`, the whole call grid.
- User: `openCallTilePopout(channelId, streamKey)` → `CALL_TILE_POPOUT_WINDOW_OPEN`, a tile's own pop-out.
  Window `DISCORD_CALL_TILE_POPOUT_<channel>_<streamKey>`. Watching a stream that isn't watched yet uses
  Discord's `watchStream` (the `STREAM_WATCH` creator). Auto pop-out uses this path too.

## Install

The installed build is the combined tree `../vencord` (both plugins symlinked into `src/userplugins/`):
`pnpm build` there, then Vesktop Settings → Vesktop → Vencord Location → `~/dev/vesktop-mods/vencord/dist`,
restart Vesktop, enable **VcActions** (and VcPresets).

## Building

esbuild follows the `src/userplugins/vcActions` symlink to this repo and reads `tsconfig.json` here, which
extends `/home/hefker/dev/vesktop-mods/vencord/tsconfig.json` to get the `@api`/`@webpack` aliases. The path is
absolute because eslint reads the tsconfig through the symlink, where a relative `../vencord` doesn't resolve,
and a symlink to the host inside this repo makes stylelint's `src/**` glob loop. Building in another Vencord
tree compiles but bundles a second copy of Vencord's modules from `vencord/`: don't install that dist.

## Limits

- Pop-out needs you in a voice channel; a user's stream must be in yours, Discord won't watch it from outside.
- The `/stream` preset choices rely on Discord re-reading a built-in command's `choices`; if they show
  stale or none, type the name: it's still matched.
- Auto pop-out reacts to every `STREAM_WATCH` of a friend's stream, including Discord re-watching after a
  reconnect; it skips streams already popped out.
- Hotkeys don't fire inside pop-out windows, only in the main window.
