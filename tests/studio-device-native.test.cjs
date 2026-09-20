const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

test('native source translation validation (Python, without claiming an Unreal build)', () => {
  const result = spawnSync(process.env.STUDIO_TEST_PYTHON || 'python', [path.join(__dirname, 'studio-device-materials.test.py')], { encoding: 'utf8', timeout: 30000, windowsHide: true });
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stderr, /Ran [1-9][0-9]* tests/);
});
