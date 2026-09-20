# Skin Studio community source SDK

This is an original, local Unreal source project and plugin. It imports Skin Studio scenes, evaluates animation keyframes, exposes interaction events to Blueprints, and includes a Canvas-based desktop preview. The desktop preview is separate from the experimental `Device/` generator, which targets the community-documented reflected SkinApi contract. The device path is source only and has not been compiled or loaded on hardware. No third-party skin assets are included.

Community SDK code uses the repository's MIT license, included in `LICENSE`. Unreal Engine itself remains subject to Epic's terms.

**Build status: not compiled or tested in Unreal on this PC. Hardware compatibility: unverified.** No usable Unreal Editor installation was found in the checked Epic Launcher installation list, standard engine folders, or the registered engine location. The JavaScript exporter and PAK metadata inspector have separate local automated tests; those are not Unreal build tests.

## Open an exported scene in Unreal

1. Extract the source ZIP into a new local directory. Keep its `Unreal`, `project`, and documentation folders together.
2. Use Unreal Engine **4.27** and its supported C++ build tools. Generate project files for `Unreal/SkinStudioPreview.uproject`, then build the `SkinStudioPreviewEditor` target for Development Editor / Win64. Epic documents [C++ plugin projects](https://dev.epicgames.com/documentation/en-us/unreal-engine/plugins?application_version=4.27).
3. Open that `.uproject`. Create an empty level and save it as `Content/Preview/M_Studio`. The project sets `SkinStudioGameMode` as its default game mode; select it in World Settings if a map overrides that setting.
4. Play in a new editor window. The bundled scene is read from `Content/Studio/Scene.json`, then displayed at a 1920 × 550 aspect ratio. The JSON is the same editable scene exported by the browser studio.
5. Use **A**, **Space**, or click inside the preview to exercise matching rules. **B** generates a synthetic beat. **Caps Lock** toggles a local test state; this is not firmware state. The focused preview now forwards letters, digits, arrows, punctuation, modifiers and function keys. This is not a global keyboard hook.
6. In Blueprints, add `SkinStudioRuntime`, call `Load Project Json`, then call `Notify Input` with `keyDown`, `keyUp`, `pointer`, `beat`, or `caps`. Use browser-style key names such as `KeyA` or `Space`. Coordinates are in the 1920 × 550 scene. Existing applications can call this API from their own event source.
7. `Evaluate Layers`, `Get Active Effects`, `Get Elapsed Seconds`, `Seek`, and `Draw To Canvas` are Blueprint-callable entry points for a custom renderer, material bridge, or render target. Compute effect age as elapsed seconds minus `StartedAt`; this clock does not wrap when the animation loops. The sample HUD calls `Draw To Canvas`; the sample controller forwards only its focused preview actions.

The native preview renders solids, gradients, text, a wave and grid, plus lightweight approximations of the particle/weather/orbit families. It interpolates all seven transform properties and handles rule matching, pulse, toggle, flash and expanding effects. Browser shader-like effects, exact particle trajectories, advanced blend modes, text rotation, image decoding and target clipping are **not pixel-identical native implementations**. Embedded images remain in the source JSON and are additionally exported as deduplicated files in `project/images/`. `project/image-manifest.json` maps each file to its layer IDs and SHA-256 hash. Import these files into Unreal Content Browser as textures for a custom renderer. Desktop font face, weight and alignment remain in JSON; the sample native renderer uses its default Unreal font. `PreviewWarnings` exposes these limitations. The browser studio remains the authoritative visual preview.

## Runtime API and limits

The runtime imports a bounded JSON document without evaluating expressions, accessing arbitrary paths, making network requests, running commands or capturing global keys. Reimporting malformed JSON leaves the previous scene in memory. The bundled-file loader reads only `Content/Studio/Scene.json`. Scenes are limited to 48 layers, 96 rules, 256 keyframes per layer / 2,048 total, and 32 MiB of JSON. At most 128 effect events are retained; events expire. A `toggle` persists until the next matching trigger or scene reload.

The original project JSON retains all properties for future renderers. `FStudioLayerFrame` is a small, Blueprint-visible evaluated representation. `FStudioEffectEvent` is the event bridge. These names belong to this community plugin; they are not claimed to be Finalmouse API names.

## Testing after installing an engine

Compile the plugin and run `Community.SkinStudio.ImportAndEvents` from Unreal's Session Frontend / Automation tools. The supplied native test checks import rejection, numeric/type bounds, base-to-first-key interpolation, destination easing, timeline endpoints, key filtering, zero-strength events, toggle parity, event bounds and preservation after a failed reimport. These tests are provided as source and have **not been run here**. Then compare every effect you use against the browser preview, verify input focus and profile the native renderer.

## UE5 source portability

For a scene targeting `5.x`, the exporter leaves EngineAssociation empty so you can select a specific locally installed UE5 version. Generate project files and rebuild from source. The plugin uses common runtime, JSON, Canvas and legacy Input APIs; it deliberately avoids a dependency on Enhanced Input. This is a portability starting point, not a successful UE5 build claim. UE5 changes to Canvas/vector APIs or toolchain requirements may require adaptation. UE5 cooked assets are not assumed compatible with a keyboard runtime associated with 4.27.

## Before any native keyboard installation

Read `COMPATIBILITY.md`. Establish the actual entry map, native class/Blueprint contracts, event mapping, engine fork, Android architecture, graphics feature level, cooker/compression settings, signing and loading behavior. A standalone plugin module cannot simply be added to an existing cooked game unless its runtime supports that module. A .pak container with the correct extension is not enough. This SDK exports source only and performs no keyboard uploads.

Useful official references: [Unreal plugin structure](https://dev.epicgames.com/documentation/en-us/unreal-engine/plugins?application_version=4.27), [4.27 Canvas tile constructors and rotation](https://dev.epicgames.com/documentation/en-us/unreal-engine/API/Runtime/Engine/FCanvasTileItem?application_version=4.27), [4.27 JSON object-field API](https://dev.epicgames.com/documentation/en-us/unreal-engine/API/Runtime/Json/Dom/FJsonObject/TryGetObjectField?application_version=4.27), [4.27 action bindings](https://dev.epicgames.com/documentation/en-us/unreal-engine/API/Runtime/Engine/Components/UInputComponent/BindAction?application_version=4.27), [PAK index metadata](https://dev.epicgames.com/documentation/unreal-engine/API/Runtime/PakFile/FPakInfo).

## Original collection scenes and device asset path

The eleven collection scene IDs now have original native 3D source assemblies with a camera, lights, primitive geometry and event-driven animation in `SkinStudioCollectionScene`. The first collection layer selects the scene. These assemblies are separate interpretations of the browser designs, not verified photographic visual parity; only the first collection layer drives this native preview. Native default materials, lighting, cropping, image backgrounds and performance require editor verification.

`Device/README.md` describes the separate Blueprint-only runtime path. Its editor-only generator creates engine-owned assets and binds the host SkinApi key delegate without putting our custom C++ scene actor in a device .pak. This path is deliberately experimental: it still needs compile/generate/cook/load tests and additional interaction parity. It performs no hardware writes.
