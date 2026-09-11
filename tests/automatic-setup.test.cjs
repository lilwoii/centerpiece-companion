const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { AutomaticSetup } = require('../src/automatic-setup.cjs');

function fixture(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'centerpiece-automatic-setup-'));
  const hardwareDirectory = path.join(directory, 'hardware');
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  return { directory, hardwareDirectory };
}

test('eligible first launch records its attempt before setup and only invokes once', async t => {
  const options = fixture(t), automatic = new AutomaticSetup(options);
  assert.equal(automatic.canAttempt(), true);
  let calls = 0;
  const setup = async () => {
    calls++;
    const marker = JSON.parse(fs.readFileSync(path.join(options.directory, 'automatic-setup-attempt.json'), 'utf8'));
    assert.equal(marker.format, 1);
    assert.equal(typeof marker.attemptedAt, 'string');
    return { keyboardReady: true };
  };
  assert.deepEqual(await automatic.run({ eligible: true, setup }), { attempted: true, result: { keyboardReady: true } });
  assert.equal(automatic.canAttempt(), false);
  assert.deepEqual(await automatic.run({ eligible: true, setup }), { attempted: false });
  assert.deepEqual(await new AutomaticSetup(options).run({ eligible: true, setup }), { attempted: false });
  assert.equal(calls, 1);
});

test('an absent device or other ineligible launch leaves first setup available', async t => {
  const options = fixture(t), automatic = new AutomaticSetup(options);
  let calls = 0;
  const setup = async () => { calls++; };
  assert.deepEqual(await automatic.run({ eligible: false, setup }), { attempted: false });
  assert.equal(automatic.canAttempt(), true);
  assert.deepEqual(fs.readdirSync(options.directory), []);
  assert.equal((await automatic.run({ eligible: true, setup })).attempted, true);
  assert.equal(calls, 1);
});

test('any existing hardware record skips automatic setup without creating an attempt', async t => {
  const options = fixture(t);
  fs.mkdirSync(options.hardwareDirectory);
  fs.writeFileSync(path.join(options.hardwareDirectory, 'hardware.json'), '{incomplete');
  assert.deepEqual(await new AutomaticSetup(options).run({ eligible: true, setup: async () => assert.fail('Existing hardware must not be changed automatically.') }), { attempted: false });
  assert.equal(fs.existsSync(path.join(options.directory, 'automatic-setup-attempt.json')), false);
});

test('a failed setup is never retried automatically, including after relaunch', async t => {
  const options = fixture(t), automatic = new AutomaticSetup(options);
  const failure = Object.assign(new Error('The keyboard did not respond.'), { code: 'STUDIO_TIMEOUT' });
  let calls = 0;
  const setup = async () => { calls++; throw failure; };
  await assert.rejects(automatic.run({ eligible: true, setup }), error => error === failure);
  assert.deepEqual(await automatic.run({ eligible: true, setup }), { attempted: false });
  assert.deepEqual(await new AutomaticSetup(options).run({ eligible: true, setup }), { attempted: false });
  assert.equal(calls, 1);
});

test('simultaneous calls and a second instance invoke the hardware action only once', async t => {
  const options = fixture(t), automatic = new AutomaticSetup(options);
  let release, calls = 0;
  const pending = new Promise(resolve => { release = resolve; });
  const setup = async () => { calls++; return pending; };
  const first = automatic.run({ eligible: true, setup });
  assert.equal(automatic.canAttempt(), false);
  assert.deepEqual(await automatic.run({ eligible: true, setup }), { attempted: false });
  assert.deepEqual(await new AutomaticSetup(options).run({ eligible: true, setup }), { attempted: false });
  release('complete');
  assert.deepEqual(await first, { attempted: true, result: 'complete' });
  assert.equal(calls, 1);
});

test('marker storage failures perform no setup and never expose private paths', async t => {
  for (const operation of ['mkdirSync', 'writeFileSync']) {
    const options = fixture(t), io = { ...fs, [operation]() { throw Object.assign(new Error('Access denied: C:\\PRIVATE-USER\\secret-path'), { code: 'EACCES' }); } };
    const automatic = new AutomaticSetup({ ...options, io });
    await assert.rejects(automatic.run({ eligible: true, setup: async () => assert.fail('No setup without a durable attempt marker.') }), error => {
      assert.equal(error.code, 'AUTOMATIC_SETUP_STORAGE_UNAVAILABLE');
      assert.match(error.message, /No keyboard settings were changed/);
      assert.doesNotMatch(error.message, /PRIVATE-USER|secret-path/);
      return true;
    });
  }
});

test('unreadable local state conservatively disables automatic discovery and setup', async t => {
  const options = fixture(t), io = { ...fs, lstatSync() { throw Object.assign(new Error('Private storage path'), { code: 'EACCES' }); } };
  const automatic = new AutomaticSetup({ ...options, io });
  assert.equal(automatic.canAttempt(), false);
  assert.deepEqual(await automatic.run({ eligible: true, setup: async () => assert.fail('Unreadable state must not authorize setup.') }), { attempted: false });
  assert.deepEqual(fs.readdirSync(options.directory), []);
});

test('corrupt, empty or previously existing markers conservatively skip setup', async t => {
  const options = fixture(t), marker = path.join(options.directory, 'automatic-setup-attempt.json');
  for (const value of ['', '{incomplete', 'null', '{"format":999}']) {
    fs.writeFileSync(marker, value);
    assert.deepEqual(await new AutomaticSetup(options).run({ eligible: true, setup: async () => assert.fail('An existing attempt must not be repeated.') }), { attempted: false });
    assert.equal(fs.readFileSync(marker, 'utf8'), value);
  }
});

test('an exclusive marker creation lost to another process skips setup', async t => {
  const options = fixture(t), io = { ...fs, writeFileSync() { throw Object.assign(new Error('Already created'), { code: 'EEXIST' }); } };
  assert.deepEqual(await new AutomaticSetup({ ...options, io }).run({ eligible: true, setup: async () => assert.fail('Only the marker owner may attempt setup.') }), { attempted: false });
});
