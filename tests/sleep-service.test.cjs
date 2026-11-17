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

function fallback(getIdleSeconds){let now=0,current=30;const power=[],errors=[];const service=new SleepService({getIdleSeconds,now:()=>now,every:()=>({unref(){}}),cancel:()=>{},run:async f=>f(),onError:e=>errors.push(e.message),setEnabled:async v=>power.push(v),createSom:()=>({identity:'test',close(){},async screenTimeout(v){if(v!==undefined)current=v;return current;}})});return{service,power,errors,setNow:v=>now=v};}
test('active Windows session prevents false sleep when game input bypasses the keyboard hook',async()=>{let queries=0;const f=fallback(async()=>{queries++;return 0.2;});await f.service.configure(10);f.setNow(599999);await f.service.reconcile();assert.equal(queries,0,'no added polling while normal idle deadline is far away');f.setNow(600000);await f.service.reconcile();assert.equal(queries,1);assert.deepEqual(f.power,[]);assert.equal(f.service.status().asleep,false);assert.equal(f.service.controller.lastInput,599800);f.setNow(601000);await f.service.reconcile();assert.equal(queries,1);await f.service.close();});
test('real Windows inactivity still sleeps and a new input wakes without switching applications',async()=>{let idle=601;const f=fallback(async()=>idle);await f.service.configure(10);f.setNow(600000);await f.service.reconcile();assert.deepEqual(f.power,[false]);f.setNow(601000);await f.service.reconcile();assert.deepEqual(f.power,[false]);idle=0;f.setNow(602000);await f.service.reconcile();assert.deepEqual(f.power,[false,true]);assert.equal(f.service.status().asleep,false);await f.service.close();});
test('only one Windows fallback request is in flight and a delayed older reading cannot undo newer keyboard activity',async()=>{let finish,queries=0;const f=fallback(()=>{queries++;return new Promise(r=>finish=r);});await f.service.configure(10);f.setNow(600000);const first=f.service.reconcile(),second=f.service.reconcile();assert.equal(queries,1);f.setNow(600200);f.service.activity();finish(1000);await Promise.all([first,second]);assert.equal(f.service.controller.lastInput,600200);assert.deepEqual(f.power,[]);await f.service.close();});
test('stale Windows fallback never cancels an explicit Test sleep',async()=>{let finish,queries=0;const f=fallback(()=>{queries++;return new Promise(r=>finish=r);});await f.service.configure(10);f.setNow(600000);const pending=f.service.reconcile();await f.service.test();finish(0);await pending;await f.service.reconcile();assert.equal(queries,1);assert.deepEqual(f.power,[false]);assert.equal(f.service.testing,true);f.service.activity();await f.service.controller.pending;assert.deepEqual(f.power,[false,true]);assert.equal(f.service.testing,false);await f.service.close();});
test('fallback completion cannot change a newly configured timer or a closed service',async()=>{for(const action of ['configure','close']){let finish;const f=fallback(()=>new Promise(r=>finish=r));await f.service.configure(10);f.setNow(600000);const pending=f.service.reconcile();if(action==='configure')await f.service.configure(15);else await f.service.close();const before=f.service.controller.lastInput;finish(0);await pending;assert.equal(f.service.controller.lastInput,before);assert.deepEqual(f.power,[]);await f.service.close();}});
test('invalid or unavailable Windows readings do not permanently disable the requested idle timer',async()=>{for(const read of [async()=>NaN,async()=>-1,async()=>({idle:0}),async()=>{throw Error('Input helper unavailable');}]){const f=fallback(read);await f.service.configure(10);f.setNow(600000);await f.service.reconcile();assert.deepEqual(f.power,[false]);assert.ok(f.service.status().inputFallbackError);f.service.activity();await f.service.controller.pending;assert.deepEqual(f.power,[false,true]);await f.service.close();}});

test('closing during native sleep configuration cannot restart timers or retain changed firmware timeout',async()=>{let current=30,release,started;const ready=new Promise(r=>started=r),gate=new Promise(r=>release=r);let reads=0,timers=0;const s=new SleepService({run:async f=>f(),onError:()=>{},every:()=>{timers++;return{unref(){}};},cancel:()=>{},setEnabled:async()=>{},createSom:()=>({identity:'test',close(){},async screenTimeout(value){if(value!==undefined)current=value;else if(++reads===1){started();await gate;}return current;}})});const configuring=s.configure(10);const rejected=assert.rejects(configuring,e=>e.code==='SLEEP_CONFIGURATION_CANCELLED');await ready;const closing=s.close();release();await Promise.all([rejected,closing]);assert.equal(timers,0);assert.equal(current,30);assert.equal(s.controller.closed,true);assert.equal(s.timer,null);});

test('failed native reconfiguration keeps the previous inactivity enforcement running',async()=>{let now=0,current=30,fail=false,tick;const power=[];const s=new SleepService({now:()=>now,run:async f=>f(),onError:()=>{},every:fn=>(tick=fn,{unref(){}}),cancel:()=>{},setEnabled:async v=>power.push(v),createSom:()=>({identity:'test',close(){},async screenTimeout(value){if(fail)throw Error('Disconnected');if(value!==undefined)current=value;return current;}})});await s.configure(10);fail=true;await assert.rejects(s.configure(15),/Disconnected/);assert.equal(s.status().timerActive,true);assert.equal(s.controller.minutes,10);now=600000;tick();await s.controller.pending;assert.deepEqual(power,[false]);fail=false;await s.close();});

test('superseded sleep configurations reject explicitly and cannot replace the newer timer',async()=>{let current=30,release,started;const ready=new Promise(r=>started=r),gate=new Promise(r=>release=r);let reads=0,tail=Promise.resolve();const s=new SleepService({run:f=>{const next=tail.then(f);tail=next.catch(()=>{});return next;},onError:()=>{},every:()=>({unref(){}}),cancel:()=>{},setEnabled:async()=>{},createSom:()=>({identity:'test',close(){},async screenTimeout(v){if(v!==undefined)current=v;else if(++reads===1){started();await gate;}return current;}})});const first=s.configure(10),cancelled=assert.rejects(first,e=>e.code==='SLEEP_CONFIGURATION_CANCELLED');await ready;const latest=s.configure(15);release();await Promise.all([cancelled,latest]);assert.equal(current,15);assert.equal(s.controller.minutes,15);assert.equal(s.status().timerActive,true);await s.close();assert.equal(current,30);});
test('failed Never wake restores previous runtime timer even after controller configuration changed',async()=>{let current=30,fail=false;const s=new SleepService({run:async f=>f(),onError:()=>{},every:()=>({unref(){}}),cancel:()=>{},setEnabled:async()=>{if(fail)throw Error('Power unavailable');},createSom:()=>({identity:'test',close(){},async screenTimeout(v){if(v!==undefined)current=v;return current;}})});await s.configure(10);fail=true;await assert.rejects(s.configure(0),/Power unavailable/);assert.equal(s.controller.minutes,10);assert.equal(s.status().timerActive,true);assert.equal(current,10,'failed Never change restores native duration too');fail=false;await s.close();});


test('failed native confirmation restores the prior firmware timeout immediately',async()=>{let current=30,clamp=false;const writes=[];const s=new SleepService({run:async f=>f(),onError:()=>{},every:()=>({unref(){}}),cancel:()=>{},setEnabled:async()=>{},createSom:()=>({identity:'test',close(){},async screenTimeout(v){if(v!==undefined){writes.push(v);current=clamp&&v===15?14:v;}return current;}})});await s.configure(10);clamp=true;await assert.rejects(s.configure(15),/confirmed 14/);assert.equal(current,10);assert.deepEqual(writes,[10,15,10]);assert.equal(s.controller.minutes,10);await s.close();});

test('repeated Test sleep preserves Never when input wakes the display',async()=>{let current=30;const s=new SleepService({run:async f=>f(),onError:()=>{},every:()=>({unref(){}}),cancel:()=>{},setEnabled:async()=>{},createSom:()=>({identity:'test',close(){},async screenTimeout(v){if(v!==undefined)current=v;return current;}})});await s.configure(0);await s.test();await s.test();s.activity();await s.controller.pending;assert.equal(s.controller.minutes,0);assert.equal(s.testing,false);await s.close();});

test('new activity cancels a queued sleep command before it can flash the display off and on',async()=>{
 let now=0,current=30,block=false,release;const power=[],paused=[];
 const gate=new Promise(r=>release=r);
 const s=new SleepService({now:()=>now,run:async f=>{if(block)await gate;return f();},onError:()=>{},every:()=>({unref(){}}),cancel:()=>{},setPaused:v=>paused.push(v),setEnabled:async v=>power.push(v),createSom:()=>({identity:'test',close(){},async screenTimeout(v){if(v!==undefined)current=v;return current;}})});
 await s.configure(10);now=600000;block=true;const sleeping=s.reconcile();s.activity();release();await sleeping;
 assert.deepEqual(power,[]);assert.equal(s.controller.asleep,false);assert.equal(paused.at(-1),false);await s.close();
});

test('activity during an already-asleep reconciliation still wakes immediately in Never test mode',async()=>{
 let current=30;const power=[];
 const s=new SleepService({run:async f=>f(),onError:()=>{},every:()=>({unref(){}}),cancel:()=>{},setEnabled:async v=>power.push(v),createSom:()=>({identity:'test',close(){},async screenTimeout(v){if(v!==undefined)current=v;return current;}})});
 await s.configure(0);await s.test();const check=s.controller.reconcile();s.activity();await check;
 assert.equal(s.controller.asleep,false);assert.deepEqual(power,[true,false,true]);await s.close();
});

test('a failed newest timer change retains the last working timer across overlapping requests',async()=>{
 let current=30,gateNext=false,release,started;let tail=Promise.resolve();const ready=new Promise(r=>started=r),gate=new Promise(r=>release=r);
 const s=new SleepService({run:f=>{const next=tail.then(f);tail=next.catch(()=>{});return next;},onError:()=>{},every:()=>({unref(){}}),cancel:()=>{},setEnabled:async()=>{},createSom:()=>({identity:'test',close(){},async screenTimeout(v){if(v===15&&gateNext){started();await gate;}if(v!==undefined)current=v===45?44:v;return current;}})});
 await s.configure(10);gateNext=true;const older=s.configure(15),cancelled=assert.rejects(older,e=>e.code==='SLEEP_CONFIGURATION_CANCELLED');await ready;const latest=s.configure(45),failed=assert.rejects(latest,/confirmed 44/);release();await Promise.all([cancelled,failed]);
 assert.equal(s.controller.minutes,10);assert.equal(s.status().timerActive,true);assert.equal(current,10);await s.close();
});

test('failed timer change preserves key activity received while its native write was pending',async()=>{
 let now=0,current=30,release,started;const ready=new Promise(r=>started=r),gate=new Promise(r=>release=r);const power=[];
 const s=new SleepService({now:()=>now,run:async f=>f(),onError:()=>{},every:()=>({unref(){}}),cancel:()=>{},setEnabled:async v=>power.push(v),createSom:()=>({identity:'test',close(){},async screenTimeout(v){if(v===15){started();await gate;throw Error('write failed');}if(v!==undefined)current=v;return current;}})});
 await s.configure(10);now=599000;const changing=s.configure(15),failed=assert.rejects(changing,/write failed/);await ready;now=599900;s.activity();release();await failed;
 assert.equal(s.controller.lastInput,599900);now=600000;await s.reconcile();assert.deepEqual(power,[]);await s.close();
});

test('close cancels queued sleep without sending a stale power-off command',async()=>{
 let now=0,current=30,block=false,release;const power=[],paused=[],gate=new Promise(r=>release=r);
 const s=new SleepService({now:()=>now,run:async f=>{if(block)await gate;return f();},onError:()=>{},every:()=>({unref(){}}),cancel:()=>{},setPaused:v=>paused.push(v),setEnabled:async v=>power.push(v),createSom:()=>({identity:'test',close(){},async screenTimeout(v){if(v!==undefined)current=v;return current;}})});
 await s.configure(10);now=600000;block=true;const sleeping=s.reconcile(),closing=s.close();await new Promise(r=>setImmediate(r));release();await Promise.all([sleeping,closing]);
 assert.deepEqual(power,[]);assert.equal(s.controller.asleep,false);assert.equal(s.controller.closed,true);assert.equal(current,30);assert.equal(paused.at(-1),false);
});

test('a failed sleep command does not create an immediate automatic retry loop',async()=>{
 let now=0,current=30,calls=0;const s=new SleepService({now:()=>now,run:async f=>f(),onError:()=>{},every:()=>({unref(){}}),cancel:()=>{},setEnabled:async()=>{calls++;throw Error('USB unavailable');},createSom:()=>({identity:'test',close(){},async screenTimeout(v){if(v!==undefined)current=v;return current;}})});
 await s.configure(10);now=600000;await assert.rejects(s.reconcile(),/USB unavailable/);await new Promise(r=>setImmediate(r));assert.equal(calls,1);assert.equal(s.controller.pending,null);assert.equal(s.controller.asleep,false);await s.close();
});

test('concurrent sleep close requests share one native timer restoration',async()=>{
 let current=30;const writes=[];const s=new SleepService({run:async f=>f(),onError:()=>{},every:()=>({unref(){}}),cancel:()=>{},setEnabled:async()=>{},createSom:()=>({identity:'test',close(){},async screenTimeout(v){if(v!==undefined){writes.push(v);current=v;}return current;}})});
 await s.configure(10);await Promise.all([s.close(),s.close()]);assert.deepEqual(writes,[10,30]);assert.equal(s.original,null);
});

test('close retains original native timer after a rejected readback and retries only when explicitly called',async()=>{
 let current=30,clamp=false;const writes=[];
 const s=new SleepService({run:async f=>f(),onError:()=>{},every:()=>({unref(){}}),cancel:()=>{},setEnabled:async()=>{},createSom:()=>({identity:'test',close(){},async screenTimeout(v){if(v!==undefined){writes.push(v);current=clamp&&v===30?29:v;}return current;}})});
 await s.configure(10);clamp=true;await assert.rejects(s.close(),/did not confirm its original sleep timer/);
 assert.equal(s.original,30);assert.equal(s.closeOperation,null);assert.equal(current,29);assert.deepEqual(writes,[10,30]);
 clamp=false;await s.close();assert.equal(s.original,null);assert.equal(current,30);assert.deepEqual(writes,[10,30,30]);
});

test('one hundred delayed sleep lifecycle sequences finish with bounded work and no orphaned timers',async()=>{
 let highestPending=0,injectedPower=0,injectedNative=0;
 for(let seed=0;seed<100;seed++){
  let now=0,current=30,serial=0,pending=0,active=0,peak=0,tail=Promise.resolve(),inject=false;const timers=new Map();
  const run=f=>{pending++;highestPending=Math.max(highestPending,pending);const result=tail.then(async()=>{await Promise.resolve();active++;peak=Math.max(peak,active);try{return await f();}finally{active--;}});tail=result.catch(()=>{});return result.finally(()=>pending--);};
  const s=new SleepService({now:()=>now,run,onError:()=>{},every:fn=>{const id=++serial;timers.set(id,fn);return id;},cancel:id=>timers.delete(id),setEnabled:async()=>{if(inject&&seed%3===0){inject=false;injectedPower++;throw Error('injected power failure');}},createSom:()=>({identity:'test',close(){},async screenTimeout(v){if(v!==undefined){if(inject&&seed%3===1){inject=false;injectedNative++;throw Error('injected native failure');}current=v;}return current;}})});
  await s.configure(seed%2?0:10);now=600000;inject=true;
  if(seed%3===0)await assert.rejects(s.test(),/injected power failure/);
  const operations=[s.configure(15),s.configure(45),s.reconcile(),s.test()];s.activity();operations.push(s.close());await Promise.allSettled(operations);inject=false;await s.close();await tail;
  assert.equal(s.timer,null,'timer '+seed);assert.equal(timers.size,0,'live timer '+seed);assert.equal(s.controller.asleep,false,'sleep '+seed);assert.equal(s.controller.closed,true,'closed '+seed);assert.equal(current,30,'native '+seed);assert.equal(pending,0,'queue '+seed);assert.equal(s.configurations.size,0,'config '+seed);assert.equal(s.controller.pending,null,'controller '+seed);assert.equal(peak,1);
 }
 assert.ok(injectedPower>0);assert.ok(injectedNative>0);assert.ok(highestPending<=3,'coalesced work stays bounded');
});

test('queued Never keepawake cancels after close or a timer change without disabling later Never ticks',async()=>{
 for(const action of ['close','configure','test']){
  let current=30,tick,tail=Promise.resolve(),release;const gate=new Promise(r=>release=r),power=[];
  const run=f=>{const r=tail.then(f);tail=r.catch(()=>{});return r;};
  const s=new SleepService({run,onError:()=>{},every:fn=>(tick=fn,{unref(){}}),cancel:()=>{},setEnabled:async v=>power.push(v),createSom:()=>({identity:'test',close(){},async screenTimeout(v){if(v!==undefined)current=v;return current;}})});
  await s.configure(0);const barrier=run(()=>gate);tick();const change=action==='close'?s.close():action==='configure'?s.configure(10):s.test();release();await Promise.all([barrier,change]);await tail;await new Promise(r=>setImmediate(r));
  assert.deepEqual(power,action==='test'?[true,false]:[true],action+' must cancel the stale Never power-on');assert.equal(s.keepAwakeBusy,false);
  if(action==='test'){s.activity();await s.controller.pending;tick();await tail;await new Promise(r=>setImmediate(r));assert.deepEqual(power,[true,false,true,true],'Never keepawake resumes after Test sleep');}
  await s.close();
 }
});


test('configured sleep never powers a different keyboard after a hot swap',async()=>{
 let now=0,current=30,keyboard='keyboard-A';const power=[];
 const s=new SleepService({run:async f=>f(),now:()=>now,every:()=>({unref(){}}),cancel:()=>{},onError:()=>{},getPowerIdentity:async()=>keyboard,setEnabled:async(value,expected)=>{if(expected&&expected!==keyboard)throw Error('Original keyboard disconnected');power.push([keyboard,value]);},createSom:()=>({identity:'display-A',async screenTimeout(v){if(v!==undefined)current=v;return current;},close(){}})});
 await s.configure(10);keyboard='keyboard-B';now=600000;await assert.rejects(s.reconcile(),/Original keyboard disconnected/);assert.deepEqual(power,[]);
 keyboard='keyboard-A';await s.reconcile();assert.deepEqual(power,[['keyboard-A',false]]);await s.close();assert.deepEqual(power,[['keyboard-A',false],['keyboard-A',true]]);
});


test('Never keepawake and reconfiguration preserve the original power target',async()=>{
 let current=30,keyboard='A',tick;const power=[],errors=[];
 const s=new SleepService({run:async f=>f(),every:fn=>(tick=fn,{unref(){}}),cancel:()=>{},onError:e=>errors.push(e.message),getPowerIdentity:async()=>keyboard,setEnabled:async(value,expected)=>{if(expected!==keyboard)throw Error('Original keyboard disconnected');power.push([keyboard,value]);},createSom:()=>({identity:'display-A',async screenTimeout(v){if(v!==undefined)current=v;return current;},close(){}})});
 await s.configure(0);keyboard='B';tick();await new Promise(setImmediate);assert.deepEqual(power,[['A',true]]);assert.equal(errors.length,1);await assert.rejects(s.configure(15),/original keyboard/);assert.equal(current,99);
 keyboard='A';await s.close();assert.equal(current,30);
});


test('Test sleep without a configured timer pins the power target through wake and close',async()=>{
 let keyboard='A';const writes=[],errors=[];
 const s=new SleepService({run:async f=>f(),onError:e=>errors.push(e.message),getPowerIdentity:async()=>keyboard,setEnabled:async(value,expected)=>{if(expected!==null&&expected!==keyboard)throw Error('wrong device');writes.push([keyboard,value,expected]);},every:()=>({unref(){}}),cancel:()=>{}});
 await s.test();keyboard='B';s.activity();await s.controller.pending.catch(()=>{});assert.deepEqual(writes,[['A',false,'A']]);
 keyboard='A';await s.reconcile();assert.deepEqual(writes,[['A',false,'A'],['A',true,'A']]);await s.close();assert.equal(s.powerIdentity,null);assert.equal(s.original,null);
});
test('failed Test sleep identity lookup never sends power and restores timer state',async()=>{
 const writes=[];const s=new SleepService({run:async f=>f(),getPowerIdentity:async()=>{throw Error('identity unavailable');},setEnabled:async v=>writes.push(v),onError:()=>{},every:()=>({unref(){}}),cancel:()=>{}});
 await assert.rejects(s.test(),/identity unavailable/);assert.deepEqual(writes,[]);assert.equal(s.testing,false);assert.equal(s.controller.minutes,null);await s.close();
});


test('repeated Test sleep waits for the same pending identity capture',async()=>{
 let release;const gate=new Promise(r=>release=r),writes=[];const s=new SleepService({run:async f=>f(),getPowerIdentity:()=>gate,setEnabled:async(value,identity)=>writes.push([value,identity]),onError:()=>{},every:()=>({unref(){}}),cancel:()=>{}});
 const first=s.test(),second=s.test();await new Promise(setImmediate);assert.deepEqual(writes,[]);release('A');await Promise.all([first,second]);assert.deepEqual(writes,[[false,'A']]);await s.close();
});


test('closing with a different display retains the original timeout for an explicit retry',async()=>{
 let identity='A';const timeouts={A:30,B:60},writes=[];
 const s=new SleepService({run:async f=>f(),setEnabled:async()=>{},onError:()=>{},every:()=>({unref(){}}),cancel:()=>{},createSom:()=>{const current=identity;return{identity:current,async screenTimeout(v){if(v!==undefined){timeouts[current]=v;writes.push([current,v]);}return timeouts[current];},close(){}};}});
 await s.configure(10);identity='B';await assert.rejects(s.close(),/original keyboard|original display/);assert.equal(s.original,30);assert.equal(timeouts.B,60);identity='A';await s.close();assert.equal(timeouts.A,30);assert.equal(s.original,null);assert.deepEqual(writes,[['A',10],['A',30]]);
});


test('Test sleep after disabling Companion sleep is temporary and restores the closed state',async()=>{
 const power=[];const s=new SleepService({run:async f=>f(),getPowerIdentity:async()=>'A',setEnabled:async(value,identity)=>power.push([value,identity]),onError:()=>{},every:()=>({unref(){}}),cancel:()=>{}});
 await s.close();await s.test();assert.deepEqual(power,[[false,'A']]);s.activity();await s.controller.pending;assert.deepEqual(power,[[false,'A'],[true,'A']]);assert.equal(s.controller.closed,true);assert.equal(s.controller.minutes,null);assert.equal(s.testing,false);await s.close();assert.equal(s.powerIdentity,null);
});
test('closing during Test identity capture prevents off and any later state resurrection',async()=>{
 let release;const gate=new Promise(r=>release=r),power=[];const s=new SleepService({run:async f=>f(),getPowerIdentity:()=>gate,setEnabled:async v=>power.push(v),onError:()=>{},every:()=>({unref(){}}),cancel:()=>{}});
 const testing=s.test(),rejected=assert.rejects(testing,e=>e.code==='SLEEP_CONFIGURATION_CANCELLED');await s.close();release('A');await rejected;s.activity();assert.deepEqual(power,[]);assert.equal(s.controller.closed,true);assert.equal(s.testing,false);assert.equal(s.powerIdentity,null);
});


test('Test sleep cannot cancel a partially applied timer configuration',async()=>{
 let current=60,block=false,release,reached,tail=Promise.resolve();const ready=new Promise(r=>reached=r),gate=new Promise(r=>release=r);
 const s=new SleepService({run:f=>{const p=tail.then(f);tail=p.catch(()=>{});return p;},setEnabled:async()=>{},onError:()=>{},every:()=>({unref(){}}),cancel:()=>{},createSom:()=>({identity:'A',async screenTimeout(v){if(v!==undefined)current=v;if(v===15&&block){reached();await gate;}return current;},close(){}})});
 await s.configure(30);block=true;const configuring=s.configure(15);await ready;
 const rejected=assert.rejects(s.test(),/configuration|changing/);release();await Promise.all([configuring,rejected]);assert.equal(current,15);assert.equal(s.controller.minutes,15);assert.equal(s.testing,false);await s.close();assert.equal(current,60);
});


test('configuration cannot reopen native sleep while original restoration is still pending',async()=>{
 let current=30,block=false,release,reached,tail=Promise.resolve();const ready=new Promise(r=>reached=r),gate=new Promise(r=>release=r);
 const s=new SleepService({run:f=>{const p=tail.then(f);tail=p.catch(()=>{});return p;},setEnabled:async()=>{},onError:()=>{},every:()=>({unref(){}}),cancel:()=>{},getPowerIdentity:async()=>'A',createSom:()=>({identity:'A',async screenTimeout(v){if(v===30&&block){reached();await gate;}if(v!==undefined)current=v;return current;},close(){}})});
 await s.configure(10);block=true;const closing=s.close();await ready;const rejected=assert.rejects(s.configure(0),/closing|restor/);release();await Promise.all([closing,rejected]);assert.equal(current,30);assert.equal(s.original,null);assert.equal(s.powerIdentity,null);assert.equal(s.timer,null);
 block=false;await s.configure(0);assert.equal(current,99);assert.equal(s.powerIdentity,'A');await s.close();assert.equal(current,30);
});


test('configuration waits until Test identity capture settles and retry preserves the power target',async()=>{
 let release,current=30,tail=Promise.resolve();const gate=new Promise(r=>release=r),power=[];
 const s=new SleepService({run:f=>{const p=tail.then(f);tail=p.catch(()=>{});return p;},getPowerIdentity:()=>gate,setEnabled:async(value,identity)=>power.push([value,identity]),onError:()=>{},every:()=>({unref(){}}),cancel:()=>{},createSom:()=>({identity:'A',async screenTimeout(v){if(v!==undefined)current=v;return current;},close(){}})});
 const testing=s.test();await Promise.resolve();const reconciling=s.reconcile();await assert.rejects(s.configure(10),/Test sleep/);release('A');await Promise.all([testing,reconciling]);await s.configure(10);assert.equal(power.some(([,identity])=>identity===null),false);assert.equal(s.testing,false);assert.equal(s.controller.minutes,10);await s.close();
});

test('a keyboard swap during native timeout read cannot capture a mixed restoration target',async()=>{
 let keyboard='A',current=30,swap=true;const writes=[];
 const s=new SleepService({run:async f=>f(),getPowerIdentity:async()=>keyboard,setEnabled:async()=>{},onError:()=>{},every:()=>({unref(){}}),cancel:()=>{},createSom:()=>({identity:'display-A',async screenTimeout(v){if(v!==undefined){writes.push(v);current=v;}else if(swap){swap=false;keyboard='B';}return current;},close(){}})});
 await assert.rejects(s.configure(10),/Keyboard changed/);assert.deepEqual(writes,[]);assert.equal(s.original,null);assert.equal(s.powerIdentity,null);keyboard='A';await s.configure(10);assert.deepEqual(writes,[10]);assert.equal(s.identity,'display-A');assert.equal(s.powerIdentity,'A');await s.close();assert.deepEqual(writes,[10,30]);
});
test('identity-aware power sends reject missing targets without sending an unbound command',async()=>{
 for(const identity of [null,'','   ']){const writes=[];const s=new SleepService({run:async f=>f(),getPowerIdentity:async()=>identity,setEnabled:async v=>writes.push(v),onError:()=>{},every:()=>({unref(){}}),cancel:()=>{}});await assert.rejects(s.test(),/identity is unavailable/);assert.deepEqual(writes,[]);await s.close();}
});


test('a swap back during identity lookup cannot pair the old keyboard with another display',async()=>{
 let keyboard='A',lookup=0;const writes=[];
 const s=new SleepService({run:async f=>f(),getPowerIdentity:async()=>{if(++lookup===1){keyboard='B';return 'A';}return keyboard;},setEnabled:async()=>{},onError:()=>{},every:()=>({unref(){}}),cancel:()=>{},createSom:()=>{const identity=keyboard;return{identity,async screenTimeout(v){if(v!==undefined)writes.push([identity,v]);keyboard='A';return 30;},close(){}};}});
 await assert.rejects(s.configure(10),/changed|disconnected/);assert.deepEqual(writes,[]);assert.equal(s.original,null);assert.equal(s.powerIdentity,null);await s.close();
});


test('failed timer change after completed Test sleep preserves the actual Never baseline',async()=>{
 let current=30,fail=false;const s=new SleepService({run:async f=>f(),setEnabled:async()=>{},onError:()=>{},every:()=>({unref(){}}),cancel:()=>{},createSom:()=>({identity:'A',async screenTimeout(v){if(fail)throw Error('disconnected');if(v!==undefined)current=v;return current;},close(){}})});
 await s.configure(0);await s.test();fail=true;await assert.rejects(s.configure(15),/disconnected/);s.activity();await s.controller.pending;assert.equal(s.controller.minutes,0);assert.equal(s.testing,false);assert.equal(s.status().timerActive,true);fail=false;await s.close();assert.equal(current,30);
});


test('failed wake while changing a completed Test restores the real configured timer',async()=>{
 let current=60,failWake=false;const s=new SleepService({run:async f=>f(),setEnabled:async value=>{if(value&&failWake)throw Error('wake failed');},onError:()=>{},every:()=>({unref(){}}),cancel:()=>{},createSom:()=>({identity:'A',async screenTimeout(v){if(v!==undefined)current=v;return current;},close(){}})});
 await s.configure(30);await s.test();failWake=true;await assert.rejects(s.configure(15),/wake failed/);assert.equal(current,30);assert.equal(s.controller.minutes,30);assert.equal(s.testing,false);assert.equal(s.controller.asleep,true);failWake=false;s.activity();await s.controller.pending;assert.equal(s.controller.asleep,false);await s.close();assert.equal(current,60);
});
