const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {KeymapEditor}=require('../src/keymap.cjs');
function fixture(){const directory=fs.mkdtempSync(path.join(os.tmpdir(),'companion-key-test-'));const e=new KeymapEditor(directory);let map={layers:[{id:0,bindings:Array.from({length:68},()=>({behaviorId:56811,param1:0}))}]};e.snapshot=structuredClone(map);e.serial='test';e.use=async fn=>fn({serial:'test',request:async({keymap:q})=>{if(q.checkUnsavedChanges)return{keymap:{checkUnsavedChanges:false}};if(q.getKeymap)return{keymap:{getKeymap:structuredClone(map)}};if(q.setLayerBinding){const v=q.setLayerBinding;map.layers[0].bindings[v.keyPosition]=v.binding;return{keymap:{setLayerBinding:0}};}if(q.saveChanges)return{keymap:{saveChanges:{ok:true}}};throw Error('unexpected query');}});return {e,get:()=>map.layers[0].bindings[10],cleanup:()=>fs.rmSync(directory,{recursive:true,force:true})};}
test('screenshot applies and undo restores the exact special binding',async()=>{const f=fixture();try{await f.e.change(0,10,0x70046,0,null);assert.deepEqual(f.get(),{behaviorId:50397,param1:0x70046});await f.e.undo();assert.deepEqual(f.get(),{behaviorId:56811,param1:0});await assert.rejects(f.e.undo(),/No binding/);}finally{f.cleanup();}});
test('undo refuses to overwrite a keymap changed outside Companion',async()=>{const f=fixture();try{await f.e.change(0,10,0x70046,0,null);f.e.snapshot={layers:[]};await assert.rejects(f.e.undo(),/changed since/);assert.equal(f.get().param1,0x70046);}finally{f.cleanup();}});
test('hash and backslash presets save their real HID combinations and undo exactly',async()=>{for(const [value,mods,expected] of [[0x02070020,0,0x02070020],[0x70020,2,0x02070020],[0x70032,0,0x70032],[0x70031,0,0x70031],[0x70064,0,0x70064]]){const f=fixture();try{await f.e.change(0,10,value,mods,null);assert.equal(f.get().param1,expected);await f.e.undo();assert.deepEqual(f.get(),{behaviorId:56811,param1:0});}finally{f.cleanup();}}});

for(const change of ['keyboard','bindings'])test('reload clears Undo from an earlier '+change+' baseline',async()=>{
 const f=fixture();try{
  await f.e.change(0,10,0x70046,0,null);const current=structuredClone(f.e.snapshot);
  if(change==='bindings')current.layers[0].bindings[10]={behaviorId:50397,param1:0x70004};
  f.e.use=async fn=>fn({serial:change==='keyboard'?'other-keyboard':'test',request:async({keymap:q})=>{assert.ok(q.getKeymap,'stale undo must not reach a write');return{keymap:{getKeymap:structuredClone(current)}};}});
  await f.e.read();assert.equal(f.e.history.length,0);await assert.rejects(f.e.undo(),/No binding change/);
 }finally{f.cleanup();}
});

test('routine unchanged binding checks preserve available Undo',async()=>{
 const f=fixture();try{await f.e.change(0,10,0x70046,0,null);await f.e.read();assert.equal(f.e.history.length,1);await f.e.undo();assert.deepEqual(f.get(),{behaviorId:56811,param1:0});}finally{f.cleanup();}
});

test('failed reload invalidates earlier bindings and Undo until a fresh successful read',async()=>{
 const f=fixture();try{await f.e.change(0,10,0x70046,0,null);f.e.use=async fn=>fn({serial:'test',request:async()=>{throw Error('Device disconnected');}});await assert.rejects(f.e.read(),/Device disconnected/);assert.equal(f.e.snapshot,null);assert.equal(f.e.history.length,0);}finally{f.cleanup();}
});


test('failed binding edit never discards unrelated pending keyboard changes',async()=>{
 const f=fixture();try{
  const requests=[];const map=structuredClone(f.e.snapshot);
  f.e.use=async fn=>fn({serial:'test',request:async({keymap:q})=>{
   requests.push(q);
   if(q.checkUnsavedChanges)return {keymap:{checkUnsavedChanges:false}};
   if(q.getKeymap)return {keymap:{getKeymap:structuredClone(map)}};
   if(q.setLayerBinding){map.layers[0].bindings[20]={behaviorId:50397,param1:0x70005};throw Error('Binding timed out');}
   if(q.discardChanges)throw Error('Must not discard XPANEL edits');
   throw Error('Unexpected write');
  }});
  await assert.rejects(f.e.change(0,10,0x70046,0,null),/Binding timed out/);
  assert.equal(requests.some(q=>q.discardChanges),false);
  assert.equal(requests.some(q=>q.saveChanges),false);
  assert.equal(f.e.snapshot,null);assert.deepEqual(f.e.history,[]);
 }finally{f.cleanup();}
});


test('concurrent edits detected after binding delivery are not globally saved or discarded',async()=>{
 const f=fixture();try{
  const requests=[];const map=structuredClone(f.e.snapshot);
  f.e.use=async fn=>fn({serial:'test',request:async({keymap:q})=>{
   requests.push(q);
   if(q.checkUnsavedChanges)return {keymap:{checkUnsavedChanges:false}};
   if(q.getKeymap)return {keymap:{getKeymap:structuredClone(map)}};
   if(q.setLayerBinding){const v=q.setLayerBinding;map.layers[0].bindings[v.keyPosition]=v.binding;map.layers[0].bindings[20]={behaviorId:50397,param1:0x70005};return {keymap:{setLayerBinding:0}};}
   throw Error('Unexpected global write');
  }});
  await assert.rejects(f.e.change(0,10,0x70046,0,null),/changed during the edit/);
  assert.equal(requests.some(q=>q.discardChanges||q.saveChanges),false);
  assert.equal(f.e.snapshot,null);
 }finally{f.cleanup();}
});


test('missing or malformed pending status never authorizes a binding edit',async()=>{
 for(const response of [{},{keymap:{}},{keymap:{checkUnsavedChanges:0}},{keymap:{checkUnsavedChanges:null}}]){
  const f=fixture();try{
   let requests=0;f.e.use=async fn=>fn({serial:'test',request:async()=>{requests++;return response;}});
   await assert.rejects(f.e.change(0,10,0x70046,0,null),e=>e.code==='STUDIO_INVALID_PENDING_STATUS');
   assert.equal(requests,1);assert.equal(fs.readdirSync(f.e.directory).length,0);
  }finally{f.cleanup();}
 }
});


test('key editor never treats missing or rejected save acknowledgements as success',async()=>{
 for(const saved of [{},{ok:false},{err:2},undefined]){
  const f=fixture();try{const use=f.e.use;f.e.use=fn=>use(s=>fn({...s,request:q=>q.keymap.saveChanges?Promise.resolve({keymap:{saveChanges:saved}}):s.request(q)}));
   await assert.rejects(f.e.change(0,10,0x70004,0,null),error=>error.code==='KEYBOARD_SAVE_FAILED');assert.equal(f.e.snapshot,null);assert.equal(f.e.history.length,0);
  }finally{f.cleanup();}
 }
});
