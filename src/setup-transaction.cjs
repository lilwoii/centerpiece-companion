const fs = require('node:fs');
const path = require('node:path');
const {randomUUID} = require('node:crypto');
const {pendingChanges} = require('./studio-response.cjs');
const {keyboardError, assertBindingResult, assertSaveResult, sameBinding, sameKeymap} = require('./keyboard-errors.cjs');
const pluginBinding = {behaviorId: 50397, param1: 0x05070013};
const widgetBinding = {behaviorId: 50397, param1: 0x05070045};
const slots = [2,3,4,5,6,7,8,9,10];
function classes(deps) { return {Studio: deps.Studio || require('./studio.cjs').Studio, Som: deps.Som || require('./som.cjs').Som}; }
function record(directory, name) {
  try { return JSON.parse(fs.readFileSync(path.join(directory, name), 'utf8')); }
  catch (e) { if (e.code === 'ENOENT') return null; throw keyboardError('SETUP_BACKUP_UNREADABLE', 'The local keyboard backup could not be read. It was preserved. Use Check setup and share the report.'); }
}
function writeRecord(file, value) {
  const temporary=file+'.'+randomUUID()+'.tmp';
  try { fs.writeFileSync(temporary,JSON.stringify(value,null,2),{flag:'wx'}); fs.renameSync(temporary,file); }
  catch(e) { try { fs.unlinkSync(temporary); } catch {} throw e; }
}
async function keymap(s) {
  const map = (await s.request({keymap: {getKeymap: true}}))?.keymap?.getKeymap;
  if (!Array.isArray(map?.layers) || !map.layers.every(l => Array.isArray(l.bindings))) throw keyboardError('KEYBOARD_INVALID_KEYMAP', 'The keyboard returned an incomplete keymap. No settings were saved.');
  return map;
}
async function layouts(s) {
  const result = (await s.request({keymap: {getPhysicalLayouts: true}}))?.keymap?.getPhysicalLayouts;
  const index = result?.activeLayoutIndex ?? 0;
  if (!Array.isArray(result?.layouts) || !Number.isInteger(index) || !result.layouts[index] || result.layouts[index].keys?.length !== 68) throw keyboardError('KEYBOARD_LAYOUT_UNSUPPORTED', 'The keyboard did not report a supported active 68-key layout. Setup cannot safely choose key positions.');
  return result;
}
function sameLayout(a, b) { return (a.activeLayoutIndex ?? 0) === (b.activeLayoutIndex ?? 0) && JSON.stringify(a.layouts) === JSON.stringify(b.layouts); }
function checkMap(map) {
  const base = map.layers.find(l => (l.id ?? 0) === 0), layer = map.layers.find(l => l.id === 1);
  if (base?.bindings.length !== 68 || layer?.bindings.length !== 68) throw keyboardError('KEYBOARD_LAYOUT_UNSUPPORTED', 'Setup needs 68 keys on both the base and L1 layers. This keyboard reported a different layout.');
  if (base.bindings[63].behaviorId !== 54567 || base.bindings[63].param1 !== 1) throw keyboardError('KEYBOARD_L1_CUSTOMIZED', 'The physical L1 key is not using the supported stock layer-1 behavior. Restore that key’s stock layer behavior in XPANEL before using L1 + P and L1 + /.');
  return layer;
}
function identity(s, som, prior, widgetPrior) {
  if (!s.serial || !som.serial) throw keyboardError('KEYBOARD_IDENTITY_UNAVAILABLE', 'The keyboard or display did not provide an identity. Reconnect the Centerpiece and run Check setup.');
  if (prior && (prior.serial !== som.serial || prior.keyboardSerial && prior.keyboardSerial !== s.serial) || widgetPrior && widgetPrior.serial !== s.serial) throw keyboardError('KEYBOARD_BACKUP_MISMATCH', 'The saved setup belongs to a different keyboard. No settings were changed.');
}
async function overlayCheck(som, prior) {
  const ownedSlots = [], preservedSlots = [];
  for (const slot of slots) {
    let bytes;
    try { bytes = await som.readOverlay(slot); } catch (e) { e.stage = `read_overlay_${slot}`; throw e; }
    if (bytes && !prior?.ownedSlots?.includes(slot)) preservedSlots.push(slot);
    else ownedSlots.push(slot);
  }
  if (ownedSlots.length < 2) throw keyboardError('KEYBOARD_OVERLAY_SPACE_REQUIRED', `Only ${ownedSlots.length} display ${ownedSlots.length === 1 ? 'slot is' : 'slots are'} available. Companion needs at least two empty slots among 2–10. Existing overlays in slots ${preservedSlots.join(', ')} were left untouched. Keep copies of your overlays, then use XPANEL to free two slots and retry setup.`, {stage:'check_display_slots'});
  return {ownedSlots, preservedSlots};
}
function changed() { return keyboardError('KEYBOARD_CONFIGURATION_CHANGED', 'The keyboard configuration changed while setup was being reviewed. Nothing was saved. Close other keyboard editors and prepare setup again.'); }
function decorate(error, stage, writesAttempted) {
  if(!/^(KEYBOARD_|SETUP_|STUDIO_)/.test(error.code||'') && stage==='connect') error=keyboardError('KEYBOARD_CONNECTION_FAILED',['EACCES','EPERM'].includes(error.code)?'Windows denied access to the keyboard display. Close other keyboard display connections and retry.':'The keyboard or display connection could not be opened. Connect one Centerpiece and close other keyboard configuration connections before retrying.');
  if(!error.code && /display.*timed out/i.test(error.message)) error=keyboardError('KEYBOARD_DISPLAY_TIMEOUT','The keyboard display did not respond before the timeout. Close other keyboard display connections and retry.');
  if (stage==='write_local_backup' && ['EACCES','EPERM','ENOSPC','EROFS','EIO','EEXIST','ENOENT','ENOTDIR'].includes(error.code)) error = keyboardError('SETUP_BACKUP_WRITE_FAILED', `The local setup backup could not be saved (${error.code}). ${writesAttempted ? 'A keyboard change was attempted; keep the existing backup and run Check setup.' : 'No keyboard settings were changed. Check free space and access to the app’s local data folder.'}`);
  if(!/^(KEYBOARD_|SETUP_|STUDIO_)/.test(error.code||'') && (stage==='check_display_slots'||error.stage?.startsWith('read_overlay_'))) error=keyboardError('KEYBOARD_DISPLAY_IO_ERROR','The display overlay could not be read. Its contents were preserved. Close other keyboard display connections and retry.',{stage:error.stage||stage});
  error.stage ||= stage;
  error.writesAttempted = !!writesAttempted;
  if (writesAttempted && !['KEYBOARD_SAVE_FAILED','KEYBOARD_READBACK_MISMATCH'].includes(error.code)) error.message += ' Setup stopped after a shortcut change was attempted. No settings were discarded; your local backup was kept. Run Check setup before retrying.';
  return error;
}

async function prepareSetup(directory, options = {}, deps = {}) {
  const {Studio, Som} = classes(deps);
  let s, som, stage = 'connect';
  try {
    const prior = record(directory, 'hardware.json'), widgetPrior = record(directory, 'widget-shortcut.json');
    s = new Studio(); som = new Som(); identity(s, som, prior, widgetPrior);
    stage = 'read_keymap'; const map = await keymap(s), layer = checkMap(map);
    const pluginOwned = prior && sameBinding(layer.bindings[26], prior.installedBinding || pluginBinding);
    if (layer.bindings[26].behaviorId !== 60498 && !pluginOwned) throw keyboardError('KEYBOARD_PLUGIN_KEY_CUSTOMIZED', 'L1 + P already has a custom mapping. Setup preserved it. Restore its Plugin Toggle behavior in XPANEL before assigning the companion shortcut.');
    const includeWidget = options.includeWidget === true;
    if (includeWidget && widgetPrior && ![widgetPrior.original, widgetPrior.installed, widgetBinding, {behaviorId:50397,param1:0x05070073}].some(b => b && sameBinding(b, layer.bindings[55]))) throw keyboardError('KEYBOARD_WIDGET_KEY_CUSTOMIZED', 'L1 + / changed since its backup was made. Setup preserved the current mapping.');
    // A correct verified installation needs no save, regardless of a dirty flag.
    if (prior?.verified && !prior.setupInProgress && !prior.restored && sameBinding(layer.bindings[26], pluginBinding) && (!includeWidget || sameBinding(layer.bindings[55], widgetBinding))) return {alreadyInstalled: true, prior};
    stage = 'read_pending_status'; const pending = await pendingChanges(s);
    if (pending && !options.reviewPending) throw keyboardError('KEYBOARD_PENDING_CHANGES', 'The keyboard reports pending configuration changes. This does not prove XPANEL has unsaved edits. Choose Review current settings to back up and keep the current configuration, or use Check setup for details.');
    stage = 'read_layout'; const physicalLayouts = await layouts(s);
    stage = 'check_display_slots'; const overlaySlots = await overlayCheck(som, prior);
    const originalSlot = await som.currentSlot();
    if (!Number.isInteger(originalSlot) || originalSlot < 0 || originalSlot > 10) throw keyboardError('KEYBOARD_DISPLAY_SLOT_INVALID', 'The display returned an invalid active slot. No settings were changed.');
    stage = 'verify_snapshot';
    if (!sameKeymap(map, await keymap(s)) || !sameLayout(physicalLayouts, await layouts(s)) || pending !== await pendingChanges(s)) throw changed();
    return {id: randomUUID(), createdAt: Date.now(), pending, includeWidget, map, physicalLayouts, prior, widgetPrior, serial: som.serial, keyboardSerial: s.serial, originalSlot, ...overlaySlots};
  } catch (e) { throw decorate(e, stage, false); } finally { s?.close(); som?.close(); }
}

async function commitSetup(directory, plan, options = {}, deps = {}) {
  if (plan.alreadyInstalled) return plan.prior;
  if (Date.now() - plan.createdAt > 5 * 60 * 1000) throw keyboardError('SETUP_REVIEW_EXPIRED', 'This setup review expired. Review the current settings again before continuing.');
  if (plan.pending && options.acceptPending !== true) throw keyboardError('SETUP_CONFIRMATION_REQUIRED', 'Confirm keeping and saving the current pending configuration before continuing.');
  const {Studio, Som} = classes(deps);
  let s, som, stage = 'connect', writesAttempted = false;
  try {
    s = new Studio(); som = new Som();
    if (s.serial !== plan.keyboardSerial || som.serial !== plan.serial) throw keyboardError('KEYBOARD_BACKUP_MISMATCH', 'A different keyboard is connected. Prepare setup again.');
    if (JSON.stringify(record(directory,'hardware.json')) !== JSON.stringify(plan.prior) || JSON.stringify(record(directory,'widget-shortcut.json')) !== JSON.stringify(plan.widgetPrior)) throw changed();
    stage = 'verify_snapshot';
    if (!sameKeymap(plan.map, await keymap(s)) || !sameLayout(plan.physicalLayouts, await layouts(s)) || plan.pending !== await pendingChanges(s)) throw changed();
    stage = 'check_display_slots';
    const overlaySlots = await overlayCheck(som, plan.prior);
    if (JSON.stringify(overlaySlots.ownedSlots) !== JSON.stringify(plan.ownedSlots) || JSON.stringify(overlaySlots.preservedSlots) !== JSON.stringify(plan.preservedSlots)) throw changed();
    stage = 'verify_snapshot';
    if (!sameKeymap(plan.map, await keymap(s)) || !sameLayout(plan.physicalLayouts, await layouts(s)) || plan.pending !== await pendingChanges(s)) throw changed();
    stage = 'write_local_backup';
    fs.mkdirSync(directory, {recursive:true});
    // Unique immutable checkpoint includes active state, never credentials. It
    // exists before the first device mutation, including on a failed retry.
    fs.writeFileSync(path.join(directory, `setup-checkpoint-${plan.id}.json`), JSON.stringify({format:1, createdAt:new Date().toISOString(), keyboardSerial:s.serial, serial:som.serial, pending:plan.pending, map:plan.map, physicalLayouts:plan.physicalLayouts, ownedSlots:plan.ownedSlots, preservedSlots:plan.preservedSlots},null,2), {flag:'wx'});
    const layer = checkMap(plan.map);
    const backup = {...(plan.prior || {serial:som.serial, keyboardSerial:s.serial, originalSlot:plan.originalSlot, originalBinding:layer.bindings[26], layerId:1, keyPosition:26, createdAt:new Date().toISOString()}), ownedSlots:plan.ownedSlots, preservedSlots:plan.preservedSlots};
    if (!plan.prior && !fs.existsSync(path.join(directory,'keymap-original.json'))) fs.writeFileSync(path.join(directory,'keymap-original.json'), JSON.stringify(plan.map,null,2), {flag:'wx'});
    writeRecord(path.join(directory,'hardware.json'), {...backup,verified:false,setupInProgress:true});
    if (plan.includeWidget && !plan.widgetPrior) fs.writeFileSync(path.join(directory,'widget-shortcut.json'), JSON.stringify({serial:s.serial, original:layer.bindings[55], installed:widgetBinding, createdAt:new Date().toISOString()},null,2), {flag:'wx'});
    const expected = structuredClone(plan.map), expectedLayer = checkMap(expected);
    for (const [position, binding, name] of [[26,pluginBinding,'L1 + P'], ...(plan.includeWidget ? [[55,widgetBinding,'L1 + /']] : [])]) {
      if (sameBinding(expectedLayer.bindings[position],binding)) continue;
      stage = position === 26 ? 'assign_plugin_shortcut' : 'assign_widget_shortcut'; writesAttempted = true;
      assertBindingResult((await s.request({keymap:{setLayerBinding:{layerId:1,keyPosition:position,binding}}}))?.keymap?.setLayerBinding, name);
      expectedLayer.bindings[position] = binding;
    }
    // A competing editor must not get silently committed with our changes.
    stage = 'verify_before_save';
    if (!sameKeymap(expected, await keymap(s)) || !sameLayout(plan.physicalLayouts, await layouts(s))) throw changed();
    if (writesAttempted || plan.pending) {
      stage = 'save_configuration';
      writesAttempted = true;
      assertSaveResult((await s.request({keymap:{saveChanges:true}}))?.keymap?.saveChanges);
    }
    stage = 'verify_saved_configuration';
    if (!sameKeymap(expected, await keymap(s)) || !sameLayout(plan.physicalLayouts, await layouts(s))) throw keyboardError('KEYBOARD_READBACK_MISMATCH', 'The keyboard replied to save, but its current configuration differs from the expected result. Your backup was kept. Use Check setup before retrying.');
    const pendingAfter = await pendingChanges(s);
    const next = {...backup, keyboardSerial:s.serial, installedBinding:pluginBinding, verified:true, restored:false, setupInProgress:false, pendingAfterSetup:pendingAfter};
    stage='write_local_backup';writeRecord(path.join(directory,'hardware.json'),next);
    return next;
  } catch (e) { throw decorate(e, stage, writesAttempted); } finally { s?.close(); som?.close(); }
}
async function setup(directory, options = {}, deps = {}) {
  const plan = await prepareSetup(directory, options, deps);
  return commitSetup(directory, plan, options, deps);
}
async function startSetup(directory, options = {}, deps = {}) {
  // Detect pending status in the same read-only preflight. A status flag alone
  // never authorizes a global save, and no failed mutation is automatically retried.
  const plan = await prepareSetup(directory, {...options,reviewPending:true}, deps);
  if (plan.pending) return {needsConfirmation:true,plan};
  return {needsConfirmation:false,backup:await commitSetup(directory,plan,{},deps)};
}
module.exports = {prepareSetup, commitSetup, setup, startSetup, pluginBinding, widgetBinding};
