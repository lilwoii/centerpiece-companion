const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const binding={behaviorId:50397,param1:0x05070013};
test('legacy setup adds identity using read-only queries and verifies the existing plugin binding',async()=>{
 let saved,closed=0;const requests=[];
 const manifest={verified:true,serial:'display',installedBinding:binding};
 const devices=[{productId:0x200,serialNumber:'keyboard'},{productId:0x202,serialNumber:'display'}].map(d=>({...d,vendorId:0x361d,usagePage:0xff00,usage:1}));
 class Studio{constructor(){this.serial='keyboard';}close(){closed++;}async request(r){requests.push(r);const keys=Array.from({length:68},()=>({behaviorId:0}));keys[26]=binding;return{keymap:{getKeymap:{layers:[{id:0,bindings:keys},{id:1,bindings:keys}]}}};}}
 const box={module:{exports:{}},require:n=>n==='node:fs'?{writeFileSync:(_p,s)=>saved=JSON.parse(s)}:n==='./hid.cjs'?{devices:()=>devices}:n==='./studio.cjs'?{Studio}:require(n)};
 vm.runInNewContext(fs.readFileSync(require.resolve('../src/legacy-setup.cjs'),'utf8'),box);
 await box.module.exports.migrateLegacySetup('test',manifest);
 assert.equal(saved.keyboardSerial,'keyboard');assert.equal(closed,1);
 assert.equal(JSON.stringify(requests),JSON.stringify([{keymap:{getKeymap:true}}]));
 devices.push(devices[0]);saved=null;
 await assert.rejects(()=>box.module.exports.migrateLegacySetup('test',manifest),/original Centerpiece/);assert.equal(saved,null);
});
test('identity and unsaved-change failures never send discard or other keymap mutations',async()=>{
 for(const scenario of ['identity','unsaved']){
  const requests=[];
  class Studio{constructor(){this.serial=scenario==='identity'?'different':'keyboard';}close(){}async request(r){requests.push(r);if(r.keymap.getKeymap)return{keymap:{getKeymap:{layers:[{id:1,bindings:Array.from({length:68},()=>({behaviorId:56811}))}]}}};return{keymap:{checkUnsavedChanges:true}};}}
  const box={module:{exports:{}},require:n=>n==='node:fs'?{readFileSync:()=>JSON.stringify({verified:true,keyboardSerial:'keyboard'}),existsSync:()=>false}:n==='./studio.cjs'?{Studio}:n.startsWith('./')?require(require('node:path').join(__dirname,'../src',n)):require(n)};
  vm.runInNewContext(fs.readFileSync(require.resolve('../src/widget-shortcut.cjs'),'utf8'),box);
  await assert.rejects(()=>box.module.exports.widgetShortcut('test'));
  assert.equal(requests.some(r=>r.keymap.discardChanges||r.keymap.setLayerBinding||r.keymap.saveChanges),false);
  assert.equal(requests.length,scenario==='identity'?0:2);
 }
});
