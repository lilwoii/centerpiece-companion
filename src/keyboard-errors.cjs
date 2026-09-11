function keyboardError(code, message, details = {}) {
  const error = new Error(message);
  error.code = code;
  Object.assign(error, details);
  return error;
}

function assertBindingResult(result, operation = 'Keyboard shortcut') {
  if (result === 0) return;
  const reasons = {1: 'the layer or key position is not valid', 2: 'the keyboard does not recognize this key behavior', 3: 'the keyboard rejected the shortcut parameters'};
  throw keyboardError('KEYBOARD_BINDING_REJECTED', `${operation}: ${reasons[result] || 'the keyboard returned an invalid change response'}. No save was requested.`, {operation, firmwareCode: Number.isInteger(result) ? result : null});
}

function assertSaveResult(result, operation = 'Keyboard setup') {
  // Both explicit success forms exist in the published protocol. An empty
  // object or ok:false must never be accepted as a successful save.
  if (result && (result.ok === true || Object.hasOwn(result, 'err') && result.err === 0) && !(result.err > 0) && result.ok !== false) return;
  const reasons = {1: 'the keyboard reported a storage error', 2: 'this firmware does not support saving configuration', 3: 'the keyboard has no free configuration storage'};
  throw keyboardError('KEYBOARD_SAVE_FAILED', `${operation}: ${reasons[result?.err] || 'the keyboard did not confirm saving'}. The current keys may have changed in memory. Your local backup was kept; use Check setup before retrying.`, {operation, firmwareCode: Number.isInteger(result?.err) ? result.err : null});
}

function normalizeBinding(b) { return {behaviorId: b?.behaviorId ?? 0, param1: b?.param1 ?? 0, param2: b?.param2 ?? 0}; }
function sameBinding(a, b) { return JSON.stringify(normalizeBinding(a)) === JSON.stringify(normalizeBinding(b)); }
function normalizedKeymap(map) {
  return {availableLayers: map?.availableLayers ?? 0, maxLayerNameLength: map?.maxLayerNameLength ?? 0,
    layers: map?.layers?.map(l => ({id: l.id ?? 0, name: l.name ?? '', bindings: l.bindings?.map(normalizeBinding)}))};
}
function sameKeymap(a, b) { return JSON.stringify(normalizedKeymap(a)) === JSON.stringify(normalizedKeymap(b)); }
function setupFailure(error) {
  return {code: /^[A-Z][A-Z0-9_]{2,60}$/.test(error.code || '') ? error.code : 'KEYBOARD_SETUP_FAILED',
    message: error.message || 'Keyboard setup could not finish.', stage: error.stage || 'setup',
    writesAttempted: !!error.writesAttempted, canRecover: error.code === 'KEYBOARD_PENDING_CHANGES' && !error.writesAttempted,
    ...(Number.isInteger(error.firmwareCode) ? {firmwareCode: error.firmwareCode} : {})};
}
module.exports = {keyboardError, assertBindingResult, assertSaveResult, sameBinding, sameKeymap, setupFailure};
