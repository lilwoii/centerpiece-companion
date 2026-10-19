const test=require('node:test'),assert=require('node:assert/strict');
const {SleepService}=require('../src/sleep-service.cjs');
test('native timer writes requested duration, confirms separate readback and restores original',async()=>{let current=30;const writes=[];const s=new SleepService({run:f=>f(),onError:()=>{},setEnabled:async()=>{},createSom:()=>({identity:'test',close(){},async screenTimeout(value){if(value!==undefined){writes.push(value);current=value;}return current;}})});await s.configure(10);assert.equal(current,10);assert.deepEqual(writes,[10]);await s.close();assert.equal(current,30);});
test('unsupported long timers do not touch the device',async()=>{const s=new SleepService({run:()=>{throw Error('must not access device');},onError:()=>{}});for(const n of [120,240,360,480,720])await assert.rejects(s.configure(n),/up to 99/);});

test('Never keeps screen on through Companion and restores native timeout on quit',async()=>{let current=15;const power=[];const s=new SleepService({run:f=>f(),onError:()=>{},setEnabled:async v=>power.push(v),createSom:()=>({identity:'test',close(){},async screenTimeout(v){if(v!==undefined)current=v;return current;}})});await s.configure(0);assert.equal(current,99);assert.deepEqual(power,[true]);assert.ok(s.timer);await s.test();assert.equal(power.at(-1),false);s.activity();await s.controller.pending;assert.equal(power.at(-1),true);await s.close();assert.equal(current,15);assert.equal(s.timer,null);});

test('timed sleep runs independently of display updates and wakes on first input',async()=>{
 let now=0,tick,current=30;const events=[];
 const s=new SleepService({now:()=>now,every:fn=>(tick=fn,{unref(){}}),cancel:()=>{},run:async f=>f(),onError:e=>{throw e;},setPaused:v=>events.push(['paused',v]),setEnabled:async v=>events.push(['power',v]),createSom:()=>({identity:'test',close(){},async screenTimeout(v){if(v!==undefined)current=v;return current;}})});
 await s.configure(10);now=599999;tick();await s.controller.pending;assert.deepEqual(events,[]);
 now=600000;tick();await s.controller.pending;assert.deepEqual(events,[['paused',true],['power',false]]);assert.equal(s.status().asleep,true);
 now+=5000;tick();await s.controller.pending;assert.equal(events.length,2);
 s.activity();await s.controller.pending;assert.deepEqual(events.slice(-2),[['power',true],['paused',false]]);assert.equal(s.status().idleSeconds,0);
 await s.close();assert.equal(current,30);assert.equal(s.status().timerActive,false);
});
test('failed sleep releases rendering and next timer tick can retry',async()=>{
 let now=0,tick,fail=true,current=10;const paused=[],errors=[];
 const s=new SleepService({now:()=>now,every:fn=>(tick=fn,{unref(){}}),cancel:()=>{},run:async f=>f(),onError:e=>errors.push(e.message),setPaused:v=>paused.push(v),setEnabled:async()=>{if(fail)throw Error('disconnected');},createSom:()=>({identity:'test',close(){},async screenTimeout(v){if(v!==undefined)current=v;return current;}})});
 await s.configure(10);now=600000;tick();await s.controller.pending.catch(()=>{});assert.deepEqual(paused,[true,false]);assert.equal(s.status().asleep,false);await new Promise(resolve=>setImmediate(resolve));assert.deepEqual(errors,['disconnected']);fail=false;tick();await s.controller.pending;assert.equal(s.status().asleep,true);await s.close();
});

test('changing the timer during Test sleep keeps the newly selected duration',async()=>{let current=10;const s=new SleepService({run:async f=>f(),onError:()=>{},setEnabled:async()=>{},createSom:()=>({identity:'test',close(){},async screenTimeout(v){if(v!==undefined)current=v;return current;}})});await s.configure(10);await s.test();await s.configure(15);s.activity();await s.controller.pending;assert.equal(s.controller.minutes,15);assert.equal(s.testing,false);await s.close();});
