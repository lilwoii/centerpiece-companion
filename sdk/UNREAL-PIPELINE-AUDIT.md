# Unreal installation and source pipeline audit

Local check on 2026-09-12 found Epic Games Launcher registered on M:, and an empty completed-engine installation manifest. No completed Unreal Editor or Android toolchain was detected at that check. Installation in progress is not reported as a working cooker.

The detector now reads Epic's manifest, registered engines and custom source build paths, validates Build.version plus Editor/RunUAT files, inventories 4.27 and UE5 separately, coalesces simultaneous requests and refreshes its cache after four seconds. Missing SDK/NDK/Java are described separately. The launcher action has only two fixed destinations (Epic's local library URI and official HTTPS download page); it never launches a path supplied by a scene or renderer.

The source export has two paths:

- `Unreal/`: existing desktop preview plus original procedural 3D assemblies for all eleven collection IDs. Each has scene-specific object geometry and key-driven movement. These sources still require a real compile, material/lighting comparison and performance profiling. Imported photographic images and browser key-mask rendering are not automatically implemented in the desktop Canvas/3D runtime.
- `Device/`: new 4.27 Blueprint-only runtime asset generator with an Editor-only C++ graph builder, exact community SkinApi reflection declarations, texture/material imports, entry map and chunk-1337 preparation. This is the first device-specific export path; it is not a finished native equivalent of every browser scene. A global key press material reaction and Atlas launch are generated as an initial interaction bridge. Cooked package loading and input must be verified before publication.

No Unreal license was accepted, no installer was invoked, no engine or third-party skin content was bundled, and no device package was uploaded by this work. JavaScript validation and source inventory checks do not establish that the Unreal C++/Python code compiles or runs. The material generator and reflected Blueprint pin layout have not been exercised by an Unreal editor here.

For collection scenes without embedded photographic layers, the export includes a labeled static original-preset image as the device generator's visible fallback. It is not a capture of current edits or a native animation. The image manifest identifies these references, and the generator records their layer IDs in its report.
