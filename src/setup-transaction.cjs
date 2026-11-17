const fs = require('node:fs');
const path = require('node:path');
const {randomUUID,createHash} = require('node:crypto');
const {pendingChanges} = require('./studio-response.cjs');
const {pluginArrowChanges} = require('./plugin-arrow-bindings.cjs');
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
function validateRestorationRecord(prior) {
  if (!prior) return;
  const binding=prior.originalBinding;
  if (binding!==undefined && (!binding || Array.isArray(binding) || !Number.isInteger(binding.behaviorId) || binding.behaviorId<0 || binding.behaviorId>65535 || ['param1','param2'].some(key=>binding[key]!==undefined&&(!Number.isInteger(binding[key])||binding[key]<0||binding[key]>0xffffffff)))) throw keyboardError('SETUP_BACKUP_UNREADABLE','The saved original key assignment is invalid. Your backup was preserved. Use Check setup before recovering this keyboard.');
  if (prior.originalSlot!==undefined && (!Number.isInteger(prior.originalSlot)||prior.originalSlot<0||prior.originalSlot>10)) throw keyboardError('SETUP_BACKUP_UNREADABLE','The saved original display slot is invalid. Your backup was preserved. Use Check setup before recovering this keyboard.');
}
function priorOwnedSlots(prior) {
  if (!prior) return [];
  // Only a completed, identity-checked installation establishes the old fixed
  // pool contract; any explicitly preserved foreign slots still stay excluded.
  const legacy=prior.verified===true && !prior.setupInProgress && prior.serial &&
    prior.layerId===1 && prior.keyPosition===26 && prior.originalBinding &&
    sameBinding(prior.installedBinding,pluginBinding);
  if(prior.ownedSlots===undefined&&!legacy)return [];
  try{return require('./overlay-allocation.cjs').ownedPool(prior);}
  catch{throw keyboardError('SETUP_BACKUP_UNREADABLE','The saved display allocation is invalid. Existing overlays were preserved. Use Check setup and share the report.');}
}
function referencedOverlaySlots(map) {
  return new Set(map.layers.flatMap(layer=>layer.bindings).filter(binding=>binding?.behaviorId===42547).map(binding=>binding.param1));
}
function validateActiveSlot(slot) {
  if (!Number.isInteger(slot) || slot < 0 || slot > 10) throw keyboardError('KEYBOARD_DISPLAY_SLOT_INVALID', 'The display returned an invalid active slot. No settings were changed.');
  return slot;
}
async function overlayCheck(som, prior, options={}) {
  const ownedSlots = [], preservedSlots = [], hashes={}, priorSlots=priorOwnedSlots(prior);
  let replacementSlots=[];
  for (const slot of slots) {
    let bytes;
    try { bytes = await som.readOverlay(slot); } catch (e) { e.stage = `read_overlay_${slot}`; throw e; }
    if (bytes && !priorSlots.includes(slot)){preservedSlots.push(slot);hashes[slot]=createHash('sha256').update(bytes).digest('hex');}
    else ownedSlots.push(slot);
  }
  if(options.replacementPlan){
    const plan=options.replacementPlan,selected=plan.replacementSlots,referenced=referencedOverlaySlots(options.map);
    if(!Array.isArray(selected)||selected.length<1||selected.length>2||new Set(selected).size!==selected.length||options.activeSlot!==plan.originalSlot)throw changed();
    for(const slot of selected){
      if(!slots.includes(slot)||!preservedSlots.includes(slot)||slot===options.activeSlot||slot===prior?.originalSlot||referenced.has(slot)||hashes[slot]!==plan.replacementHashes?.[slot])throw changed();
    }
    if(selected.length!==Math.max(0,2-ownedSlots.length))throw changed();
    replacementSlots=[...selected];
  }else if(ownedSlots.length<2&&options.reviewOccupied===true){
    const referenced=referencedOverlaySlots(options.map),needed=2-ownedSlots.length;
    replacementSlots=[...preservedSlots].reverse().filter(slot=>slot!==options.activeSlot&&slot!==prior?.originalSlot&&!referenced.has(slot)).slice(0,needed);
    if(replacementSlots.length!==needed)throw keyboardError('KEYBOARD_OVERLAY_REPLACEMENT_UNAVAILABLE','There are not enough inactive display slots without a key assignment to prepare recovery. No overlays were changed. Stop using an assigned overlay or change its assignment in XPANEL, then review recovery again.',{stage:'check_display_slots'});
  }
  if(replacementSlots.length){
    for(const slot of replacementSlots){ownedSlots.push(slot);preservedSlots.splice(preservedSlots.indexOf(slot),1);}
    ownedSlots.sort((a,b)=>a-b);
  }
  if (ownedSlots.length < 2) {
    const instruction = ownedSlots.length === 0
      ? 'Display slots are full. Two empty overlay slots are needed.'
      : 'One more empty display slot is needed; one is already available.';
    throw keyboardError('KEYBOARD_OVERLAY_SPACE_REQUIRED', `${instruction} Companion needs two available slots among 2–10 so it can update the display without overwriting the active frame. Existing overlays in slots ${preservedSlots.join(', ')} were left untouched. Do not delete skins or reset the keyboard. Companion could not verify ownership of enough occupied overlays. Choose Review display slot recovery to review replacing inactive overlays. Nothing is replaced without your confirmation. Use Check setup → Copy setup report if recovery cannot proceed.`, {stage:'check_display_slots'});
  }
  return {ownedSlots, preservedSlots,...(replacementSlots.length?{replacementSlots,replacementHashes:Object.fromEntries(replacementSlots.map(slot=>[slot,hashes[slot]]))}:{})};
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
    validateRestorationRecord(prior);
    const savedSlots=priorOwnedSlots(prior);
    stage = 'read_keymap'; const map = await keymap(s), layer = checkMap(map);
    // Companion owns L1 + P. Reclaim blank or externally remapped bindings as
    // well as stock Plugin Toggle, with the full pre-change map checkpointed.
    const includeWidget = options.includeWidget === true;
    if (includeWidget && widgetPrior && ![widgetPrior.original, widgetPrior.installed, widgetBinding, {behaviorId:50397,param1:0x05070073}].some(b => b && sameBinding(b, layer.bindings[55]))) throw keyboardError('KEYBOARD_WIDGET_KEY_CUSTOMIZED', 'L1 + / changed since its backup was made. Setup preserved the current mapping.');
    // A correct verified installation needs no save, regardless of a dirty flag.
    if (savedSlots.length>=2 && prior?.verified && prior.keyboardSerial===s.serial && !prior.setupInProgress && !prior.restored && !pluginArrowChanges(map).length && sameBinding(layer.bindings[26], pluginBinding) && (!includeWidget || sameBinding(layer.bindings[55], widgetBinding))) return {alreadyInstalled: true, prior};
    stage = 'read_pending_status'; const pending = await pendingChanges(s);
    if (pending && !options.reviewPending) throw keyboardError('KEYBOARD_PENDING_CHANGES', 'The keyboard reports pending configuration changes. This does not prove XPANEL has unsaved edits. Choose Review current settings to back up and keep the current configuration, or use Check setup for details.');
    stage = 'read_layout'; const physicalLayouts = await layouts(s);
    stage = 'check_display_slots'; const originalSlot=validateActiveSlot(await som.currentSlot());
    const overlaySlots = await overlayCheck(som, prior, {reviewOccupied:options.reviewOccupied===true,map,activeSlot:originalSlot});
    stage = 'verify_snapshot';
    if (!sameKeymap(map, await keymap(s)) || !sameLayout(physicalLayouts, await layouts(s)) || pending !== await pendingChanges(s)) throw changed();
    return {id: randomUUID(), createdAt: Date.now(), pending, includeWidget, map, physicalLayouts, prior, widgetPrior, serial: som.serial, keyboardSerial: s.serial, originalSlot, ...overlaySlots};
  } catch (e) { throw decorate(e, stage, false); } finally { s?.close(); som?.close(); }
}

async function commitSetup(directory, plan, options = {}, deps = {}) {
  if (plan.alreadyInstalled) return plan.prior;
  if (Date.now() - plan.createdAt > 5 * 60 * 1000) throw keyboardError('SETUP_REVIEW_EXPIRED', 'This setup review expired. Review the current settings again before continuing.');
  if ((plan.pending || plan.prior?.setupInProgress===true) && options.acceptPending !== true) throw keyboardError('SETUP_CONFIRMATION_REQUIRED', 'Confirm keeping and saving the current configuration before continuing.');
  if(plan.replacementSlots?.length&&options.acceptOverlayReplacement!==true)throw keyboardError('SETUP_OVERLAY_CONFIRMATION_REQUIRED','Review and confirm replacing the selected display overlays before continuing. No overlays were changed.');
  const {Studio, Som} = classes(deps);
  let s, som, stage = 'connect', writesAttempted = false;
  try {
    s = new Studio(); som = new Som();
    if (s.serial !== plan.keyboardSerial || som.serial !== plan.serial) throw keyboardError('KEYBOARD_BACKUP_MISMATCH', 'A different keyboard is connected. Prepare setup again.');
    if (JSON.stringify(record(directory,'hardware.json')) !== JSON.stringify(plan.prior) || JSON.stringify(record(directory,'widget-shortcut.json')) !== JSON.stringify(plan.widgetPrior)) throw changed();
    stage = 'verify_snapshot';
    if (!sameKeymap(plan.map, await keymap(s)) || !sameLayout(plan.physicalLayouts, await layouts(s)) || plan.pending !== await pendingChanges(s)) throw changed();
    stage = 'check_display_slots';
    const overlaySlots = await overlayCheck(som, plan.prior,plan.replacementSlots?.length?{replacementPlan:plan,map:plan.map,activeSlot:validateActiveSlot(await som.currentSlot())}:{});
    if (JSON.stringify(overlaySlots.ownedSlots) !== JSON.stringify(plan.ownedSlots) || JSON.stringify(overlaySlots.preservedSlots) !== JSON.stringify(plan.preservedSlots)) throw changed();
    stage = 'verify_snapshot';
    if (!sameKeymap(plan.map, await keymap(s)) || !sameLayout(plan.physicalLayouts, await layouts(s)) || plan.pending !== await pendingChanges(s)) throw changed();
    if(validateActiveSlot(await som.currentSlot())!==plan.originalSlot)throw changed();
    stage = 'write_local_backup';
    fs.mkdirSync(directory, {recursive:true});
    // Unique immutable checkpoint includes active state, never credentials. It
    // exists before the first device mutation, including on a failed retry.
    fs.writeFileSync(path.join(directory, `setup-checkpoint-${plan.id}.json`), JSON.stringify({format:1, createdAt:new Date().toISOString(), keyboardSerial:s.serial, serial:som.serial, pending:plan.pending, map:plan.map, physicalLayouts:plan.physicalLayouts, ownedSlots:plan.ownedSlots, preservedSlots:plan.preservedSlots,...(plan.replacementSlots?.length?{replacementSlots:plan.replacementSlots,replacementHashes:plan.replacementHashes}: {})},null,2), {flag:'wx'});
    const layer = checkMap(plan.map);
    const backup = {serial:som.serial, keyboardSerial:s.serial, originalSlot:plan.originalSlot, originalBinding:layer.bindings[26], layerId:1, keyPosition:26, createdAt:new Date().toISOString(), ...(plan.prior||{}), ownedSlots:plan.ownedSlots, preservedSlots:plan.preservedSlots};
    const arrowChanges=pluginArrowChanges(plan.map);
    backup.pluginArrows=[...(backup.pluginArrows||[])];
    for(const change of arrowChanges)if(!backup.pluginArrows.some(item=>item.position===change.position))backup.pluginArrows.push(change);
    if (!plan.prior && !fs.existsSync(path.join(directory,'keymap-original.json'))) writeRecord(path.join(directory,'keymap-original.json'), plan.map);
    writeRecord(path.join(directory,'hardware.json'), {...backup,verified:false,setupInProgress:true});
    if (plan.includeWidget && !plan.widgetPrior) writeRecord(path.join(directory,'widget-shortcut.json'), {serial:s.serial, original:layer.bindings[55], installed:widgetBinding, createdAt:new Date().toISOString()});
    const expected = structuredClone(plan.map), expectedLayer = checkMap(expected);
    for (const [position, binding, name] of [[26,pluginBinding,'L1 + P'], ...(plan.includeWidget ? [[55,widgetBinding,'L1 + /']] : []), ...arrowChanges.map(item=>[item.position,item.installed,'L1 arrow'])]) {
      if (sameBinding(expectedLayer.bindings[position],binding)) continue;
      stage = position === 26 ? 'assign_plugin_shortcut' : position===55?'assign_widget_shortcut':'assign_plugin_arrow'; writesAttempted = true;
      assertBindingResult((await s.request({keymap:{setLayerBinding:{layerId:1,keyPosition:position,binding}}}))?.keymap?.setLayerBinding, name);
      expectedLayer.bindings[position] = binding;
    }
    // A competing editor must not get silently committed with our changes.
    stage = 'verify_before_save';
    if (!sameKeymap(expected, await keymap(s)) || !sameLayout(plan.physicalLayouts, await layouts(s))) throw changed();
    if (writesAttempted || plan.pending || plan.prior?.setupInProgress===true) {
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
  if (plan.pending || plan.prior?.setupInProgress===true || plan.replacementSlots?.length) return {needsConfirmation:true,plan};
  return {needsConfirmation:false,backup:await commitSetup(directory,plan,{},deps)};
}
module.exports = {prepareSetup, commitSetup, setup, startSetup, pluginBinding, widgetBinding, validateRestorationRecord};
