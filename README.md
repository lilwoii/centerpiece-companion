# Centerpiece Companion

**[Download the Windows installer](https://github.com/lilwoii/centerpiece-companion/releases)**. Open the newest release and download the `.exe` under Assets. You do not need the source ZIP, `.blockmap`, or `.yml` files. [Sharing guide](SHARING.md).

Free, unofficial Windows companion for the 68-key Centerpiece Pro. Original code is MIT licensed. This is a community preview tested on one keyboard, not replacement firmware or a complete Stream Deck runtime.

Run the Windows installer from this project's GitHub Releases on Windows 10/11 x64. The location page lets you choose the app folder and future update-download folder on separate local drives. Updates use a dedicated subfolder there. Windows still requires some free space on its system drive; personal settings remain in your Windows account. No administrator account is required. The executable is unsigned. Close XPANEL before setup or binding edits, and save or discard its pending changes.

Use the app's **Set up my keyboard** button. Setup backs up the original keymap in your Windows profile and reserves overlay slots 2–10. It stops if an unowned slot is occupied. Your installed keyboard skin remains in place.

Choose four logo slots. L1+P enters plugin mode; release L1, use Up/Down, then Enter. Escape exits, or wait 45 seconds. Existing XPANEL media bindings remain usable. Navigation uses preloaded states. Caps Lock exits plugin mode to show its indicator immediately.

Keyboard editor uses the physical layout. Click a key or arm **Press a key to select** for ten seconds. Bindings are backed up and read back after saving. L1, L1+P and L1+/ are reserved. Press L1+/ to cycle screen widgets and save the selection while the app runs in the tray.

The small screen above Up supports Spotify artwork/progress, clock, weather, CPU/GPU readings, microphone state, Twitch text and custom text. The idle display refreshes up to twice per second when USB is ready; navigation uses a still snapshot. Sensors are sampled separately. Small-screen text is truncated. Position and size are adjustable.

Weather prefers Windows location, with a manual city and unit choice. Data refreshes about every ten minutes. Weather attribution: [Open-Meteo](https://open-meteo.com/), CC BY 4.0; the free endpoint is intended for noncommercial use.

CPU load is built in. NVIDIA temperature uses an available nvidia-smi; other temperatures require an existing Libre Hardware Monitor server at 127.0.0.1:8085. No sensor driver is bundled. Missing readings stay unavailable. Microphone controls target the default Windows communications input.

OBS requires the user's local WebSocket configuration. For Twitch, enter a channel name or link and click Connect with Twitch. Approve read-only access in your browser; no developer registration or manual token is required for community users. Twitch credentials are encrypted locally, restored at startup and renewed automatically. OBS passwords stay in memory. Many catalog logos are website launchers or configured shortcuts, not native API integrations. Third-party Stream Deck plugins cannot be imported directly.

Connections offers original L1+P, L1+/ and overlay restoration. Other intentional remaps remain. Closing the window keeps controls running in the Windows tray. Its menu offers optional Start with Windows and Quit. Quit stops live controls and restores the original displayed overlay; reserved images remain stored on the keyboard. Keep your local restore backup.

Share the public GitHub release link or its installer. The older personal portable folder may contain private backups. Never upload AppData, diagnostics or hardware-backup. Read PRIVACY.md. Test your configured actions before a live stream; account and sensor integrations need their own live validation.

Keyboard language defaults to QWERTY. Choose another Windows-supported layout, including Russian or Korean, to change desktop and keyboard labels. Actual typing still uses the selected Windows language or IME; use Win+Space to switch it. The physical keyboard remains a 68-key layout.

Community requests use browser Discord sign-in. Users authorize the configured community application; they do not register developer accounts. Skin submissions are moderated HTTPS links opened in a browser, not automatic installation of user files. Updates require a published GitHub release and an installed app; this preview is unsigned.

Update with **Check for updates → Download update → Restart & update**. The update installer allows new app and future-download locations. Its selected download folder applies to subsequent downloads; the current installer remains where it was downloaded. To move from an older version that downloads to C:, download this installer directly from GitHub and run it manually.

The full XPANEL skin catalog and native community skin installation are not included in this preview. Read SHARING.md before distributing the app.
