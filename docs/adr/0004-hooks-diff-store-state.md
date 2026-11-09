# Hooks fire on changes of store state, not on Flux actions, with a time-based depth guard

A hook's event (`on vcjoin = ...`) is a change in your own state as Discord's stores hold it (SelectedChannelStore, ApplicationStreamingStore, MediaEngineStore). Each store change is read into a snapshot and compared with the last one (`stateEvents` in lib/hooks.ts). Listening to Flux actions such as VOICE_CHANNEL_SELECT or STREAM_START would be the obvious route, but those also fire for no-ops (muting while muted), for other users, and for requests that later fail. Their names and payloads change between Discord builds, and each event would need its own filter. A snapshot diff means an event fires only when your state actually changed. Nothing fires for the state you're already in when the plugin starts or the setting changes, and the pure diff can be tested.

That loses cause and effect: a store change arrives after a hook's step finishes, not inside it, so we can't know which hook caused it. The loop guard (`createHookGuard`) therefore counts by time. An event that fires while a hook runs, or within 1 s after one finishes, counts as one level deeper, and past 4 levels the hook is skipped with an error. `on muted = unmute` plus `on unmuted = mute` then stops instead of looping forever.

## Consequences

- An unrelated event in that 1 s window, such as you muting by hand just after a hook ran, also counts one level deeper. It is only skipped if the chain is already 4 deep.
- Hook steps start after a `setTimeout`, so they never dispatch inside Discord's own dispatch.
- Adding an event means adding a field to the snapshot (`HookState`) and a line to `stateEvents`, not finding a new Flux action.
