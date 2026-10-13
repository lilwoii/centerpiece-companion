const fs=require('node:fs'),path=require('node:path'),sharp=require('sharp');const{Som}=require('./som.cjs');
const DEFAULT_POOL=[2,3,4,5,6,7,8,9,10];
const NAVIGATION=['previous','toggle','next','fourth'];
const CONTENT_INTERVAL=250;
function ownedPool(manifest){
 const pool=manifest?.ownedSlots===undefined?DEFAULT_POOL:manifest.ownedSlots;
 if(!Array.isArray(pool)||pool.length<2||pool.length>9||new Set(pool).size!==pool.length||pool.some(n=>!Number.isInteger(n)||n<2||n>10))throw Error('The saved display allocation is invalid. Run Check setup before applying the keyboard display.');
 return [...pool];
}
class DisplayCache{
 constructor(directory,render,{now=Date.now,setTimeout:later=setTimeout,clearTimeout:cancel=clearTimeout}={}){this.directory=directory;this.render=render;this.som=null;this.manifest=null;this.pool=[...DEFAULT_POOL];this.lastSlot=null;this.updating=false;this.watching=false;this.config=null;this.caps=false;this.layer=false;this.desired='idle';this.cache=new Map();this.frames=new Map();this.frameContent=new Map();this.usage=new Map();this.usedAt=0;this.data={};this.lastFrame='';this.error='';this.selectionAt=0;this.liveUploadedAt=0;this.now=now;this.later=later;this.cancel=cancel;this.liveTimer=null;this.liveDeadline=0;this.livePending=false;}
 get capacity(){return this.pool.length-1;}
 key(selected=this.desired,caps=this.caps,layer=this.layer){const key=selected!=='idle'?'nav:'+selected:layer?'layer:'+(caps?1:0):'idle:'+(caps?1:0);return this.config?.stripEnabled===false?'hidden:'+key:key;}
 frame(selected,caps,layer){const config=selected==='idle'?this.config:{...this.config,indicator:{...this.config.indicator,enabled:false}};return this.render(selected,config,{caps,layer},this.data);}
 touch(key){this.usage.set(key,++this.usedAt);}
 trim(){
  while(this.cache.size>this.capacity){
   const choices=[...this.cache].filter(([,slot])=>slot!==this.lastSlot);
   // With eight free slots, keep both Caps states and all four arrow highlights.
   // The remaining cache position is shared by the two L1 hint states.
   const dynamic=this.capacity>=7?choices.filter(([key])=>key.startsWith('layer:')):[];
   const candidates=dynamic.length?dynamic:choices;
   candidates.sort((a,b)=>(this.usage.get(a[0])||0)-(this.usage.get(b[0])||0));
   const key=candidates[0]?.[0];if(key===undefined)throw Error('The display cache has no safe frame to replace.');
   this.cache.delete(key);this.frames.delete(key);this.frameContent.delete(key);this.usage.delete(key);
  }
 }
 spare(){const used=new Set(this.cache.values());return this.pool.find(slot=>slot!==this.lastSlot&&!used.has(slot));}
 async write(slot,selected,caps,layer=false,verify=true){
  if(!this.pool.includes(slot)||slot===this.lastSlot)throw Error('The display upload target is not a free inactive companion slot.');
  const content=this.contentKey(),svg=this.frame(selected,caps,layer),png=await sharp(Buffer.from(svg)).png().toBuffer();
  await this.som.uploadOverlay(slot,png,'Companion strip',verify);
  // The firmware activates a completed overlay upload. Record that transition
  // before dropping old cache entries, so the visible slot is never overwritten.
  this.lastSlot=slot;this.selectionAt=Date.now();const key=this.key(selected,caps,layer);
  this.cache.set(key,slot);this.frames.set(key,svg);this.frameContent.set(key,content);this.touch(key);this.trim();return svg;
 }
 setWidget(widget){if(!this.config)return;this.config={...this.config,widget:structuredClone(widget)};this.liveUploadedAt=0;}
 animatedLive(){const c=this.config||{},w=c.widget||{};return c.weatherMotion!==false&&(w.type==='weather'||w.clockSeconds===true||c.appearance?.motion&&c.appearance.motion!=='off'||c.slots?.some(slot=>slot?.plugin==='weather'));}
 liveInterval(){if(!this.animatedLive())return 0;const c=this.config||{},w=c.widget||{},type=w.type==='follow'?c.slots?.[this.data.selected||0]?.plugin:w.type;return ['spotify','youtubemusic','youtube'].includes(type)?500:1500;}
 contentKey(){
  const c=this.config||{},w=c.widget||{},slot=c.slots?.[this.data.selected||0],type=w.type==='follow'?slot?.plugin:w.type;
  if(!['spotify','youtubemusic','youtube'].includes(type))return null;
  const target=type==='youtubemusic'?(w.type==='follow'?slot?.mediaTarget:null)||c.youtubeMusicTarget||'desktop':'';
  const media=(type==='spotify'?this.data.media:type==='youtube'?this.data.youtube:w.type==='follow'?(this.data.youtubeMusicByTarget?.[target]||this.data.youtubeMusic):this.data.youtubeMusic)||{};
  // Position, clock anchors and polling timestamps are deliberately excluded.
  // Only the visible player's identity/artwork can bypass animation throttling.
  return JSON.stringify([type,target,media.source,media.title,media.artist,media.album,media.art,!!media.available,!!media.remembered]);
 }
 clearLiveTimer(){if(this.liveTimer!==null)this.cancel(this.liveTimer);this.liveTimer=null;this.liveDeadline=0;}
 deferLive(delay){
  this.livePending=true;const deadline=this.now()+delay;
  if(this.liveTimer!==null&&this.liveDeadline<=deadline)return;
  this.clearLiveTimer();this.liveDeadline=deadline;
  this.liveTimer=this.later(()=>{this.liveTimer=null;this.liveDeadline=0;if(!this.som||!this.config||this.error||this.tasksPaused||this.updating||this.watching)return;void this.refreshLive().catch(error=>{this.error=error.message;});},delay);
  this.liveTimer?.unref?.();
 }
 initialStates(){
  const idle=[['idle',false,false],['idle',true,false]],layer=[['idle',false,true],['idle',true,true]],nav=NAVIGATION.map(name=>[name,false,false]);
  if(this.capacity>=8)return [...idle,...layer,...nav];
  const desired=[this.desired,this.caps,this.desired==='idle'&&this.layer];
  const priority=[...idle,...nav,layer[this.caps?1:0],layer[this.caps?0:1]];
  const states=priority.slice(0,this.capacity);
  if(!states.some(state=>this.key(...state)===this.key(...desired)))states[states.length-1]=desired;
  return states;
 }
 async apply(config,locks){
  if(!this.som)throw Error('Keyboard strip is disconnected.');if(this.updating||this.watching)throw Error('Display is busy. Try again.');
  // A slot edit needs one new visible frame, not eight sequential firmware
  // uploads. Other states are rebuilt when requested; keeping their old frame
  // mappings would briefly show the previous action or a stale highlight.
  const slotEdit=this.config&&this.cache.size&&!this.error&&Array.isArray(this.config.slots)&&Array.isArray(config.slots)&&JSON.stringify(this.config.slots)!==JSON.stringify(config.slots)&&JSON.stringify({...this.config,slots:[]})===JSON.stringify({...config,slots:[]});
  // A visibility toggle does not change the contents of the existing visible
  // frames. Retain them and render only the requested hidden/visible state.
  if(this.config&&this.cache.size&&!this.error&&(this.config.stripEnabled!==false)!==(config.stripEnabled!==false)&&JSON.stringify({...this.config,stripEnabled:true})===JSON.stringify({...config,stripEnabled:true})){
   this.config=structuredClone(config);this.caps=!!locks.caps;this.liveUploadedAt=0;
   if(!this.cache.has(this.key()))await this.refreshLive();
   this.displayReady();return;
  }
  this.clearLiveTimer();this.livePending=false;this.updating=true;this.config=structuredClone(config);this.caps=!!locks.caps;this.error='';this.liveUploadedAt=0;
  try{
   if(typeof this.som.currentSlot==='function'){
    const active=await this.som.currentSlot();if(!Number.isInteger(active)||active<0||active>10)throw Error('The display returned an invalid active slot.');
    this.lastSlot=active||null;
   }
   this.cache.clear();this.frames.clear();this.frameContent.clear();this.usage.clear();
   const states=slotEdit?[[this.desired,this.caps,this.desired==='idle'&&this.layer]]:this.initialStates();
   for(const [selected,caps,layer]of states){
    const target=this.spare();if(target===undefined)throw Error('No inactive companion display slot is available.');
    await this.write(target,selected,caps,layer);
   }
   this.lastFrame='';
  }catch(e){this.error=e.message;throw e;}finally{this.updating=false;this.displayReady();}
 }
 connect(){
  const file=path.join(this.directory,'hardware.json');if(!fs.existsSync(file))return false;
  this.manifest=JSON.parse(fs.readFileSync(file,'utf8'));if(!this.manifest.verified||this.manifest.restored)return false;
  this.pool=ownedPool(this.manifest);this.som=new Som();
  if(this.som.serial!==this.manifest.serial){this.som.close();this.som=null;throw Error('This keyboard needs its own local setup.');}
  return true;
 }
 displayReady(){
  if(!this.som||!this.config||this.updating||this.watching||this.tasksPaused)return;
  const key=this.key(),slot=this.cache.get(key);
  // Do not briefly select an old song's cached navigation/Caps frame. A
  // completed transfer is followed by at most one pending, newest-state render.
  if(slot&&!this.error&&(this.frameContent.get(key)??null)!==this.contentKey()){void this.refreshLive().catch(error=>{this.error=error.message;});return;}
  if(slot){this.touch(key);if(slot!==this.lastSlot){this.som.selectSlot(slot);this.lastSlot=slot;this.selectionAt=Date.now();}}
  else if(!this.error&&!this.tasksPaused)void this.refreshLive().catch(error=>{this.error=error.message;});
  if(slot&&this.livePending&&!this.error)void this.refreshLive().catch(error=>{this.error=error.message;});
 }
 show(nav){this.desired=nav.active?nav.id:'idle';this.displayReady();}
 setLocks(locks){this.caps=!!locks.caps;this.displayReady();}
 setLayer(active){this.layer=!!active;this.displayReady();}
 setData(data){this.data=data;}
 async refreshLive(){
  if(!this.som||!this.config)return;
  if(this.updating||this.watching){this.livePending=true;return;}
  const selected=this.desired,caps=this.caps,layer=selected==='idle'&&this.layer,key=this.key(selected,caps,layer),svg=this.frame(selected,caps,layer);
  if(this.cache.has(key)&&svg===this.frames.get(key)){this.frameContent.set(key,this.contentKey());this.livePending=false;this.clearLiveTimer();this.displayReady();return;}
  // Live animation throttling must never defer a missing selection/Caps frame.
  // New music content has a short independent bound; progress and weather keep
  // their normal limit. Wake at the deadline rather than losing the update
  // until another 500ms polling tick happens to arrive.
  const contentChanged=(this.frameContent.get(key)??null)!==this.contentKey(),interval=contentChanged?CONTENT_INTERVAL:this.liveInterval();
  const remaining=interval-(this.now()-this.liveUploadedAt);
  if(this.cache.has(key)&&interval&&this.liveUploadedAt&&remaining>0){this.deferLive(remaining);return;}
  const target=this.spare();if(target===undefined)throw Error('No inactive companion display slot is available.');
  this.clearLiveTimer();this.livePending=false;this.updating=true;
  try{this.lastFrame=await this.write(target,selected,caps,layer,false);this.liveUploadedAt=this.now();}
  catch(e){this.livePending=false;this.clearLiveTimer();this.error=e.message;throw e;}finally{this.updating=false;this.displayReady();}
 }
 async reconcile(){if(!this.som||this.watching||this.updating||!this.lastSlot||Date.now()-this.selectionAt<300)return;this.watching=true;const expected=this.lastSlot;try{const current=await this.som.currentSlot();this.lastObservedSlot=current;if(!this.som||this.cache.get(this.key())!==expected)return;if(current!==expected){this.som.selectSlot(expected);this.selectionAt=Date.now();}}finally{this.watching=false;this.displayReady();}}
 detach(){this.clearLiveTimer();this.livePending=false;const som=this.som;this.som=null;som?.close();this.cache.clear();this.frames.clear();this.frameContent.clear();this.usage.clear();this.lastSlot=null;this.lastFrame='';this.error='';this.liveUploadedAt=0;}
 async close(){this.clearLiveTimer();this.livePending=false;if(!this.som)return;const som=this.som;this.som=null;try{await som.activate(this.manifest.originalSlot||0);}finally{som.close();}}
}
module.exports={DisplayCache,ownedPool};
