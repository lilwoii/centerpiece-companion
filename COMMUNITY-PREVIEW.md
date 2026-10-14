# Centerpiece Companion

**[Download the Windows installer](https://github.com/lilwoii/centerpiece-companion/releases)**. Open the newest release and download the `.exe` under Assets. You do not need the source ZIP, `.blockmap`, or `.yml` files. [Sharing guide](SHARING.md).

Free, unofficial Windows companion for the 68-key Centerpiece Pro. Original code is MIT licensed. This is a community preview tested on one keyboard, not replacement firmware or a complete Stream Deck runtime.

Run the Windows installer from this project's GitHub Releases on Windows 10/11 x64. The location page lets you choose the app folder and future update-download folder on separate local drives. Updates use a dedicated subfolder there. Windows still requires some free space on its system drive; personal settings remain in your Windows account. The default per-user folder needs no administrator access. Updating an app in a protected folder requests Windows approval using the same account. The executable is unsigned. Close XPANEL before setup or binding edits, and save or discard its pending changes.

The first visible launch automatically sets up a connected, unconfigured keyboard. Pending keyboard settings open a review before saving the current configuration. Setup backs up the original keymap in your Windows profile and uses free overlay slots among 2–10, leaving existing overlays stored and untouched. At least two free slots are needed. **Set up my keyboard** remains available for manual retry; automatic setup never loops after a failure or canceled review. Your installed keyboard skin remains in place; Companion's overlay is active while running.

Choose four logo slots. L1+P enters plugin mode; release L1, use Up/Down, then Enter. Escape exits, or wait 45 seconds. Existing XPANEL media bindings remain usable. Navigation uses preloaded states. Caps Lock exits plugin mode to show its indicator immediately.

Keyboard editor uses the physical layout. Click a key or arm **Press a key to select** for ten seconds. Bindings are backed up and read back after saving. L1, L1+P and L1+/ are reserved. Press L1+/ to cycle screen widgets and save the selection while the app runs in the tray.

The small screen above Up supports Spotify artwork/progress, clock, weather, CPU/GPU readings, microphone state, Twitch text and custom text. The idle display refreshes up to twice per second when USB is ready; navigation uses a still snapshot. Sensors are sampled separately. Small-screen text is truncated. Position and size are adjustable.

## Fixed in preview.35

Upgrades check app-folder permissions before removing the previous version and request Windows approval when the folder is protected. Update downloads fall back to a writable account cache if the preferred folder is unavailable, without replacing that preference. Saved plugins, widgets, appearance settings and keyboard backups remain in the same Windows account.

## Added in preview.34

- **More monitoring:** RAM usage, supported NVIDIA GPU 0 VRAM usage, network probe quality, game FPS/frametime and Steam/Windows BITS download progress. RAM, VRAM, FPS and network readings can also be plugin tiles. Unsupported or blocked sources show their status rather than invented values. PresentMon is bundled for game capture; some Windows accounts need the conditional permission steps shown in the app.
- **Market watchlist:** display up to four symbols with price, daily change, colored branding where available and data age. Add/remove symbols directly beneath Display when Market watchlist is selected. Yahoo Finance is checked every 60 seconds while active; provider data can be delayed, so this is not a tick-by-tick feed.
- **Favorite widgets:** stars are inside the Display dropdown. Yellow stars save immediately and limit L1+/ cycling to favorites. With no favorites, every widget participates. The old Follow selected plugin choice has been removed.
- **Custom plugin artwork:** keep a plugin's action while replacing its logo with a local image or one of more than 300 presets. Image conversion, a larger logo mode and a full-tile image mode are available under Plugin appearance → Custom image.
- **Key actions:** select a key and click Screenshot, Print or a media action to assign it immediately. Undo restores the prior binding. Screenshot uses Windows + Print Screen and shows the save folder with a Change folder option; Print opens the focused app's Ctrl+P dialog. Custom screenshot/print icons support color, size and placement controls.
- **Display sleep:** choose 10, 15, 30 or 45 minutes, 1 hour, or Never. A selection saves immediately. Timed sleep is handled by the firmware; Never requires Companion running in the tray. Test sleep checks the display and first-key wake behavior.
- **Experimental physical languages:** Windows mappings now drive transparent Companion legends for layouts outside the firmware's built-in language sets, including Shift/Caps symbol states. UK English and Korean were physically checked. The full Windows catalog has not been checked on hardware, and Companion-rendered media artwork still differs from XPANEL's original icons.

Existing display choices and keyboard backups remain local. This release does not change YouTube Music integration. See [README.md](README.md) for source limits and [PRIVACY.md](PRIVACY.md) for the data each monitoring feature uses.

## Connections and daily use

Weather prefers Windows location, with a manual city and unit choice. Data refreshes about every ten minutes. Weather attribution: [Open-Meteo](https://open-meteo.com/), CC BY 4.0; the free endpoint is intended for noncommercial use.

CPU load is built in. NVIDIA temperature uses an available nvidia-smi; other temperatures require an existing Libre Hardware Monitor server at 127.0.0.1:8085. No sensor driver is bundled. Missing readings stay unavailable. Microphone controls target the default Windows communications input.

OBS requires the user's local WebSocket configuration. For Twitch, enter a channel name or link and click Connect with Twitch. Approve read-only access in your browser; no developer registration or manual token is required for community users. Twitch credentials are encrypted locally, restored at startup and renewed automatically. OBS passwords stay in memory. Many catalog logos are website launchers or configured shortcuts, not native API integrations. Third-party Stream Deck plugins cannot be imported directly.

Connections offers original L1+P, L1+/ and overlay restoration. Other intentional remaps remain. Closing the window keeps controls running in the Windows tray. Its menu offers optional Start with Windows and Quit. Quit stops live controls and restores the original displayed overlay; reserved images remain stored on the keyboard. Keep your local restore backup.

Share the public GitHub release link or its installer. The older personal portable folder may contain private backups. Never upload AppData, diagnostics or hardware-backup. Read PRIVACY.md. Test your configured actions before a live stream; account and sensor integrations need their own live validation.

Keyboard language defaults to QWERTY. Firmware-supported languages use native legends; other mapped layouts use Companion legends while the app runs. Original native legend visibility is restored on normal exit, with a recovery record for interrupted sessions. Actual typing still uses the selected Windows language or IME; use Win+Space to switch it. Function labels may remain English, and IME composition does not assign every written character to a key. The physical keyboard remains a 68-key layout, so selecting a language cannot add ISO/JIS keys that are not present.

Community requests use browser Discord sign-in. Users authorize the configured community application; they do not register developer accounts. Skin submissions are moderated HTTPS links opened in a browser, not automatic installation of user files. Updates require a published GitHub release and an installed app; this preview is unsigned.

Update with **Check for updates → Download update → Restart & update**. The update installer allows new app and future-download locations. Its selected download folder applies to subsequent downloads; the current installer remains where it was downloaded. To move from an older version that downloads to C:, download this installer directly from GitHub and run it manually.

The full XPANEL skin catalog and native community skin installation are not included in this preview. Read SHARING.md before distributing the app.
