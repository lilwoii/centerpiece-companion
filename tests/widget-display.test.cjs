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
