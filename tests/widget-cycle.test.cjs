const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),vm=require('node:vm');
const{WidgetCycle,nextWidget,types}=require('../src/widget-cycle.cjs');
test('widget cycling wraps and rapid taps save every selection but coalesce display work',async()=>{assert.equal(nextWidget('off'),'spotify');const workspace={config:{widget:{type:'spotify',text:'saved text',x:1710}},save(c){this.config=c;}};let applied=0,changed=0;const cycle=new WidgetCycle(workspace,async()=>{applied++;},()=>changed++);for(let i=0;i<3;i++)cycle.press();assert.equal(workspace.config.widget.type,'cpu');assert.equal(workspace.config.widget.text,'saved text');assert.equal(changed,3);await new Promise(r=>setTimeout(r,240));assert.equal(applied,1);cycle.close();assert.equal(new Set(types).size,11);assert.equal(types.includes('follow'),false);assert.equal(nextWidget('text'),'off');assert.equal(nextWidget('follow'),'spotify');});

function fixture({pending=false,editResult=0,saveResult={err:0},normalize=false,serial='test-device'}={}){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'widget-key-test-'));
 const original={layers:[{id:0,bindings:Array.from({length:68},()=>({behaviorId:56811}))},{id:1,bindings:Array.from({length:68},()=>({behaviorId:56811}))}]};
 const state={map:structuredClone(original),writes:0,requests:[],closed:0};
 class Studio{
  constructor(){this.serial=serial;}
  close(){state.closed++;}
  async request(r){
   state.requests.push(r);
   if(r.keymap.checkUnsavedChanges)return{keymap:{checkUnsavedChanges:pending}};
   if(r.keymap.getKeymap){const map=structuredClone(state.map);if(normalize&&state.writes)for(const l of map.layers)for(const b of l.bindings){b.param1??=0;b.param2??=0;}return{keymap:{getKeymap:map}};}
   if(r.keymap.setLayerBinding){const e=r.keymap.setLayerBinding;assert.equal(e.layerId,1);assert.equal(e.keyPosition,55);state.writes++;if(editResult instanceof Error)throw editResult;if(editResult===0)state.map.layers[1].bindings[55]=e.binding;return{keymap:{setLayerBinding:editResult}};}
   if(r.keymap.saveChanges)return{keymap:{saveChanges:saveResult}};
   throw Error('Unexpected keyboard request');
  }
 }
 const box={module:{exports:{}},structuredClone,require:n=>n==='./studio.cjs'?{Studio}:n.startsWith('./')?require(path.join(__dirname,'../src',n)):require(n)};
 vm.runInNewContext(fs.readFileSync(require.resolve('../src/widget-shortcut.cjs'),'utf8'),box);
 fs.writeFileSync(path.join(dir,'hardware.json'),JSON.stringify({verified:true,keyboardSerial:'test-device'}));
 return{...box.module.exports,state,dir,original,close(){for(const f of ['hardware.json','widget-shortcut.json']){const p=path.join(dir,f);if(fs.existsSync(p))fs.unlinkSync(p);}fs.rmdirSync(dir);}};
}

test('widget shortcut backs up and changes only layer-one slash, reads back, and restores',async()=>{
 const f=fixture();try{
  await f.widgetShortcut(f.dir);assert.equal(f.state.writes,1);assert.equal(f.state.map.layers[1].bindings[55].param1,0x05070045);assert.deepEqual(f.state.map.layers[0],f.original.layers[0]);
  await f.widgetShortcut(f.dir);assert.equal(f.state.writes,1);
  await f.widgetShortcut(f.dir,true);assert.equal(JSON.stringify(f.state.map),JSON.stringify(f.original));
  f.state.map.layers[1].bindings[55]={behaviorId:50397,param1:0x05070073};await f.widgetShortcut(f.dir);assert.equal(f.state.map.layers[1].bindings[55].param1,0x05070045);
  await f.widgetShortcut(f.dir,true);assert.equal(JSON.stringify(f.state.map),JSON.stringify(f.original));
 }finally{f.close();}
});

test('already installed widget shortcut loads without saving or querying unrelated pending changes',async()=>{
 const f=fixture({pending:true});try{
  f.state.map.layers[1].bindings[55]={...f.binding,param2:0};
  assert.equal(await f.widgetShortcut(f.dir),true);
  assert.equal(f.state.writes,0);assert.equal(JSON.stringify(f.state.requests),JSON.stringify([{keymap:{getKeymap:true}}]));
  assert.equal(fs.existsSync(path.join(f.dir,'widget-shortcut.json')),false);assert.equal(f.state.closed,1);
 }finally{f.close();}
});

test('widget shortcut requires a valid clean flag only when a change is needed',async()=>{
 for(const pending of [true,null,'false',1]){
  const f=fixture({pending});try{
   await assert.rejects(()=>f.widgetShortcut(f.dir),e=>['KEYBOARD_PENDING_CHANGES','STUDIO_INVALID_PENDING_STATUS'].includes(e.code));
   assert.equal(f.state.writes,0);assert.equal(f.state.requests.some(r=>r.keymap.saveChanges||r.keymap.discardChanges),false);assert.equal(f.state.closed,1);
  }finally{f.close();}
 }
});

test('widget shortcut does not discard another client configuration after a rejected or ambiguous edit',async()=>{
 for(const editResult of [1,2,3,Error('Keyboard configuration query timed out')]){
  const f=fixture({editResult});try{
   await assert.rejects(()=>f.widgetShortcut(f.dir));assert.equal(f.state.writes,1);
   assert.equal(f.state.requests.some(r=>r.keymap.discardChanges||r.keymap.saveChanges),false);
   const backup=JSON.parse(fs.readFileSync(path.join(f.dir,'widget-shortcut.json'),'utf8'));assert.deepEqual(backup.original,f.original.layers[1].bindings[55]);
  }finally{f.close();}
 }
});

test('widget shortcut accepts explicit success and canonical protobuf zero defaults, but rejects false save',async()=>{
 const f=fixture({saveResult:{ok:true},normalize:true});try{assert.equal(await f.widgetShortcut(f.dir),true);}finally{f.close();}
 for(const saveResult of [{ok:false},{},{err:1},{err:2},{err:3}]){
  const broken=fixture({saveResult});try{await assert.rejects(()=>broken.widgetShortcut(broken.dir));assert.equal(broken.state.requests.some(r=>r.keymap.discardChanges),false);}finally{broken.close();}
 }
});

test('widget shortcut checks device identity and supported layer before accepting an installed chord',async()=>{
 const f=fixture({serial:'different-device',pending:true});try{f.state.map.layers[1].bindings[55]=f.binding;await assert.rejects(()=>f.widgetShortcut(f.dir),{code:'KEYBOARD_IDENTITY_MISMATCH'});assert.equal(f.state.requests.length,0);}finally{f.close();}
 const short=fixture({pending:true});try{short.state.map.layers[1].bindings.length=56;short.state.map.layers[1].bindings[55]=short.binding;await assert.rejects(()=>short.widgetShortcut(short.dir),{code:'KEYBOARD_LAYOUT_UNSUPPORTED'});assert.equal(short.state.writes,0);}finally{short.close();}
});
