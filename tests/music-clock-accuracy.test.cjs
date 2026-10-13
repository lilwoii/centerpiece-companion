const test=require('node:test');
const assert=require('node:assert/strict');
const {PlaybackClock,positionAt}=require('../src/playback-clock.cjs');
const sample=(values={})=>({available:true,source:'youtube-music-desktop-app.exe',title:'Track',artist:'Artist',album:'Album',status:'Playing',duration:226,rawPosition:.014008,timelineUpdatedAt:100000,playbackRate:1,...values});

test('a desktop track-start timeline older than thirty seconds resumes at its actual age',()=>{
 const clock=new PlaybackClock();
 const media=clock.update(sample(),165000,165000);
 assert.equal(media.position,65.014008);
 assert.equal(positionAt(media,166500),66.514008);
 // Actual observed desktop behavior: repeated raw position and source timestamp.
 const next=clock.update(sample(),165500,165500);
 assert.equal(next.position,65.514008);
});

test('video clocks apply reported playback speed to initial age and subsequent frames',()=>{
 const clock=new PlaybackClock();
 const media=clock.update(sample({source:'chrome.exe',rawPosition:30,playbackRate:1.5}),102000,102000);
 assert.equal(media.position,33);
 assert.equal(positionAt(media,104000),36);
 const repeated=clock.update(sample({source:'chrome.exe',rawPosition:30,playbackRate:1.5}),104000,104000);
 assert.equal(repeated.position,36);
});

test('a playback-rate change is anchored to the updated timeline, without applying the new rate retroactively',()=>{
 const clock=new PlaybackClock();
 clock.update(sample({rawPosition:30}),100000,100000);
 const changed=clock.update(sample({rawPosition:35,timelineUpdatedAt:105000,playbackRate:2}),105000,105000);
 assert.equal(changed.position,35);
 assert.equal(positionAt(changed,107000),39);
});

test('paused and closed sessions do not extrapolate, and unavailable timestamps use the sampled position',()=>{
 for(const status of ['Paused','Closed']){
  const media=new PlaybackClock().update(sample({rawPosition:42,status}),165000,165000);
  assert.equal(positionAt(media,200000),42);
 }
 for(const timelineUpdatedAt of [undefined,null,NaN,-11644473600000]){
  const media=new PlaybackClock().update(sample({rawPosition:42,timelineUpdatedAt}),165000,165000);
  assert.equal(media.position,42);
 }
 const ended=new PlaybackClock().update(sample(),900000,900000);
 assert.equal(ended.position,226);
});

test('missing/invalid speed falls back to normal playback and zero speed remains stationary',()=>{
 for(const playbackRate of [undefined,null,NaN,Infinity,-1,99]){
  const media=new PlaybackClock().update(sample({rawPosition:10,playbackRate}),101000,101000);
  assert.equal(positionAt(media,102000),12);
 }
 const media=new PlaybackClock().update(sample({rawPosition:10,playbackRate:0}),101000,101000);
 assert.equal(positionAt(media,102000),10);
});

test('restarting the same desktop song honors a newer zero-position timeline',()=>{
 const clock=new PlaybackClock();
 const playing=clock.update(sample({rawPosition:0}),160000,160000);
 assert.equal(playing.position,60);
 const restarted=clock.update(sample({rawPosition:0,timelineUpdatedAt:160100}),160100,160100);
 assert.equal(restarted.position,0);
 assert.equal(positionAt(restarted,161100),1);
 // A delayed report from before the restart must not put the old position back.
 const stale=clock.update(sample({rawPosition:40,timelineUpdatedAt:140000}),161100,161100);
 assert.equal(stale.position,1);
});
