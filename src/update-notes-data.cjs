// Ship a matching entry with every release. Text is bundled with the app, never downloaded as HTML.
module.exports = Object.freeze({
  "0.3.0-preview.36": Object.freeze([
    "Keyboard language choices are now US QWERTY, UK QWERTY, Korean 2-set, Japanese Romaji and Kana, Russian, Chinese Pinyin and German QWERTZ. Saved layouts reapply on reconnect, with Shift/Caps Lock labels and verified physical application.",
    "Added FPS, RAM, VRAM and network plugin readings and monitoring widgets. Market watchlist supports up to four symbols, matching brand colors and prices refreshed every 60 seconds.",
    "Star favorites directly inside the widget menu. L1 + / cycles your favorites, or all widgets when none are starred.",
    "Display sleep offers supported timers, a Never option while Companion runs, and Test sleep. A key press wakes the display.",
    "Screenshot and Print key actions apply immediately with Undo. Choose a screenshot folder and resize or position custom key icons.",
    "Replace functional plugin logos with custom images or 302 picture presets. Convert images and choose larger icons or full-tile artwork without changing the plugin action.",
    "Improved overlay initialization checks, update installation in protected folders, writable download-cache fallback and preservation of saved settings.",
    "Update checks now explain when a release download has been withdrawn or is temporarily unavailable instead of incorrectly blaming your internet connection."
  ]),
  "0.3.0-preview.35": Object.freeze([
    "Fixed updates getting stuck on a misleading app-cannot-close error when Companion is installed in a protected folder. Setup now requests Windows permission before replacing files.",
    "Update downloads automatically use a writable account cache if the preferred folder becomes unavailable. Your preferred location and saved settings are preserved.",
    "Improved installer error messages and retry handling, and preserved the selected update-download folder during upgrades."
]),
  "0.3.0-preview.34": Object.freeze([
    "Updated the bundled image-processing library to its latest security patch.",
    "Screenshot and Print key actions apply immediately, with Undo, larger adjustable icons and a selectable screenshot folder.",
    "Customize functional plugin icons with your own images or 302 picture presets, including large-icon and full-tile display options.",
    "Star widgets directly inside the Display menu. L1 + / cycles your favorites, or every widget when none are starred.",
    "Added FPS, RAM, VRAM and network plugin readings, plus monitoring widgets and a market watchlist for up to four symbols refreshed every 60 seconds.",
    "Added supported display sleep timers and a Never option while Companion runs, with a Test sleep button.",
    "Expanded physical keyboard legends for Windows layouts, including Shift/Caps Lock states and cached frames for faster switching.",
    "Improved overlay-preview validation to avoid rejecting compatible display previews during setup.",
    "Language legends remain in testing: UK English and Korean passed physical checks; XPANEL media-icon styling and wider physical language verification still need polish."
]),
  "0.3.0-preview.33": Object.freeze([
    "Saved display settings are backed up on launch and before changes, including plugins, widgets, colors and indicators.",
    "Unreadable or unsupported settings are preserved instead of being replaced with defaults. Automatic setup pauses with a clear error.",
    "Settings changed by another app cannot be overwritten by a stale Companion instance.",
    "Includes YouTube Music Desktop/Web plugin controls, live artwork and progress, faster track changes, automatic action saving and the simplified playback setup guide."
]),
  "0.3.0-preview.32": Object.freeze([
    "Added YouTube Music plugin actions and a live artwork/playback widget, with separate Desktop and Web choices for each position.",
    "Music action changes now save automatically. Faster song and artwork refreshes keep the keyboard display in step with track changes.",
    "The YouTube Music widget remembers the last played song when the player is unavailable, with a clear idle fallback.",
    "Added live playback progress for regular YouTube, plus clearer desktop startup instructions without pairing or browser extensions.",
    "Fixed creator-tool setup error handling when a Windows subprocess returns a numeric error code."
]),
  '0.3.0-preview.31': Object.freeze([
    'Weather tiles and widgets now cross-check rain, showers and snowfall against the provider’s condition code, including mixed precipitation and freezing rain.',
    'A separate “Storms <3h” label shows upcoming thunderstorm forecasts without presenting them as current lightning.',
    'Older or invalid future weather readings no longer replace newer data. Offline and stale readings remain clearly identified.'
  ]),
  '0.3.0-preview.30': Object.freeze([
    'Faster plugin strip On/Off: visibility changes reuse cached graphics instead of rebuilding every navigation and indicator frame. Widgets remain available.',
    'Fixed a keyboard-monitor failure that could stop L1 highlights without notifying automatic recovery. Companion now detects a stopped monitor and reconnects.',
    'Expanded support reports with connection status and recent shortcut-check history, without recording typed keys. Find Check setup under Connections → Keyboard setup help.'
  ]),
  '0.3.0-preview.29': Object.freeze([
    'Added L1 + Esc recovery for Finalmouse’s waiting screen. Press it once while the message is visible; pressing it again reopens that screen. Existing custom Esc assignments are preserved.',
    'Automatic setup restores Companion’s L1 + P shortcut when it has been cleared or reassigned, and repairs stock Plugin Engine arrow actions.',
    'Choose a custom plugin shortcut by clicking the key box, pressing a key, and saving. The strip hint follows your selection; occupied XPANEL keys and overlay shortcuts are protected.',
    'Plugin strip visibility now has a separate display-connection status. Pending optional shortcut changes no longer block display startup.'
  ]),
  '0.3.0-preview.28': Object.freeze([
    'Fixed stock L1 arrow actions opening Finalmouse’s “Waiting for Plugin Engine connection” screen. Setup automatically repairs those stock bindings and preserves custom mappings.',
    'L1 + P still opens Companion plugin navigation, and L1 + / still switches widgets.',
    'Missing plugin highlights now take priority over animated display refreshes. Navigation stops if the keyboard display becomes unavailable.',
    'Original arrow mappings are backed up locally and restored with Companion’s keyboard restoration.'
  ]),
  '0.3.0-preview.27': Object.freeze([
    'Live seconds now preserve your regional 12/24-hour time format.',
    'Weather animation is clearer across plugin tiles and the screen widget, with an option to turn it off.',
    'Weather refresh and detail reporting were improved, including source time, feels-like temperature, humidity and wind.',
    'Fixed a live widget preview that could jump or remain stuck while settings changed.',
    'Improved automatic keyboard/display recovery for the “Waiting for Plugin Engine connection” state, while preserving L1 + P and L1 + /.'
  ]),
  '0.3.0-preview.26': Object.freeze([
    'Temporarily disabled keyboard language feature to prevent unwanted bars over XPANEL key labels.',
    'An orange Update available button now announces new releases, with automatic checks every five minutes and when returning to the app.',
    'Fixed a status message that could stay on “Working…” after an action completed.',
    'A visible Unreal editor shortcut brings advanced editing into the desktop Companion window.',
    'Create an editable Unreal project from your design, then build saved Blueprint and material edits for the keyboard.',
    'Animate photo subjects locally, edit their motion paths, and combine them with key-press reactions.',
    'Clearer creation guidance, color-coded controls and a toolbar that stays visible while editing.',
    'Improved saved-project selection, cancellable builds and packaged photo-processing dependencies.',
    'After updates, missing Microsoft creator tools are set up automatically when Unreal 4.27 is installed.'
  ]),
  '0.3.0-preview.25': Object.freeze([
    'An orange Update available button now announces new releases, with automatic checks every five minutes and when returning to the app.',
    'Fixed a status message that could stay on “Working…” after an action completed.',
    'A visible Unreal editor shortcut brings advanced editing into the desktop Companion window.',
    'Create an editable Unreal project from your design, then build saved Blueprint and material edits for the keyboard.',
    'Animate photo subjects locally, edit their motion paths, and combine them with key-press reactions.',
    'Clearer creation guidance, color-coded controls and a toolbar that stays visible while editing.',
    'Improved saved-project selection, cancellable builds and packaged photo-processing dependencies.',
    'After updates, missing Microsoft creator tools are set up automatically when Unreal 4.27 is installed.'
  ]),
  '0.3.0-preview.24': Object.freeze([
    'Fixed a status message that could stay on “Working…” after an action completed.',
    'A visible Unreal editor shortcut brings advanced editing into the desktop Companion window.',
    'Create an editable Unreal project from your design, then build saved Blueprint and material edits for the keyboard.',
    'Animate photo subjects locally, edit their motion paths, and combine them with key-press reactions.',
    'Clearer creation guidance, color-coded controls and a toolbar that stays visible while editing.',
    'Improved saved-project selection, cancellable builds and packaged photo-processing dependencies.',
    'After updates, missing Microsoft creator tools are set up automatically when Unreal 4.27 is installed.'
  ]),
  '0.3.0-preview.23': Object.freeze([
    'A visible Unreal editor shortcut brings advanced editing into the desktop Companion window.',
    'Create an editable Unreal project from your design, then build saved Blueprint and material edits for the keyboard.',
    'Animate photo subjects locally, edit their motion paths, and combine them with key-press reactions.',
    'Clearer creation guidance, color-coded controls and a toolbar that stays visible while editing.',
    'Improved saved-project selection, cancellable builds and packaged photo-processing dependencies.',
    'After updates, missing Microsoft creator tools are set up automatically when Unreal 4.27 is installed.'
  ]),
  '0.3.0-preview.22': Object.freeze([
    'Skin Studio: create, edit and save layered skins with key-press reactions and live previews.',
    'Build supported scenes for your keyboard with Unreal Engine 4.27. Unfinished collection scenes are labeled Test skin.',
    'Customize plugin decorations, strip colors, hint text and Caps Lock indicators.',
    'Expanded widgets include calendar, custom text styling, emojis and animated weather.',
    'Keyboard testing preserves protected skins and offers verified restoration copies for supported occupied slots.',
    'Smoother native particles, games and combined effects, plus safer skin imports and complete packaged dependencies.'
  ]),
  '0.3.0-preview.21': Object.freeze([
    'First launch automatically sets up a connected, unconfigured Centerpiece keyboard.',
    'Setup uses free display slots and leaves existing XPANEL overlays untouched.',
    'Full display storage now explains exactly how many empty slots are needed.',
    'Setup errors show the latest blocker, and pending settings open a review before saving.',
    'An orange Update available indicator makes new releases easier to spot.'
  ]),
  '0.3.0-preview.20': Object.freeze([
    'First launch automatically sets up a connected, unconfigured Centerpiece keyboard.',
    'Setup now uses free display slots and leaves your existing XPANEL overlays untouched.',
    'Setup errors now show the latest blocker instead of an older pending-settings warning.',
    'An orange Update available indicator makes new releases easier to spot.',
    'Pending settings are detected automatically, with one confirmation before saving the current configuration.'
  ]),
  '0.3.0-preview.19': Object.freeze([
    'Setup recovery preserves your current keyboard settings and creates a backup on this PC.',
    'Clearer setup errors explain what the keyboard reported and what to do next.',
    'See what changed after each update. Close this box to hide it until the next version.'
  ])
});
