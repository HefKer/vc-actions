# Manual tests

What the unit tests can't reach: Discord internals, looked up at run time. Run after a Discord update or a change in
the area. Fully restart Vesktop first (a Nix rebuild means a new store path; Ctrl+R reloads the old one).
"Pop-out" means: repeat in a popped-out window.

## Hotkeys editor (settings)
- [ ] Existing bindings load and still fire after editing
- [ ] Colours right in dark, light and midnight themes; text and caret line up on a long wrapping line
- [ ] Autocomplete after `= ` for action ids; then choices for `stream `, `pluginsettings `, `fav `; events after `on `
- [ ] Esc with the list open closes only the list; Esc again closes the modal
- [ ] Undo after accepting a completion
- [ ] Clicking a problem's line number selects the line; clicking a row in Actions inserts it
- [ ] Closing the modal right after typing still saves

## Groups and hint
- [ ] `ctrl+space f = +⭐ favorites`, `ctrl+space , = +config`: the hint shows labels, counts, group colour; actions in another colour
- [ ] After `ctrl+space ,` the header reads `ctrl+space ,  +config`
- [ ] `help` has sections headed by the labels
- [ ] `ctrl+space q = +x` (nothing under it) and a prefix labelled twice give errors
- [ ] Colours in light and dark

## Bindings infrastructure
- [ ] Each hook fires once: vcjoin (join, move), vcleave, streamstart/stop, watchstart/stop, muted/unmuted
- [ ] `on muted = unmute` + `on unmuted = mute` stops with the depth error
- [ ] `help` lists hooks; a hook's error shows in the main window
- [ ] `repeat` after a macro, after a palette pick, in a pop-out

## Message mode
- [ ] Enter and leave in the main window and a pop-out with chat
- [ ] Scroll up, `G`/`j` to the newest: fully visible at the bottom, hint moved to the top; `k` to the top: hint back at the bottom
- [ ] `3k`, `g`/`G`, `z`; keys don't type into a focused message box
- [ ] `r` vs `R` pinging (and replying to yourself)
- [ ] `e` opens the reaction picker (main window and pop-out)
- [ ] `/` typing, Backspace, Enter, Esc, `n`/`N`, `3n`
- [ ] `;` with more than 14 messages on screen (two-letter labels), and while scrolling with the mouse
- [ ] `c`/`l` with and without a selection, main window and pop-out
- [ ] `p` on pinned and unpinned; `d` on yours and someone else's (with and without Manage Messages); the dialog takes the keys and the mode continues
- [ ] Select 3 of yours, `d`: one confirm, all deleted; a selection with someone else's message refuses with nothing deleted
- [ ] `E` on yours and someone else's; `t` on a message with a thread and without (text channel and DM)
- [ ] `o` on a reply whose message is loaded, one that isn't, one into another channel
- [ ] Forward one message; forward 3+ to 2 destinations, with and without a comment; an 11th selection is refused
- [ ] Mode ends on channel switch and on focusing another app; a binding sequence still works while on
- [ ] `reply last`, `react 👍`, `react thumbsup`, a custom emoji name, reacting twice
- [ ] `edit last`; `scroll top|bottom|unread` with history loaded and not

## Pickers
- [ ] `palette`: unchanged look, Tab completion, free text; frecency reorders after a few runs and survives a restart
- [ ] `favpick`, `userpick`: Enter, Esc, click away; run from the palette; in a pop-out
- [ ] `userpick`: order matches the DM list; a friend never messaged opens a new DM; picking from a pop-out navigates the main window
- [ ] `channelpick` with collapsed categories, threads, voice channels; in DMs; `channelpick all`
- [ ] Unread and mention badges in each picker
- [ ] `serverpick` with folders
- [ ] `vcpick`: Enter joins, Shift+Enter only opens the view, "Already in", the people list
- [ ] `soundpick`: a locked sound; not in voice
- [ ] `presetpick` live and not live

## Unread and notifications
- [ ] `unread next`/`prev` order across servers, DMs, threads, collapsed categories; muted channels and servers skipped
- [ ] `unread mention` from a DM
- [ ] `markread channel|server|all`; reads reach another device
- [ ] `notifmute` on a channel, a server, a DM; Discord's menu shows the same state after
- [ ] `notifs toggle` against the settings switch
- [ ] `inbox` opens on Mentions; pressing again closes it

## Status
- [ ] Each status; `status toggle dnd` twice; `hold … = status dnd`
- [ ] `/customstatus hi`, `clear`, `\clear`; the emoji is kept
- [ ] DND while streaming: go live and stop; change status mid-stream and it isn't overwritten
- [ ] UserSettingsAPI is enabled as a dependency

## Upload and search
- [ ] `upload` opens the file chooser (main window and pop-out)
- [ ] `upload clipboard` with a screenshot copied (main window and pop-out); with text copied gives the "no image" error
- [ ] `search from:<you> test` in a server and a DM; `/search cat`; `search` alone focuses the bar; from the friends list gives the error
