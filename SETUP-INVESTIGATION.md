# Setup blocked by a pending-changes report

## Confirmed findings

The old “Save or discard XPANEL edits before setup” message came from a true `checkUnsavedChanges` response. The companion did not inspect XPANEL's UI or establish who changed a setting. The wording therefore attributed the flag to XPANEL without sufficient evidence.

The public XPANEL remapping bundle inspected during this investigation defines the same boolean protocol field. Its runtime remapping helpers read keymaps/layouts and save changes, but the references to `checkUnsavedChanges` in this bundle are protocol definitions rather than calls to query that flag. A clean XPANEL editor is not an independent verification that the flag is false. This observation is specific to the inspected bundle, not a claim about every XPANEL component or future release. [Published remapping bundle](https://xpanel.finalmouse.com/_app/immutable/nodes/34.zJgB-e2x.js).

The upstream ZMK handler combines pending physical-layout selection and pending keymap state into one boolean. It does not say that the user edited a key binding. This establishes protocol semantics; it does not prove which condition exists in Finalmouse's firmware or on the affected keyboard. [Upstream handler](https://github.com/zmkfirmware/zmk/blob/main/app/src/studio/keymap_subsystem.c).

The companion's Studio clients also reused request IDs starting at 1 while subscribing to a shared HID reader. Concurrent clients could accept each other's same-ID responses; delayed responses could also match a subsequently opened client. Preview 18 allocates IDs across clients and validates the expected reply subsystem/method. An isolated test sends replies out of order to two clients and verifies that each receives its own boolean result.

## What Preview 18 changes

- Removes the unsupported assumption that a pending flag means XPANEL edits.
- Preserves the setup stop when the flag is true, and rejects missing/malformed pending status.
- Fixes per-client request-ID reuse and rejects mismatched response types.
- Adds **Check setup** and **Copy setup report**. Queries are read-only, with three pending samples and two keymap reads to detect changing state. Reports contain firmware/app versions, interface presence, layout/key counts, compatibility summaries and query error codes.
- Reports exclude serial numbers, binding contents, layer names, account data and paths. Keymap hashes are compared internally and are not exported. Nothing is sent automatically.
- Separates “Keyboard connected · Setup required” from “Keyboard ready” after display initialization.

## Still unconfirmed

We do not have a response capture from the affected community user's PC. The request-ID defect is real but has not been established as the cause of this user's persistent warning. A consistently true flag, a transient/routed response or a firmware-specific issue must be distinguished using the report. The update does not clear the flag by saving/discarding unknown settings, and does not claim to repair a firmware defect.

Ask the affected user to update in-app, retry setup once, and if blocked choose **Check setup → Copy setup report**. A factory reset or repeated reinstall is not a diagnostic substitute.

## Verification

80 automated tests pass, including concurrent request routing, fail-closed status validation and sanitized read-only reports. Isolated desktop checks exercise Check setup, report display, copy and hide controls alongside the existing regression flows. No live keyboard writes or third-party account mutations were used for this investigation. The affected keyboard still needs to supply its report.
