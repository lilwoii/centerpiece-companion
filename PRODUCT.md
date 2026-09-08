# Product evidence

The owner requested a free-shareable personal Windows Centerpiece companion: Spotify first; then a logo library, four keyboard strip positions, left navigation, media controls, key remapping/swapping and Caps Lock indication above the existing skin. Brand colors and bottom-placed L1+P labeling are explicit owner choices.

The app offers 33 catalog entries, clearly separated by actual capability: local Spotify/Windows media, OBS WebSocket commands, live sensor/weather widgets, service/app launchers and user-configured shortcuts. It does not claim complete YouTube/Twitch/Discord/Kick account APIs or the whole Stream Deck ecosystem.

Hardware evidence: public XPANEL 2.4.5 protocol bundles and live USB readbacks; MIT ZMK Studio schemas. Keyboard VID 0x361d / PID 0x0200; display PID 0x0202, vendor usage 0xff00/1. The native plugin page was a preview; this implementation uses transparent overlays. No firmware or skin replacement.

L1+P is mapped to Ctrl+Alt+P using standard ZMK modifier encoding. Overlay slots 2–10 contain idle, Caps, L1 and four navigation frames. USB uses one native reader per interface in a separate process; display query and live upload are serialized. Navigation takes priority over the transient P hint, which leaves native function-layer labels untouched. On September 7, 2026, the owner confirmed quick navigation, P behavior and Spotify's moving keyboard timer after these corrections. Earlier Caps placement and response, four logo positions and the bottom shortcut were also owner-confirmed. This is evidence from one keyboard, not universal compatibility.

Sources: https://zmk.dev/docs/keymaps/modifiers ; https://github.com/obs-websocket-community-projects/obs-websocket-js ; https://github.com/obsproject/obs-websocket ; https://github.com/simple-icons/simple-icons ; https://learn.microsoft.com/en-us/uwp/api/windows.media.control.globalsystemmediatransportcontrolssession
