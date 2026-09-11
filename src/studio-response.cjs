const {randomInt} = require('node:crypto');
const {keyboardError} = require('./keyboard-errors.cjs');
let sequence = randomInt(1, 0x7fffffff);
// All Studio clients share the same HID reader. Request IDs must stay unique,
// including when a client closes before its delayed response arrives.
function nextRequestId() { sequence = (sequence + 1) >>> 0; if (!sequence) sequence = 1; return sequence; }

const operations = {
  core: {getDeviceInfo: 'Reading keyboard information', getLockState: 'Checking configuration access', lock: 'Locking configuration access', resetSettings: 'Resetting keyboard settings'},
  keymap: {getKeymap: 'Reading key assignments', setLayerBinding: 'Changing a key assignment', checkUnsavedChanges: 'Checking pending configuration changes', saveChanges: 'Saving keyboard configuration', discardChanges: 'Discarding pending configuration changes', getPhysicalLayouts: 'Reading the physical keyboard layout', setActivePhysicalLayout: 'Changing the physical keyboard layout', moveLayer: 'Moving a keyboard layer', addLayer: 'Adding a keyboard layer', removeLayer: 'Removing a keyboard layer', restoreLayer: 'Restoring a keyboard layer', setLayerProps: 'Changing keyboard layer properties'},
  behaviors: {listAllBehaviors: 'Reading supported key behaviors', getBehaviorDetails: 'Reading key behavior details'}
};
function requestInfo(body) {
  const subsystems = body && typeof body === 'object' ? Object.keys(body).filter(k => Object.hasOwn(operations, k)) : [];
  const subsystem = subsystems[0], value = subsystem && body[subsystem];
  const methods = value && typeof value === 'object' ? Object.keys(value) : [];
  const method = methods[0];
  if (subsystems.length !== 1 || methods.length !== 1 || !Object.hasOwn(operations[subsystem], method)) return null;
  return {subsystem, method, stage: `${subsystem}.${method}`, operation: operations[subsystem][method]};
}
function studioError(code, message, body, details = {}) {
  const info = requestInfo(body);
  return keyboardError(code, `${info ? `${info.operation}: ` : ''}${message}`, {stage: info?.stage || 'configuration', operation: info?.operation || 'Keyboard configuration', ...details});
}
function nativeError(error, body, stage = 'read_response') {
  // Native HID errors can contain the device path and serial. Classify locally;
  // never expose the original error or its cause in a shared setup report.
  const reason = `${error?.code || ''} ${error?.message || ''}`;
  if (/\b(?:EACCES|EPERM)\b|access (?:is )?denied|permission denied/i.test(reason)) return studioError('STUDIO_ACCESS_DENIED', 'Windows denied access to the keyboard configuration interface. Close other keyboard configuration connections and retry.', body, {transportStage: stage});
  if (/not (?:connected|found)|disconnected|unavailable|connection (?:closed|interrupted)|helper stopped|ENODEV|device.*removed/i.test(reason)) return studioError('STUDIO_DEVICE_UNAVAILABLE', 'the keyboard configuration connection became unavailable. Reconnect it in the app and retry.', body, {transportStage: stage});
  const code = stage === 'discover_devices' ? 'STUDIO_DISCOVERY_FAILED' : stage === 'open_configuration' ? 'STUDIO_OPEN_FAILED' : 'STUDIO_IO_ERROR';
  const message = stage === 'discover_devices' ? 'Windows could not list the keyboard configuration interface. Retry the connection.' : stage === 'open_configuration' ? 'Windows could not open the keyboard configuration interface. Close other keyboard configuration connections and retry.' : 'the USB configuration operation failed. Its result was not confirmed. Reconnect the keyboard in the app and retry.';
  return studioError(code, message, body, {transportStage: stage});
}
function validateResponse(body, response) {
  const info = requestInfo(body);
  if (!info) throw studioError('STUDIO_REQUEST_INVALID', 'the companion generated an invalid configuration request. Run Check setup and report this error.', body);
  if (response && Object.hasOwn(response, 'meta')) {
    const meta = response.meta;
    if (!meta || typeof meta !== 'object' || Object.keys(meta).length !== 1) throw studioError('STUDIO_INVALID_META_RESPONSE', 'the keyboard returned an incomplete protocol status instead of a result. Run Check setup.', body);
    if (Object.hasOwn(meta, 'noResponse') && typeof meta.noResponse === 'boolean') throw studioError('STUDIO_NO_RESPONSE', 'the firmware returned a no-response status instead of the required result. This operation was not confirmed. Run Check setup.', body);
    if (!Object.hasOwn(meta, 'simpleError') || !Number.isInteger(meta.simpleError)) throw studioError('STUDIO_INVALID_META_RESPONSE', 'the keyboard returned an invalid protocol status. Run Check setup.', body);
    const errors = {
      1: ['STUDIO_LOCKED', 'the keyboard reports configuration access is locked. Unlock configuration access using the keyboard’s supported controls, then retry.'],
      2: ['STUDIO_RPC_UNSUPPORTED', 'the keyboard firmware does not support this configuration operation. Run Check setup so its versions and unsupported operation can be reviewed.'],
      3: ['STUDIO_FIRMWARE_DECODE_FAILED', 'the keyboard could not decode the configuration request. Run Check setup; the companion and firmware protocol may be incompatible.'],
      4: ['STUDIO_FIRMWARE_ENCODE_FAILED', 'the keyboard could not encode its reply. The result was not confirmed. Run Check setup.']
    };
    const [code, message] = errors[meta.simpleError] || ['STUDIO_META_ERROR', `the keyboard returned a protocol error (firmware code ${meta.simpleError}). The firmware did not give a more specific reason. Run Check setup.`];
    throw studioError(code, message, body, {firmwareCode: meta.simpleError});
  }
  const subsystems = response && typeof response === 'object' ? Object.keys(response).filter(k => Object.hasOwn(operations, k)) : [];
  const result = response?.[info.subsystem];
  if (subsystems.length !== 1 || !result || typeof result !== 'object' || Object.keys(result).length !== 1 || !Object.hasOwn(result, info.method)) throw studioError('STUDIO_RESPONSE_MISMATCH', 'the keyboard returned an unexpected configuration response. This operation was not confirmed. Run Check setup.', body);
  return response;
}
async function pendingChanges(studio) {
  const body = {keymap: {checkUnsavedChanges: true}};
  const value = (await studio.request(body))?.keymap?.checkUnsavedChanges;
  if (typeof value !== 'boolean') throw studioError('STUDIO_INVALID_PENDING_STATUS', 'the keyboard did not return a valid pending-changes status. Run Check setup.', body);
  return value;
}
async function requireCleanSetup(studio) {
  if (await pendingChanges(studio)) throw studioError('KEYBOARD_PENDING_CHANGES', 'the keyboard reports pending configuration changes. This does not identify which app or setting caused them. Run Check setup or review the current settings before continuing.', {keymap: {checkUnsavedChanges: true}});
}
module.exports = {nextRequestId, requestInfo, studioError, nativeError, validateResponse, pendingChanges, requireCleanSetup};
