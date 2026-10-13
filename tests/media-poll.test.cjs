const test=require('node:test'),assert=require('node:assert/strict');const {MediaPoll,trackKey}=require('../src/media-poll.cjs');
test('Spotify checks run promptly without overlapping or continuing after close',async()=>{let callback,delay,calls=0,release;const poll=new MediaPoll(()=>{calls++;return new Promise(r=>release=r);},()=>({available:true}),{setTimeout:(fn,ms)=>{callback=fn;delay=ms;return 1;},clearTimeout:()=>{callback=null;}});poll.start();assert.equal(delay,300);const running=callback();assert.equal(calls,1);poll.start();assert.equal(calls,1);poll.close();release();await running;assert.equal(callback,null);});
test('missing Spotify backs off and metadata changes distinguish tracks from timer movement',()=>{let delay;new MediaPoll(()=>{},()=>({available:false}),{setTimeout:(_fn,ms)=>delay=ms,clearTimeout:()=>{}}).start();assert.equal(delay,1800);const first={available:true,title:'First',artist:'Artist',album:'Album',position:1};assert.equal(trackKey(first),trackKey({...first,position:2}));assert.notEqual(trackKey(first),trackKey({...first,title:'Next'}));assert.notEqual(trackKey(first),trackKey({...first,album:'Other release'}));});

test('music reconnect polls promptly and command refreshes coalesce without overlap',async()=>{
 let callback,delay,calls=0,release;const poll=new MediaPoll(()=>{calls++;return new Promise(r=>release=r);},()=>({available:false}),{setTimeout:(fn,ms)=>{callback=fn;delay=ms;return 1;},clearTimeout:()=>{callback=null;}},{active:250,inactive:500,immediate:true});
 poll.start();assert.equal(delay,0);const first=callback();poll.kick();poll.kick();assert.equal(calls,1);release();await first;assert.equal(delay,0);
 const second=callback();assert.equal(calls,2);release();await second;assert.equal(delay,500);
 poll.kick();assert.equal(delay,0);poll.close();assert.equal(callback,null);
});

test('track-change discovery bursts are bounded, coalesced and return to the normal interval',async()=>{
 let callback,delay,calls=0,release;
 const poll=new MediaPoll(()=>{calls++;return new Promise(resolve=>{release=resolve;});},()=>({available:true}),{setTimeout:(fn,ms)=>{callback=fn;delay=ms;return 1;},clearTimeout:()=>{callback=null;}},{active:250,inactive:500});
 poll.start();const initial=callback();poll.boost();poll.boost();assert.equal(calls,1);
 release();await initial;assert.equal(delay,0,'changes during a read get one immediate follow-up');
 for(let index=0;index<8;index++){const next=callback();release();await next;assert.equal(delay,100);}
 const normal=callback();release();await normal;assert.equal(delay,250,'the burst ends without another track change');
 poll.close();poll.boost();assert.equal(callback,null,'closing cancels pending discovery');
});
