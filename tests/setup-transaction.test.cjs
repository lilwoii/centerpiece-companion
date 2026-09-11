const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {prepareSetup,commitSetup,setup,startSetup,pluginBinding,widgetBinding}=require('../src/setup-transaction.cjs');
const {sameKeymap}=require('../src/keyboard-errors.cjs');
function fixture(t, options={}) {
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'companion-setup-'));
  t.after(()=>fs.rmSync(directory,{recursive:true,force:true}));
  const x={pending:options.pending??false,map:{availableLayers:6,layers:[{bindings:Array.from({length:68},()=>({behaviorId:50397,param1:0x70004}))},{id:1,bindings:Array.from({length:68},()=>({behaviorId:56811}))}]},layouts:{layouts:[{keys:Array.from({length:68},()=>({width:100,height:100}))}]},calls:[],saves:0,edits:[],closed:0};
  x.map.layers[0].bindings[63]={behaviorId:54567,param1:1};x.map.layers[1].bindings[26]={behaviorId:60498};
  class Studio{constructor(){this.serial=x.serial||'keyboard';}close(){x.closed++;}async request(r){x.calls.push(r);if(r.keymap.checkUnsavedChanges)return{keymap:{checkUnsavedChanges:x.pending}};if(r.keymap.getKeymap){x.onRead?.();return{keymap:{getKeymap:structuredClone(x.map)}};}if(r.keymap.getPhysicalLayouts)return{keymap:{getPhysicalLayouts:structuredClone(x.layouts)}};if(r.keymap.setLayerBinding){const e=r.keymap.setLayerBinding;x.edits.push(e);assert.ok(fs.readdirSync(directory).some(n=>n.startsWith('setup-checkpoint-')),'checkpoint before mutation');if(x.editError)throw x.editError;x.map.layers.find(l=>l.id===e.layerId).bindings[e.keyPosition]=structuredClone(e.binding);x.afterEdit?.();return{keymap:{setLayerBinding:x.bindingResult??0}};}if(r.keymap.saveChanges){x.saves++;if(x.saveError)throw x.saveError;if(!options.sticky)x.pending=false;return{keymap:{saveChanges:x.saveResult??{ok:true}}};}throw Error('Unexpected write: '+JSON.stringify(r));}}
  class Som{constructor(){this.serial='display';}close(){}async readOverlay(n){(x.overlayReads??=[]).push(n);if(x.occupied===n||x.occupied?.includes?.(n))return Buffer.from('existing overlay');return null;}async currentSlot(){return x.activeSlot??0;}}
  return {x,directory,deps:{Studio,Som}};
}
test('normal setup installs both shortcuts with one save and preserves every other key',async t=>{
  const {x,directory,deps}=fixture(t),before=structuredClone(x.map);x.map.layers[0].bindings[32]={behaviorId:50397,param1:0x70039};before.layers[0].bindings[32]=structuredClone(x.map.layers[0].bindings[32]);
  const result=await setup(directory,{includeWidget:true},deps);assert.equal(result.verified,true);assert.equal(x.saves,1);assert.deepEqual(x.edits.map(e=>e.keyPosition),[26,55]);before.layers[1].bindings[26]=pluginBinding;before.layers[1].bindings[55]=widgetBinding;assert.equal(sameKeymap(x.map,before),true);assert.ok(x.calls.every(r=>!r.keymap.discardChanges));
});
test('pending recovery is read-only until confirmation, then saves current settings without XPANEL',async t=>{
  const {x,directory,deps}=fixture(t,{pending:true});await assert.rejects(()=>setup(directory,{includeWidget:true},deps),{code:'KEYBOARD_PENDING_CHANGES'});assert.deepEqual(fs.readdirSync(directory),[]);
  const plan=await prepareSetup(directory,{includeWidget:true,reviewPending:true},deps);assert.equal(plan.pending,true);assert.deepEqual(fs.readdirSync(directory),[]);await assert.rejects(()=>commitSetup(directory,plan,{},deps),{code:'SETUP_CONFIRMATION_REQUIRED'});assert.equal(x.edits.length,0);
  const result=await commitSetup(directory,plan,{acceptPending:true},deps);assert.equal(result.verified,true);assert.equal(result.pendingAfterSetup,false);assert.equal(x.saves,1);
});
test('a persistently true firmware flag does not block verified recovery or reinstall checks',async t=>{
  const {x,directory,deps}=fixture(t,{pending:true,sticky:true});const plan=await prepareSetup(directory,{reviewPending:true,includeWidget:true},deps);const result=await commitSetup(directory,plan,{acceptPending:true},deps);assert.equal(result.pendingAfterSetup,true);x.calls=[];await setup(directory,{includeWidget:true},deps);assert.equal(x.saves,1);assert.equal(x.calls.some(r=>r.keymap.checkUnsavedChanges),false);
});
test('missing status, custom L1, full overlay storage and unsupported layout never get forced',async t=>{
  for(const kind of ['status','l1','overlay','layout']){const {x,directory,deps}=fixture(t);if(kind==='status')x.pending=undefined;if(kind==='l1')x.map.layers[0].bindings[63]={behaviorId:50397,param1:1};if(kind==='overlay')x.occupied=6;if(kind==='layout')x.layouts.layouts[0].keys=[];
    if(kind==='overlay')x.occupied=[2,3,4,5,6,7,8,9];
    await assert.rejects(()=>prepareSetup(directory,{reviewPending:true},deps));assert.equal(x.edits.length,0);assert.equal(x.saves,0);assert.deepEqual(fs.readdirSync(directory),[]);}
});
test('changed keymap, layout, device or expired confirmation stops before any mutation',async t=>{
  for(const kind of ['keymap','layout','device','expired']){const {x,directory,deps}=fixture(t,{pending:true});const plan=await prepareSetup(directory,{reviewPending:true},deps);if(kind==='keymap')x.map.layers[0].bindings[1].param1++;if(kind==='layout')x.layouts.layouts[0].keys[1].width=50;if(kind==='device')x.serial='other';if(kind==='expired')plan.createdAt=0;await assert.rejects(()=>commitSetup(directory,plan,{acceptPending:true},deps));assert.equal(x.saves,0);assert.equal(x.edits.length,0);}
});
test('concurrent changes after a shortcut edit are never saved or discarded',async t=>{
  const {x,directory,deps}=fixture(t);const plan=await prepareSetup(directory,{},deps);x.afterEdit=()=>{x.map.layers[0].bindings[4].param1++};await assert.rejects(()=>commitSetup(directory,plan,{},deps),{code:'KEYBOARD_CONFIGURATION_CHANGED',writesAttempted:true});assert.equal(x.saves,0);assert.ok(x.calls.every(r=>!r.keymap.discardChanges));assert.equal(JSON.parse(fs.readFileSync(path.join(directory,'hardware.json'))).verified,false);
});
test('failed save keeps backup and a reviewed retry actually saves already-applied shortcuts',async t=>{
  const {x,directory,deps}=fixture(t,{pending:true});let plan=await prepareSetup(directory,{reviewPending:true,includeWidget:true},deps);x.saveResult={err:3};await assert.rejects(()=>commitSetup(directory,plan,{acceptPending:true},deps),{code:'KEYBOARD_SAVE_FAILED',firmwareCode:3});assert.equal(JSON.parse(fs.readFileSync(path.join(directory,'hardware.json'))).verified,false);x.pending=true;x.saveResult={ok:true};const count=x.edits.length;plan=await prepareSetup(directory,{reviewPending:true,includeWidget:true},deps);await commitSetup(directory,plan,{acceptPending:true},deps);assert.equal(x.edits.length,count);assert.equal(x.saves,2);assert.equal(fs.readdirSync(directory).filter(n=>n.startsWith('setup-checkpoint-')).length,2);
});
test('an orphaned original backup is preserved and does not block a new checkpoint',async t=>{
  const {directory,deps}=fixture(t);fs.writeFileSync(path.join(directory,'keymap-original.json'),'old original');await setup(directory,{},deps);assert.equal(fs.readFileSync(path.join(directory,'keymap-original.json'),'utf8'),'old original');
});
test('failed shortcut delivery does not discard configuration or mark setup verified',async t=>{
  const {x,directory,deps}=fixture(t);const plan=await prepareSetup(directory,{},deps);x.editError=Object.assign(Error('Reply timed out'),{code:'STUDIO_TIMEOUT'});await assert.rejects(()=>commitSetup(directory,plan,{},deps),{code:'STUDIO_TIMEOUT',stage:'assign_plugin_shortcut',writesAttempted:true});assert.equal(x.saves,0);assert.ok(x.calls.every(r=>!r.keymap.discardChanges));
});
test('display access and read failures are not misreported as local backup failures',async t=>{
  for(const stage of ['open','read']){const {directory,deps}=fixture(t);const error=Object.assign(Error('Private device path SECRET-SERIAL'),{code:stage==='open'?'EACCES':'EIO'});
    class Som{constructor(){if(stage==='open')throw error;this.serial='display';}close(){}async readOverlay(){throw error;}}
    await assert.rejects(()=>prepareSetup(directory,{}, {...deps,Som}),e=>{assert.equal(e.code,stage==='open'?'KEYBOARD_CONNECTION_FAILED':'KEYBOARD_DISPLAY_IO_ERROR');assert.doesNotMatch(e.message,/SECRET-SERIAL|backup could not/);return true;});
  }
});
test('starting setup automatically detects pending state and prepares one read-only review',async t=>{
  const {x,directory,deps}=fixture(t,{pending:true});const result=await startSetup(directory,{includeWidget:true},deps);
  assert.equal(result.needsConfirmation,true);assert.equal(result.plan.pending,true);assert.equal(x.saves,0);assert.equal(x.edits.length,0);assert.deepEqual(fs.readdirSync(directory),[]);
  await commitSetup(directory,result.plan,{acceptPending:true},deps);assert.equal(x.saves,1);
});
test('clean and already installed setup finish without a recovery confirmation',async t=>{
  const {x,directory,deps}=fixture(t);let result=await startSetup(directory,{includeWidget:true},deps);assert.equal(result.needsConfirmation,false);assert.equal(result.backup.verified,true);
  x.pending=true;result=await startSetup(directory,{includeWidget:true},deps);assert.equal(result.needsConfirmation,false);assert.equal(x.saves,1);
});
test('automatic detection never treats malformed status or full overlay storage as recoverable',async t=>{
  for(const kind of ['malformed','occupied','save']){const {x,directory,deps}=fixture(t,{pending:kind!=='save'});if(kind==='malformed')x.pending='true';if(kind==='occupied')x.occupied=4;if(kind==='save')x.saveResult={err:3};
    if(kind==='occupied')x.occupied=[2,3,4,5,6,7,8,9,10];
    await assert.rejects(()=>startSetup(directory,{includeWidget:true},deps));assert.equal(x.saves,kind==='save'?1:0);assert.ok(x.calls.every(r=>!r.keymap.discardChanges));}
});

test('reported stock two-layer keyboard with pending flag and occupied slot 2 sets up around that overlay',async t=>{
  const {x,directory,deps}=fixture(t,{pending:true,sticky:true});x.map.availableLayers=2;x.occupied=2;x.activeSlot=2;
  const result=await startSetup(directory,{includeWidget:true},deps);
  assert.equal(result.needsConfirmation,true);assert.deepEqual(result.plan.preservedSlots,[2]);assert.deepEqual(result.plan.ownedSlots,[3,4,5,6,7,8,9,10]);
  assert.equal(x.edits.length,0);assert.deepEqual(fs.readdirSync(directory),[]);
  const backup=await commitSetup(directory,result.plan,{acceptPending:true},deps);
  assert.equal(backup.verified,true);assert.equal(backup.originalSlot,2);assert.equal(backup.pendingAfterSetup,true);assert.deepEqual(backup.ownedSlots,[3,4,5,6,7,8,9,10]);assert.deepEqual(backup.preservedSlots,[2]);assert.equal(x.saves,1);
  assert.ok(x.overlayReads.every(slot=>slot>=2&&slot<=10));
});

test('two free overlay slots are enough and occupied destinations remain outside ownership',async t=>{
  const {x,directory,deps}=fixture(t);x.occupied=[2,3,4,5,6,7,8];
  const result=await startSetup(directory,{includeWidget:true},deps);
  assert.equal(result.needsConfirmation,false);assert.deepEqual(result.backup.ownedSlots,[9,10]);assert.deepEqual(result.backup.preservedSlots,[2,3,4,5,6,7,8]);
});

test('an overlay added while reviewing stops setup before shortcuts or save',async t=>{
  const {x,directory,deps}=fixture(t,{pending:true});x.occupied=2;const plan=await prepareSetup(directory,{reviewPending:true},deps);x.occupied=[2,3];
  await assert.rejects(()=>commitSetup(directory,plan,{acceptPending:true},deps),{code:'KEYBOARD_CONFIGURATION_CHANGED',writesAttempted:false});
  assert.equal(x.edits.length,0);assert.equal(x.saves,0);assert.deepEqual(fs.readdirSync(directory),[]);
});

test('insufficient overlay space names occupied slots and leaves the keyboard untouched',async t=>{
  const {x,directory,deps}=fixture(t,{pending:true});x.occupied=[2,3,4,5,6,7,8,9];
  await assert.rejects(()=>startSetup(directory,{},deps),error=>{
    assert.equal(error.code,'KEYBOARD_OVERLAY_SPACE_REQUIRED');assert.match(error.message,/One more empty display slot is needed/);assert.match(error.message,/one is already available/);assert.match(error.message,/2, 3, 4, 5, 6, 7, 8, 9/);assert.equal(error.writesAttempted,false);return true;
  });
  assert.equal(x.saves,0);assert.equal(x.edits.length,0);assert.deepEqual(fs.readdirSync(directory),[]);
});

test('full overlay storage asks for two slots, not one, without changing the keyboard',async t=>{
  const {x,directory,deps}=fixture(t);x.occupied=[2,3,4,5,6,7,8,9,10];
  await assert.rejects(()=>startSetup(directory,{},deps),error=>{
    assert.equal(error.code,'KEYBOARD_OVERLAY_SPACE_REQUIRED');assert.match(error.message,/Display slots are full\. Two empty overlay slots are needed/);assert.match(error.message,/Check setup → Copy setup report/);assert.doesNotMatch(error.message,/remove.*XPANEL|delete.*XPANEL/i);assert.equal(error.writesAttempted,false);return true;
  });
  assert.equal(x.saves,0);assert.equal(x.edits.length,0);assert.deepEqual(fs.readdirSync(directory),[]);
});
