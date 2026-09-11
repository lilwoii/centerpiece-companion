const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {EventEmitter} = require('node:events');
const protobuf = require('protobufjs');
const helpers = require('../src/studio-response.cjs');
const src = path.resolve(__dirname, '../src');
const schema = protobuf.loadSync(path.join(src, 'proto/studio.proto'));
const Request = schema.lookupType('zmk.studio.Request');
const Response = schema.lookupType('zmk.studio.Response');
const pendingBody = {keymap: {checkUnsavedChanges: true}};
const device = {vendorId: 0x361d, productId: 0x200, usagePage: 0xff00, usage: 1, path: 'PRIVATE-PATH', serialNumber: 'PRIVATE-SERIAL'};

function fixture(options = {}) {
  const handles = [], writes = [], timers = new Map();
  let timerId = 0;
  class Handle extends EventEmitter {
    constructor() { super(); if (options.openError) throw options.openError; handles.push(this); }
    write(packet) { if (options.writeError) throw options.writeError; writes.push(Buffer.from(packet)); return packet.length; }
    close() { this.closed = true; if (options.closeError) throw options.closeError; }
  }
  const hid = {HID: Handle, devices() { if (options.discoveryError) throw options.discoveryError; return options.devices || [device]; }};
  const codec = options.encodeError ? {loadSync: () => ({lookupType: name => name === 'zmk.studio.Request' ? {verify: b => Request.verify(b), create: b => Request.create(b), encode() { throw options.encodeError; }} : Response})} : protobuf;
  const box = {module: {exports: {}}, Buffer, Promise, __dirname: src,
    require: name => name === './hid.cjs' ? hid : name === './studio-response.cjs' ? helpers : name === 'protobufjs' ? codec : require(name),
    setTimeout: (fn, ms) => { const id = ++timerId; timers.set(id, {fn, ms}); return id; }, clearTimeout: id => timers.delete(id)};
  vm.runInNewContext(fs.readFileSync(path.join(src, 'studio.cjs'), 'utf8'), box);
  function emitBytes(bytes) {
    const frame = [0xab];
    for (const byte of bytes) { if ([0xab, 0xac, 0xad].includes(byte)) frame.push(0xac); frame.push(byte); }
    frame.push(0xad);
    for (let n = 0; n < frame.length; n += 60) {
      const chunk = frame.slice(n, n + 60), packet = Buffer.alloc(64);
      packet[0] = 4; packet[1] = chunk.length + 2; packet[2] = 16;
      Buffer.from(chunk).copy(packet, 3);
      for (const handle of handles) if (!handle.closed) handle.emit('data', packet);
    }
  }
  return {Studio: box.module.exports.Studio, handles, writes, timers,
    emitBytes, emit: value => emitBytes(Response.encode(value).finish()),
    reply: (studio, body) => emitBytes(Response.encode({requestResponse: {requestId: studio.pending.id, ...body}}).finish()),
    expire: () => { const item = timers.values().next().value; assert.ok(item); assert.equal(item.ms, 4000); item.fn(); }};
}
function expected(code, stage = 'keymap.checkUnsavedChanges', firmwareCode) {
  return error => {
    assert.equal(error.code, code); assert.equal(error.stage, stage);
    assert.equal(typeof error.operation, 'string');
    if (firmwareCode !== undefined) assert.equal(error.firmwareCode, firmwareCode);
    assert.doesNotMatch(error.message, /PRIVATE-|[A-Z]:\\|\\\\\?\\|Save or discard XPANEL/i);
    return true;
  };
}

test('real firmware meta replies distinguish locked, unsupported RPC and firmware codec failures', async () => {
  const f = fixture(), studio = new f.Studio();
  const cases = [[0, 'STUDIO_META_ERROR', /protocol error/], [1, 'STUDIO_LOCKED', /access is locked/], [2, 'STUDIO_RPC_UNSUPPORTED', /does not support/], [3, 'STUDIO_FIRMWARE_DECODE_FAILED', /could not decode/], [4, 'STUDIO_FIRMWARE_ENCODE_FAILED', /could not encode/], [99, 'STUDIO_META_ERROR', /firmware code 99/]];
  try {
    for (const [number, code, message] of cases) {
      const request = studio.request(pendingBody);
      f.reply(studio, {meta: {simpleError: number}});
      await assert.rejects(request, error => { expected(code, undefined, number)(error); assert.match(error.message, message); return true; });
      assert.equal(f.timers.size, 0);
    }
  } finally { studio.close(); }
});

test('no-response and empty meta replies never become successful results', async () => {
  const f = fixture(), studio = new f.Studio();
  try {
    for (const meta of [{noResponse: true}, {noResponse: false}, {}]) {
      const request = studio.request(pendingBody);
      f.reply(studio, {meta});
      await assert.rejects(request, expected(Object.hasOwn(meta, 'noResponse') ? 'STUDIO_NO_RESPONSE' : 'STUDIO_INVALID_META_RESPONSE'));
    }
    assert.throws(() => helpers.validateResponse(pendingBody, {meta: {simpleError: 0, noResponse: true}}), expected('STUDIO_INVALID_META_RESPONSE'));
  } finally { studio.close(); }
});

test('false pending status and zero-valued success survive real protobuf framing; unrelated replies and notifications are ignored', async () => {
  const f = fixture(), studio = new f.Studio();
  try {
    const request = helpers.pendingChanges(studio), id = studio.pending.id;
    f.emit({notification: {keymap: {unsavedChangesStatusChanged: true}}});
    f.emit({notification: {core: {lockStateChanged: 0}}});
    f.emit({requestResponse: {requestId: id + 1, keymap: {checkUnsavedChanges: true}}});
    assert.equal(studio.pending.id, id);
    f.reply(studio, {keymap: {checkUnsavedChanges: false}});
    assert.equal(await request, false);
    const write = studio.request({keymap: {setLayerBinding: {layerId: 1, keyPosition: 26, binding: {behaviorId: 50397, param1: 0x05070013}}}});
    f.reply(studio, {keymap: {setLayerBinding: 0}});
    assert.equal((await write).keymap.setLayerBinding, 0);
    const lock = studio.request({core: {getLockState: true}});
    f.reply(studio, {core: {getLockState: 0}});
    assert.equal((await lock).core.getLockState, 0);
  } finally { studio.close(); }
});

test('missing and wrong RPC results reject without allowing the setup pending check to pass', async () => {
  const f = fixture(), studio = new f.Studio();
  try {
    for (const reply of [{}, {keymap: {}}, {keymap: {getKeymap: {}}}, {core: {getLockState: 0}}]) {
      const request = studio.request(pendingBody); f.reply(studio, reply);
      await assert.rejects(request, expected('STUDIO_RESPONSE_MISMATCH'));
    }
    assert.throws(() => helpers.validateResponse(pendingBody, {keymap: {checkUnsavedChanges: false, getKeymap: {}}}), expected('STUDIO_RESPONSE_MISMATCH'));
    for (const value of [undefined, null, 0, 'false']) await assert.rejects(helpers.pendingChanges({request: async () => ({keymap: {checkUnsavedChanges: value}})}), expected('STUDIO_INVALID_PENDING_STATUS'));
  } finally { studio.close(); }
});

test('timeouts name the failed RPC and delayed replies cannot complete its next request', async () => {
  const f = fixture(), studio = new f.Studio();
  try {
    const request = studio.request({keymap: {saveChanges: true}}), previousId = studio.pending.id;
    f.expire();
    await assert.rejects(request, error => { expected('STUDIO_TIMEOUT', 'keymap.saveChanges')(error); assert.match(error.message, /Saving keyboard configuration.*4 seconds/); return true; });
    const next = studio.request(pendingBody), nextId = studio.pending.id;
    assert.notEqual(nextId, previousId);
    f.emit({requestResponse: {requestId: previousId, keymap: {saveChanges: {ok: true}}}});
    assert.equal(studio.pending.id, nextId);
    f.reply(studio, {keymap: {checkUnsavedChanges: false}});
    await next;
    assert.equal(f.timers.size, 0);
  } finally { studio.close(); }
});

test('busy clients retain the original request and closed clients cannot send new requests', async () => {
  const f = fixture(), studio = new f.Studio();
  const request = studio.request(pendingBody), originalId = studio.pending.id;
  await assert.rejects(studio.request({keymap: {getKeymap: true}}), expected('STUDIO_BUSY', 'keymap.getKeymap'));
  assert.equal(studio.pending.id, originalId); assert.equal(f.writes.length, 1);
  studio.close(); studio.close();
  await assert.rejects(request, expected('STUDIO_CLOSED'));
  await assert.rejects(studio.request(pendingBody), expected('STUDIO_CLOSED'));
  assert.equal(f.writes.length, 1); assert.equal(f.timers.size, 0);
});

test('invalid requests and local encoding failures have distinct errors and send no USB packets', async () => {
  const f = fixture(), studio = new f.Studio();
  try {
    for (const body of [null, {}, {keymap: {unknownMethod: true}}, {keymap: {getKeymap: true, saveChanges: true}}, {keymap: {setLayerBinding: 'PRIVATE-PATH'}}]) {
      await assert.rejects(studio.request(body), error => { assert.equal(error.code, 'STUDIO_REQUEST_INVALID'); assert.doesNotMatch(error.message, /PRIVATE-/); return true; });
    }
    assert.equal(f.writes.length, 0); assert.equal(f.timers.size, 0);
  } finally { studio.close(); }
  const broken = fixture({encodeError: Error('PRIVATE-PATH encode failure')}), b = new broken.Studio();
  try { await assert.rejects(b.request(pendingBody), expected('STUDIO_ENCODE_FAILED')); assert.equal(broken.writes.length, 0); }
  finally { b.close(); }
});

test('invalid or oversized incoming messages fail with precise safe errors and release the request', async () => {
  const f = fixture(), studio = new f.Studio();
  try {
    const invalid = studio.request(pendingBody); f.emitBytes(Buffer.from([0xff]));
    await assert.rejects(invalid, expected('STUDIO_DECODE_FAILED'));
    const oversized = studio.request(pendingBody); f.emitBytes(Buffer.alloc(100001, 0));
    await assert.rejects(oversized, expected('STUDIO_RESPONSE_TOO_LARGE'));
    const next = studio.request(pendingBody); f.reply(studio, {keymap: {checkUnsavedChanges: false}});
    assert.equal((await next).keymap.checkUnsavedChanges, false); assert.equal(f.timers.size, 0);
  } finally { studio.close(); }
});

test('discovery distinguishes missing, duplicate inventory entries and multiple keyboards', () => {
  assert.throws(() => new (fixture({devices: []}).Studio)(), expected('STUDIO_NOT_CONNECTED', 'configuration'));
  assert.throws(() => new (fixture({devices: [device, {...device, path: 'PRIVATE-SECOND'}]}).Studio)(), expected('STUDIO_MULTIPLE_KEYBOARDS', 'configuration'));
  const f = fixture({devices: [device, {...device}]}), studio = new f.Studio();
  assert.equal(f.handles.length, 1); studio.close();
  assert.throws(() => new (fixture({discoveryError: Error('PRIVATE-PATH worker error')}).Studio)(), expected('STUDIO_DISCOVERY_FAILED', 'configuration'));
  assert.throws(() => new (fixture({openError: Error('PRIVATE-PATH open error')}).Studio)(), expected('STUDIO_OPEN_FAILED', 'configuration'));
  assert.throws(() => new (fixture({openError: Object.assign(Error('Access is denied PRIVATE-PATH'), {code: 'EPERM'})}).Studio)(), expected('STUDIO_ACCESS_DENIED', 'configuration'));
});

test('native write and read failures redact paths, distinguish access and disconnect errors, and do not leave requests pending', async () => {
  const denied = fixture({writeError: Object.assign(Error('PRIVATE-PATH'), {code: 'EACCES'})}), a = new denied.Studio();
  try { await assert.rejects(a.request(pendingBody), error => { expected('STUDIO_ACCESS_DENIED')(error); assert.equal(error.transportStage, 'write_request'); return true; }); assert.equal(denied.timers.size, 0); }
  finally { a.close(); }
  for (const [message, code] of [['USB connection interrupted. PRIVATE-SERIAL', 'STUDIO_DEVICE_UNAVAILABLE'], ['PRIVATE-PATH unexpected USB failure', 'STUDIO_IO_ERROR']]) {
    const f = fixture({closeError: Error('PRIVATE-PATH close')}), studio = new f.Studio();
    const request = studio.request(pendingBody); f.handles[0].emit('error', Error(message));
    await assert.rejects(request, expected(code));
    await assert.rejects(studio.request(pendingBody), expected(code));
    assert.equal(f.writes.length, 1); assert.equal(f.timers.size, 0);
    assert.doesNotThrow(() => studio.close());
  }
});
