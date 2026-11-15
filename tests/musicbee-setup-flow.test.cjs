const test=require('node:test'),assert=require('node:assert/strict');const {MusicBeeSetupFlow}=require('../src/musicbee-setup-flow.cjs');
test('automatic MusicBee setup leaves working connections alone',async()=>{let installs=0;const flow=new MusicBeeSetupFlow({probe:async()=>({available:true}),install:async()=>{installs++},onChange:()=>{}});assert.equal((await flow.ensure()).status,'connected');assert.equal(installs,0);});
test('automatic MusicBee setup shares pending work and retains restart instructions',async()=>{let finish,installs=0;const states=[];const flow=new MusicBeeSetupFlow({probe:async()=>({available:false}),install:()=>{installs++;return new Promise(r=>finish=r)},onChange:s=>states.push(s.status)});const first=flow.ensure(),second=flow.ensure();assert.equal(first,second);await new Promise(r=>setImmediate(r));finish({message:'Restart MusicBee'});assert.equal((await first).status,'restart');assert.equal(installs,1);assert.deepEqual(states,['checking','installing','restart']);flow.connected();assert.equal(flow.state.status,'connected');});
test('setup errors remain actionable without rejecting an already saved keyboard assignment',async()=>{const flow=new MusicBeeSetupFlow({probe:async()=>({available:false}),install:async()=>{throw Error('Open MusicBee')},onChange:()=>{}});assert.equal((await flow.ensure()).status,'error');assert.match(flow.state.message,/Open MusicBee/);});

for(const fails of [false,true])test('a live MusicBee connection wins over an older setup '+(fails?'failure':'completion'),async()=>{
 let finish;const flow=new MusicBeeSetupFlow({probe:async()=>({available:false}),install:()=>new Promise((resolve,reject)=>{finish=()=>fails?reject(Error('late error')):resolve({message:'Restart MusicBee'});}),onChange:()=>{}});
 const pending=flow.ensure();await new Promise(r=>setImmediate(r));flow.connected();finish();await pending;
 assert.equal(flow.state.status,'connected');assert.equal(flow.state.message,'MusicBee connected.');
});

test('a connection established during probing avoids an unnecessary install',async()=>{
 let resolve,installs=0;const flow=new MusicBeeSetupFlow({probe:()=>new Promise(r=>resolve=r),install:async()=>{installs++;return{message:'restart'};},onChange:()=>{}});
 const pending=flow.ensure();flow.connected();resolve({available:false});await pending;assert.equal(installs,0);assert.equal(flow.state.status,'connected');
});
