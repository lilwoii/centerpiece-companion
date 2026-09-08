# Companion interaction contract

Business source: PRODUCT.md and the user's Spotify-first request.

| Capability | Canonical owner | Source of truth | Allowed variants | Verification |
|---|---|---|---|---|
| Buttons | src/styles.css native buttons | DESIGN.md | primary, neutral | desktop verification |
| Scrollbar | src/styles.css global baseline | DESIGN.md | forced-colors | computed style |
| Toast | src/renderer.js and src/desk.js feedback regions | PRODUCT.md | status, error | DOM verification |
| Select/Listbox | native HTML select in src/index.html | DESIGN.md | native Windows popup ownership accepted | desktop verification |
| Navigation | src/desk.js hash routes | PRODUCT.md | sidebar, responsive wrap | desktop verification |
| Input | src/styles.css native inputs | DESIGN.md | text, password, color, number, checkbox | validation tests |

No reusable application existed before this version. The player, shortcut and device sections use the same buttons and status vocabulary. The library and keyboard editor share these recipes.

Media actions show pending by disabling the transport controls, retain dimensions, and refresh state on completion. The main process serializes actions and never automatically retries a media mutation. Failed actions stay in the feedback area. Spotify absent disables playback controls and gives a recovery instruction.

Shortcut enablement registers all three shortcuts or rolls back all of them on conflict. It persists only the boolean enable setting. Shortcuts apply globally to Windows, not exclusively to the Centerpiece, and are released when the app exits. Initial default is off.

Per the owner's requested arrow navigation, L1+P enters plugin mode through the keyboard's layer-1 P mapping to Ctrl+Alt+P. Left/Right are reserved for future pages, Up/Down select a strip position, Enter runs and exits, Escape exits. All reserved arrows register atomically on entry and are released on exit or after 45 seconds idle. Four positions accept catalog assignments. Selection is shown on desktop and in the keyboard strip using preloaded overlays.

Device version queries are user-triggered or run once at startup. The main process cannot accept arbitrary HID packets from UI. Strip activation checks the saved hardware identity. Normal app exit restores the original overlay slot. Setup backs up the original keymap, checks empty destination slots, verifies returned image previews and reads back the single-key binding change.

English UI, keyboard-accessible native controls, visible focus, readable contrast, natural document scrolling and narrow layout are required. No remote navigation or web content is accepted in the desktop window.

Route title is Page · Centerpiece Companion. Navigation focuses the destination heading; unknown hashes fall back to library. Local transient search, filters and form drafts stay in memory across pages; saved assignments live in desk.json, never URLs. Native select, color and file-picker popups intentionally retain Windows behavior.

Assignment writes validate in the main process and distinguish saved local state from hardware upload failures. Actions run only on explicit activation. OBS credentials remain session-only. Keymap writes require matching device identity and a fresh unchanged snapshot, preserve L1/L1+P, create backups, and read back saves. All four navigation highlights and Caps/L1 states are preloaded; arrow presses perform no uploads. No raw typing is logged.
Window controls use the shared header on every page. Close hides to tray; minimize uses the Windows taskbar; maximize toggles restore. The tray menu owns explicit Quit and optional Start with Windows. Renderer access is limited to these named actions.

Discord browser approval runs independently of desktop actions. Sign in changes to Cancel sign-in while pending, with recovery status on the Community page. Update checks become available immediately after the installed updater initializes.

Saved Discord sessions restore at startup from Windows-encrypted local storage. Active sessions renew within their 30-day expiry window. Invalid submission fields do not spend the submission allowance; failures retain form text and show a plain-language error with a retry interval for rate limits.

Twitch uses the public-client device approval flow with chat:read only. A channel name or Twitch URL and Connect with Twitch replace all manual token inputs. Approval is cancellable without blocking the desktop. Tokens stay encrypted on this PC, restore at startup, validate hourly and renew as needed. Disconnect clears local credentials and attempts revocation. Browser approval URLs are restricted to Twitch activation.

L1 + / cycles screen widgets in the tray through Spotify, clock, weather, CPU, GPU, microphone, Twitch, custom text, follow selection and off. Every press saves its selection; display writes coalesce after a 60 ms pause. Layer-one slash emits Ctrl+Alt+F12, is backed up and read back on setup, and is reserved in the editor. Restore companion setup restores its previous mapping. The companion must remain running in the tray for live widget switching.

Interactive installation and update installation show a locations page for the app folder and future update-download folder. Update downloads and their installer temporary files use a dedicated subfolder on the chosen local drive. Personal settings remain per Windows user in AppData. Windows itself still requires system-drive free space. Silent installations use a sibling update folder.

Holding L1 highlights both P and physical slash using the custom L1 color, or the Caps Lock indicator color when no custom color is selected. Earlier F24 widget bindings migrate to F12 without replacing the original-key backup.

Widget cycling updates only the visible screen state in the spare overlay slot. It does not rebuild or display the other navigation/Caps/L1 images. Cached states refresh their widget content when selected, while retaining instant selection and Caps feedback.
