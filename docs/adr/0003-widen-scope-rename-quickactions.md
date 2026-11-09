# Scope widens past voice; plugin renamed QuickActions

Supersedes 0002. With `palette` in place, non-voice actions were wanted (Vencord's plugin settings, favorite servers), which 0002 named as the trigger to widen. The plugin is renamed `QuickActions` and `migratePluginSettings` moves the saved `VcActions` settings (bindings, auto pop-out, enabled flag) to the new name on first load. The repo, its folder and the userplugin symlink keep `vc-actions`/`vcActions`: a repo rename touches the Nix package and links for no gain. DataStore keys already saved under `VcActions_` keep their names so their data survives.

## Considered Options

- Widen and keep the name: no migration, but the name would lie.
- A second plugin for non-voice actions: it couldn't share the binding engine and palette without depending on this one.
