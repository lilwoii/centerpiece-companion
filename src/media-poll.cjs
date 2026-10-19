class MediaPoll {
 constructor(refresh,getMedia,timers={setTimeout,clearTimeout},policy={}){this.refresh=refresh;this.getMedia=getMedia;this.timers=timers;this.policy={active:1000,inactive:8000,paused:5000,immediate:false,...policy};this.stopped=true;this.timer=null;this.running=false;this.urgent=false;this.burst=0;}
 start(){if(!this.stopped)return;this.stopped=false;this.schedule(this.policy.immediate?0:undefined);}
 schedule(delay){if(this.stopped)return;this.timer=this.timers.setTimeout(async()=>{this.timer=null;if(this.stopped)return;this.running=true;try{await this.refresh();}finally{this.running=false;const urgent=this.urgent;this.urgent=false;const burst=this.burst>0;if(!urgent&&burst)this.burst--;this.schedule(urgent?0:burst?300:undefined);}},delay??(this.getMedia()?.available?(this.getMedia()?.status==='Paused'?this.policy.paused:this.policy.active):this.policy.inactive));}
 kick(){if(this.stopped)return;if(this.running){this.urgent=true;return;}this.timers.clearTimeout(this.timer);this.schedule(0);}
 boost(){if(this.stopped)return;this.burst=3;this.kick();}
 close(){this.stopped=true;this.burst=0;this.timers.clearTimeout(this.timer);}
}
function trackKey(media){return JSON.stringify([!!media?.available,media?.source||'',media?.title||'',media?.artist||'',media?.album||'']);}
module.exports={MediaPoll,trackKey};
