# Preview 16 verification

## Included additions

- Favorite widget rotation with ordering, one-or-more validation and preserved legacy defaults.
- Local saved profiles, manual loading and opt-in foreground-app switching. Profile snapshots contain slot choices, widget type/text, rotation and timer duration. They do not contain connections, keymaps, skins or display geometry.
- A 1–180 minute countdown, desktop controls and three timer actions assignable to plugin slots.
- Read-only OBS recording/on-air status and elapsed time, using the existing local OBS connection.
- Gentle four-phase weather animation with an optional static hardware setting; desktop motion honors reduced motion.
- Spotify artwork increased from 44×44 to 54×54 pixels inside the existing widget area.

## Results

- 74 automated tests passed. Catalog dispatch covers 34 entries and 77 actions through simulated adapters; rendering covers all 12 widget modes.
- Regression tests cover timer timing/pause/resume/reset/bounds; favorite ordering and invalid/duplicate choices; profile persistence, isolation, default restoration, focus gating, unique app links, and disabling automatic switching after a display failure.
- Existing Spotify timing, widget/arrow shortcut independence, display acknowledgements, startup, update storage, shutdown and account-flow regression tests pass.
- Isolated Electron checks passed for profile creation/linking/loading, favorites reordering and focus retention, timer controls, profile removal dialog focus, stable weather preview nodes and layouts at 1320 and 560 pixels.
- Existing custom-text Apply and the 69-item gallery checks pass.
- Read-only Windows foreground executable lookup succeeded. No window titles, key contents or app-name history were collected.
- JavaScript syntax checks and the strict UI project audit pass. Design metadata lint has zero errors; its six existing token-reference warnings concern metadata, while runtime CSS owns those tokens.

## Practical limits

The installed app was left running. These changes were tested in source and an isolated desktop harness, not by repeatedly switching the user's live keyboard. Check normal typing, L1+P, L1+/, larger Spotify artwork, weather motion and profiles after updating. Automatic profile changes rebuild the established display cache through its serialized queue; they can take longer than switching a single widget, and require a stable foreground app. They are off by default.

Hardware animation uses slowly changing static frames, rather than Unreal animations or a guaranteed frame rate. USB transfer time affects motion. The animation can be disabled. No firmware or keymap changes are introduced.

Real OBS streaming/recording was not started for testing. OBS status requires a user connection; both-active status prioritizes streaming. Timer completion is visual and causes no external action. Live timers and automatic switching require the companion in the tray; a timer does not survive quitting the app.

This is functional regression verification, not a guarantee that every third-party integration or hardware combination is defect-free.
