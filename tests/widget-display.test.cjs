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
