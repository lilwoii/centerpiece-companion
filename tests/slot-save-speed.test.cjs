const test=require('node:test'),assert=require('node:assert/strict');
const {DisplayCache}=require('../src/display-cache.cjs');
const {DisplayTasks}=require('../src/display-tasks.cjs');

function fixture(pool=[2,3,4,5,6,7,8,9,10]){
 const device={active:1,uploads:[],selections:[]};
 const cache=new DisplayCache('.',(selected,config,locks,data)=>`<svg xmlns="http://www.w3.org/2000/svg" width="2" height="2"><title>${selected}/${config.slots[0].action}/${locks.caps}/${locks.layer}/${data.revision||0}</title></svg>`);
 cache.pool=[...pool];
 cache.som={currentSlot:async()=>device.active,uploadOverlay:async(slot,png,name,verify)=>{
  assert.ok(pool.includes(slot),'upload stays in Companion-owned slots');
  assert.notEqual(slot,device.active,'visible firmware overlay is not overwritten');
  device.uploads.push({slot,verify});await device.hook?.();device.active=slot;
 },selectSlot:slot=>{
  assert.ok(pool.includes(slot));assert.notEqual(slot,device.active);
  device.selections.push(slot);device.active=slot;
 }};
 const config={slots:[{plugin:'youtubemusic',action:'toggle'},null,null,null],indicator:{enabled:true},widget:{type:'clock'},weatherMotion:true};
 return {cache,device,config,tasks:new DisplayTasks(cache)};
}
async function settled(cache){const deadline=Date.now()+3000;while(cache.updating||cache.watching){if(Date.now()>deadline)throw Error('Display did not settle');await new Promise(resolve=>setTimeout(resolve,2));}}

test('changing one plugin action uploads one verified frame and never selects old action highlights',async()=>{
 for(const pool of [[2,3,4,5,6,7,8,9,10],[4,5,7,9,10],[9,10]]){
  const {cache,device,config,tasks}=fixture(pool);await tasks.run(()=>cache.apply(config,{caps:false}));
  const before=device.uploads.length,next=structuredClone(config);next.slots[0].action='next';
  await tasks.run(()=>cache.apply(next,{caps:false}));
  assert.equal(device.uploads.length-before,1,'saving skips the full highlight warmup');
  assert.equal(device.uploads.at(-1).verify,true,'new visible settings retain read-back verification');
  assert.equal(cache.cache.size,1,'old action frames are unavailable for selection');
  assert.equal(device.active,cache.cache.get('idle:0'));assert.match(cache.frames.get('idle:0'),/idle\/next\//);
  for(const id of ['previous','toggle','next','fourth']){
   const uploads=device.uploads.length,selections=device.selections.length;
   cache.show({active:true,id});await settled(cache);
   assert.equal(device.uploads.length-uploads,1,'a missing highlight is rebuilt once');
   assert.equal(device.selections.length,selections,'no previous action frame flashes before the correct highlight');
   assert.equal(device.active,cache.cache.get('nav:'+id));assert.match(cache.frames.get('nav:'+id),new RegExp(`${id}/next/`));
  }
  cache.show({active:false});cache.setLocks({caps:true});cache.setLayer(true);await settled(cache);
  assert.equal(device.active,cache.cache.get('layer:1'));assert.match(cache.frames.get('layer:1'),/idle\/next\/true\/true/);
 }
});

test('navigation requested during a fast save resolves to the newest highlight after its transfer',async()=>{
 const {cache,device,config,tasks}=fixture();await tasks.run(()=>cache.apply(config,{caps:false}));
 let release,entered;const started=new Promise(resolve=>{entered=resolve;});
 device.hook=()=>{device.hook=null;entered();return new Promise(resolve=>{release=resolve;});};
 const next=structuredClone(config);next.slots[0].action='previous';const saving=tasks.run(()=>cache.apply(next,{caps:false}));await started;
 cache.show({active:true,id:'toggle'});cache.setLocks({caps:true});cache.show({active:true,id:'fourth'});
 release();await saving;await settled(cache);
 assert.equal(device.active,cache.cache.get('nav:fourth'));assert.match(cache.frames.get('nav:fourth'),/fourth\/previous\/true\/false/);
 assert.equal(cache.error,'');
});

test('failed slot upload surfaces the error without showing stale highlights or retrying forever',async()=>{
 const {cache,device,config,tasks}=fixture();await tasks.run(()=>cache.apply(config,{caps:false}));
 const next=structuredClone(config);next.slots[0].action='next';device.hook=async()=>{throw Error('Transfer disconnected');};
 const before=device.uploads.length;await assert.rejects(tasks.run(()=>cache.apply(next,{caps:false})),/Transfer disconnected/);
 cache.show({active:true,id:'toggle'});await settled(cache);await new Promise(resolve=>setTimeout(resolve,10));
 assert.equal(cache.error,'Transfer disconnected');assert.equal(cache.cache.size,0);assert.equal(device.uploads.length,before+1);
});

test('slot edits combined with appearance changes retain complete verified initialization',async()=>{
 const {cache,device,config,tasks}=fixture();await tasks.run(()=>cache.apply(config,{caps:false}));
 const next=structuredClone(config);next.slots[0].action='next';next.indicator.on='#123456';const before=device.uploads.length;
 await tasks.run(()=>cache.apply(next,{caps:false}));assert.equal(device.uploads.length-before,8);assert.equal(cache.cache.size,8);
});

test('music progress refreshes at the normal 500ms cadence even with animated weather in the strip',async()=>{
 for(const type of ['spotify','youtubemusic','youtube'])for(const follow of [false,true]){
  const {cache,device,config}=fixture();config.slots=[{plugin:'weather',action:'refresh'},{plugin:type,action:'toggle'},null,null];config.widget.type=follow?'follow':type;
  cache.config=config;cache.setData({selected:1,revision:1});await cache.refreshLive();const before=device.uploads.length;
  cache.liveUploadedAt=Date.now()-650;cache.setData({selected:1,revision:2});await cache.refreshLive();
  assert.equal(device.uploads.length,before+1,`${type} ${follow?'follow':'direct'} is not throttled by the weather tile`);
  cache.setData({selected:1,revision:3});await cache.refreshLive();assert.equal(device.uploads.length,before+1,'rapid duplicate polling stays bounded');
 }
});

test('animated weather retains its slower upload limit when a music widget is not selected',async()=>{
 const {cache,device,config}=fixture();config.slots[0]={plugin:'weather',action:'refresh'};config.widget.type='follow';cache.config=config;
 cache.setData({revision:1});await cache.refreshLive();cache.liveUploadedAt=Date.now()-650;cache.setData({revision:2});await cache.refreshLive();assert.equal(device.uploads.length,1);
 cache.liveUploadedAt=Date.now()-1510;await cache.refreshLive();assert.equal(device.uploads.length,2);
});
