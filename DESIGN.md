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

## Overview

This is a product surface for one Windows Centerpiece owner, with potential free sharing. English is the current language; no market-specific workflow is assumed. The brief prioritizes Spotify, then Stream Deck style actions. No prior application or sibling design exists.

The reference is a slate-colored studio transport controller. The signature is a stationary record paired with physical-looking shortcut keys. It is a visual cue, not album art or a fake keyboard preview. Avoid gaming RGB decorations, a marketplace full of nonfunctional buttons, and fake hardware connection claims.

## Colors

Runtime CSS in src/styles.css owns tokens and this file mirrors them. Each colors key maps directly to the same-named CSS custom property. Muted blue provides emphasis; success and error colors always accompany text. Dark theme is the default, as requested by the owner, with native forced-color fallbacks.

## Typography

Body uses Segoe UI; headings use Bahnschrift with Segoe UI fallback; shortcuts use Cascadia Mono with Consolas fallback. Local fonts prevent network dependency and late font swapping. Artist and track names accept Unicode and wrap at long words.

## Layout

Seven pages share a left sidebar: Plugin library, Keyboard editor, Screen widgets, Media controls, Connections, Feature requests and Community skins. Content scrolls naturally; the sidebar owns its own bounded scrollbar and becomes wrapped navigation below 740px. Four assignment controls sit beside a slim strip preview. Existing slate tokens and local fonts remain unchanged.

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
Window chrome is owned by the shared header and window-ui.js: a draggable dark surface excluding interactive controls, yellow minimize, green maximize/restore and red close-to-tray. Each color also has a distinct symbol and accessible name. Tray Quit stops live controls; Windows startup is opt-in.

## Community skin gallery

Use the existing dark surfaces and typography for a responsive preview grid, with original creator credits and clear download buttons. Keep XPANEL catalog listings visibly separate from owner-reviewed submissions. Native search, shared status messages and 24-item progressive disclosure keep all 69 entries accessible without a long initial image load.

The sidebar footer exposes Start with Windows as a native checkbox with a short status description. It uses existing text and accent tokens, is accessible from every page, and shares its setting with the tray menu.
