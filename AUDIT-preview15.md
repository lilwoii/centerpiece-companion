# Preview 15 plugin and widget audit

This audit combines automated adapter tests, image rendering, isolated desktop UI checks and read-only live data checks. It is not a claim that every external application was operated on a physical keyboard.

## Fixes

- Spotify uses one playback clock. Windows timeline samples previously passed through PowerShell arithmetic that rounded elapsed time to whole seconds, then the widget added elapsed time again. Repeated reports could pull the display backward. The new clock ignores repeated samples, eases small corrections and resets for track changes and significant seeks.
- Replaying 45 captured playing samples produces 27 backward steps with the previous calculation and zero with the corrected clock. The committed fixture contains only normalized timing numbers, without track or account information.
- Spotify progress widths use whole pixels to avoid transferring visually identical subpixel changes.
- A delayed weather response for an old location no longer overwrites a newly selected location. Failed requests retry sooner, and location/unit changes clear incompatible readings.
- Missing GPU sensors show “No sensor”; CPU load uses percent when temperature is unavailable. CPU load stays within 0–100%.

## Verification

| Area | Coverage and result |
| --- | --- |
| Automated suite | 68 tests passed, including existing authentication, startup, update storage, shutdown, widget selection and shortcut independence regressions. |
| Plugin catalog | All 33 entries and 73 declared actions validate and dispatch through mocked adapters. Expected shortcuts and OBS methods are checked. No streams, recordings, chat messages or app launches were triggered by these tests. |
| Widgets | All 10 modes render: Off, Follow plugin, Spotify, Clock, Weather, CPU, GPU, Microphone, Twitch and Custom text. Tests include missing data, zero values and escaped text. |
| Playback | Repeated/coarse reports, pause/resume, forward/backward seeks, track changes, small timing corrections, invalid data and end-of-track bounds pass. Captured Windows playing reports pass the regression replay. |
| Live Windows data | Spotify status was readable. GPU temperature, microphone state and CPU load were available. CPU temperature was unavailable from the current sources. |
| Weather service | Read-only city search and current-weather retrieval succeeded. A simulated old-location response is discarded. |
| Desktop UI | Custom text selection, preview and Apply passed in an isolated Electron harness. All 69 gallery entries, search, pagination, focus, live thumbnails and narrow layout checks passed. |
| Source checks | JavaScript syntax checks passed. |

## Limits and follow-up checks

- Real OBS connections, Twitch account/chat sessions and every third-party app action were not exercised end to end. Many catalog entries are launchers or configurable shortcuts, not native integrations with those services.
- No live keyboard firmware, keymap or display test was performed during this audit. The installed app was left running. After updating, check normal typing, L1+P navigation, L1+/ widget switching, Caps Lock, custom text, and Spotify play/pause/seek/next-track behavior.
- Cached display frames can briefly contain an older widget snapshot when changing keyboard modes, until the next live refresh. This release does not redesign that cache or promise a fixed hardware frame rate.
- CPU temperature needs a supported sensor source; absent values are explicitly shown as unavailable. Small widget space limits the amount of visible text.
- Reboot/startup and the final user-visible update restart require a check on the installed release. Automated tests cover their underlying contracts, not a real reboot.

This is a functional regression audit, not an exhaustive security assessment or a guarantee against all defects.
