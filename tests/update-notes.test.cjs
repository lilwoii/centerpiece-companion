const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { UpdateNotes } = require('../src/update-notes.cjs');
const notes = { '1.0.1': ['First change.', 'Second change.'], '1.0.2': ['Next release.'] };

function directory(t) {
  const value = fs.mkdtempSync(path.join(os.tmpdir(), 'centerpiece-update-notes-test-'));
  t.after(() => { for (const name of fs.readdirSync(value)) fs.unlinkSync(path.join(value, name)); fs.rmdirSync(value); });
  return value;
}

test('the release being built includes its own update notes', t => {
  const version = require('../package.json').version;
  const current = new UpdateNotes({ directory: directory(t), version });
  assert.ok(current.view(), `Add bundled update notes for ${version} before publishing.`);
});

test('dismissal persists only for the installed version and the next update shows its own notes', t => {
  const options = { directory: directory(t), version: '1.0.1', notes };
  const first = new UpdateNotes(options);
  assert.deepEqual(first.view(), { version: '1.0.1', items: notes['1.0.1'] });
  first.view().items.push('A renderer cannot mutate bundled notes.');
  assert.equal(first.view().items.length, 2);
  assert.equal(first.dismiss('1.0.1'), null);
  assert.equal(new UpdateNotes(options).view(), null);
  assert.deepEqual(new UpdateNotes({ ...options, version: '1.0.2' }).view(), { version: '1.0.2', items: notes['1.0.2'] });
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(options.directory, 'update-notes.json'), 'utf8')), { dismissedVersion: '1.0.1' });
});

test('opening in the tray and reading state never marks notes as read', t => {
  const options = { directory: directory(t), version: '1.0.1', notes };
  const background = new UpdateNotes(options);
  for (let i = 0; i < 5; i++) assert.ok(background.view());
  assert.deepEqual(fs.readdirSync(options.directory), []);
  assert.ok(new UpdateNotes(options).view());
});

test('failed persistence retains visible notes and the previous saved preference', t => {
  const dir = directory(t), file = path.join(dir, 'update-notes.json');
  fs.writeFileSync(file, JSON.stringify({ dismissedVersion: '1.0.0' }));
  const brokenIo = { ...fs, renameSync() { throw new Error('Test disk failure'); } };
  const value = new UpdateNotes({ directory: dir, version: '1.0.1', notes, io: brokenIo });
  assert.throws(() => value.dismiss('1.0.1'), /Could not save your update-note preference/);
  assert.ok(value.view());
  assert.deepEqual(fs.readdirSync(dir), ['update-notes.json']);
  assert.equal(JSON.parse(fs.readFileSync(file, 'utf8')).dismissedVersion, '1.0.0');
});

test('foreign dismissals are rejected and absent release data never shows another version', t => {
  const dir = directory(t), value = new UpdateNotes({ directory: dir, version: '1.0.1', notes });
  for (const foreign of ['1.0.2', '../settings.json', null, {}, 1]) assert.throws(() => value.dismiss(foreign), /no longer current/);
  assert.deepEqual(fs.readdirSync(dir), []);
  assert.equal(new UpdateNotes({ directory: dir, version: '1.0.3', notes }).view(), null);
  assert.equal(new UpdateNotes({ directory: dir, version: '1.0.1', notes: { '1.0.1': [''] } }).view(), null);
});

test('damaged preferences do not block launch or hide the current release', t => {
  const dir = directory(t), file = path.join(dir, 'update-notes.json');
  for (const content of ['{incomplete', 'null', JSON.stringify({ dismissedVersion: false }), 'x'.repeat(5000)]) {
    fs.writeFileSync(file, content);
    const value = new UpdateNotes({ directory: dir, version: '1.0.1', notes });
    assert.ok(value.view());
  }
});
