# vc-actions — Vencord userplugin `VcActions`

Hotkeys and slash commands for Vesktop, built as a **registry**: one file per action under `actions/`.
README.md is the source of truth for the actions, adding one, pop-out internals, install and limits; keep it in sync.

## Context
- Vesktop 1.6.8 on NixOS, **niri** (Wayland). Unpacked Vesktop source: `../.vesktop-1.6.8-src/dist/js/{main,renderer,preload}.js`.
- Sibling plugin **VcPresets** (`../vc-presets`): look it up at call time via `Vencord.Plugins.plugins.VcPresets`,
  never import it. Its API is in its own README.
- Global hotkeys are out of scope (niri binds handle them); in-app hotkeys get no defaults.

## Rules
- Build host: the combined tree `../vencord` (both plugins symlinked into `src/userplugins/`). Verify with
  `pnpm build` and `pnpm test` there. Fix alias trouble from this repo (see `tsconfig.json`), never by editing Vencord.
  `../vc-presets` is its own repo: leave it and build failures in its files alone.
- Public repo (GitHub HefKer/vc-actions): small commits to `main`; push only when the user asks.

## Agent skills

### Issue tracker

GitHub Issues on HefKer/vc-actions via `gh`. See `docs/agents/issue-tracker.md`.

### Triage labels

Default five: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: root `GLOSSARY.md` + `docs/adr/`. See `docs/agents/domain.md`.
