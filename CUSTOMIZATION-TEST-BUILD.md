# Community customization — local test build

This branch is not published. Start the side preview with `npm run preview:customization`, then open http://127.0.0.1:41737. It uses sample readings and separate browser storage; Apply saves only this preview. The installed companion and keyboard are untouched.

## Try it

- Plugin library: select a position, choose a real plugin or Custom tile, then edit its text, emoji or image. PNG, JPEG and WebP imports become local PNG assets. Apply with Add to keyboard. Existing weather, CPU, GPU and clock entries can fill individual positions.
- Strip colors & bottom hint: set global colors, per-tile colors, breathing/cycling backgrounds, or hide/replace the default shortcut hint. Restore defaults resets this appearance group.
- Keyboard editor: enable Caps Lock color, select Small dot and a placement. Preview Caps Lock on simulates its state. Whole-key fill remains the default.
- Screen widgets: choose Calendar for a full-area month view with weekday heading and today marked red. Custom text supports font, size, color, alignment, insets and bold. Weather temperature units offers Automatic, Celsius and Fahrenheit.

Automatic temperature units use the operating system regional locale, not the private Windows Weather app. Existing explicit choices are preserved. Actual sensor temperatures still require a supported sensor connection.

## Verification

151 unit tests pass, including defaults/migration, PNG rejection, escaped text, dot bounds, calendar dates, stable navigation frames and profile text styling. Syntax checks pass. Strict UI static audit reports zero findings. Browser checks confirm emoji saving, calendar rendering, custom text style persistence, Celsius persistence and Caps dot persistence at the narrow side-panel size.

No keyboard upload, installer, public release or update feed was run. Actual hardware upload timing, animated colors and native font rendering still need acceptance testing before release. The Unreal Skin Studio remains in its separate local worktree.

Calendar detail previews render vector artwork at 2x display density instead of enlarging native keyboard pixels. Calendar is present before initial settings load so its saved selection survives reopening. This improves desktop preview clarity without changing hardware frame size.
