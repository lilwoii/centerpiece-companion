const test=require('node:test'),assert=require('node:assert/strict');const {ConnectionRecovery,retryable}=require('../src/connection-recovery.cjs');
test('connection retry backs off and succeeds without overlapping',async()=>{const c=new ConnectionRecovery();let calls=0;const recover=async()=>{calls++;if(calls<2)throw Object.assign(Error('gone'),{code:'STUDIO_DEVICE_UNAVAILABLE',writesAttempted:false});};await assert.rejects(c.run({eligible:true,recover,now:100}));assert.equal(await c.run({eligible:true,recover,now:200}),false);assert.equal(await c.run({eligible:true,recover,now:10100}),true);assert.equal(calls,2);assert.equal(c.blocked,false);});
test('uncertain writes and custom bindings stop automatic retries',async()=>{for(const e of [{code:'STUDIO_TIMEOUT',writesAttempted:true},{code:'KEYBOARD_PLUGIN_KEY_CUSTOMIZED'},{code:'SETUP_REVIEW_REQUIRED'}]){const c=new ConnectionRecovery();await assert.rejects(c.run({eligible:true,recover:async()=>{throw Object.assign(Error('blocked'),e)}}));assert.equal(c.blocked,true);assert.equal(await c.run({eligible:true,recover:()=>assert.fail('No repeated writes'),now:Date.now()+90000}),false);}});
test('transient read failures and verified display rebuild failures may retry',()=>{assert.equal(retryable({code:'STUDIO_TIMEOUT',writesAttempted:false}),true);assert.equal(retryable({code:'KEYBOARD_DISPLAY_INITIALIZATION_FAILED',configurationVerified:true}),true);assert.equal(retryable({code:'KEYBOARD_DISPLAY_INITIALIZATION_FAILED'}),false);});
test('parallel and ineligible recovery cannot start another USB reset',async()=>{const c=new ConnectionRecovery();let finish;const first=c.run({eligible:true,recover:()=>new Promise(r=>finish=r)});assert.equal(await c.run({eligible:true,recover:()=>assert.fail()}),false);finish();await first;assert.equal(await c.run({eligible:false,recover:()=>assert.fail()}),false);});

test('successful explicit setup resets a blocked recovery for future disconnects',async()=>{const c=new ConnectionRecovery();await assert.rejects(c.run({eligible:true,recover:async()=>{throw Object.assign(Error('review'),{code:'SETUP_REVIEW_REQUIRED'});}}));assert.equal(c.blocked,true);c.reset();assert.equal(c.blocked,false);assert.equal(c.failures,0);assert.equal(await c.run({eligible:true,recover:async()=>{},now:1}),true);});

test('healthy connections retry isolated binding reads without rebuilding the display',()=>{const{BindingCheckHealth}=require('../src/connection-recovery.cjs'),health=new BindingCheckHealth(),error={code:'STUDIO_TIMEOUT',writesAttempted:false},connected={monitorConnected:true,displayConnected:true,displayError:''};assert.equal(health.defer(error,connected),true);assert.equal(health.defer(error,connected),true);assert.equal(health.defer(error,connected),false);health.success();assert.equal(health.defer(error,connected),true);});
test('real disconnections, display errors and uncertain writes do not defer recovery',()=>{const{BindingCheckHealth}=require('../src/connection-recovery.cjs');for(const flags of [{monitorConnected:false,displayConnected:true},{monitorConnected:true,displayConnected:false},{monitorConnected:true,displayConnected:true,displayError:'USB failed'}])assert.equal(new BindingCheckHealth().defer({code:'STUDIO_TIMEOUT'},flags),false);assert.equal(new BindingCheckHealth().defer({code:'STUDIO_TIMEOUT',writesAttempted:true},{monitorConnected:true,displayConnected:true}),false);});
function timedRecovery(now){const vm=require('node:vm'),fs=require('node:fs'),box={module:{exports:{}},Date:{now}};vm.runInNewContext(fs.readFileSync(require.resolve('../src/connection-recovery.cjs'),'utf8'),box);return new box.module.exports.ConnectionRecovery();}
test('slow successful recovery starts its quiet period when rebuilding finishes',async()=>{
 let time=1000,calls=0;const c=timedRecovery(()=>time);
 await c.run({eligible:true,recover:async()=>{calls++;time+=45000;c.reset();}});
 assert.equal(c.next,56000);assert.equal(c.status().nextRetrySeconds,10);
 assert.equal(await c.run({eligible:true,recover:async()=>calls++}),false);time=55999;
 assert.equal(await c.run({eligible:true,recover:async()=>calls++}),false);time=56000;
 assert.equal(await c.run({eligible:true,recover:async()=>calls++}),true);assert.equal(calls,2);
});
test('slow failed recovery retains its entire backoff after the operation ends',async()=>{
 let time=1000;const c=timedRecovery(()=>time),recover=async()=>{time+=45000;throw Object.assign(Error('Display unavailable'),{code:'CONNECTION_UNAVAILABLE'});};
 await assert.rejects(c.run({eligible:true,recover}));assert.equal(c.next,56000);assert.equal(c.status().nextRetrySeconds,10);
 assert.equal(await c.run({eligible:true,recover:()=>assert.fail('must wait')}),false);
 time=56000;await assert.rejects(c.run({eligible:true,recover}));assert.equal(c.next,121000);assert.equal(c.status().nextRetrySeconds,20);
});
