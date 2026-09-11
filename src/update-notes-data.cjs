// Ship a matching entry with every release. Text is bundled with the app, never downloaded as HTML.
module.exports = Object.freeze({
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
