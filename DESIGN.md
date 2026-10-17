---
version: alpha
name: Centerpiece Companion
description: A personal Windows music control desk for Centerpiece owners.
colors:
  background: "#11151d"
  surface: "#1c2430"
  ink: "#edf2fa"
  muted: "#a8b5c9"
  primary: "#9bb9ff"
  hover: "#bdd0ff"
  border: "#374457"
  tint: "#252f40"
  error: "#ff9aa8"
  success: "#8ad8b1"
  attention: "#ffb45b"
typography:
  body:
    fontFamily: "Segoe UI, sans-serif"
  display:
    fontFamily: "Bahnschrift, Segoe UI, sans-serif"
  mono:
    fontFamily: "Cascadia Mono, Consolas, monospace"
rounded:
  DEFAULT: "12px"
spacing:
  section: "24px"
components:
  button: {}
  player: {}
  status: {}
---

# Centerpiece Companion design

Plugin shortcuts use the existing section, native checkbox, readonly key-capture box and primary Save shortcut button in Plugin library. Clicking the box arms one-key capture for ten seconds; Tab, blur and page changes cancel it. Capture uses physical key positions, not translated characters. Custom L1 shortcuts are additive: P remains a fallback and Companion reclaims P automatically. Existing XPANEL assignments block custom shortcut saves; overlay conflicts identify the overlay number. Recovery defaults on and is clearly labeled L1 + Esc, a firmware toggle to use only while the waiting screen is visible. A custom L1+Esc assignment leaves recovery disabled rather than blocking display startup. The saved shortcut owns sidebar and default strip hints; custom decorative hints remain unchanged. Never update the displayed saved shortcut before hardware readback succeeds. Display connection status is separate from the saved strip visibility switch and never claims to observe physical pixels.

## Overview

This is a product surface for one Windows Centerpiece owner, with potential free sharing. English is the current language; no market-specific workflow is assumed. The brief prioritizes Spotify, then Stream Deck style actions. No prior application or sibling design exists.

The reference is a slate-colored studio transport controller. The signature is a stationary record paired with physical-looking shortcut keys. It is a visual cue, not album art or a fake keyboard preview. Avoid gaming RGB decorations, a marketplace full of nonfunctional buttons, and fake hardware connection claims.

## Colors

Runtime CSS in src/styles.css owns tokens and this file mirrors them. Each colors key maps directly to the same-named CSS custom property. Muted blue provides emphasis; success and error colors always accompany text. Dark theme is the default, as requested by the owner, with native forced-color fallbacks.

## Typography

Body uses Segoe UI; headings use Bahnschrift with Segoe UI fallback; shortcuts use Cascadia Mono with Consolas fallback. Local fonts prevent network dependency and late font swapping. Artist and track names accept Unicode and wrap at long words.

## Layout

The sidebar contains Plugin library, Keyboard editor, Screen widgets, Connections, Feature requests, My skins, Skin Studio and Skin library. Profiles and Media controls are no longer navigation pages; existing saved data is retained. The retired app-profile timer no longer changes the current layout when foreground apps change. Content scrolls naturally; the sidebar owns its own bounded scrollbar and becomes wrapped navigation below 740px. Four assignment controls sit beside a slim strip preview. Existing slate tokens and local fonts remain unchanged.

## Elevation & Depth

Use surface contrast and borders. No floating shadow cards. Shortcut key bottom borders are the only physical depth treatment.

## Shapes

Player radius uses --radius, 12px. Controls and inset notices use a smaller 7px shape. The circular record is a subject-specific exception.

## Components

Native buttons own click, keyboard, disabled and busy semantics. All buttons share CSS recipes. Busy controls retain their labels and dimensions. Focus uses a 3px primary outline. Feedback has one stable role=status region. Errors stay visible until another action succeeds.

Scrollbar is globally owned by styles.css, with track, thumb, hover, active, and forced-color variants. Native Windows select and color picker popups are intentional; platform geometry and keyboard behavior are acceptable. Shared inputs and buttons use existing tokens. No animation is required. CSS respects reduced motion.

Mapping: colors.* → matching :root variables → shared controls and text; typography roles → --font-body/display/mono; rounded.DEFAULT → --radius; spacing.section → --space. Verification compares source and DOM states.

## Do's and Don'ts

- Do distinguish PC Spotify controls from keyboard display integration.
- Do show real device and media state, including unavailable states.
- Don't imply the keyboard Plugins menu is implemented.
- Don't add ornamental plugin install controls for future work.

## Revision 0.2 reconciliation

The owner explicitly superseded the earlier one-screen brief with a logo library and keyboard editing. Brand logos use their identification colors, with white/light authorized-style variants for monochrome marks on the dark background. Generic tools have their own icons. Labels distinguish launchers and configured shortcuts from native integration. No runtime palette token changed.
Window chrome is owned by the shared header and window-ui.js: a draggable dark surface excluding interactive controls, yellow minimize, green maximize/restore and red close-to-tray. Each color also has a distinct symbol and accessible name. Tray Quit stops live controls; Windows startup defaults on for installed builds and launches quietly in the tray. Explicit opt-outs are saved and respected; development previews do not register startup.

## Community skin gallery

Use the existing dark surfaces and typography for a responsive preview grid, with original creator credits and clear download buttons. Keep XPANEL catalog listings visibly separate from owner-reviewed submissions. Native search, shared status messages and 24-item progressive disclosure keep all 69 entries accessible without a long initial image load.

The sidebar footer exposes Start with Windows as a native checkbox with a short status description. It uses existing text and accent tokens, is accessible from every page, and shares its setting with the tray menu.

## Profiles and live widgets

Profiles reuse native selects, text inputs and shared buttons on a dedicated page. Widget rotation uses compact checkbox rows with named move-up/down buttons, preserving keyboard focus after reordering. Weather preview motion is subtle and stops under reduced motion; hardware animation is separately optional. The removal confirmation uses a native dialog with focus containment, Cancel first, a danger action and persistent failure feedback. No design tokens changed.

## Release changes notice

A compact, nonmodal notice at the top of the shared content area uses the existing surface, primary border, typography and native button recipes. Its bold New update changes heading, small version label and plain bullet list explain the installed release. A quiet X dismisses that version locally. The notice remains in normal document flow, never covers controls, and does not steal focus when the app opens from the tray. Closing restores keyboard focus to the active page heading. No design tokens or window behavior changed.

## Available update status

The shared header shows an orange Update available label with version or retry details beside Download update. Downloaded releases use Update ready and Restart & update. This attention color identifies a next step rather than an error; downloading uses the existing primary color, and failures use the existing error color. Text always accompanies color. Runtime `--attention` owns `#ffb45b`, mirrored by `colors.attention` above; the header status and named update-attention button variant consume it. Native button focus, pressed and disabled treatments remain shared. The header wraps at narrower window sizes, retains full messages and never animates or flashes to demand attention.

## Local customization build

Keep the established slate surfaces, native fields, shared buttons and feedback. Position customization follows the four-position assignment so users can edit immediately after selecting a tile. Advanced color, hint and typography controls use native disclosures. A shared rendered keyboard preview appears on Library, Keyboard editor and Screen widgets; the detail preview uses the same renderer as hardware output. Controls stack in the narrow Codex side panel.

User-selected artwork colors belong to keyboard content, not application theme tokens. Original colors, visible shortcut hint and whole-key Caps indicator remain defaults. Color motion is opt-in and freezes during plugin navigation. Preview motion respects reduced motion. Calendar uses red plus a filled day marker to identify today. Temperature settings expose explicit Celsius/Fahrenheit choices beside widget editing.

## Integrated Studio and local skins

The local movement editor uses a compact disclosure in the existing layer inspector: Still, Drift, Swim and Orbit, with speed/range and direction controls. Nearby reactions reuse the interaction inspector with explicit radius and movement distance. Stillwater is an original editable pond, with independent fish rather than an inseparable background image. The owner requested a red Back to editor control in large preview; this named navigation variant uses the existing error color with a clear return label and arrow, and never deletes edits. Test with my keys remains green for app preview. Adjacent Test on keyboard opens a read-only capability result using the shared dialog; installed Unreal alone does not imply a working native package or upload path.
Skin Studio and Preset library share one Companion shell and a persistent local workbench. Export opens a dialog within Studio. Studio reuses src/styles.css tokens. Interaction rules use compact disclosures in the designer inspector beside the canvas; small windows stack the inspector below it. Page changes preserve the scene and undo history.

Local .pak imports inspect metadata and copy files; they never execute or install skins. Archive is reversible. Profiles remember appearances and optional skin references, excluding connections. Skin slots and PNG overlay slots are distinct; unverified skin slots are not offered. Studio bridge requests validate source, origin and an action allowlist. Existing-slot selection is serialized with display writes; no arbitrary native skin upload action is exposed.

## Export hierarchy and optional support
The Export dialog uses one primary project-save row, one compact PNG row and collapsed Unreal tools with nested metadata inspection. All existing exports stay available with compatibility limitations beside the native source action. The community note remains below.
The shared header places a small dot and community tagline beside the brand; an optional Buy Me a Coffee link sits below it. In the installed app a no-argument IPC action opens only https://buymeacoffee.com/woii in the OS default browser. The app collects no payment details, creates no contribution and does not change the default browser. The browser preview uses a normal external link with noopener/noreferrer. Loading and launch errors appear next to the link.

## Studio creator workflow refresh
Export now opens a native dialog inside Skin Studio; Preset library remains a separate page. Escape/Close restores focus. Epic setup uses a fixed official redirect and five-second detection polling while Studio is visible. Compatibility is neutral text and does not imply a verified native build. Multi-key selection supports click/drag/all and an explicit clear action; interaction groups and layer masks reuse selection. Editable scene slots are explicitly separate from five installed keyboard skin slots. Default device metadata is captured before switching, original identity is retained, and loading confirmation is awaited. Local preview uses sample widget readings; installed-skin thumbnail previews are static and identified as such. No file upload or public release action is added.

## Clear skin collections and preview testing
The owner requested stronger separation between physical XPANEL slots and editable Companion projects. Replaced both disclosures with one two-tab shelf. XPANEL saved skins owns five physical slots, an active indicator and the sole default-skin controls; Companion skin projects owns five clickable local project spaces, save and export. No new palette: green --success identifies the Test with my keys action and physical/default state, blue --primary identifies save/enlarge actions. Labels accompany every color. Back to my design appears only while an XPANEL thumbnail obscures the editable canvas. Large preview hides the shelf and side inspectors; Back to editor restores them and edit mode. The 1920×550 label now explicitly says Skin canvas and px.
The Community skins page features an Interactive Studio collection above other libraries, showing original image previews and truthful editable-project status. Five stylized and six photographic scenes (including the new Atlas rocket) use artwork colors only in content. Original Ignition remains available. Native .pak verification is a separate capability and is not implied by gallery membership.


## Creator and library refinement
The owner superseded the old disclosure-heavy controls. Interactions now use a compact named list with one active settings panel; a small effect chooser adds rules to highlighted keys. Advanced timing/trigger/target controls remain available but are not repeated across closed rows. Colors always have effect names and labels. The dedicated rocket action was removed; shared Test with my keys and visible game instructions own testing.
My skins owns saved/archived editable projects, imported .pak files and a secondary community browser. Skin library owns subject filters (Nature, Space, Ocean & water, Weather, City & machines, Abstract, Games and the Companion community collection). Publish to community opens a review draft and clearly distinguishes editable projects from native .pak files. Collection art stays in the content palette; app chrome keeps existing tokens.
Plugin position cards now pair each name with its identifying logo. Decoration is an explicit plugin with inline emoji/image/text editing. The old Customize this position disclosure is retired. Strip colors and bottom hint use one compact, accented disclosure. The keyboard settings row places L1 shortcut hint on the left and Caps Lock indicator on the right; editing layer and key controls follow immediately, with Keyboard language last. Narrow layouts stack in that same reading order. The incomplete Live keyboard settings panel is removed. Real media-binding quick choices and optional icon designs reuse existing safe binding operations and overlay rendering.

Screen widgets, Decoration and bottom hints share an emoji palette and insertion behavior; arbitrary pasted Unicode remains supported within the existing field limits. Review form descriptions keep the label, help sentence and textarea in separate rows, preserving readable spacing at narrow widths.

## Optional creator setup and reaction presets
The installation banner appears only during an explicitly started skin creation/editing flow when Unreal 4.27 is missing. Leaving Studio, opening the library or returning to an installed skin ends that notice; late detection responses cannot restore it. A completed installation dismisses it automatically. Export → Unreal tools and the native build dialog explain any missing creator components. Unreal 4.27 is required to cook a new native skin; already-built skins do not need Unreal installed. Asset-only cooking does not require Android SDK/NDK/JDK. Detection refreshes while Studio is visible and when focus returns.
Reaction presets are a searchable, filterable dialog with 40 editable combinations. It shows the selected layer and keys, prevents unavailable object actions, supports keyboard dismissal and restores focus. Added rules use the existing named interactions list and undo history. Native build progress keeps one explicit saved design name, cancellable steps, precise errors and a distinction between package integrity and observed device rendering.

The Studio information icon opens an accessible native dialog with the creation guide, using the shared button, heading, dialog and scrollbar tokens. Escape or Close returns focus to the icon. The guide distinguishes desktop previews, native builds and physical verification.

Image conversion uses the existing Studio dialog and button styles. A wide keyboard-ratio preview owns its checkerboard transparency background; framing controls remain below it. Output is lossless PNG at 1920 × 550, with enlargement off by default. No claim of restoring missing source detail.

Image actions use full-width, compact stacked rows: Import image first, Convert image second. Keep the labels on one line; never split them into narrow side-by-side squares.

Skin Studio development notice: compact orange attention text beneath the designer heading. Use shared dialog/status controls for named slot replacement; destructive replacement uses danger intent with an explicit consequence.

Studio creator actions remain visible in the sticky toolbar. Purple identifies Unreal editor and advanced editing; green identifies native build/apply actions; red identifies Return to Studio. Each color retains an explicit text label. The Unreal editor shortcut opens and expands its settings directly so users need not discover it under export.

The duplicate Build & export toolbar action is removed. Unreal editor is the single advanced-tools entry; Use on my keyboard owns physical builds. Dialog closing and setup focus restoration return to Unreal editor.

Update availability uses the shared header renderer and attention token: a solid orange Update available button downloads the release. Automatic checks run every five minutes and on window focus, throttled and deduplicated; detected availability stays visible until download.

Keyboard language controls and automatic language overlays are temporarily disabled. XPANEL labels stay visible regardless of saved Windows language preferences. Caps Lock, media icons and L1 shortcut hints remain active.

Local time seconds uses a native checkbox in Screen widgets, shared by the clock plugin and widget. Weather uses provider day/night for the selected location and animated moon/stars at night; stale readings are identified. The manual setup button is hidden; background recovery owns setup, while the existing settings-review dialog retains confirmation for pending changes. Recovery runs in the tray, preserves custom bindings, and never automatically retries an uncertain settings write.

YouTube Music reuses the Spotify artwork/progress widget and existing branded red library icon. Compact Desktop / Web buttons appear beside YouTube Music actions and its widget. Each plugin position owns its own player, identified in the position action caption; the fixed widget has a separate player choice. Auto is removed from the UI because browser media cannot reliably identify the music website. Selected buttons use the existing primary token and aria-pressed; labels and dimensions remain fixed while saving. Connections shows widget detection status with an optional collapsed source override for the chosen player; normal use needs no Connections step. Music selection stays stable during live polling. Existing dark palette, native controls and typography remain unchanged.


## Immediate plugin action choices
The Plugin library keeps native action selects and the existing music action buttons. Choosing a self-contained action saves only the selected position immediately; it never executes playback or launch actions. Actions requiring a shortcut, path, URL or OBS input, and decoration edits, retain explicit Add/Save. A serialized per-position queue coalesces rapid choices and keeps the newest selection without dropping edits to another position. Responses merge only that saved position into the local draft; unrelated unfinished controls remain unchanged. Pending and failure feedback reuse the shared status region, errors retain the selected choice for retry, and music action buttons keep focus while updating their pressed state. Profile changes cancel queued choices and ignore stale responses. No theme tokens or layout are changed.


YouTube Music customization begins with a compact orange Playback setup note above its action and Desktop/Web controls, hidden for other plugins. It uses the existing attention token for its border and title, with readable body text. Desktop guidance uses three compact numbered arrow rows under Settings → Playback: Continue where you left off → On; Pause on application launch → Off; Fully quit → Reopen Desktop. A small note names the possible automatic-playback side effect. Start on boot stays a single arrow row under General, introduced by Optional settings in the existing blue primary token. The instruction labels explicitly say In YouTube Music Desktop and In web app. Web guidance explains that a first Play can be needed again after a browser restart. This note changes no third-party settings and performs no playback action. The redundant optional desktop pairing UI, approval instructions and client bridge are removed; normal use follows the selected Windows media session with no new credentials or browser extension.

## Action artwork and display sleep
Extend the existing media action editor with Print Screen and Ctrl+P, using camera/printer glyphs and the shared icon color, background and design controls. Functional plugins expose the same validated local artwork picker as decorations; the action and player remain unchanged. Image conversion uses high-quality resampling to a transparent 128 px PNG, with physical dimensions explained and no claim to restore missing source detail.
The keyboard preview toolbar owns a compact native sleep select in the existing success color, a text label and a Test sleep action. Selection saves through its own serialized hardware operation; errors retain the last saved value. The prior XPANEL timeout remains untouched until a user selects a Companion timer.
Keyboard layout reference uses Windows' layout catalog and local fonts in the editor. It does not paint language backgrounds over XPANEL legends or activate a Windows input method. Windows settings owns installation and activation of input layouts and IMEs.


## Live monitoring and native languages
New monitoring widgets use the existing slate surface, mint actions and amber unavailable/setup states. Sources are grouped in one collapsible widget panel. Event titles default private. Market quotes use a public endpoint with explicit data age and need no credentials. Measurements expire instead of freezing as live values. Game capture is opt-in for a selected executable; Windows permission setup is explicit and never signs the user out. Network loss is labelled probe loss to a named endpoint, not total link packet loss. Steam manifests show saved progress and its age. Language selection uses firmware command 53 only for XPANEL-supported IDs; it never changes legend offsets or paints replacement backgrounds. Unsupported layouts stay preview-only with explicit status. Screenshot destination is an orange panel; changing it uses a native directory picker and leaves existing files untouched.

Live widget sources: game capture follows the foreground game by default. Required Windows permission instructions use an amber left border and short arrow-separated steps. Source errors and quote timestamps remain visible in Screen widgets. Appointment and peripheral battery are removed until reliable device coverage exists.

Market controls now sit under Display and appear only for Market watchlist. Add/remove edits save immediately, support up to four simultaneous quote cells, and normalize plain crypto/index symbols. Brand logos use bundled Simple Icons; unknown brands use ticker badges. FPS setup shares this contextual area, with a mint Enable game capture button visible only for Game performance.

Widget favorites are immediately saved yellow star buttons in a stable list. Empty favorites mean all widgets during L1 + / cycling. Orange explanatory text states both behaviors. FPS permission action is orange and shown only after capture is denied; successful readings state setup is not required. Market refresh cadence is highlighted orange.

Widget favorites live inside the compact Display picker as independent star buttons beside each choice; no separate favorites list. Keyboard navigation supports Escape and arrow keys. Plugin save actions use orange, decoration save uses mint, and appearance selection uses violet. Functional artwork supports a larger 48px image or full-square fill while retaining actions. Illustrated preset variants are sorted ahead of existing photos, with all prior assets retained.

The widget picker is a single-column popup with a fixed 44px star column; Follow selected plugin is removed. Image presets are conditional on Custom image, with mint conversion and amber size controls. Sleep exposes supported native durations and Companion-managed Never; long unsupported values are not offered. Never still requires a physical extended-idle check; it is not a verified firmware-native setting.

Keyboard language uses one native selector with eight choices: US, UK, Korean 2-set, Japanese Romaji and Kana, Russian, Chinese Pinyin and German QWERTZ. No new visual tokens or parallel selector are introduced. Pending text uses the existing status region; success is shown only after device application and persistence, and errors restore the previous selection. Japanese Romaji and Chinese Pinyin explicitly explain Latin input keys and Windows IME composition. Retained legacy preferences are not silently rewritten by opening the page.

Transparency uses three independent, initially-off native switches in the keyboard preview toolbar beside Display sleep. Plugins use green, Caps Lock amber and Widget purple labels and accents. Saves go through the existing serialized task/configChange flow; failure restores saved switch state. Background alpha leaves content readable and retains the selected plugin outline. Switching off restores saved colors/opacity. The key binding editor records a physical key plus Ctrl/Shift/Alt/Windows, stages it for explicit Save, and cancels on Escape, Tab, blur or timeout. US and UK # presets state their layout; Windows interprets characters. The existing backup/readback and reserved-key guards remain authoritative.

Feature request mentions use the existing community feed, task/status helpers, native details composer and dialog. Owner-only @author actions send a private in-app mention tied to the request author, resolved server-side. A yellow count on Feature requests and a top-right Notifications button show unread items; read is explicit per message and account-scoped. Polling runs every 30 seconds while the app window is visible. A failed send retains text and its idempotency key. User text is textContent only. No Discord messages are sent by mentions. Restored Companion setup resumes automatically on launch after identity, backup, pending-state and readback checks; explicit Restore pauses setup for that session.
