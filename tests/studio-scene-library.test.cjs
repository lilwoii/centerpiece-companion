const test=require('node:test'),assert=require('node:assert/strict');
const S=require('../studio/scene-library.js'),M=require('../studio/model.js');
function environment(){const map=new Map(),storage={getItem:key=>map.has(key)?map.get(key):null,setItem:(key,value)=>map.set(key,value)};return{storage,map,initial:M.createProject('Starting design')};}

test('Different project spaces saved by two stale editor windows merge without losing either project',()=>{
 const {storage,initial}=environment(),a=S.load(storage,initial),b=S.load(storage,initial);
 const first=M.createProject('Saved by A'),second=M.createProject('Saved by B');
 S.updateSlot(storage,initial,0,first,a.slots[0]);
 const latest=S.updateSlot(storage,initial,1,second,b.slots[1]);
 assert.equal(latest.slots[0].id,first.id);
 assert.equal(latest.slots[1].id,second.id);
 assert.equal(S.load(storage,initial).slots[0].id,first.id);
 assert.equal(latest.defaultScene.id,initial.id);
});
test('A stale same-space save reports a conflict and preserves the newer saved project',()=>{
 const {storage,initial}=environment(),a=S.load(storage,initial),b=S.load(storage,initial);
 const first=M.createProject('Saved by A'),second=M.createProject('Saved by B');
 S.updateSlot(storage,initial,0,first,a.slots[0]);const raw=storage.getItem(S.KEY);
 assert.throws(()=>S.updateSlot(storage,initial,0,second,b.slots[0]),error=>error.code==='STUDIO_SCENE_CONFLICT');
 assert.equal(storage.getItem(S.KEY),raw);
 assert.equal(S.load(storage,initial).slots[0].id,first.id);
});
test('Changing the same project content also conflicts despite retaining its ID',()=>{
 const {storage,initial}=environment(),first=M.createProject('First title');
 const a=S.updateSlot(storage,initial,2,first,null),b=S.load(storage,initial);
 const changed=M.clone(first);changed.name='Renamed in A';
 S.updateSlot(storage,initial,2,changed,a.slots[2]);
 assert.throws(()=>S.updateSlot(storage,initial,2,{...first,name:'Edited in B'},b.slots[2]),error=>error.code==='STUDIO_SCENE_CONFLICT');
 assert.equal(S.load(storage,initial).slots[2].name,'Renamed in A');
});
test('Refreshing the expected space allows an intentional replacement',()=>{
 const {storage,initial}=environment(),first=M.createProject('First'),second=M.createProject('Second');
 S.updateSlot(storage,initial,4,first,null);
 const fresh=S.load(storage,initial);
 const saved=S.updateSlot(storage,initial,4,second,fresh.slots[4]);
 assert.equal(saved.slots[4].id,second.id);
 assert.deepEqual(saved.slots.slice(0,4),[null,null,null,null]);
});
test('Invalid inputs, storage failure and unreadable saved data leave the previous library intact',()=>{
 const {storage,initial,map}=environment();S.load(storage,initial);const before=storage.getItem(S.KEY);
 for(const index of [-1,5,1.5,'1'])assert.throws(()=>S.updateSlot(storage,initial,index,M.createProject('New'),null));
 assert.throws(()=>S.updateSlot(storage,initial,0,{},null));
 assert.throws(()=>S.updateSlot(storage,initial,0,M.createProject('New'),undefined));
 assert.equal(storage.getItem(S.KEY),before);
 const failing={...storage,setItem(){throw Error('Quota exceeded');}};
 assert.throws(()=>S.updateSlot(failing,initial,0,M.createProject('New'),null),/Quota exceeded/);
 assert.equal(storage.getItem(S.KEY),before);
 map.set(S.KEY,'broken library');
 assert.throws(()=>S.updateSlot(storage,initial,0,M.createProject('New'),null));
 assert.equal(storage.getItem(S.KEY),'broken library');
});
