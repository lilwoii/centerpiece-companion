const now=()=>performance.timeOrigin+performance.now();
const number=(v,fallback=0)=>Number.isFinite(v)?v:fallback;
function positionAt(media,time=now()){const duration=Math.max(0,number(media?.duration));return Math.min(duration,Math.max(0,number(media?.position)+(media?.status==='Playing'?Math.max(0,time-number(media.positionTimestamp,time))/1000:0)));}
class PlaybackClock{
 constructor(){this.last=null;}
 update(media,time=now(),wall=Date.now()){
  if(!media?.available){this.last=null;return media;}
  const key=JSON.stringify([media.title,media.artist,media.album]),raw=Math.max(0,number(media.rawPosition,number(media.position))),source=number(media.timelineUpdatedAt,wall),duration=Math.max(0,number(media.duration));
  const age=Math.max(0,Math.min(30,(wall-source)/1000));let measured=raw+(media.status==='Playing'?age:0),position=measured;
  const old=this.last;
  if(old&&old.key===key){
   const projected=positionAt(old.media,time),elapsed=Math.max(0,(time-old.time)/1000);
   if(media.status==='Playing'&&old.media.status==='Playing'){
    // Repeated/coarse reports do not restart the local clock. New samples can seek.
    if(source<old.source||raw===old.raw)position=projected;
    else{const error=measured-projected;position=Math.abs(error)>1.25?measured:Math.max(old.media.position,projected+Math.max(-elapsed*.1,Math.min(elapsed*.1,error)));}
   }else if(media.status==='Playing'&&source<=old.source)position=old.media.position;
  }
  const result={...media,position:Math.min(duration,Math.max(0,position)),positionTimestamp:time};this.last={key,raw,source,media:result,time};return result;
 }
}
module.exports={PlaybackClock,positionAt};
