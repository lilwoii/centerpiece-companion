const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),vm=require('node:vm');
function fixture(options={}){const pending=Object.hasOwn(options,'pending')?options.pending:false;
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'companion-restore-')),file=path.join(directory,'hardware.json');
 const binding={behaviorId:50397,param1:0x05070013};const original={behaviorId:56811};const record={serial:'display',keyboardSerial:'keyboard',originalSlot:1,originalBinding:original,ownedSlots:[4,7],preservedSlots:[2,3,5,6,8,9,10],verified:true};
 fs.writeFileSync(file,JSON.stringify(record));const before=fs.readFileSync(file,'utf8');const calls=[];let activated=false,closed=0,widgetRestores=0;
 const map={layers:[{id:1,bindings:Array.from({length:68},()=>({behaviorId:56811}))}]};map.layers[0].bindings[26]=binding;
 class Studio{constructor(){this.serial='keyboard';}close(){closed++;}async request({keymap:q}){calls.push(q);if(q.checkUnsavedChanges)return{keymap:{checkUnsavedChanges:pending}};if(q.getKeymap)return{keymap:{getKeymap:structuredClone(map)}};if(q.setLayerBinding){map.layers[0].bindings[q.setLayerBinding.keyPosition]=q.setLayerBinding.binding;return{keymap:{setLayerBinding:0}};}if(q.saveChanges)return{keymap:{saveChanges:options.failSave?{err:3}:{ok:true}}};throw Error('Unexpected request');}}
 class Som{constructor(){this.serial='display';}async activate(slot){assert.equal(slot,1);if(options.failActivate)throw Error('simulated activate failure');activated=true;}close(){closed++;}}
 const io={...fs,renameSync:(a,b)=>{if(options.failRename)throw Error('simulated storage failure');return fs.renameSync(a,b);}};
 const sandbox={module:{exports:{}},require:n=>n==='node:fs'?io:n==='./studio.cjs'?{Studio}:n==='./som.cjs'?{Som}:n==='./plugin-shortcuts.cjs'?(options.shortcuts?{read:require('../src/plugin-shortcuts.cjs').read,configure:(dir,value,deps)=>require('../src/plugin-shortcuts.cjs').configure(dir,value,{...deps,Studio})}:{read:()=>null}):n==='./widget-shortcut.cjs'?{widgetShortcut:async()=>{widgetRestores++;return false;}}:n.startsWith('./')?require(path.join(__dirname,'../src',n)):require(n)};
 vm.runInNewContext(fs.readFileSync(require.resolve('../src/setup.cjs'),'utf8'),sandbox);
 return{failRename:value=>{options.failRename=value;},failActivate:value=>{options.failActivate=value;},failSave:value=>{options.failSave=value;},installShortcuts:value=>require('../src/plugin-shortcuts.cjs').configure(directory,value,{Studio}),map,restore:()=>sandbox.module.exports.restore(directory),file,before,calls,directory,activated:()=>activated,closed:()=>closed,widgetRestores:()=>widgetRestores,clean:()=>fs.rmSync(directory,{recursive:true,force:true})};
}
test('restoring keyboard retains its exact allocation record',async()=>{const f=fixture();try{await f.restore();const result=JSON.parse(fs.readFileSync(f.file,'utf8'));assert.equal(result.restored,true);assert.deepEqual(result.ownedSlots,[4,7]);assert.deepEqual(result.preservedSlots,[2,3,5,6,8,9,10]);assert.equal(f.activated(),true);assert.equal(f.closed(),2);assert.deepEqual(fs.readdirSync(f.directory),['hardware.json']);}finally{f.clean();}});
test('failed restored-record replacement preserves readable ownership metadata',async()=>{const f=fixture({failRename:true});try{await assert.rejects(f.restore(),/storage failure/);assert.equal(fs.readFileSync(f.file,'utf8'),f.before);assert.deepEqual(fs.readdirSync(f.directory),['hardware.json']);assert.equal(f.closed(),2);}finally{f.clean();}});
test('restoration refuses malformed pending flags before modifying bindings',async()=>{for(const pending of [undefined,null,0,'false']){const f=fixture({pending});try{await assert.rejects(f.restore());assert.equal(f.calls.some(q=>q.setLayerBinding||q.saveChanges),false);assert.equal(fs.readFileSync(f.file,'utf8'),f.before);}finally{f.clean();}}});


test('restoring keyboard removes the hide-legends shortcut and returns Right Alt to its original binding',async()=>{
 const f=fixture({shortcuts:true});try{
  const original=structuredClone(f.map.layers[0].bindings[62]);
  await f.installShortcuts({custom:false,engineRecovery:false,hideLegendsShortcut:true});
  assert.equal(f.map.layers[0].bindings[62].param1,0x05070044);
  await f.restore();
  assert.deepEqual(f.map.layers[0].bindings[62],original);
  const shortcuts=JSON.parse(fs.readFileSync(path.join(f.directory,'plugin-shortcuts.json'),'utf8'));
  assert.equal(shortcuts.settings.hideLegendsShortcut,false);assert.deepEqual(shortcuts.entries,[]);
 }finally{f.clean();}
});


test('explicit restoration recovers an interrupted optional shortcut save and restores original keys',async()=>{
 const f=fixture({shortcuts:true,failSave:true});try{
  const original=structuredClone(f.map);
  await assert.rejects(f.installShortcuts({custom:true,position:33,engineRecovery:true,hideLegendsShortcut:true}),{code:'KEYBOARD_SAVE_FAILED'});
  assert.equal(JSON.parse(fs.readFileSync(path.join(f.directory,'plugin-shortcuts.json'),'utf8')).inProgress,true);
  f.failSave(false);await f.restore();
  for(const position of [0,33,62])assert.deepEqual(f.map.layers[0].bindings[position],original.layers[0].bindings[position]);
  assert.equal(JSON.parse(fs.readFileSync(path.join(f.directory,'plugin-shortcuts.json'),'utf8')).inProgress,false);
  assert.equal(JSON.parse(fs.readFileSync(f.file,'utf8')).restored,true);
 }finally{f.clean();}
});


test('explicit restoration retries after saved keys but failed overlay activation or metadata write',async()=>{
 for(const fault of ['failActivate','failRename']){
  const f=fixture({[fault]:true});try{
   await assert.rejects(f.restore(),/simulated/);
   const edits=f.calls.filter(q=>q.setLayerBinding).length,saves=f.calls.filter(q=>q.saveChanges).length;
   f[fault](false);await f.restore();
   assert.equal(f.calls.filter(q=>q.setLayerBinding).length,edits);
   assert.equal(f.calls.filter(q=>q.saveChanges).length,saves+1);
   assert.equal(JSON.parse(fs.readFileSync(f.file,'utf8')).restored,true);assert.equal(f.activated(),true);
  }finally{f.clean();}
 }
});

test('explicit restoration retries a failed save even if original bindings are in RAM and pending is false',async()=>{
 const f=fixture({failSave:true});try{
  await assert.rejects(f.restore(),{code:'KEYBOARD_SAVE_FAILED'});assert.equal(f.calls.filter(q=>q.saveChanges).length,1);
  f.failSave(false);await f.restore();assert.equal(f.calls.filter(q=>q.saveChanges).length,2);
  assert.equal(f.calls.filter(q=>q.setLayerBinding).length,1);assert.equal(JSON.parse(fs.readFileSync(f.file,'utf8')).restored,true);
 }finally{f.clean();}
});

test('restoration preserves an unknown external plugin-key reassignment',async()=>{
 const f=fixture();try{
  f.map.layers[0].bindings[26]={behaviorId:50397,param1:0x70006};const before=structuredClone(f.map);
  await assert.rejects(f.restore(),/changed outside/);assert.deepEqual(f.map,before);
  assert.equal(f.calls.some(q=>q.setLayerBinding||q.saveChanges),false);assert.equal(fs.readFileSync(f.file,'utf8'),f.before);
 }finally{f.clean();}
});


test('incomplete or malformed restoration backup cannot mutate any shortcut or display',async()=>{
 const invalid=[{originalBinding:undefined},{originalBinding:null},{originalBinding:{}},{originalBinding:{behaviorId:'50397'}},{originalBinding:{behaviorId:50397,param1:-1}},{originalSlot:undefined},{originalSlot:null},{originalSlot:11},{serial:''},{keyboardSerial:null},{pluginArrows:{}},{pluginArrows:[null]}];
 for(const patch of invalid){const f=fixture({shortcuts:true});try{
  await f.installShortcuts({custom:false,engineRecovery:false,hideLegendsShortcut:true});
  const record=JSON.parse(fs.readFileSync(f.file,'utf8'));fs.writeFileSync(f.file,JSON.stringify({...record,...patch}));
  const before=fs.readFileSync(f.file,'utf8'),map=structuredClone(f.map),count=f.calls.length;
  await assert.rejects(f.restore(),{code:'SETUP_BACKUP_UNREADABLE'});
  assert.equal(f.calls.length,count);assert.deepEqual(f.map,map);assert.equal(f.widgetRestores(),0);assert.equal(f.activated(),false);assert.equal(fs.readFileSync(f.file,'utf8'),before);
 }finally{f.clean();}}
});

test('invalid JSON or another keyboard backup is rejected before optional shortcut restoration',async()=>{
 for(const invalid of ['invalid JSON','other keyboard','other display']){const f=fixture({shortcuts:true});try{
  await f.installShortcuts({custom:false,engineRecovery:false,hideLegendsShortcut:true});
  const record=JSON.parse(fs.readFileSync(f.file,'utf8'));
  fs.writeFileSync(f.file,invalid==='invalid JSON'?'{':JSON.stringify({...record,[invalid==='other keyboard'?'keyboardSerial':'serial']:'different'}));
  const map=structuredClone(f.map),count=f.calls.length;
  await assert.rejects(f.restore());assert.equal(f.calls.length,count);assert.deepEqual(f.map,map);assert.equal(f.widgetRestores(),0);assert.equal(f.activated(),false);
 }finally{f.clean();}}
});

test('valid legacy original backup without keyboard serial still restores and can retry',async()=>{
 const f=fixture({failSave:true});try{
  const record=JSON.parse(fs.readFileSync(f.file,'utf8'));delete record.keyboardSerial;fs.writeFileSync(f.file,JSON.stringify(record));
  await assert.rejects(f.restore(),{code:'KEYBOARD_SAVE_FAILED'});f.failSave(false);await f.restore();
  assert.deepEqual(structuredClone(f.map.layers[0].bindings[26]),record.originalBinding);assert.equal(f.activated(),true);assert.equal(JSON.parse(fs.readFileSync(f.file,'utf8')).restored,true);
 }finally{f.clean();}
});
