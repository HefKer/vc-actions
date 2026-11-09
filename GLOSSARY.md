# QuickActions

Keyboard, palette and slash-command control of Discord inside Vesktop: voice and streaming first, plus other things you do often.

## Language

**Action**:
One named thing the plugin can do, runnable from a slash command, a binding, or both.
_Avoid_: command (that's the slash-command form only), function

**Choice**:
A value offered for an action's argument while typing, such as a preset name.
_Avoid_: option, suggestion

**Combo**:
One keypress plus its modifiers, such as `ctrl+alt+p`.
_Avoid_: chord, shortcut, keybind

**Sequence**:
Combos pressed one after another, such as `ctrl+space v j`.
_Avoid_: chord, multi-key

**Leader**:
The first combo of a sequence.
_Avoid_: prefix key

**Binding**:
One line of the hotkeys setting: a trigger (combo or sequence) and the step or steps it runs.
_Avoid_: hotkey line, mapping, shortcut

**Step**:
One action with its arguments, as written in a binding.

**Macro**:
A binding with more than one step, run in order.
_Avoid_: combo (that's a keypress)

**Hold binding**:
A binding that runs its action on press and undoes it on release.
_Avoid_: push-to-X binding, keyup binding

**Holdable**:
Said of an action that knows how to undo itself on release, which is the only kind a hold binding accepts.
