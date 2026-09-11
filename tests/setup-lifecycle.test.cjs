const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { DisplayTasks } = require('../src/display-tasks.cjs');

// Evaluate only the coordination functions with fake services. Loading the main
// module would open Electron, accounts and HID, which these tests must never do.
const source = fs.readFileSync(require.resolve('../src/main.cjs'), 'utf8');
function section(from, to) {
  const start = source.indexOf(from), end = source.indexOf(to, start);
  assert.ok(start >= 0 && end > start, 'Main-process coordination entry points must exist.');
  return source.slice(start, end);
}
function deferred() { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; }

function fixture({ sample = async () => {}, appearance = async () => {}, inspect = async () => ({ keyboard: true, display: true }), start } = {}) {
  const events = [], handlers = {}, state = { device: {}, strip: false }, context = {
    Promise, Error, state, setupBusy: false, setupPlan: null, setupFinished: Promise.resolve(), setupReview: null,
    quitting: false, automaticSetupSuspended: false, automaticCheckBusy: false, automaticSetupTimer: 1,
    profileTimer: null, timer: null, stripTimer: null, lockTimer: null, liveTimer: null, modeTimeout: null,
    hardwareDirectory: 'test-only', widgetShortcutReady: true, appliedAppearance: '',
    clearInterval() { events.push('clear-timer'); }, clearTimeout() {},
    desk: { editor: { busy: false }, live: { sample }, close() { assert.equal(state.setupRunning, false); events.push('desk-close'); } },
    strip: { connect() { events.push('connect'); return true; }, async close() { events.push('strip-close'); } },
    monitor: { start() { events.push('monitor-start'); }, close() { events.push('monitor-close'); } },
    media: { close() { events.push('media-close'); } }, mediaPoll: null, community: null, twitch: null, widgetCycle: null,
    globalShortcut: { unregisterAll() { events.push('unregister'); } },
    displayTasks: new DisplayTasks({}), syncAppearance: async () => { events.push('appearance'); return appearance(); },
    send() {}, handle(name, fn) { handlers[name] = fn; }, inspectDevice: inspect,
    win: { isVisible: () => true, isMinimized: () => false, webContents: { send() { events.push('review-event'); } } },
    automaticSetup: { canAttempt: () => true, async run({ eligible, setup }) { if (!eligible) return { attempted: false }; events.push('automatic-attempt'); return { attempted: true, result: await setup() }; } },
    require(name) {
      if (name === './keyboard-errors.cjs') return require('../src/keyboard-errors.cjs');
      if (name === './hid.cjs') return { async shutdown() { events.push('hid-close'); } };
      if (name === './setup-transaction.cjs') return { startSetup: start || (async () => ({ needsConfirmation: true, plan: { id: 'review', pending: true, map: { layers: [] }, ownedSlots: [3, 4], preservedSlots: [2] } })) };
      throw Error('Unexpected dependency: ' + name);
    }
  };
  vm.createContext(context);
  const suspension = section('function suspendAutomaticSetup()', '\nconst updateNotes');
  const operations = section('    const setupReview=plan=>', "    handle('restore-keyboard'");
  const discovery = section('      async function tryAutomaticSetup()', '      if(!automaticSetupSuspended&&automaticSetup.canAttempt())');
  const cleanup = section("    quitting=true;clearInterval(automaticSetupTimer);", "  },()=>app.quit(),error=>");
  vm.runInContext(suspension + '\n' + operations + '\n' + discovery + '\nthis.lifecycle={setupOperation,tryAutomaticSetup,cleanup:async()=>{' + cleanup + '}};', context);
  return { context, events, handlers, state, ...context.lifecycle };
}

test('quit waits for the setup transaction and never starts display initialization afterward', async () => {
  const transaction = deferred(), f = fixture();
  const setup = f.setupOperation(() => transaction.promise, true);
  const quit = f.cleanup();
  assert.equal(f.events.includes('desk-close'), false);
  transaction.resolve({ verified: true });
  await Promise.all([setup, quit]);
  assert.equal(f.events.includes('connect'), false);
  assert.equal(f.events.includes('monitor-start'), false);
  assert.ok(f.events.indexOf('desk-close') < f.events.indexOf('hid-close'));
  await assert.rejects(f.setupOperation(async () => assert.fail('No setup after Quit.'), true), /companion is closing/);
});

test('quit during the live sample waits and does not queue display initialization', async () => {
  const reached = deferred(), sample = deferred(), f = fixture({ sample: () => { reached.resolve(); return sample.promise; } });
  const setup = f.setupOperation(async () => ({ verified: true }), true);
  await reached.promise;
  const quit = f.cleanup();
  assert.equal(f.events.includes('desk-close'), false);
  sample.resolve();
  await Promise.all([setup, quit]);
  assert.equal(f.events.includes('appearance'), false);
  assert.equal(f.events.includes('monitor-start'), false);
});

test('quit during display initialization waits for completion without restarting monitoring', async () => {
  const reached = deferred(), appearance = deferred(), f = fixture({ appearance: () => { reached.resolve(); return appearance.promise; } });
  const setup = f.setupOperation(async () => ({ verified: true }), true);
  await reached.promise;
  const quit = f.cleanup();
  assert.equal(f.events.includes('desk-close'), false);
  appearance.resolve();
  await Promise.all([setup, quit]);
  assert.equal(f.events.includes('monitor-start'), false);
  assert.ok(f.events.includes('strip-close'));
});

test('failed setup also releases the shutdown completion barrier', async () => {
  const transaction = deferred(), f = fixture(), failure = Error('Save failed');
  const setup = f.setupOperation(async () => { await transaction.promise; throw failure; }, true);
  const rejected = assert.rejects(setup, error => error === failure), quit = f.cleanup();
  transaction.resolve();
  await Promise.all([rejected, quit]);
  assert.ok(f.events.includes('hid-close'));
});

test('manual review cannot be replaced by automatic discovery already in progress', async () => {
  const discovery = deferred(), f = fixture({ inspect: () => discovery.promise });
  const automatic = f.tryAutomaticSetup();
  await f.handlers['setup-keyboard']();
  assert.equal(f.state.setupRecovery.token, 'review');
  assert.deepEqual(Array.from(f.state.setupRecovery.displaySlots), [3, 4]);
  assert.deepEqual(Array.from(f.state.setupRecovery.preservedOverlaySlots), [2]);
  discovery.resolve({ keyboard: true, display: true });
  await automatic;
  assert.equal(f.events.includes('automatic-attempt'), false);
  await f.handlers['cancel-setup-recovery']();
  await f.tryAutomaticSetup();
  assert.equal(f.state.setupRecovery, null);
  assert.equal(f.events.includes('review-event'), false);
  assert.equal(f.context.automaticSetupSuspended, true);
});

test('a prepared review blocks automatic inspection without replacing its token', async () => {
  const f = fixture({ inspect: async () => assert.fail('No discovery while reviewing settings.') });
  f.state.setupRecovery = { token: 'existing-review' };
  await f.tryAutomaticSetup();
  assert.equal(f.state.setupRecovery.token, 'existing-review');
  assert.equal(f.events.includes('automatic-attempt'), false);
});
