# Native compatibility is not verified

| Part | Status |
| --- | --- |
| Editable Skin Studio JSON and browser preview | Local application implementation; see its automated and UI checks |
| Community Unreal C++ importer and Canvas runtime | Source provided; Unreal compilation and native execution not performed here |
| Unreal 4.27 | Primary source target suggested by observed sample metadata |
| Unreal 5.x | Source portability path only; requires a selected engine version and rebuild |
| Host reflected SkinApi signatures and input delegate | Documented by community reverse engineering; device runtime binding unverified here |
| Cooked native keyboard .pak | Not produced by this source exporter |
| Fish objects, drift/swim/orbit motion and proximity-flee rules | Browser preview only; native implementation still required |

Read-only inspection of the user-provided `Koi.pak` found PAK version 11, 1,841 indexed paths and matching SHA-1 values for its primary, path-hash and directory indexes. Literal metadata identified EngineAssociation `4.27` and module `spark`. Indexed paths included `M_EntryPoint`, `M_Koi`, `BP_KoiInteractionController` and `GLSL_ES3_1_ANDROID`. These clues do not reveal class inheritance, native event signatures, required cooked assets, device architecture, a proprietary engine fork, or the packaging contract. The sample's contents were never executed, and no sample assets are copied into the SDK or presets.

PAK format version is a container property, not proof of an exact engine version. SHA-1 checks here detect accidental index corruption; they are not publisher authentication or a safety audit. The [official FPakInfo documentation](https://dev.epicgames.com/documentation/unreal-engine/API/Runtime/PakFile/FPakInfo) describes the index offset, length and hash. The independent [repak parser source](https://github.com/trumank/repak/blob/master/repak/src/pak.rs) documents the v11 index layout used to inform this read-only inspector. No code or skin assets from that project are vendored.

A valid next validation step is to compile this source in a separately installed 4.27 editor, run its native tests, and establish an officially supported or otherwise verified native loading contract. Packaging a ZIP or JSON file under a `.pak` name would not satisfy that requirement and is intentionally not offered.

The separate `Device/` source target follows the documented `/Game/map/M_EntryPoint` and chunk-1337 Android ASTC convention. It declares only the known SkinApi reflection surface, with an editor-only graph generator. The actor runtime in `Unreal/` remains desktop-preview source and is not a dependency of generated device Blueprint assets. No device generator or cook has run here. See `Device/README.md` for evidence, limits and the required verification sequence.
