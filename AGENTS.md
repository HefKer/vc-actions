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
  `stopStream(): void`. Don't import it; look it up at call time and show a
  clear toast/message if it's missing or disabled.

## Wanted (first actions)
1. `/stream <preset>` (autocomplete from `listPresets`), `/stopstream`. (`/retarget` was dropped: casting moved to
   xdg-desktop-portal-wlr, monitors only.)
2. `/popout [user]`, through Discord's own pop-out code paths found in its webpack (`findByCode`): no user opens the
   call pop-out (the call view's Pop Out button, whole grid); a user pops out that user's stream tile.
3. Optional setting: auto-pop-out when you start watching a friend's stream.
4. In-app hotkeys (the Vesktop window focused) bound to actions, configurable in the plugin settings, no defaults
   that clash with Discord's own. Global hotkeys aren't in scope (niri binds handle global ones).

## Rules
- Build host: the combined tree `../vencord` (both plugins symlinked into `src/userplugins/`). Verify with
  `pnpm build` and `pnpm test` there. Path aliases resolve through `tsconfig.json` extending `.host/tsconfig.json`,
  `.host` being a gitignored absolute symlink to that tree; fix alias trouble from this repo, never by editing Vencord.
  Don't edit `../vc-presets`; a build failure in its files is its agent's.
- Don't touch the running Vesktop, its settings, or `~/.config/vesktop`. Don't push, don't add remotes. The user live-tests.
- Small commits to `main` here. README.md: action list, how to add an action, install, limits.
