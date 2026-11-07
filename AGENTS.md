# vc-actions — Vencord userplugin `VcActions`

Hotkeys and slash commands for Vesktop. The user will keep adding actions, so build it as a **registry**:
one file per action under `actions/`, each declaring its id, description, optional slash command and
optional default hotkey. Adding an action = adding a file plus one import line.

## Context
- Vesktop 1.6.8 on NixOS, **niri** (Wayland). Monitors: DP-1 left, DP-3 right.
- Unpacked Vesktop source: `../.vesktop-1.6.8-src/dist/js/{main,renderer,preload}.js`. Vesktop allows Discord's own
  pop-out windows (`window.open` with a `DISCORD_*` frame name to `/popout`); niri already floats them on DP-1.
- Sibling plugin **VcPresets** (`../vc-presets`, being written in parallel) exposes at runtime via
  `Vencord.Plugins.plugins.VcPresets`: `listPresets(): {name: string}[]`, `startPreset(name): Promise<void>`,
  `stopStream(): void`, `retarget(name): Promise<void>`. Don't import it; look it up at call time and show a
  clear toast/message if it's missing or disabled.

## Wanted (first actions)
1. `/stream <preset>` (autocomplete from `listPresets`), `/stopstream`, `/retarget <preset>`.
2. `/popout [user]`: pop out a stream you're watching (the focused one, or that user's) through Discord's
   own pop-out code path, found in Discord's webpack (Vencord `findByProps`/`findByCode` or a patch).
3. Optional setting: auto-pop-out when you start watching a friend's stream.
4. In-app hotkeys (the Vesktop window focused) bound to actions, configurable in the plugin settings, no defaults
   that clash with Discord's own. Global hotkeys aren't in scope (niri binds handle global ones).

## Rules
- Build host: `../.vencord-vc-actions` (Vencord worktree; `src/userplugins/vcActions` → this repo). Verify with
  `pnpm build` and `pnpm test` there. If tsconfig path aliases don't resolve through the symlink, fix it from this
  repo (e.g. a tsconfig.json extending the host's), not by editing Vencord.
- Don't touch the running Vesktop, its settings, or `~/.config/vesktop`. Don't push, don't add remotes. The user live-tests.
- Small commits to `main` here. README.md: action list, how to add an action, install, limits.
