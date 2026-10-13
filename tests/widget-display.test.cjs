const test=require('node:test'),assert=require('node:assert/strict');
const {DisplayCache}=require('../src/display-cache.cjs');
test('widget switch uploads only the visible state, preserving navigation and lock caches',async()=>{
 const uploads=[];const cache=new DisplayCache('.',(selected,config,locks)=>`<svg xmlns="http://www.w3.org/2000/svg" width="2" height="2"><title>${selected}/${config.widget.type}/${locks.caps}/${locks.layer}</title></svg>`);
 cache.som={uploadOverlay:async slot=>uploads.push(slot),selectSlot:()=>{}};
 await cache.apply({indicator:{enabled:true},widget:{type:'spotify'}},{caps:true});uploads.length=0;cache.som.selectSlot=()=>assert.fail("No unrelated frame should be selected");
 cache.layer=true;cache.desired='idle';const before=new Map(cache.cache);
 cache.setWidget({type:'clock'});await cache.refreshLive();
 assert.deepEqual(uploads,[10]);assert.equal(cache.caps,true);assert.equal(cache.layer,true);assert.equal(cache.desired,'idle');
 for(const [key,slot]of before)if(key!=='layer:1')assert.equal(cache.cache.get(key),slot);
 await cache.refreshLive();assert.equal(uploads.length,1);
 cache.setWidget({type:'weather'});await cache.refreshLive();assert.equal(uploads.length,2);assert.equal(cache.cache.size,8);
});
test('custom text reaches the visible frame with one acknowledged live upload',async()=>{const calls=[];const cache=new DisplayCache('.',require('../src/strip.cjs').configuredSVG);cache.som={uploadOverlay:async(slot,png,name,verify)=>calls.push({slot,verify}),selectSlot:()=>{}};const config=require('../src/workspace.cjs').defaults();config.widget={type:'spotify',text:'',x:1710,y:219,width:194,height:94};await cache.apply(config,{caps:false});assert.ok(calls.every(c=>c.verify===true));calls.length=0;cache.setWidget({...config.widget,type:'text',text:'Hello <community> & friends'});await cache.refreshLive();assert.equal(calls.length,1);assert.equal(calls[0].verify,false);assert.match(cache.frames.get('idle:0'),/Hello &lt;community&gt;/);});
test('live transfers still require both upload acknowledgements and reject a failed transfer',async()=>{const {Som}=require('../src/som.cjs'),sharp=require('sharp');const png=await sharp({create:{width:2,height:2,channels:4,background:'#ffffff'}}).png().toBuffer();const calls=[],som={transfer:async type=>calls.push(type),readOverlay:()=>assert.fail('Live upload should not read the whole preview back')};await Som.prototype.uploadOverlay.call(som,2,png,'Live frame',false);assert.deepEqual(calls,[1,4]);som.transfer=async()=>{throw Error('Firmware rejected upload');};await assert.rejects(()=>Som.prototype.uploadOverlay.call(som,2,png,'Live frame',false),/Firmware rejected/);});

function poolFixture(pool){
 const x={active:2,uploads:[],selections:[]};
 const cache=new DisplayCache('.',(selected,config,locks,data)=>`<svg xmlns="http://www.w3.org/2000/svg" width="2" height="2"><title>${selected}/${locks.caps}/${locks.layer}/${config.widget.type}/${data.revision||0}</title></svg>`);
 cache.pool=[...pool];cache.manifest={ownedSlots:[...pool],originalSlot:2};
 cache.som={currentSlot:async()=>x.active,uploadOverlay:async slot=>{
  assert.ok(pool.includes(slot),'upload stays in allocated empty slots');assert.notEqual(slot,x.active,'never overwrite the active frame');
  x.uploads.push(slot);await x.uploadHook?.();x.active=slot;
 },selectSlot:slot=>{assert.ok(pool.includes(slot),'selection stays in allocated slots');assert.notEqual(slot,x.active,'selecting the current slot would toggle it off');x.selections.push(slot);x.active=slot;},activate:async slot=>{x.active=slot;},close(){}};
 return{x,cache,config:{indicator:{enabled:true},widget:{type:'spotify'}}};
}
async function settled(cache){const deadline=Date.now()+3000;do{await new Promise(resolve=>setTimeout(resolve,2));if(!cache.updating&&!cache.watching)return;if(Date.now()>deadline)throw Error('Cache did not settle');}while(true);}

test('visibility toggles use at most one upload and retain reusable navigation frames',async()=>{
 const {DisplayTasks}=require('../src/display-tasks.cjs');
 for(const pool of [[2,3,4,5,6,7,8,9,10],[9,10]]){
  const {x,cache,config}=poolFixture(pool),tasks=new DisplayTasks(cache);
  cache.render=(selected,c,locks)=>`<svg xmlns="http://www.w3.org/2000/svg" width="2" height="2"><title>${c.stripEnabled!==false}/${selected}/${locks.caps}/${c.widget.type}</title></svg>`;
  await tasks.run(()=>cache.apply(config,{caps:false}));const initial=x.uploads.length;
  for(const enabled of [false,true,false,true]){
   const before=x.uploads.length;await tasks.run(()=>cache.apply({...config,stripEnabled:enabled},{caps:false}));
   assert.ok(x.uploads.length-before<=1,'toggle must not rebuild every highlight');
   assert.equal(x.active,cache.cache.get(cache.key()));
   assert.match(cache.frames.get(cache.key()),new RegExp(`${enabled}/idle/false/spotify`));
  }
  if(pool.length===9){assert.equal(x.uploads.length-initial,1,'repeat toggles select cached frames');for(const id of ['previous','toggle','next','fourth']){const before=x.uploads.length;cache.show({active:true,id});assert.equal(x.active,cache.cache.get('nav:'+id));assert.equal(x.uploads.length,before);}}
 }
});

test('visibility with other edits uses full rebuild and failed toggle is surfaced',async()=>{
 const {x,cache,config}=poolFixture([2,3,4,5,6,7,8,9,10]);await cache.apply(config,{caps:false});let before=x.uploads.length;
 await cache.apply({...config,stripEnabled:false,widget:{type:'clock'}},{caps:false});assert.ok(x.uploads.length-before>1);
 x.uploadHook=async()=>{throw Error('Disconnected during toggle');};await assert.rejects(cache.apply({...cache.config,stripEnabled:true},{caps:false}),/Disconnected during toggle/);assert.match(cache.error,/Disconnected/);
});

test('eight, five and two free slots preserve occupied overlays through navigation, Caps and live frames',async()=>{
 for(const pool of [[3,4,5,6,7,8,9,10],[4,5,7,9,10],[9,10]]){
  const {x,cache,config}=poolFixture(pool);await cache.apply(config,{caps:false});await settled(cache);
  assert.equal(cache.cache.size,pool.length-1);assert.equal(x.active,cache.cache.get('idle:0'));
  for(const id of ['previous','toggle','next','fourth','previous']){cache.show({active:true,id});await settled(cache);assert.equal(x.active,cache.cache.get('nav:'+id));}
  cache.show({active:false});cache.setLocks({caps:true});cache.setLayer(true);await settled(cache);
  assert.equal(x.active,cache.cache.get('layer:1'));cache.setLayer(false);await settled(cache);assert.equal(x.active,cache.cache.get('idle:1'));
  cache.setData({revision:2});await cache.refreshLive();await settled(cache);assert.match(cache.frames.get('idle:1'),/\/2<\/title>/);
  assert.equal(cache.cache.size,pool.length-1);assert.equal(new Set(cache.cache.values()).size,cache.cache.size);assert.ok(x.uploads.every(slot=>slot!==2));assert.equal(cache.error,'');
  await cache.close();assert.equal(x.active,2,'closing restores the untouched original overlay');
 }
});

test('eight-slot allocation keeps all arrow and Caps highlights cached while L1 hints share one cache entry',async()=>{
 const {x,cache,config}=poolFixture([3,4,5,6,7,8,9,10]);await cache.apply(config,{caps:false});await settled(cache);const before=x.uploads.length;
 for(let repeat=0;repeat<10;repeat++)for(const id of ['previous','toggle','next','fourth'])cache.show({active:true,id});
 cache.show({active:false});cache.setLocks({caps:true});cache.setLocks({caps:false});assert.equal(x.uploads.length,before,'arrows and Caps use cached frames');
 cache.setLayer(true);cache.setLocks({caps:true});await settled(cache);
 for(const key of ['idle:0','idle:1','nav:previous','nav:toggle','nav:next','nav:fourth','layer:1'])assert.ok(cache.cache.has(key),key+' stays available');
 assert.equal(cache.cache.has('layer:0'),false);assert.equal(cache.cache.size,7);assert.equal(cache.error,'');
});

test('rapid selection and widget changes during a two-slot upload resolve to the latest requested state',async()=>{
 const {x,cache,config}=poolFixture([9,10]);await cache.apply(config,{caps:false});await settled(cache);let release,entered;
 const started=new Promise(resolve=>{entered=resolve;});x.uploadHook=()=>{x.uploadHook=null;entered();return new Promise(resolve=>{release=resolve;});};
 cache.show({active:true,id:'previous'});await started;
 for(let n=0;n<50;n++){cache.setLocks({caps:n%2===0});cache.setLayer(n%3===0);cache.show({active:true,id:['previous','toggle','next','fourth'][n%4]});}
 cache.setWidget({type:'clock'});cache.show({active:false});cache.setLocks({caps:true});cache.setLayer(false);release();await settled(cache);
 assert.equal(cache.desired,'idle');assert.equal(x.active,cache.cache.get('idle:1'));assert.match(cache.frames.get('idle:1'),/\/clock\//);assert.equal(cache.cache.size,1);assert.equal(cache.error,'');
});

test('on-demand display misses wait for configuration tasks and do not restart after close',async()=>{
 const {DisplayTasks}=require('../src/display-tasks.cjs');
 for(const close of [false,true]){
  const {x,cache,config}=poolFixture([9,10]);await cache.apply(config,{caps:false});await settled(cache);const before=x.uploads.length,tasks=new DisplayTasks(cache);let release,entered;
  const started=new Promise(resolve=>{entered=resolve;});const checking=tasks.run(async()=>{entered();await new Promise(resolve=>{release=resolve;});});await started;
  cache.show({active:true,id:'fourth'});await new Promise(resolve=>setTimeout(resolve,5));assert.equal(x.uploads.length,before);
  const closing=close?tasks.run(()=>cache.close()):Promise.resolve();release();await checking;await closing;await settled(cache);
  if(close){assert.equal(cache.som,null);assert.equal(x.uploads.length,before);}else{assert.equal(x.active,cache.cache.get('nav:fourth'));assert.equal(x.uploads.length,before+1);}
 }
});

test('failed on-demand upload is recorded once without an unhandled retry loop',async()=>{
 const {x,cache,config}=poolFixture([9,10]);await cache.apply(config,{caps:false});await settled(cache);const before=x.uploads.length;
 x.uploadHook=async()=>{throw Error('Simulated upload failure');};cache.show({active:true,id:'next'});await settled(cache);assert.equal(cache.error,'Simulated upload failure');
 await new Promise(resolve=>setTimeout(resolve,10));assert.equal(x.uploads.length,before+1);
});

test('saved display pools reject duplicate, reserved or insufficient slots',()=>{
 const{ownedPool}=require('../src/display-cache.cjs');assert.deepEqual(ownedPool({}),[2,3,4,5,6,7,8,9,10]);assert.deepEqual(ownedPool({ownedSlots:[3,5,10]}),[3,5,10]);
 for(const ownedSlots of [[],[2],[2,2],[1,2],[2,11],['2',3],null])assert.throws(()=>ownedPool({ownedSlots}));
});

test('Caps and navigation cannot emit display packets during exclusive native transfers',async()=>{
 const sent=[],cache=new DisplayCache('.',()=>''),{DisplayTasks}=require('../src/display-tasks.cjs');
 cache.som={selectSlot:slot=>sent.push(slot)};cache.config={};cache.cache.set('idle:0',2);cache.cache.set('idle:1',3);cache.cache.set('nav:next',4);cache.lastSlot=2;
 const tasks=new DisplayTasks(cache);await tasks.run(async()=>{cache.setLocks({caps:true});cache.show({active:true,id:'next'});cache.setLayer(true);assert.deepEqual(sent,[]);});
 assert.deepEqual(sent,[4]);assert.equal(cache.desired,'next');assert.equal(cache.caps,true);
});

test('animated live frames are rate limited to prevent rapid full-screen flashes',async()=>{
 const uploads=[];const cache=new DisplayCache('.',(selected,config)=>'<svg xmlns="http://www.w3.org/2000/svg" width="2" height="2"><title>'+Date.now()+'</title></svg>');
 cache.som={uploadOverlay:async slot=>uploads.push(slot),selectSlot:()=>{}};
 cache.config={widget:{type:'weather'},weatherMotion:true,slots:[]};
 await cache.refreshLive();await cache.refreshLive();
 assert.equal(uploads.length,1);
 cache.liveUploadedAt=Date.now()-1501;await cache.refreshLive();
 assert.equal(uploads.length,2);
});

test('animated weather never throttles an uncached navigation highlight',async()=>{
 const {x,cache,config}=poolFixture([9,10]);config.widget={type:'weather'};config.weatherMotion=true;
 await cache.apply(config,{caps:false});await settled(cache);
 cache.liveUploadedAt=Date.now();cache.show({active:true,id:'fourth'});await settled(cache);
 assert.equal(x.active,cache.cache.get('nav:fourth'));
 assert.equal(cache.desired,'fourth');assert.equal(cache.error,'');
});

function musicFixture(){
 let now=10000,id=0;const timers=new Map(),device={active:1,uploads:[],selections:[],concurrent:0,maxConcurrent:0};
 const cache=new DisplayCache('.',(selected,config,locks,data)=>{
  const slot=config.slots[data.selected||0],media=config.widget.type==='follow'?data.youtubeMusicByTarget?.[slot.mediaTarget||config.youtubeMusicTarget]:data.youtubeMusic;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="2" height="2"><title>${selected}/${locks.caps}/${locks.layer}/${media?.title}/${media?.art}/${media?.position}</title></svg>`;
 },{now:()=>now,setTimeout:(callback,delay)=>{const token=++id;timers.set(token,{at:now+delay,callback});return token;},clearTimeout:token=>timers.delete(token)});
 cache.config={widget:{type:'youtubemusic'},youtubeMusicTarget:'desktop',weatherMotion:true,slots:[{plugin:'weather'},{plugin:'youtubemusic',mediaTarget:'web'}]};
 cache.manifest={originalSlot:1};
 cache.som={uploadOverlay:async(slot,png,name,verify)=>{
  assert.notEqual(slot,device.active,'active overlay is never overwritten');
  assert.ok(cache.pool.includes(slot));device.concurrent++;device.maxConcurrent=Math.max(device.maxConcurrent,device.concurrent);
  device.uploads.push({slot,verify});try{await device.hook?.();device.active=slot;}finally{device.concurrent--;}
 },selectSlot:slot=>{assert.notEqual(slot,device.active,'a selected frame must not toggle off');device.selections.push(slot);device.active=slot;},activate:async slot=>{device.active=slot;},close(){}};
 function set(title='First',art='cover-one',position=0,more={}){cache.setData({youtubeMusic:{available:true,source:'desktop',title,artist:'Artist',art,position},...more});}
 async function advance(ms){now+=ms;for(const [token,timer]of [...timers])if(timer.at<=now){timers.delete(token);timer.callback();}await settled(cache);}
 set();return {cache,device,set,advance,timers};
}

test('new music metadata and artwork bypass the animation delay with one bounded pending upload',async()=>{
 const {cache,device,set,advance,timers}=musicFixture();await cache.refreshLive();
 await advance(300);set('Second','cover-two');await cache.refreshLive();
 assert.equal(device.uploads.length,2,'new title/art does not wait for the 500ms animation deadline');
 await advance(50);set('Second','cover-two-updated');await cache.refreshLive();
 assert.equal(device.uploads.length,2,'rapid artwork changes keep the content transfer floor');assert.equal(timers.size,1);
 await advance(199);assert.equal(device.uploads.length,2);await advance(1);
 assert.equal(device.uploads.length,3,'deferred cover is delivered without another polling tick');
 assert.match(cache.frames.get('idle:0'),/Second\/cover-two-updated/);
 assert.ok(device.uploads.every(upload=>upload.verify===false),'live writes preserve the normal acknowledged upload path');assert.equal(device.maxConcurrent,1);
});

test('music time samples do not bypass the animation throttle and coalesce to the latest position',async()=>{
 const {cache,device,set,advance,timers}=musicFixture();await cache.refreshLive();
 for(let i=1;i<=20;i++){await advance(10);set('First','cover-one',i);await cache.refreshLive();}
 assert.equal(device.uploads.length,1);assert.equal(timers.size,1,'polling creates only one deadline');
 await advance(299);assert.equal(device.uploads.length,1);await advance(1);
 assert.equal(device.uploads.length,2);assert.match(cache.frames.get('idle:0'),/cover-one\/20/);assert.equal(timers.size,0);
});

test('music changes during an upload preserve only the latest content and latest Caps/navigation state',async()=>{
 for(const pool of [[2,3,4,5,6,7,8,9,10],[9,10]]){
  const {cache,device,set,advance}=musicFixture();cache.pool=pool;await cache.apply(cache.config,{caps:false});device.uploads.length=0;device.selections.length=0;
  let release,entered;const started=new Promise(resolve=>{entered=resolve;});device.hook=()=>{device.hook=null;entered();return new Promise(resolve=>{release=resolve;});};
  set('Second','cover-two');const writing=cache.refreshLive();await started;
  set('Third','cover-three');cache.show({active:true,id:'toggle'});await cache.refreshLive();
  set('Latest','cover-latest');cache.setLocks({caps:true});cache.setLayer(true);cache.show({active:true,id:'fourth'});
  release();await writing;await advance(250);
  assert.equal(device.uploads.length,2,'intermediate song and navigation changes are coalesced');
  assert.equal(device.maxConcurrent,1);assert.deepEqual(device.selections,[],'old song frames are never selected while waiting for current artwork');
  assert.equal(device.active,cache.cache.get('nav:fourth'));assert.match(cache.frames.get('nav:fourth'),/fourth\/true\/false\/Latest\/cover-latest/);
  cache.show({active:false});await advance(250);
  assert.equal(device.active,cache.cache.get('layer:1'));assert.match(cache.frames.get('layer:1'),/idle\/true\/true\/Latest\/cover-latest/);
  assert.equal(cache.error,'');
 }
});

test('only the displayed music player can request content-priority uploads including Follow targets',async()=>{
 const {cache,device,set,advance,timers}=musicFixture();
 const web={available:true,source:'web',title:'Web-first',artist:'Artist',art:'web-cover',position:0};
 set('First','cover-one',0,{youtubeMusicByTarget:{web},selected:1});await cache.refreshLive();
 set('First','cover-one',1,{youtubeMusicByTarget:{web:{...web,title:'Web-new'}},selected:1});await advance(300);await cache.refreshLive();
 assert.equal(device.uploads.length,1,'hidden Web metadata does not promote Desktop progress');assert.equal(timers.size,1);
 cache.setWidget({type:'follow'});await cache.refreshLive();assert.equal(device.uploads.length,2);assert.match(cache.frames.get('idle:0'),/Web-new/);
 set('Desktop-new','desktop-new-cover',1,{youtubeMusicByTarget:{web:{...web,title:'Web-new',position:1}},selected:1});await advance(300);await cache.refreshLive();
 assert.equal(device.uploads.length,2,'hidden Desktop metadata does not promote Follow-Web progress');
 set('Desktop-new','desktop-new-cover',1,{youtubeMusicByTarget:{web:{...web,title:'Web-latest',position:1}},selected:1});await cache.refreshLive();
 assert.equal(device.uploads.length,3);assert.match(cache.frames.get('idle:0'),/Web-latest/);
});

test('a queued music update waits for exclusive display tasks and is canceled on disconnect',async()=>{
 for(const detached of [false,true]){
  const {cache,device,set,advance,timers}=musicFixture();await cache.refreshLive();set('Next','next-cover');await cache.refreshLive();assert.equal(timers.size,1);
  cache.tasksPaused=true;await advance(300);assert.equal(device.uploads.length,1,'no scheduled write during another display task');
  if(detached)cache.detach();cache.tasksPaused=false;cache.displayReady();await settled(cache);
  assert.equal(device.uploads.length,detached?1:2);assert.equal(timers.size,0);
 }
});

test('metadata changes outside visible labels do not delay selecting an identical cached highlight',async()=>{
 const {cache,device,set}=musicFixture();cache.render=(selected)=>`<svg xmlns="http://www.w3.org/2000/svg" width="2" height="2"><title>${selected}</title></svg>`;
 await cache.apply(cache.config,{caps:false});const before=device.uploads.length;
 set('Changed metadata with the same rendered frame');cache.show({active:true,id:'toggle'});await settled(cache);
 assert.equal(device.uploads.length,before);assert.equal(device.active,cache.cache.get('nav:toggle'));
});
