const test=require('node:test'),assert=require('node:assert/strict');
const {DisplayCache}=require('../src/display-cache.cjs'),{ConnectionRecovery}=require('../src/connection-recovery.cjs');
test('display read timeouts have a distinct classification and release their response listener',async()=>{const {Som}=require('../src/som.cjs'),client={listeners:new Set()};await assert.rejects(Som.prototype.wait.call(client,()=>{},()=>{},1),error=>error.code==='DISPLAY_REQUEST_TIMEOUT');assert.equal(client.listeners.size,0);});
function fixture(){let time=10000,active=1;const uploads=[],timers=[];const cache=new DisplayCache('.',(selected,_config,locks,data)=>`<svg width="4" height="4"><title>${selected}/${locks.caps}/${data.revision}</title></svg>`,{now:()=>time,setTimeout:(fn,delay)=>{const timer={fn,delay,unref(){}};timers.push(timer);return timer;},clearTimeout:()=>{}});cache.config={slots:[],widget:{type:'clock'},weatherMotion:false};cache.data={revision:0};cache.som={currentSlot:async()=>active,uploadOverlay:async slot=>{assert.notEqual(slot,active);uploads.push(slot);active=slot;},selectSlot:slot=>{active=slot;}};return{cache,uploads,timers,advance:ms=>time+=ms,activate:slot=>active=slot};}
test('an externally changed active overlay is never overwritten, including a two-slot allocation',async()=>{for(const pool of [[2,3,4,5,6,7,8,9,10],[9,10]]){const f=fixture();f.cache.pool=pool;await f.cache.refreshLive();const next=f.cache.spare();f.activate(next);f.cache.data.revision++;await f.cache.refreshLive();assert.equal(f.uploads.length,2);assert.notEqual(f.uploads[1],next);assert.equal(f.cache.cache.get('idle:0'),f.uploads[1]);assert.equal(new Set(f.cache.cache.values()).size,f.cache.cache.size);f.cache.clearLiveTimer();}});
test('unreadable or invalid active slots cancel the upload before any image is overwritten',async()=>{for(const invalid of [11,undefined,'timeout']){const f=fixture();await f.cache.refreshLive();f.cache.som.currentSlot=async()=>{if(invalid==='timeout')throw Object.assign(Error('timeout'),{code:'DISPLAY_REQUEST_TIMEOUT'});return invalid;};f.cache.data.revision++;await assert.rejects(f.cache.refreshLive());assert.equal(f.uploads.length,1);assert.ok(f.cache.error);f.cache.clearLiveTimer();}});
test('display status polling is bounded and isolated read timeouts do not force reconnects',async()=>{const f=fixture();await f.cache.refreshLive();f.cache.selectionAt=0;let reads=0;f.cache.som.currentSlot=async()=>{reads++;throw Object.assign(Error('timeout'),{code:'DISPLAY_REQUEST_TIMEOUT'});};await f.cache.reconcile();f.advance(500);await f.cache.reconcile();assert.equal(reads,1);f.advance(2500);await f.cache.reconcile();assert.equal(reads,2);f.advance(2500);await assert.rejects(f.cache.reconcile(),/timeout/);assert.equal(f.cache.statusTimeouts,3);assert.equal(f.uploads.length,1);f.cache.clearLiveTimer();});
test('a successful status read clears transient errors; other USB failures still surface immediately',async()=>{const f=fixture();await f.cache.refreshLive();f.cache.selectionAt=0;const active=f.cache.lastSlot;f.cache.som.currentSlot=async()=>{throw Object.assign(Error('timeout'),{code:'DISPLAY_REQUEST_TIMEOUT'});};await f.cache.reconcile();assert.equal(f.cache.statusReadFailures,1);f.advance(2500);f.cache.som.currentSlot=async()=>active;await f.cache.reconcile();assert.equal(f.cache.statusReadFailures,0);f.advance(2500);f.cache.som.currentSlot=async()=>{throw Error('USB disconnected');};await assert.rejects(f.cache.reconcile(),/disconnected/);});
test('repeated successful recoveries cannot form a ten-second rebuild loop',async()=>{const recovery=new ConnectionRecovery();let calls=0;const recover=async()=>{calls++;recovery.reset();};assert.equal(await recovery.run({eligible:true,recover,now:100}),true);assert.equal(await recovery.run({eligible:true,recover,now:10100}),true);assert.equal(await recovery.run({eligible:true,recover,now:20100}),false);assert.equal(calls,2);assert.equal(recovery.status(20100).nextRetrySeconds,40);assert.equal(await recovery.run({eligible:true,recover,now:60100}),true);recovery.reset();assert.equal(recovery.status(60100).attemptsInLastMinute,0);});
test('failed exit restoration remains retryable without resuming overlay traffic',async()=>{
 const f=fixture();await f.cache.refreshLive();f.cache.manifest={originalSlot:1};let attempts=0,closed=0;
 f.cache.som.activate=async()=>{if(++attempts===1)throw Error('Temporary restore timeout');};f.cache.som.close=()=>closed++;
 await assert.rejects(f.cache.close(),/restore timeout/);assert.ok(f.cache.som);assert.equal(closed,0);
 f.cache.data.revision++;f.cache.displayReady();await f.cache.refreshLive();f.cache.selectionAt=0;await f.cache.reconcile();assert.equal(f.uploads.length,1);
 await assert.rejects(f.cache.apply(f.cache.config,{caps:false}),/restoration is pending/);
 await f.cache.close();assert.equal(attempts,2);assert.equal(closed,1);assert.equal(f.cache.som,null);
});
test('failed display sessions reject further refresh requests and suppress lock changes',async()=>{
 const f=fixture();await f.cache.refreshLive();f.cache.data.revision++;
 let attempts=0,selections=0;const upload=f.cache.som.uploadOverlay;
 f.cache.som.uploadOverlay=async()=>{attempts++;throw Error('Display rejected frame');};
 await assert.rejects(f.cache.refreshLive(),/rejected frame/);
 for(let tick=0;tick<20;tick++){f.advance(500);await assert.rejects(f.cache.refreshLive(),/rejected frame/);}
 assert.equal(attempts,1,'polling must not repeatedly transmit into a failed display session');
 f.cache.cache.set('idle:1',4);f.cache.som.selectSlot=()=>selections++;f.cache.setLocks({caps:true});f.cache.show({active:true,id:'next'});
 assert.equal(selections,0,'lock/navigation events must not send packets after failure');
 f.cache.som.uploadOverlay=upload;f.cache.desired='idle';await f.cache.apply(f.cache.config,{caps:false});assert.equal(f.cache.error,'');
});
test('the production background refresh stops an on-demand failure without retransmitting',async()=>{
 const fs=require('node:fs'),vm=require('node:vm'),source=fs.readFileSync(require.resolve('../src/main.cjs'),'utf8');
 const f=fixture();await f.cache.refreshLive();f.cache.data.revision++;let attempts=0;
 f.cache.som.uploadOverlay=async()=>{attempts++;throw Error('Display rejected frame');};
 await assert.rejects(f.cache.refreshLive(),/rejected frame/);
 const context={strip:f.cache,state:{strip:true},quitting:false,displayBusy:false,displayTasks:{paused:false},appliedAppearance:'saved',send(){}};
 vm.runInNewContext(source.slice(source.indexOf('async function refreshStrip('),source.indexOf('async function perform(')),context);
 await context.refreshStrip();assert.equal(context.state.strip,false);assert.equal(context.appliedAppearance,'');assert.match(context.state.error,/rejected frame/);
 for(let tick=0;tick<20;tick++)await context.refreshStrip();assert.equal(attempts,1);
});
test('fatal status errors cancel pending live work before the failure is propagated',async()=>{
 const f=fixture();await f.cache.refreshLive();f.cache.selectionAt=0;f.cache.livePending=true;f.cache.data.revision++;
 let reads=0;f.cache.som.currentSlot=async()=>{reads++;throw Error('USB disconnected');};
 await assert.rejects(f.cache.reconcile(),/USB disconnected/);await new Promise(resolve=>setImmediate(resolve));
 assert.equal(reads,1);assert.equal(f.cache.error,'USB disconnected');assert.equal(f.cache.livePending,false);assert.equal(f.uploads.length,1);assert.equal(f.cache.updating,false);
});

