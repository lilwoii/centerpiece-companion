const { test } = require('node:test');
const assert = require('node:assert/strict');
const { sourceFingerprint } = require('../src/studio-native-tools.cjs');

test('native cache invalidates when included game Blueprint source changes', () => {
  const file = 'Device/Plugins/SkinStudioDeviceBuilder/Source/Private/GameBlueprintLogic.inl';
  const bundle = content => ({ files: [{ path: file, content }] });
  assert.notEqual(sourceFingerprint(bundle('before')), sourceFingerprint(bundle('after')));
});

test('native cache fingerprint is independent of export file order', () => {
  const files = [
    { path: 'Device/Plugins/Example/Source/Main.cpp', content: 'main' },
    { path: 'Device/Plugins/Example/Source/Game.inl', content: 'game' },
  ];
  assert.equal(sourceFingerprint({ files }), sourceFingerprint({ files: [...files].reverse() }));
});
