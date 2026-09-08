const test = require('node:test');
const assert = require('node:assert/strict');
const { identify } = require('../src/device.cjs');
const plugins = require('../src/plugins/index.cjs');
const { MediaBridge } = require('../src/media.cjs');
const { PluginNavigation } = require('../src/navigation.cjs');
test('plugin navigation ignores arrows when inactive and wraps when active', () => {
  const nav = new PluginNavigation(plugins.list());
  assert.equal(nav.move('Down').id, 'previous');
  nav.active = true;
  assert.equal(nav.move('Up').id, 'next');
  assert.equal(nav.move('Down').id, 'previous');
  assert.equal(nav.move('Right').plugin, 'spotify');
});

test('ignores Finalmouse mice and protected typing collections', () => {
  const keyboard = { vendorId: 0x361d, productId: 0x200, usagePage: 0xff00, usage: 1 };
  assert.deepEqual(identify([{ ...keyboard, productId: 0x100 }, { ...keyboard, usagePage: 1, usage: 6 }, keyboard]), { keyboard, display: undefined });
});
test('dispatches a registered plugin action once and propagates errors', async () => {
  const calls = []; const context = { media: { request: async action => { calls.push(action); throw new Error('Spotify unavailable'); } } };
  await assert.rejects(plugins.execute('spotify', 'next', context), /Spotify unavailable/);
  assert.deepEqual(calls, ['next']);
});
test('rejects unknown plugins and actions before accessing media', async () => {
  await assert.rejects(plugins.execute('missing', 'next', {}), /not installed/);
  await assert.rejects(plugins.execute('spotify', 'shell', {}), /Unknown/);
  const media = new MediaBridge(); await assert.rejects(media.request('shell'), /Unknown/); assert.equal(media.process, null);
});
