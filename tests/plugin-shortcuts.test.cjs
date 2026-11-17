const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {configure,normalize,label,read}=require('../src/plugin-shortcuts.cjs');
function fixture(t){const directory=fs.mkdtempSync(path.join(os.tmpdir(),'plugin-shortcuts-'));t.after(()=>fs.rmSync(directory,{recursive:true,force:true}));fs.writeFileSync(path.join(directory,'hardware.json'),JSON.stringify({verified:true,keyboardSerial:'test'}));
 const x={map:{layers:[{id:1,bindings:Array.from({length:68},()=>({behaviorId:56811}))}]},pending:false,writes:0,saves:0};x.map.layers[0].bindings[26]={behaviorId:50397,param1:0x05070013};
 class Studio{constructor(){this.serial=x.serial||'test';}close(){}async request({keymap:k}){if(k.getKeymap){const result=structuredClone(x.map);x.afterRead?.();return{keymap:{getKeymap:result}};}if(k.checkUnsavedChanges)return{keymap:{checkUnsavedChanges:x.pending}};if(k.setLayerBinding){assert.equal(read(directory).inProgress,true);x.writes++;x.map.layers[0].bindings[k.setLayerBinding.keyPosition]=k.setLayerBinding.binding;x.afterWrite?.();return{keymap:{setLayerBinding:0}};}if(k.saveChanges){x.saves++;return{keymap:{saveChanges:x.fail?{err:3}:{ok:true}}};}throw Error('Unexpected request');}}
 return{directory,x,deps:{Studio}};
}
test('custom key and recovery toggle are saved, backed up and reversibly disabled',async t=>{const {directory,x,deps}=fixture(t),before=structuredClone(x.map);await configure(directory,{custom:true,position:33,engineRecovery:true},deps);assert.equal(x.map.layers[0].bindings[0].behaviorId,60498);assert.deepEqual(x.map.layers[0].bindings[33],x.map.layers[0].bindings[26]);assert.equal(label(read(directory).settings),'L1 + A');await configure(directory,{custom:false,engineRecovery:false,hideLegendsShortcut:false},deps);assert.deepEqual(x.map,before);});
test('moving shortcut restores former key and preserves P fallback',async t=>{const{directory,x,deps}=fixture(t);await configure(directory,{custom:true,position:33},deps);await configure(directory,{custom:true,position:34},deps);assert.equal(x.map.layers[0].bindings[33].behaviorId,56811);assert.deepEqual(x.map.layers[0].bindings[34],x.map.layers[0].bindings[26]);});
test('pending changes, identity mismatch and external edits are not overwritten',async t=>{for(const kind of ['pending','identity','external']){const{directory,x,deps}=fixture(t);if(kind==='external'){await configure(directory,{custom:true,position:33},deps);x.map.layers[0].bindings[33]={behaviorId:50397,param1:1};}if(kind==='pending')x.pending=true;if(kind==='identity')x.serial='different';const writes=x.writes;await assert.rejects(configure(directory,{custom:true,position:33},deps));assert.equal(x.writes,writes);}});
test('failed save keeps a checkpoint and cannot be retried automatically',async t=>{const{directory,x,deps}=fixture(t);x.fail=true;await assert.rejects(configure(directory,{custom:true,position:33},deps));assert.equal(read(directory).inProgress,true);assert.ok(fs.readdirSync(directory).some(n=>n.startsWith('shortcut-checkpoint-')));const writes=x.writes;await assert.rejects(configure(directory,{custom:true,position:33},deps));assert.equal(x.writes,writes);});
test('competing changes are detected before a global save',async t=>{const{directory,x,deps}=fixture(t);x.afterWrite=()=>{x.map.layers[0].bindings[10]={behaviorId:50397,param1:1};};await assert.rejects(configure(directory,{custom:true,position:33},deps));assert.equal(x.saves,0);});
test('reserved chords reject conflicts and every other physical position is selectable',()=>{for(let i=0;i<68;i++){if([55,62,63].includes(i))assert.throws(()=>normalize({custom:true,position:i,hideLegendsShortcut:true}));else assert.equal(normalize({custom:true,position:i,engineRecovery:false}).position,i);}assert.throws(()=>normalize({custom:true,position:0,engineRecovery:true}));assert.equal(label(),'L1 + P');assert.equal(normalize().engineRecovery,true);});
test('strip uses chosen shortcut and escapes its label',()=>{const {Workspace,defaults}=require('../src/workspace.cjs');const c=Workspace.prototype.validate(defaults());c.pluginShortcuts={custom:true,position:33};const svg=require('../src/strip.cjs').configuredSVG('idle',c,{caps:false,layer:true});assert.match(svg,/L1 \+ A/);assert.doesNotMatch(svg,/L1 \+ P/);});
test('existing XPANEL key and overlay assignments are never replaced by a custom shortcut',async t=>{for(const binding of [{behaviorId:50397,param1:0x70004},{behaviorId:10000,param1:2}]){const {directory,x,deps}=fixture(t);x.map.layers[0].bindings[37]=binding;const before=structuredClone(x.map);await assert.rejects(configure(directory,{custom:true,position:37},deps),{code:'PLUGIN_SHORTCUT_CONFLICT'});assert.deepEqual(x.map,before);assert.equal(x.writes,0);}});
test('custom Esc binding does not block startup display setup',async t=>{const {directory,x,deps}=fixture(t);x.map.layers[0].bindings[0]={behaviorId:50397,param1:0x70004};const before=structuredClone(x.map);const result=await require('../src/plugin-shortcuts.cjs').configureStartup(directory,{},deps);assert.equal(result.settings.engineRecovery,false);assert.match(result.warning,/preserve/);assert.deepEqual(x.map.layers[0].bindings[0],before.layers[0].bindings[0]);assert.equal(x.map.layers[0].bindings[62].param1,0x05070044);assert.equal(x.writes,1);});
test('key capture follows physical positions regardless of typed language',()=>{const keys=require('../src/shortcut-keys.js');assert.deepEqual(keys.names,require('../src/keymap.cjs').physical);assert.equal(keys.position('KeyG'),37);assert.equal(keys.position('KeyP'),26);assert.equal(keys.position('Slash'),55);assert.equal(keys.position('Unknown'),-1);});
test('pending optional recovery installation does not block existing display startup',async t=>{const{directory,x,deps}=fixture(t);x.pending=true;const result=await require('../src/plugin-shortcuts.cjs').configureStartup(directory,{},deps);assert.equal(result.settings.engineRecovery,false);assert.match(result.warning,/deferred/);assert.equal(x.writes,0);assert.equal(x.saves,0);});
test('pending optional changes retain verified existing shortcuts',async t=>{const{directory,x,deps}=fixture(t);await configure(directory,{custom:true,position:33},deps);x.pending=true;const writes=x.writes;const result=await require('../src/plugin-shortcuts.cjs').configureStartup(directory,{custom:true,position:34},deps);assert.equal(result.settings.position,33);assert.equal(x.writes,writes);});

test('hide shortcut preserves a conflicting XPANEL binding at startup',async t=>{const {directory,x,deps}=fixture(t);x.map.layers[0].bindings[62]={behaviorId:42547,param1:4};const result=await require('../src/plugin-shortcuts.cjs').configureStartup(directory,{},deps);assert.equal(result.settings.hideLegendsShortcut,false);assert.match(result.warning,/Right Alt/);assert.deepEqual(x.map.layers[0].bindings[62],{behaviorId:42547,param1:4});});

test('unfinished optional shortcuts defer startup using actual bindings before and after power reset',async t=>{
 const{directory,x,deps}=fixture(t),original=structuredClone(x.map);x.fail=true;
 await assert.rejects(configure(directory,{custom:true,position:33},deps));
 const file=path.join(directory,'plugin-shortcuts.json'),backup=fs.readFileSync(file),writes=x.writes,saves=x.saves;
 const api=require('../src/plugin-shortcuts.cjs');
 let result=await api.configureStartup(directory,{custom:true,position:33},deps);
 assert.equal(result.settings.position,33);assert.equal(result.settings.engineRecovery,true);assert.equal(result.settings.hideLegendsShortcut,true);assert.match(result.warning,/without saving/);
 x.map=original;result=await api.configureStartup(directory,{custom:true,position:33},deps);
 assert.equal(result.settings.position,26);assert.equal(result.settings.custom,false);assert.equal(result.settings.engineRecovery,false);assert.equal(result.settings.hideLegendsShortcut,false);
 assert.equal(x.writes,writes);assert.equal(x.saves,saves);assert.deepEqual(fs.readFileSync(file),backup);
 await assert.rejects(configure(directory,{},deps),{code:'PLUGIN_SHORTCUT_INCOMPLETE'});
});
test('unfinished startup preserves unknown optional assignments and disables their controls',async t=>{
 const{directory,x,deps}=fixture(t);x.fail=true;await assert.rejects(configure(directory,{custom:true,position:33},deps));
 for(const position of [0,33,62])x.map.layers[0].bindings[position]={behaviorId:42547,param1:8};
 const before=structuredClone(x.map),writes=x.writes,saves=x.saves;
 const result=await require('../src/plugin-shortcuts.cjs').configureStartup(directory,{},deps);
 assert.deepEqual(result.settings,{custom:false,position:26,engineRecovery:false,hideLegendsShortcut:false});assert.deepEqual(x.map,before);assert.equal(x.writes,writes);assert.equal(x.saves,saves);
});
test('unfinished startup rejects wrong identity, missing base shortcut, and unstable reads without writes',async t=>{
 for(const kind of ['identity','required','unstable']){
  const{directory,x,deps}=fixture(t);x.fail=true;await assert.rejects(configure(directory,{},deps));
  const writes=x.writes,saves=x.saves,backup=fs.readFileSync(path.join(directory,'plugin-shortcuts.json'));
  if(kind==='identity')x.serial='other';
  if(kind==='required')x.map.layers[0].bindings[26]={behaviorId:56811};
  if(kind==='unstable')x.afterRead=()=>{x.map.layers[0].bindings[10]={behaviorId:50397,param1:(x.map.layers[0].bindings[10].param1||0)+1};};
  await assert.rejects(require('../src/plugin-shortcuts.cjs').configureStartup(directory,{},deps));
  assert.equal(x.writes,writes);assert.equal(x.saves,saves);assert.deepEqual(fs.readFileSync(path.join(directory,'plugin-shortcuts.json')),backup);
 }
});

test('unfinished startup keeps valid custom Esc and Right Alt plugin controls',async t=>{
 for(const position of [0,62]){
  const{directory,x,deps}=fixture(t);x.fail=true;
  const settings={custom:true,position,engineRecovery:false,hideLegendsShortcut:false};
  await assert.rejects(configure(directory,settings,deps));
  const writes=x.writes,saves=x.saves,backup=fs.readFileSync(path.join(directory,'plugin-shortcuts.json'));
  const result=await require('../src/plugin-shortcuts.cjs').configureStartup(directory,settings,deps);
  assert.deepEqual(result.settings,settings);assert.equal(x.writes,writes);assert.equal(x.saves,saves);assert.deepEqual(fs.readFileSync(path.join(directory,'plugin-shortcuts.json')),backup);
 }
});


test('explicit interrupted recovery saves an already applied mapping and preserves its original restoration',async t=>{
 const {directory,x,deps}=fixture(t),original=structuredClone(x.map),settings={custom:true,position:33};
 x.fail=true;await assert.rejects(configure(directory,settings,deps));const writes=x.writes,saves=x.saves;
 x.fail=false;await configure(directory,settings,{...deps,recoverInterrupted:true});
 assert.equal(x.writes,writes);assert.equal(x.saves,saves+1);assert.equal(read(directory).inProgress,false);
 await configure(directory,{custom:false,engineRecovery:false,hideLegendsShortcut:false},deps);assert.deepEqual(x.map,original);
});

test('manual recovery accepts known partial and power-reset states and preserves all original bindings',async t=>{
 for(const reset of [false,true]){
  const {directory,x,deps}=fixture(t),original=structuredClone(x.map);
  await configure(directory,{custom:true,position:33},deps);const committed=structuredClone(x.map);
  x.fail=true;await assert.rejects(configure(directory,{custom:true,position:34},deps));
  if(reset)x.map=committed;else x.map.layers[0].bindings[34]=original.layers[0].bindings[34];
  x.fail=false;await configure(directory,{custom:true,position:35},{...deps,recoverInterrupted:true});
  assert.equal(read(directory).inProgress,false);assert.equal(x.map.layers[0].bindings[33].behaviorId,56811);assert.equal(x.map.layers[0].bindings[34].behaviorId,56811);
  await configure(directory,{custom:false,engineRecovery:false,hideLegendsShortcut:false},deps);assert.deepEqual(x.map,original);
 }
});

test('manual interrupted recovery rejects unknown edits, pending settings, identity and malformed backups without writes',async t=>{
 for(const kind of ['external','pending','identity','original-conflict','duplicate','invalid-binding']){
  const {directory,x,deps}=fixture(t);await configure(directory,{custom:true,position:33},deps);
  x.fail=true;await assert.rejects(configure(directory,{custom:true,position:34},deps));
  if(kind==='external')x.map.layers[0].bindings[34]={behaviorId:42547,param1:9};
  if(kind==='pending')x.pending=true;
  if(kind==='identity')x.serial='other';
  const file=path.join(directory,'plugin-shortcuts.json'),record=read(directory);
  if(kind==='original-conflict')record.planned.entries.find(e=>e.position===0).original={behaviorId:0};
  if(kind==='duplicate')record.planned.entries.push(record.planned.entries[0]);
  if(kind==='invalid-binding')record.planned.entries[0].installed=null;
  fs.writeFileSync(file,JSON.stringify(record));const backup=fs.readFileSync(file),writes=x.writes,saves=x.saves,before=structuredClone(x.map);
  await assert.rejects(configure(directory,{custom:true,position:34},{...deps,recoverInterrupted:true}));
  assert.equal(x.writes,writes);assert.equal(x.saves,saves);assert.deepEqual(x.map,before);assert.deepEqual(fs.readFileSync(file),backup);
 }
});

test('a repeatedly failed manual recovery retains enough original state for a later successful retry',async t=>{
 const {directory,x,deps}=fixture(t),original=structuredClone(x.map);x.fail=true;
 await assert.rejects(configure(directory,{custom:true,position:33},deps));
 await assert.rejects(configure(directory,{custom:true,position:34},{...deps,recoverInterrupted:true}));assert.equal(read(directory).inProgress,true);
 x.fail=false;await configure(directory,{custom:true,position:35},{...deps,recoverInterrupted:true});
 await configure(directory,{custom:false,engineRecovery:false,hideLegendsShortcut:false},deps);assert.deepEqual(x.map,original);
});

test('startup never turns an interrupted checkpoint into an automatic save even with recovery option supplied',async t=>{
 const {directory,x,deps}=fixture(t);x.fail=true;await assert.rejects(configure(directory,{custom:true,position:33},deps));
 x.fail=false;const writes=x.writes,saves=x.saves;
 await require('../src/plugin-shortcuts.cjs').configureStartup(directory,{custom:true,position:33},{...deps,recoverInterrupted:true});
 assert.equal(x.writes,writes);assert.equal(x.saves,saves);assert.equal(read(directory).inProgress,true);
});


test('completed optional shortcut backups validate originals before restoration',async t=>{
 for(const original of [undefined,null,{}, {behaviorId:'56811'}, {behaviorId:50397,param1:-1}]){
  const{directory,x,deps}=fixture(t);await configure(directory,{custom:true,position:33,engineRecovery:false,hideLegendsShortcut:false},deps);
  const file=path.join(directory,'plugin-shortcuts.json'),record=read(directory);record.entries[0].original=original;fs.writeFileSync(file,JSON.stringify(record));const before=fs.readFileSync(file,'utf8'),writes=x.writes,saves=x.saves;
  await assert.rejects(configure(directory,{custom:false,engineRecovery:false,hideLegendsShortcut:false},deps));assert.equal(x.writes,writes);assert.equal(x.saves,saves);assert.equal(fs.readFileSync(file,'utf8'),before);
 }
});
