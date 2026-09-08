# Privacy and local data

Settings, weather location and keyboard backups stay under each Windows account's AppData/centerpiece-companion directory. Settings and backups use Windows file permissions; they are not encrypted. Do not share this directory.

OBS passwords stay in memory for the session. Twitch access and refresh tokens are encrypted with Windows-backed secure storage in twitch-session.bin on the user’s PC. Tokens travel directly between the companion and Twitch, never through the community server. They are excluded from public UI state and community packages. Disconnect removes the saved connection and attempts to revoke Twitch access. Spotify uses the existing Windows media session. The companion does not receive a Spotify password.

Weather sends the chosen coordinates to api.open-meteo.com and city searches to geocoding-api.open-meteo.com. Twitch chat connects to Twitch over TLS. OBS and optional temperature sensors use loopback. Opening an assigned website or app invokes that destination and its privacy policy.

The keyboard monitor observes L1 state and selects one physical key only when the editor is explicitly armed. It stores no typing history. Caps Lock monitoring reads lock state. Microphone mute control does not record audio.

Community requests and skins require a separately configured server. The Discord webhook must remain a server secret; it must never be embedded in a public app or source repository. Discord sign-in must use OAuth, not a user's Discord password or personal account token.

Enter credentials only in Connections. Ordinary custom text, paths, URLs and weather settings are saved locally. Service providers necessarily receive the authentication or request data needed for their features.

Discord sign-in shares your Discord user ID and username with the community service. Your requests, approved skin links, name color and timestamps are public. Requests and skin links are also sent to the owner's Discord review channel. Submissions remain until the owner removes them; contact the project owner for removal. The companion never collects your Discord password.

The companion's own session is encrypted with Windows-backed Electron secure storage when available, otherwise kept in memory. The server stores only a hash of its random session token, expiring after 30 days of inactivity, renewed during use. Temporary browser sign-in state expires after five minutes and handoff codes after one minute. Hashed IP rate counters expire and are cleaned periodically. Cloudflare and Discord also process request metadata under their own policies.

Closing the window keeps local keyboard and live-plugin processing running in the tray. Quit from the tray to stop it. Start with Windows is optional and can be disabled in that menu. Updates contact this project's GitHub releases; downloads and restarting to install require user actions.

The skin gallery fetches the public registry and preview images from assets.freethinkerportal.com. Official downloads are resolved through marketplace-upload.ashkon.workers.dev and opened from the approved XPANEL asset/storage hosts. These providers receive normal connection metadata, including your IP address. Search stays in the app. No XPANEL account credentials are requested, and skin files are not rehosted by the companion.


## Optional automatic profiles

When enabled, automatic profiles read the executable name of the foreground Windows app locally. The companion does not collect window titles, browsing history or typed text, and does not send foreground app names to a server. Saved profiles and app links stay in `profiles.json` in your Windows user data folder. Profile snapshots exclude account connections, keyboard remaps and skins. App-launch slots can contain local app paths. Automatic switching is off until you enable it.
