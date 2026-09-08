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
