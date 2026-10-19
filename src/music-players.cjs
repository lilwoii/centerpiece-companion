const {MediaBridge}=require('./media.cjs');
const {MediaPoll,trackKey}=require('./media-poll.cjs');
const {PlaybackClock}=require('./playback-clock.cjs');
const {MusicMemory}=require('./music-memory.cjs');
const {playerTarget,validateSource}=require('./music-source.cjs');

// Independent routing and clocks share one bounded Windows media worker.
class MusicPlayers {
 constructor({directory,onChange=()=>{},canRefresh=()=>true,bridgeFactory=()=>new MediaBridge('youtubemusic'),memory, timers}={}){
  this.target='desktop';this.onChange=onChange;this.canRefresh=canRefresh;this.closed=false;this.sourceRevision=0;
  this.memory=memory||new MusicMemory({directory});this.bridges={};this.clocks={};this.views={};this.polls={};this.pending={};
  for(const target of ['desktop','web']){
   const bridge=this.bridges[target]=bridgeFactory(target);bridge.target=target;
   this.clocks[target]=new PlaybackClock();this.views[target]=this.memory.update({available:false,target},target);
   this.polls[target]=new MediaPoll(()=>this.refresh(target),()=>this.views[target],timers,{active:1000,inactive:8000,paused:5000,immediate:true});
  }
 }
 get source(){return this.bridges[playerTarget(this.target)].source||'';}
 set source(value){value=validateSource(value);const target=playerTarget(this.target);for(const [name,bridge]of Object.entries(this.bridges))bridge.source=name===target?value:'';this.sourceRevision++;}
 view(target=this.target){return this.views[playerTarget(target)];}
 refresh(target=this.target){
  target=playerTarget(target);if(this.closed||!this.canRefresh())return Promise.resolve(this.view(target));
  if(this.pending[target])return this.pending[target];
  const bridge=this.bridges[target],source=bridge.source,revision=this.sourceRevision;
  const pending=Promise.resolve().then(async()=>{
   try{
    if(this.closed)return this.view(target);
    let result;try{result=await bridge.request('status');}catch(error){result={available:false,message:error.message,sources:[]};}
    if(this.closed||revision!==this.sourceRevision)return this.view(target);
    if(!result.available&&source)result={...result,source};
    const previous=this.views[target],clocked=this.clocks[target].update(result);
    this.views[target]={...this.memory.update({...clocked,target,receivedAt:Date.now()},target),target};
    // A brief discovery burst catches staggered title/cover updates promptly,
    // then returns to normal polling without keeping every player busy.
    if(trackKey(previous)!==trackKey(this.views[target]))this.polls[target].boost();
    this.onChange(target,this.views[target],previous);return this.views[target];
   }finally{delete this.pending[target];}
  });this.pending[target]=pending;return pending;
 }
 async request(action,{target=this.target}={}){
  target=playerTarget(target);if(this.closed)throw Error('Music connection is closed.');
  if(action==='status')return this.refresh(target);
  try{return await this.bridges[target].request(action);}
  finally{this.polls[target].boost();}
 }
 start(){for(const poll of Object.values(this.polls))poll.start();}
 kick(target=this.target){this.polls[playerTarget(target)].kick();}
 close(){if(this.closed)return;this.closed=true;for(const poll of Object.values(this.polls))poll.close();for(const bridge of Object.values(this.bridges))bridge.close();this.memory.persist?.(true);}
}
module.exports={MusicPlayers};
