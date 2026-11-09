# Scope stays voice and streaming; name stays VcActions

Superseded by 0003.

The engine (bindings, sequences, palette) could serve any Discord action, and `goto`, `react`, `markread` were proposed. We keep the plugin to voice and streaming for now, because Vencord stores settings under the plugin name: widening later means a rename, and a rename drops saved bindings unless the setting is migrated. Revisit once `palette` exists: if non-voice actions keep being wanted, rename and migrate the `hotkeys` setting in one go.

## Considered Options

- Widen now and rename now: cheapest rename, but grows scope before the engine is proven.
- Widen and keep the name: no migration, but the name would lie.
