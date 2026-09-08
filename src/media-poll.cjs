class MediaPoll {
 constructor(refresh,getMedia,timers={setTimeout,clearTimeout}){this.refresh=refresh;this.getMedia=getMedia;this.timers=timers;this.stopped=true;this.timer=null;}
 start(){if(!this.stopped)return;this.stopped=false;this.schedule();}
 schedule(){if(this.stopped)return;this.timer=this.timers.setTimeout(async()=>{try{await this.refresh();}finally{this.schedule();}},this.getMedia()?.available?300:1800);}
 close(){this.stopped=true;this.timers.clearTimeout(this.timer);}
}
function trackKey(media){return JSON.stringify([!!media?.available,media?.title||'',media?.artist||'',media?.album||'']);}
module.exports={MediaPoll,trackKey};
