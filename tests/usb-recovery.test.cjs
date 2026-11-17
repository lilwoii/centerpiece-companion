const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),{EventEmitter}=require('node:events');
const {Som}=require('../src/som.cjs');
function worker(){const process=new EventEmitter(),messages=[],native=[];Object.assign(process,{argv:[],connected:true,send:m=>messages.push(m),exit(){}});class Native extends EventEmitter{constructor(path){super();this.path=path;this.writes=0;native.push(this);}write(p){this.writes++;return this.short?1:p.length;}close(){this.closed=true;}}
 let discoveryError=false;const inventory=[{vendorId:0x361d,productId:0x202,usagePage:0xff00,usage:1,path:'screen'},{vendorId:0x361d,productId:0x200,usagePage:0xff00,usage:1,path:'keys'}];
 vm.runInNewContext(fs.readFileSync(require.resolve('../src/hid-worker.cjs'),'utf8'),{process,require:()=>({HID:Native,devices:()=>{if(discoveryError)throw Error('enumeration failed');return inventory;}})});return{native,messages,process,inventory,setDiscoveryError:value=>discoveryError=value,send:m=>process.emit('message',m)};}
for(const cause of ['write','reader','protocol'])test('recovery replaces failed native handle after '+cause+' failure without restarting the keyboard interface',()=>{const r=worker();r.send({op:'open',path:'screen',key:1});r.send({op:'open',path:'keys',key:2});r.send({op:'open',path:'screen',key:3});const old=r.native[0];if(cause==='write'){old.short=true;r.send({op:'write',key:1,data:Array(1024).fill(0)});}else if(cause==='reader')old.emit('error',Error('disconnected'));else r.send({op:'invalidate',key:1});
 r.send({op:'write',key:3,data:Array(1024).fill(0)});assert.equal(old.writes,cause==='write'?1:0);
 r.send({op:'close',key:1});assert.ok(!old.closed,'other failed client still owns the native handle');r.send({op:'close',key:3});assert.ok(old.closed);
 r.send({op:'open',path:'screen',key:4});assert.equal(r.native.length,3);r.send({op:'write',key:4,data:Array(1024).fill(0)});assert.equal(r.native[2].writes,1);
 r.send({op:'write',key:2,data:Array(64).fill(0)});assert.equal(r.native[1].writes,1);assert.ok(!r.native[1].closed);
 const count=r.messages.length;old.emit('data',Buffer.from([3,1,0,50,5]));assert.equal(r.messages.length,count,'retired reader cannot deliver stale replies');});
test('healthy short-lived clients retain one native reader',()=>{const r=worker();r.send({op:'open',path:'screen',key:1});r.send({op:'close',key:1});r.send({op:'open',path:'screen',key:2});assert.equal(r.native.length,1);assert.ok(!r.native[0].closed);});
test('late errors from a retired native reader cannot evict its replacement',()=>{const r=worker();r.send({op:'open',path:'screen',key:1});const old=r.native[0];r.send({op:'invalidate',key:1});r.send({op:'close',key:1});r.send({op:'open',path:'screen',key:2});old.emit('error',Error('late close error'));r.send({op:'open',path:'screen',key:3});assert.equal(r.native.length,2,'both current clients must share the replacement reader');r.send({op:'write',key:2,data:Array(1024).fill(0)});r.send({op:'write',key:3,data:Array(1024).fill(0)});assert.equal(r.native[1].writes,2);assert.ok(!r.native[1].closed);});
test('replacement waits until every failed client releases its reader',()=>{const r=worker();r.send({op:'open',path:'screen',key:1});r.send({op:'open',path:'screen',key:2});r.send({op:'invalidate',key:1});r.send({op:'close',key:1});r.send({op:'open',path:'screen',key:3});assert.equal(r.native.length,1);assert.match(r.messages.at(-1).message,/session is closing/);r.send({op:'close',key:2});r.send({op:'open',path:'screen',key:4});assert.equal(r.native.length,2);assert.ok(r.native[0].closed);assert.ok(!r.native[1].closed);});
test('missing transfer acknowledgement invalidates the interface once and preserves stage diagnostics',async()=>{const s=Object.create(Som.prototype);s.listeners=new Set();let invalidations=0;s.handle={writeBatch:async()=>{},invalidate(){invalidations++;}};s.wait=function(match,trigger){return Som.prototype.wait.call(this,match,trigger,5);};await assert.rejects(s.transfer(4,Buffer.alloc(2000)),e=>e.transferStage==='acknowledgement'&&e.bytesWritten===2000);assert.equal(invalidations,1);assert.equal(s.listeners.size,0);});
test('failed invalidation cannot replace the transfer failure or erase its diagnostics',async()=>{const s=Object.create(Som.prototype);s.listeners=new Set();s.handle={writeBatch:async()=>{throw Error('Native write failed');},invalidate(){throw Error('Helper already disconnected');}};await assert.rejects(s.transfer(4,Buffer.alloc(2000)),e=>e.message==='Native write failed'&&e.transferStage==='start'&&e.bytesWritten===0&&e.transferBytes===2000);assert.equal(s.listeners.size,0);});
test('native reader diagnostics occur once per failed interface and contain no packets or device paths',()=>{const r=worker();r.send({op:'open',path:'screen',key:1});r.native[0].emit('data',Buffer.from([1,2,3]));r.native[0].emit('error',Error('reader stopped '.repeat(100)));r.native[0].emit('error',Error('again'));const events=r.messages.filter(m=>m.event==='diagnostic');assert.equal(events.length,1);assert.equal(events[0].kind,'usb-interface-failed');assert.equal(events[0].details.interface,'display');assert.equal(events[0].details.reason,'reader');assert.equal(events[0].details.message.length,160);assert.deepEqual(Object.keys(events[0].details).sort(),['clients','interface','message','reason']);});
function virtual(){const children=[];const box={module:{exports:{}},__dirname:require('node:path').resolve(__dirname,'../src'),process:{env:{},execPath:'node'},Buffer,setTimeout,clearTimeout,require:name=>name==='node:child_process'?{fork(){const child=new EventEmitter();child.connected=true;child.send=(_message,callback)=>callback?.();child.disconnect=()=>{child.connected=false;child.emit('exit',0,null);};child.kill=()=>child.emit('exit',null,'SIGTERM');children.push(child);return child;},execFileSync:()=> '[]'}:require(name)};vm.runInNewContext(fs.readFileSync(require.resolve('../src/hid.cjs'),'utf8'),box);return{api:box.module.exports,children};}
test('unexpected USB helper exit records one bounded diagnostic and closes active requests',async()=>{const f=virtual(),events=[];f.api.setDiagnosticHandler((kind,details)=>events.push({kind,details}));const h=new f.api.HID('screen');h.on('error',()=>{});const request=f.api.devicesAsync();f.children[0].emit('exit',37,'SIGTERM');await assert.rejects(request,/USB helper stopped/);assert.equal(h.closed,true);assert.equal(events.length,1);assert.equal(events[0].kind,'usb-helper-failed');assert.deepEqual(JSON.parse(JSON.stringify(events[0].details)),{reason:'exit',exitCode:37,signal:'SIGTERM',clients:1,pendingRequests:1});f.children[0].emit('error',Error('late process error'));assert.equal(events.length,1);});
test('intentional shutdown and retired helper messages never appear as fresh crash diagnostics',async()=>{const f=virtual(),events=[];f.api.setDiagnosticHandler((kind,details)=>events.push({kind,details}));const h=new f.api.HID('screen');h.on('error',()=>{});const old=f.children[0];await f.api.shutdown();const replacement=new f.api.HID('screen');replacement.on('error',()=>{});old.emit('message',{event:'diagnostic',kind:'usb-interface-failed',details:{reason:'reader'}});assert.equal(events.length,0);assert.equal(replacement.closed,false);await f.api.shutdown();});
test('diagnostic sink failure cannot prevent interface errors or helper cleanup',()=>{const f=virtual();f.api.setDiagnosticHandler(()=>{throw Error('disk unavailable');});const h=new f.api.HID('screen');let errors=0;h.on('error',()=>errors++);f.children[0].emit('message',{event:'diagnostic',kind:'usb-interface-failed',details:{reason:'reader'}});f.children[0].emit('error',Error('native helper failed'));assert.equal(errors,1);assert.equal(h.closed,true);});
test('lost IPC closes old clients immediately without poisoning a replacement opened before exit',async()=>{const f=virtual(),events=[];f.api.setDiagnosticHandler((kind,details)=>events.push({kind,details}));const oldHandle=new f.api.HID('screen');oldHandle.on('error',()=>{});const old=f.children[0],request=f.api.devicesAsync();old.connected=false;const next=new f.api.HID('screen');next.on('error',()=>{});await assert.rejects(request,/USB helper stopped/);assert.equal(oldHandle.closed,true);assert.equal(next.closed,false);assert.equal(f.children.length,2);old.emit('exit',null,'SIGTERM');assert.equal(next.closed,false);assert.equal(events.length,1);assert.equal(events[0].details.reason,'disconnect');await f.api.shutdown();});
test('IPC disconnect event retires active clients without waiting for process exit',()=>{const f=virtual(),events=[];f.api.setDiagnosticHandler((kind,details)=>events.push({kind,details}));const h=new f.api.HID('screen');h.on('error',()=>{});f.children[0].connected=false;f.children[0].emit('disconnect');assert.equal(h.closed,true);assert.equal(events.length,1);assert.equal(events[0].details.reason,'disconnect');});

test('IPC send failure rejects discovery immediately instead of waiting for its timeout',async()=>{const f=virtual();const h=new f.api.HID('screen');h.on('error',()=>{});f.children[0].send=(_m,callback)=>callback(Error('channel unavailable'));let error;const request=f.api.devicesAsync().catch(e=>{error=e;});await new Promise(setImmediate);const immediate=error;await f.api.shutdown();await request;assert.match(immediate?.message||'',/USB helper is unavailable/);});
test('IPC send failure rejects a native batch immediately and reports its client error',async()=>{const f=virtual();const h=new f.api.HID('screen');let errors=0;h.on('error',()=>errors++);f.children[0].send=(_m,callback)=>callback(Error('channel unavailable'));let error;const request=h.writeBatch([Buffer.alloc(1024)]).catch(e=>{error=e;});await new Promise(setImmediate);const immediate=error;await f.api.shutdown();await request;assert.match(immediate?.message||'',/USB helper is unavailable/);assert.equal(errors,1);});

test('a late IPC send callback cannot affect a replacement helper session',async()=>{const f=virtual();const oldHandle=new f.api.HID('screen');oldHandle.on('error',()=>{});let callback;const old=f.children[0];old.send=(_m,cb)=>{callback=cb;};const request=f.api.devicesAsync();const rejected=assert.rejects(request,/USB helper stopped/);old.connected=false;old.emit('disconnect');await rejected;const h=new f.api.HID('screen');let errors=0;h.on('error',()=>errors++);callback(Error('late IPC failure'));assert.equal(h.closed,false);assert.equal(errors,0);await f.api.shutdown();});
test('synchronously failed discovery sends clear their pending request timer',async()=>{const f=virtual();new f.api.HID('screen').on('error',()=>{});f.children[0].send=()=>{throw Error('send threw');};await assert.rejects(f.api.devicesAsync(),/send threw/);const events=[];f.api.setDiagnosticHandler((kind,details)=>events.push({kind,details}));f.children[0].emit('disconnect');assert.equal(events[0].details.pendingRequests,0);await f.api.shutdown();});

test('failed USB client construction leaves no orphan that can crash later helper cleanup',async()=>{
 const f=virtual();new f.api.HID('screen').on('error',()=>{});
 const child=f.children[0],events=[];f.api.setDiagnosticHandler((kind,details)=>events.push({kind,details}));
 child.send=()=>{throw Error('open IPC failed');};assert.throws(()=>new f.api.HID('screen'),/open IPC failed/);
 assert.doesNotThrow(()=>child.emit('disconnect'));assert.equal(events[0].details.clients,1);await f.api.shutdown();
});


test('worker IPC delivery failures close native handles and reject further queued writes',()=>{
 for(const mode of ['throw','callback']){
  const r=worker();r.send({op:'open',path:'screen',key:1});r.send({op:'open',path:'keys',key:2});let exits=0;r.process.exit=()=>{exits++;};
  r.process.send=(_message,callback)=>{if(mode==='throw')throw Error('channel closed');callback?.(Error('channel closed'));};
  assert.doesNotThrow(()=>r.native[0].emit('data',Buffer.from([3,1,0,50,5])));
  assert.equal(exits,1);assert.ok(r.native.every(h=>h.closed));
  r.send({op:'write',key:1,data:Array(1024).fill(0)});r.send({op:'write',key:2,data:Array(64).fill(0)});
  assert.ok(r.native.every(h=>h.writes===0),'no physical writes after losing response channel');
  r.process.emit('disconnect');assert.equal(exits,1);
 }
});

test('failed close and invalidate IPC messages retire the helper instead of leaving orphaned native clients',async()=>{
 for(const operation of ['close','invalidate'])for(const mode of ['throw','callback']){
  const f=virtual(),h=new f.api.HID('screen'),other=new f.api.HID('keys');h.on('error',()=>{});other.on('error',()=>{});const old=f.children[0];
  old.send=(_m,callback)=>{if(mode==='throw')throw Error('IPC disappeared');callback?.(Error('IPC disappeared'));};
  assert.doesNotThrow(()=>h[operation]());assert.equal(h.closed,true);assert.equal(other.closed,true);assert.equal(old.connected,false);
  const next=new f.api.HID('screen');next.on('error',()=>{});assert.equal(f.children.length,2);assert.equal(next.closed,false);await f.api.shutdown();
 }
});

test('repeated control-channel failures reject in-flight work and stale callbacks cannot retire new sessions',async()=>{
 const f=virtual();let late;
 for(let cycle=0;cycle<200;cycle++){
  const h=new f.api.HID('screen');h.on('error',()=>{});const other=new f.api.HID('keys');other.on('error',()=>{});const proc=f.children.at(-1);
  if(late){late(Error('old channel callback'));assert.equal(h.closed,false);}
  const batch=h.writeBatch([Buffer.alloc(1024)]),rejected=assert.rejects(batch,/USB helper stopped/);
  proc.send=(_message,callback)=>{late=callback;callback?.(Error('closed during cleanup'));};
  other.close();await rejected;assert.equal(h.closed,true);assert.equal(proc.connected,false);
  assert.doesNotThrow(()=>{h.close();h.invalidate();});
 }
 await f.api.shutdown();
});

test('a write racing IPC disconnect never sends a retired handle key into the replacement helper',async()=>{
 for(const batch of [false,true]){
  const f=virtual(),h=new f.api.HID('screen');h.on('error',()=>{});const old=f.children[0];old.connected=false;
  if(batch)await assert.rejects(h.writeBatch([Buffer.alloc(1024)]),/closed|stopped|unavailable/i);
  else assert.throws(()=>h.write(Array(1024).fill(0)),/closed|stopped|unavailable/i);
  assert.equal(h.closed,true);assert.equal(f.children.length,1,'a stale write does not start a replacement helper');await f.api.shutdown();
 }
});

test('cleanup sees a disconnected IPC channel before its disconnect event and cancels other pending clients',async()=>{
 const f=virtual(),h=new f.api.HID('screen'),other=new f.api.HID('keys');h.on('error',()=>{});other.on('error',()=>{});const pending=h.writeBatch([Buffer.alloc(1024)]),rejected=assert.rejects(pending,/USB helper stopped/);
 f.children[0].connected=false;other.close();assert.equal(h.closed,true);await rejected;await f.api.shutdown();
});


test('disconnect at every metadata transfer stage cannot upload pixels or invalidate the replacement session',async()=>{
 for(const failedCommand of [1,16,32]){
  const f=virtual(),handle=new f.api.HID('screen'),s=Object.create(Som.prototype);s.listeners=new Set();s.handle=handle;
  handle.on('error',error=>{s.failure=error;for(const listener of [...s.listeners])listener(error);});
  const old=f.children[0],commands=[];let replacement,newInvalidations=0;
  old.send=(message,callback)=>{
   if(message.op!=='write-batch'){callback?.();return;}
   const command=message.packets[0][3];commands.push(command);
   if(command===failedCommand){
    old.connected=false;old.emit('disconnect');replacement=new f.api.HID('screen');replacement.on('error',()=>{});
    f.children.at(-1).send=(next,done)=>{if(next.op==='invalidate')newInvalidations++;done?.();};
   }else{old.emit('message',{id:message.id,result:true});callback?.();}
  };
  const png=Buffer.concat([Buffer.from('89504e470d0a1a0a','hex'),Buffer.alloc(100)]);
  await assert.rejects(s.uploadOverlay(2,png,'test',false),/USB helper stopped/);
  assert.ok(replacement);assert.equal(replacement.closed,false);assert.equal(newInvalidations,0);assert.ok(!commands.includes(4),'failed metadata never starts the PNG transfer');assert.equal(s.listeners.size,0);
  assert.doesNotThrow(()=>replacement.write(Array(1024).fill(0)));await f.api.shutdown();
 }
});


test('successful discovery releases disappeared idle readers while preserving current and active interfaces',()=>{
 const r=worker();r.send({op:'open',path:'screen',key:1});r.send({op:'close',key:1});r.send({op:'open',path:'keys',key:2});
 r.inventory.splice(0,2);r.setDiscoveryError(true);r.send({op:'devices',id:10});assert.ok(r.native.every(h=>!h.closed),'failed enumeration cannot prove removal');
 r.setDiscoveryError(false);r.send({op:'devices',id:11});assert.equal(r.native[0].closed,true);assert.ok(!r.native[1].closed,'active client remains responsible for its reader');
 r.send({op:'close',key:2});assert.ok(!r.native[1].closed);r.send({op:'devices',id:12});assert.equal(r.native[1].closed,true);
});

test('device path churn without reader errors retains only the current idle interface',()=>{
 const r=worker();r.inventory.splice(1,1);
 for(let i=0;i<100;i++){r.inventory[0]={...r.inventory[0],path:'screen-'+i};r.send({op:'open',path:'screen-'+i,key:i});r.send({op:'close',key:i});r.send({op:'devices',id:1000+i});assert.equal(r.native.filter(h=>!h.closed).length,1);}
 r.send({op:'open',path:'screen-99',key:200});assert.equal(r.native.length,100,'current idle reader is reused');
});


test('late IPC backpressure callbacks and retired idle readers cannot disturb replacement clients',()=>{
 const r=worker();r.send({op:'open',path:'screen',key:1});r.send({op:'close',key:1});const old=r.native[0],device=r.inventory.shift();r.send({op:'devices',id:1});r.inventory.unshift(device);r.send({op:'open',path:'screen',key:2});
 const count=r.messages.length;old.emit('data',Buffer.from([3,1,0,50,2]));old.emit('error',Error('late retired reader error'));assert.equal(r.messages.length,count);r.send({op:'write',key:2,data:Array(1024).fill(0)});assert.equal(r.native[1].writes,1);assert.ok(!r.native[1].closed);
 const callbacks=[];let exits=0;r.process.exit=()=>exits++;r.process.send=(_message,callback)=>{callbacks.push(callback);return false;};
 for(let n=0;n<20;n++)r.native[1].emit('data',Buffer.from([3,1,0,50,2]));assert.ok(!r.native[1].closed,'IPC backpressure alone is not delivery failure');
 r.process.connected=false;r.process.emit('disconnect');assert.equal(exits,1);for(const callback of callbacks)callback?.(Error('late channel close'));assert.equal(exits,1);assert.ok(r.native.every(h=>h.closed));
});
