const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {create,canAutosave}=require('../src/slot-autosave.js');
const {catalog}=require('../src/catalog.cjs');
const slot=action=>({plugin:'youtubemusic',action,value:''});
const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return{promise,resolve,reject};};
test('self-contained actions save on selection; input and decoration require explicit save',()=>{
 for(const action of ['toggle','next','previous','rewind','open'])assert.equal(canAutosave(catalog,'youtubemusic',action),true);
 for(const [plugin,action]of [['hotkey','hotkey'],['browser','url'],['app','app'],['obs','scene'],['obs','mute'],['decoration','display'],['youtubemusic','unknown']])assert.equal(canAutosave(catalog,plugin,action),false);
 assert.equal(canAutosave(catalog,'mic','mute'),true);
});
test('rapid choices keep the newest choice without dropping another position',async()=>{
 const calls=[],saved=[],gate=deferred();let inFlight=0,maxFlight=0;
 const queue=create({save:async input=>{inFlight++;maxFlight=Math.max(maxFlight,inFlight);calls.push(input);if(calls.length===1)await gate.promise;inFlight--;return input;},onSaved:(i,s)=>saved.push([i,s.action])});
 const first=queue.enqueue(0,slot('toggle')),replaced=queue.enqueue(0,slot('next')),other=queue.enqueue(1,slot('previous')),last=queue.enqueue(0,slot('open'));
 assert.deepEqual(await replaced,{superseded:true});gate.resolve();await Promise.all([first,other,last]);await queue.whenIdle();
 assert.equal(maxFlight,1);assert.deepEqual(calls.map(c=>[c.index,c.slot.action]),[[0,'toggle'],[0,'open'],[1,'previous']]);
 assert.deepEqual(saved,[[0,'open'],[1,'previous']]);
});
test('save snapshot cannot change when the user edits another field while pending',async()=>{
 const gate=deferred(),calls=[],queue=create({save:async value=>{calls.push(value);await gate.promise;return value;}});
 const input=slot('toggle');input.appearance={background:'#123456'};const result=queue.enqueue(2,input);
 input.action='next';input.appearance.background='#ffffff';gate.resolve();await result;
 assert.equal(calls[0].slot.action,'toggle');assert.equal(calls[0].slot.appearance.background,'#123456');
});
test('failed writes preserve the queue and allow selecting the same action to retry',async()=>{
 let count=0;const errors=[],saved=[];const queue=create({save:async value=>{if(++count===1)throw Error('Disconnected');return value;},onError:(i,e)=>errors.push([i,e.message]),onSaved:(i,s)=>saved.push([i,s.action])});
 await queue.enqueue(0,slot('toggle'));await queue.enqueue(0,slot('toggle'));await queue.whenIdle();
 assert.deepEqual(errors,[[0,'Disconnected']]);assert.deepEqual(saved,[[0,'toggle']]);
});
test('a profile change cancels pending choices and ignores an older reply',async()=>{
 const gate=deferred(),calls=[],saved=[];const queue=create({save:async input=>{calls.push(input);await gate.promise;return input;},onSaved:(i,s)=>saved.push([i,s.action])});
 const first=queue.enqueue(0,slot('toggle')),pending=queue.enqueue(1,slot('next'));queue.invalidate();gate.resolve();await first;
 assert.deepEqual(await pending,{superseded:true});await queue.whenIdle();assert.equal(calls.length,1);assert.deepEqual(saved,[]);
});
function uiFixture(){
 const elements=new Map(),writes=[],feedback=[];
 function el(id){if(!elements.has(id))elements.set(id,{value:'',listeners:{},addEventListener(type,fn){this.listeners[type]=fn;},focus(){}});return elements.get(id);}
 const saved={slots:[slot('toggle'),null,null,null],indicator:{on:'#111111'},widget:{text:'saved'}};
 const context=vm.createContext({structuredClone,window:{SlotAutosave:require('../src/slot-autosave.js'),readTileCustomization:()=>({}),companion:{setSlot:async input=>{writes.push(structuredClone(input));saved.slots[input.index]=structuredClone(input.slot);return{desk:{config:structuredClone(saved)},feedback:'Saved'};}}},el,draft:{...structuredClone(saved),widget:{text:'unsaved custom text'}},deskCurrent:{desk:{catalog,config:structuredClone(saved)}},selectedPosition:0,selectedPlugin:'youtubemusic',selectedMusicTarget:'desktop',announce:(m,e)=>feedback.push([m,e]),drawSlots(){},drawLibrary(){},drawMusicActions(){},actionHelp(){},task:(_button,fn)=>fn()});
 const source=fs.readFileSync(require.resolve('../src/desk.js'),'utf8');vm.runInContext(source.slice(source.indexOf('const slotSaves='),source.indexOf("el('run-slot').addEventListener")),context);
 return{context,el,writes,feedback,settle:()=>vm.runInContext('slotSaves.whenIdle()',context)};
}
test('choosing Open saves the selected slot, keeps unrelated unsaved fields, and executes nothing',async()=>{
 const f=uiFixture();f.el('slot-action').value='open';f.el('slot-value').value='';f.el('slot-action').listeners.change();await f.settle();
 assert.deepEqual(f.writes,[{index:0,slot:{...slot('open'),mediaTarget:'desktop'}}]);assert.equal(f.context.draft.slots[0].action,'open');assert.equal(f.context.draft.widget.text,'unsaved custom text');
 // The fixture exposes no runSlot/open methods: choosing the action only writes settings.
});
test('an incomplete shortcut remains editable until Add to keyboard',async()=>{
 const f=uiFixture();f.el('slot-action').value='hotkey';f.el('slot-value').value='Ctrl+';f.el('slot-action').listeners.change();await f.settle();assert.equal(f.writes.length,0);
 f.el('slot-value').value='Ctrl+F10';await f.el('save-slot').listeners.click();assert.equal(f.writes[0].slot.value,'Ctrl+F10');
});
