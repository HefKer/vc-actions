# Own overlay for feedback, not Discord's toasts and modals

Bindings must work in pop-out windows, which are the main view in daily use, but Discord's toasts (and most likely its modals) render only in the main window. So binding feedback, the which-key hint, `help` and `palette` use one small overlay of our own, drawn into the document of the window where the key was pressed. Slash commands keep replying with a bot message.

## Considered Options

- Discord's `showToast` and `openModal`: free styling and familiar look, but invisible when you're in a pop-out.
- Feedback only in the main window: rejected, the main window is often hidden behind the pop-out.
