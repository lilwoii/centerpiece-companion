# Skin Studio in Companion

Local test build only. Nothing has been published to the community update channel.

## September 13 development pass

- **Test preview** opens the selected design in the on-screen interaction preview. **Use skin** and the green **Use on my keyboard** action follow the native build and physical-slot activation workflow.
- Companion project spaces remain saved designs on the PC, not additional firmware slots. Applying a built design uses a real keyboard slot, with replacement review for an occupied slot. Reapplying the same owned package selects it without another upload.
- The restore-test control appears after a successful test upload; it is not an activation button.
- Saved Unreal 4.27 projects can be compiled and cooked without regenerating their assets, preserving Blueprint and material edits. A real project passed compilation, Android cooking and package-integrity checks through this path. This does not prove every user-authored graph will work on the device.
- The desktop app hosts the installed Unreal Editor in the Studio page through a native panel with matching DPI awareness. Real-editor attach/resize/detach and desktop open/return/reopen checks passed. Returning to Studio hides the retained editor session. Quitting Companion detaches and reveals retained editors to preserve unsaved work. Browser previews cannot embed a Windows editor window.
- Blueprints must use runtime classes already installed on the keyboard. A skin package cannot install arbitrary new C++ game modules or runtime plugins; the build reports these explicitly. External Unreal graphs are not automatically converted back into the simpler Studio layer canvas.
- Automatic Windows layout detection and Cyrillic/Hangul label rendering are implemented. Rendering and lookup checks passed; physical keyboard verification remains part of the batch test.

The sections below include earlier development history; this section describes the newer activation and Unreal-project build behavior.

## Designer
- 1920 × 550 live canvas with keyboard guides, selection, dragging, resizing and snapping.
- 47 editable presets; use a preset or combine its layers with your scene.
- Up to 48 layers: solid, gradient, wave, ripple, particles, stars, rain, snow, fireflies, orbit, aurora, plasma, grid, rings, text, imported images, heatmap, rocket, nebula and meteors.
- Layer ordering, duplicate, hide, lock, opacity, rotation, blend modes, colors, effect speed, density, size and reaction strength.
- Text content, font, weight, alignment and size; PNG/JPEG/WebP artwork imports.
- Precision placement, canvas fit/fill, fit to a keyboard key, undo and redo.
- Timeline, looping, duration and numeric keyframes for position, size, rotation and opacity; linear, smooth, ease-in and ease-out interpolation.
- Interaction inspector beside the canvas: key press/release, pointer click, simulated beat or Caps event; per-key filters and whole-canvas/per-layer targets. Ripple, burst, flash, pulse, toggle, heat, shockwave, sparkle and launch reactions with color, strength and duration.
- Test buttons and focused-canvas keyboard testing. Beat and Caps buttons simulate events; this is not a live music-analysis or keyboard-device connection.
- Local draft saving, conflicting-tab protection and editable .cpskin files.
- Individual fish layers, plus Still/Drift/Swim/Orbit movement for objects and imported images. Set speed, travel range and facing direction.
- Nearby-key reactions: add a ripple and move-away behavior to an object, then adjust the proximity radius, escape distance, duration, strength and selected keys. Proximity is measured when the key is pressed.
- Stillwater · koi garden demonstrates five separate swimming fish, moving water and key-driven avoidance. This is original procedural artwork, not a reconstructed Koi.pak.

## Pages within the same app
Skin library browses and searches starting scenes. The Export button inside Skin Studio opens a compact window that saves editable projects, full-resolution PNG frames and a ZIP containing Unreal source and the community SDK. Source targets are 4.27 and an experimental UE5 port.

## Local skins and profiles
Community skins includes a local .pak library: drop/import, inspect metadata, select a skin reference, export a copy, archive and restore. Profiles remember plugin/widget/color/Caps choices and a selected local skin reference. Up to 20 PC profiles do not consume extra keyboard slots. Community submissions retain the existing moderated link workflow.

## Limits and remaining work
This is not the full Unreal Editor and cannot edit every arbitrary Unreal scene. The local pipeline now compiles its creator tools, generates scene Blueprints, cooks Android_ASTC assets, packages them, and verifies package integrity. Editable fish, object movement and proximity avoidance have native source implementations with Editor runtime checks. The storm physical test confirms host key delivery for that package. Other editing combinations need their own native validation.

Material compilation, text orientation and late input connection defects were corrected. The owner physically verified Storm meadow rendering and key-position lightning with A, G and L. That evidence applies to the tested storm package. Unreal can return success after a material compile failure, so the build runner rejects that output. Slot 5 was restored to Flames and Koi in slot 4 selected again after the test.

A compiled Koi.pak cannot be opened as its original editable project. Existing keyboard skin switching uses verified slots 1–5. Local native upload has backup, slot protection and restoration checks; package upload acknowledgement is not proof of rendering or interaction. The owner-approved Storm meadow package and editable project were published as separate skin assets; the app update channel remains unchanged.

XPANEL skin storage and Companion PNG overlay storage use separate commands. Overlay slots 1–10 do not prove Unreal skin slots 6–10 exist. The earlier overlay collision provides no evidence of extra skin capacity.

## Unreal setup
The designer and finished compatible skins do not require the full Unreal Editor. Native cooking currently needs creator-side Unreal and compatible build tools. Epic's ordinary setup requires sign-in and license review; its silent offline installer is restricted to eligible organizations. The Export window links to Epic and checks for UE 4.27 and compatible creator tools every five seconds while open, including the Epic registry location for custom drives. No app restart is needed. Detection is not build verification. The engine is not bundled into Companion.

- https://dev.epicgames.com/documentation/unreal-engine/install-unreal-engine
- https://dev.epicgames.com/documentation/unreal-engine/offline-installer-of-unreal-engine

## Current local additions
- Click/drag to select keyboard key groups, select all, and apply a layer mask or interaction group. Standard browser key events cover 63 of the physical keys; firmware-only keys need native input integration.
- Show the configured Companion plugin strip and widgets above the scene. Local browser values are sample readings; installed Companion uses its current state.
- Five clickable Companion project spaces save and reopen editable designs separately from XPANEL. The old PC default record remains preserved internally; the redundant PC default controls were removed. This does not upload a project to the keyboard.
- Read and switch the five actual installed skins; capture the starting skin identifier per device before switching, keep the original record, and choose a preferred default. This record preserves identity, not a binary backup of the installed file. External replacement of the default slot is detected.
- On the owner keyboard, Koi was detected in slot 4; a switch to Lava Lamp slot 1 and return to Koi passed after waiting for firmware loading.
- Ignition is an original procedural launch scene. Space/canvas click launches; WASD creates sparkles. No community submission or public update has been made.

## September 12 collection and workflow pass
- New Interactive Studio collection at the top of the local Community skins page: eleven new projects plus original Ignition, with full editable downloads, embedded artwork and previews. Five stylized animated scenes, five photographic environments and one realistic launchpad/rocket.
- Every scene responds in the browser renderer. Photo backgrounds are separate layers; Atlas uses an independently moving vehicle, exhaust and smoke.
- Green Test with my keys starts/focuses the large app preview and shows received events. Back to editor is red and returns to editing without losing the scene. Native build and test actions check prerequisites, build the saved project, and require slot review before upload. XPANEL thumbnail return control appears only when it has a visible effect.
- Source exports now include original Unreal 3D collection assemblies and an experimental separate4.27 device Blueprint generator based on the host SkinApi declarations. The native generator has compiled and cooked locally; physical rendering and host input remain under investigation. They are not community-ready keyboard .paks.
- No public release or community-server submission occurred.

## Native editing verification in progress
- Selected-key layer masks use the trusted 68-key layout. Reaction groups can use reported key positions without guessing firmware key codes.
- Native timelines translate position, dimensions, rotation, opacity and effect size, including the four editor easing modes. Rotation animation is retained when automatic facing is enabled.
- Three independent native fixtures cover a koi pond, orbital scene and aurora with proximity movement and visual reactions. Results are recorded under verification/native-reaction-suite; a queued or failed build is not a passing result.
- Current automated Studio suite: 229 passing checks, plus 15 Python native translation checks and 166 core app checks. These are separate from physical keyboard tests.

- Native creator tools also compile without shared precompiled headers, with two concurrent compile tasks. This avoids the large-header stall observed locally.
- Koi pond, orbital garden and drifting aurora each passed generated Blueprint runtime checks and Android package integrity checks. The mask/timeline fixture also builds with selected A/G/L reaction filters. Caps Lock press reactions now translate to the physical Caps key.

## Native rendering verification, September 12 continued
- All 23 editable layer types compiled, cooked to Android ASTC, and passed package validation across three fixture scenes. Runtime rendering compared idle output with a key press for each layer; every selected layer region changed. Details: verification/native-layer-matrix-results.json and verification/native-layer-matrix-render-results.json.
- Native text uses locally prepared glyph textures for all five Studio font options, alignment, weight, color and multiline layout. Glow is a live material effect. Runtime rendering verified text and its reaction.
- Rocket launch now has a native material implementation and passed a runtime key-reaction image comparison.
- Screen, Overlay and Soft light use a generated Blueprint compositor; Multiply is also supported. Compositor pulse rendering changed 56,000 pixels after the test key press. Performance and the final display still require physical-keyboard checks.
- Fixed pulse timing being pruned by Unreal because the parameter-read execution pin was disconnected. Such warnings now reject a build even if Unreal exits successfully. New artifacts require validation revision 3.
- Convert image preserves aspect ratio, previews framing and saves a lossless 1920 x 550 PNG. No enlargement by default. The actions are stacked full-width below the layer list.
- These additions remain local. Beat event sources and collection/game scene parity remain separate unfinished native work; this report is not a claim of universal Unreal editing or all-combination hardware support.

- Visual key reactions retain the four most recent presses per rule. A native runtime test produced four independent lightning bolts and ripples at separate positions; verification/native-history-render-results.json records the regional image changes. The owner then confirmed simultaneous reactions on the physical keyboard but reported substantial lag. That first package failed the performance check.
- The replacement shader skips expired reactions, bounds work to visible effect regions, and evaluates nearby lightning segments instead of traversing every segment for every pixel. The replacement package compiled, cooked and rendered successfully locally. The owner physically tested the replacement and confirmed: "it looks very good its smooth". This verifies the tested multi-press lightning/ripple fixture, not every editing combination. Flames was restored to slot 5 and Koi reselected in slot 4 after testing.
- All eleven native reaction effects passed individual idle/pressed runtime image comparisons, alternating key-down and key-up triggers. Results are in verification/native-effect-matrix-render-results.json; these comparisons do not measure keyboard frame rate.

## Further release checks
- Full-range particle motion now uses the same seeded positions as the editor and retains all 1–200 particles. The initial full-screen implementation was laggy. Its replacement uses batched sprite geometry and passed the owner's physical 1,000-particle test: "Smooth; typing works". This covers five normal-blend layers, not arbitrary high-density advanced-blend scenes. The verified package and restoration result are recorded in verification/native-particles-sprite-physical-result.json.
- Native text now prepares individual glyph lines and reflows them as box width/height change, including alignment and fit-to-width. The animated text fixture compiled, cooked, and passed visual runtime inspection at small and expanded dimensions for left/top, centered, and right/bottom layouts. Captures are StudioText-small.png and StudioText-large.png in the work folder from verification/native-text-reflow-result.json.
- Fixed repeated import of an identical texture: layers sharing a content hash reuse the imported texture rather than failing the second import.
- No public app release has been made. Native collection/game parity, beat sources, advanced-blend hardware checks and the final installed workflow remain open.
- Wave, aurora, plasma, rings/ripples, perspective grid, nebula and meteor templates now implement more of their editable size, density, seed and motion settings. The eight-layer fixture compiled and cooked for Android after fixing a GLSL reserved-name error. All eight regions passed native runtime key-reaction image comparisons (verification/native-patterns-render-results.json). These changes are not a claim that every parameter on every layer is complete.
- The first advanced-blend hardware check was inconclusive/failing: the owner saw the outer panels pulse but not the two middle panels. All four regions changed in the desktop runtime capture. A stronger-contrast test is being prepared; hardware blend verification remains open.
- Build validation revision 4 requires rebuilding old creator artifacts so the corrected particle and text translation is used. Existing separately imported skin files are unaffected.
- Latest checks: 230 Studio tests, 17 native translation checks, and 166 core app tests pass. The local preview server restart was rejected by automatic approval review; its cached backend modules may remain older than these filesystem changes.
- Higher-contrast blending test passed on the physical keyboard: the owner confirmed "All four pulse smoothly" for Screen, Overlay, Soft light and Multiply. Evidence is in verification/native-composite-strong-physical-result.json. The first test's low-contrast middle-panel motion was inconclusive; the stronger result does not verify arbitrary complex blended scenes. Flames and Koi were restored afterward.

## September 13 native game verification
- Cloud courier and Dune runner now generate native Engine Blueprint gameplay for start, flap/jump, collision and restart, with native material game surfaces. Both pass runtime state checks and Android package validation; these are not yet physical-gameplay approvals. Cloud courier also passes a single-obstacle score-once test.
- Runtime image captures are saved under the work folders in verification/native-games-results.json. Visual parity with the browser games remains unfinished; Dune runner HUD visibility needs investigation.
- Source cache fingerprints now cover included .inl files so game code changes cannot reuse stale compiled editor tools. Two cache regression tests and all twelve browser-game tests pass.
- Cloud courier physical test: flap and restart worked, but owner reported lag. The test is not a performance pass. Flames slot 5 and active Koi slot 4 were restored. A revised build packs seventeen scalar material writes into three vector writes per frame; performance retesting is pending.
- Packed material updates did not resolve physical Cloud courier lag; restart still worked. This second failed performance result is recorded separately in verification/native-cloud-game-packed-physical-result.json. Restored Flames/Koi again. Cloud courier now has an experimental batched 37-quad renderer; compiled and cooked successfully, but physical smoothness is not yet verified.
- Cloud courier batched sprite renderer passed physical smoothness: owner reported "it works smoothly". Exact artifact hash and restoration are in verification/native-cloud-game-sprite-physical-result.json. Cloud courier is now included in the native source inventory; this does not certify advanced blend combinations or equivalence to every browser-game visual.
- Dune runner now uses batched sprite geometry too. Its score display is visible in the latest native runtime captures; both games pass key-reaction and score-visibility image checks in verification/native-games-render-results.json. Physical Dune runner check is pending.
- Dune runner passed the physical check: owner answered "YES WORKS SMOOTHYL" to the jumping, score and smoothness check. Exact artifact and restoration are in verification/native-dune-game-sprite-physical-result.json. Flames slot 5 and active Koi slot 4 are restored; the installed Companion is running in the background. Dune runner is included in the native source inventory. Prism breaker remains unfinished.

### Native completion pass — September 13

- Prism breaker now compiles to Engine/SkinApi assets and passes automatic serve, paddle, brick scoring, three-life, restart and win checks. Owner reported “works smoothly” on the physical keyboard. Flames restored and Koi reselected.
- The exact Storm meadow project that hit STUDIO_BUILD_SOURCE now compiles, cooks and passes package checks. Upload and restoration also completed through the refreshed Companion UI at localhost:41738.
- Build lookup is bound to the complete scene hash. Missing source includes are reported before compilation. Export inventories refresh for each build to avoid mixed source versions during local development.
- Active Companion slot reuse retains the XPANEL baseline and has switching/failure/restoration regression coverage.
- Orbit satellite rendering passed the physical motion and key-pulse check (owner: “yes its smooth”). The 210-sprite package and restoration are recorded in verification/native-orbit-physical-result.json.
- Heatmap key response and fading passed the revised physical performance check (owner: “works smoothly now”). The initial full-surface implementation was laggy; the verified build uses 80 cell quads and resolves cell history in the vertex shader. Build 7014702d-c0ba-4314-8089-66d1b61621e7 was tested, then Flames was restored and Koi reselected. This verifies the tested normal-blend heatmap, not every advanced blend combination.
- Remaining collection scene translations and beat input are still in progress. This is not a public release.
- Tidal observatory now uses the editable native layer pipeline, including the imported photographic background and per-key reaction rules. The first physical test exposed invisible reactions on transparent surfaces. Corrected reaction opacity and stronger moving water highlights were tested in build 4f4ad26a-e711-4f83-8bd5-66662ca03007; the owner confirmed visible ripples and idle movement. Flames was restored and Koi reselected. Remaining collection scenes still require their own translations and checks.
