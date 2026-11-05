const test=require('node:test'),assert=require('node:assert/strict');
const {Som}=require('../src/som.cjs');
function client({rejectBatch=false,earlyReply=false}={}){
 const packets=[],batches=[],s=Object.create(Som.prototype);s.listeners=new Set();
 const reply=()=>{for(const listener of [...s.listeners])listener(null,32,Buffer.from([0,4]));};
 s.handle={write(packet){packets.push(packet);if(packet[3]===32)queueMicrotask(reply);return packet.length;},async writeBatch(batch){batches.push(batch.length);if(rejectBatch)throw Error('USB batch failed');for(const packet of batch)packets.push(packet);if(earlyReply||batch.some(p=>p[3]===32))reply();}};
 return {s,packets,batches};
}
test('large overlay transfers drain bounded batches before ending and include file-status heartbeats',async()=>{
 const f=client(),bytes=Buffer.alloc(2*1024*1024+2048,17);await f.s.transfer(4,bytes);
 assert.ok(f.batches.length>1);assert.ok(f.batches.every(n=>n<=64));
 assert.deepEqual(Buffer.concat(f.packets.filter(p=>p[3]===16).map(p=>Buffer.from(p).subarray(4,4+Buffer.from(p).readUInt16LE(1)))),bytes);
 assert.equal(f.packets.filter(p=>p[3]===17).length,2);assert.equal(f.packets.at(-1)[3],32);assert.equal(f.s.listeners.size,0);
});
test('failed batches stop upload without sending FILE_END or remaining image data',async()=>{
 const f=client({rejectBatch:true});await assert.rejects(f.s.transfer(4,Buffer.alloc(1024*1024)),/USB batch failed/);
 assert.equal(f.batches.length,1);assert.equal(f.packets.some(p=>p[3]===32),false);assert.equal(f.s.listeners.size,0);
});
test('premature upload acknowledgement cannot complete a partially transmitted file',async()=>{
 const f=client({earlyReply:true});await assert.rejects(f.s.transfer(4,Buffer.alloc(1024*1024)),/before.*ended/);
 assert.equal(f.batches.length,1);assert.equal(f.packets.some(p=>p[3]===32),false);
});
test('an interface error during a batch prevents every later batch and FILE_END',async()=>{
 const f=client();f.s.handle.writeBatch=async batch=>{f.batches.push(batch.length);for(const listener of [...f.s.listeners])listener(Error('USB interrupted'));await new Promise(resolve=>setImmediate(resolve));};
 await assert.rejects(f.s.transfer(4,Buffer.alloc(1024*1024)),/USB interrupted/);
 await new Promise(resolve=>setImmediate(resolve));assert.equal(f.batches.length,1);assert.equal(f.packets.some(p=>p[3]===32),false);assert.equal(f.s.listeners.size,0);
});
test('a timed-out batch cannot resume writing after its delayed completion',async()=>{
 const f=client();let release;
 f.s.wait=function(match,trigger){return Som.prototype.wait.call(this,match,trigger,5);};
 f.s.handle.writeBatch=batch=>{f.batches.push(batch.length);return new Promise(resolve=>release=resolve);};
 await assert.rejects(f.s.transfer(4,Buffer.alloc(1024*1024)),error=>error.code==='DISPLAY_REQUEST_TIMEOUT');
 release();await new Promise(resolve=>setImmediate(resolve));assert.equal(f.batches.length,1);assert.equal(f.packets.some(p=>p[3]===32),false);assert.equal(f.s.listeners.size,0);
});
test('the USB worker acknowledges completed batches and stops immediately on a short native write',()=>{
 const fs=require('node:fs'),vm=require('node:vm'),{EventEmitter}=require('node:events'),proc=new EventEmitter(),messages=[];let writes=0,short=false;
 Object.assign(proc,{argv:[],connected:true,send:m=>messages.push(m),exit(){}});
 class Native extends EventEmitter{write(p){writes++;return short?100:p.length;}close(){}}
 vm.runInNewContext(fs.readFileSync(require.resolve('../src/hid-worker.cjs'),'utf8'),{process:proc,require:()=>({HID:Native,devices:()=>[{vendorId:0x361d,productId:0x202,usagePage:0xff00,usage:1,path:'test'}]})});
 proc.emit('message',{op:'open',key:1,path:'test'});const packets=Array.from({length:64},()=>Array(1024).fill(0));
 const deadline=Date.now()+10000;
 proc.emit('message',{op:'write-batch',key:1,id:2,deadline,packets});assert.equal(writes,64);assert.equal(messages.at(-1).result,true);
 short=true;proc.emit('message',{op:'write-batch',key:1,id:3,deadline,packets});assert.equal(writes,65);assert.ok(messages.at(-1).error);
 proc.emit('message',{op:'write-batch',key:1,id:4,deadline,packets:[...packets,packets[0]]});assert.equal(writes,65);assert.ok(messages.at(-1).error);
 proc.emit('message',{op:'write-batch',key:99,id:5,deadline,packets});assert.ok(messages.at(-1).error);
});
test('exit restoration confirms delayed slot changes and never repeats a toggle command',async()=>{
 for(const target of [0,1]){
  const replies=[6,6,target,target],selections=[];
  await Som.prototype.activate.call({currentSlot:async()=>replies.shift(),selectSlot:slot=>selections.push(slot)},target);
  assert.deepEqual(selections,[target===0?6:target]);assert.equal(replies.length,0);
 }
});
test('unconfirmed or malformed restoration does not report success',async()=>{
 const selections=[];
 await assert.rejects(Som.prototype.activate.call({currentSlot:async()=>6,selectSlot:slot=>selections.push(slot)},0),error=>error.code==='DISPLAY_RESTORE_FAILED');assert.deepEqual(selections,[6]);
 await assert.rejects(Som.prototype.activate.call({currentSlot:async()=>11,selectSlot:()=>assert.fail('must not toggle an unknown slot')},0),/Invalid active overlay/);
});
test('backlogged or stalled USB batches cannot continue writing beyond their deadline',()=>{
 const fs=require('node:fs'),vm=require('node:vm'),{EventEmitter}=require('node:events'),proc=new EventEmitter(),messages=[];let time=200,writes=0,stall=false;
 Object.assign(proc,{argv:[],connected:true,send:m=>messages.push(m),exit(){}});
 class Native extends EventEmitter{write(p){writes++;if(stall)time+=1000;return p.length;}close(){}}
 vm.runInNewContext(fs.readFileSync(require.resolve('../src/hid-worker.cjs'),'utf8'),{Date:{now:()=>time},process:proc,require:()=>({HID:Native,devices:()=>[{vendorId:0x361d,productId:0x202,usagePage:0xff00,usage:1,path:'test'}]})});
 proc.emit('message',{op:'open',key:1,path:'test'});const packets=Array.from({length:64},()=>Array(1024).fill(0));
 proc.emit('message',{op:'write-batch',key:1,id:1,deadline:100,packets});assert.equal(writes,0);assert.ok(messages.at(-1).error);
 stall=true;proc.emit('message',{op:'write-batch',key:1,id:2,deadline:500,packets});assert.equal(writes,0,'failed sessions reject queued writes until reconnect');assert.ok(messages.at(-1).error);
});

test('transfer waits for confirmed start write before sending any image bytes',async()=>{
 const f=client();let release;const original=f.s.handle.writeBatch;
 f.s.handle.writeBatch=packets=>packets[0][3]===4?new Promise(resolve=>{release=()=>{f.packets.push(...packets);resolve();};}):original(packets);
 const pending=f.s.transfer(4,Buffer.alloc(2050));await new Promise(resolve=>setImmediate(resolve));
 assert.equal(f.packets.length,0);release();await pending;
 assert.deepEqual(f.packets.map(p=>p[3]),[4,16,16,16,32]);
});
test('failed start or end write identifies the failing stage and cannot be mistaken for a missing firmware reply',async()=>{
 for(const command of [4,32]){const f=client(),original=f.s.handle.writeBatch;
 f.s.handle.writeBatch=packets=>{if(packets[0][3]===command)return Promise.reject(Error('Incomplete USB packet write.'));return original(packets);};
 await assert.rejects(f.s.transfer(4,Buffer.alloc(2040)),e=>e.transferStage===(command===4?'start':'end')&&e.bytesWritten===(command===4?0:2040)&&e.transferBytes===2040);
 assert.equal(f.packets.some(p=>p[3]===32),false);if(command===4)assert.equal(f.packets.length,0);
 }
});
test('missing firmware acknowledgement reports successfully written byte count',async()=>{
 const f=client();f.s.wait=function(match,trigger){return Som.prototype.wait.call(this,match,trigger,20);};
 f.s.handle.writeBatch=async packets=>{f.packets.push(...packets);};
 await assert.rejects(f.s.transfer(4,Buffer.alloc(2040)),e=>e.code==='DISPLAY_REQUEST_TIMEOUT'&&e.transferStage==='acknowledgement'&&e.bytesWritten===2040);
});
test('single native USB writes report short control packets instead of silently succeeding',()=>{
 const fs=require('node:fs'),vm=require('node:vm'),{EventEmitter}=require('node:events'),proc=new EventEmitter(),messages=[];
 Object.assign(proc,{argv:[],connected:true,send:m=>messages.push(m),exit(){}});
 class Native extends EventEmitter{write(){return 10;}close(){}}
 vm.runInNewContext(fs.readFileSync(require.resolve('../src/hid-worker.cjs'),'utf8'),{process:proc,require:()=>({HID:Native,devices:()=>[{vendorId:0x361d,productId:0x202,usagePage:0xff00,usage:1,path:'test'}]})});
 proc.emit('message',{op:'open',key:1,path:'test'});proc.emit('message',{op:'write',key:1,data:Array(1024).fill(0)});
 assert.equal(messages.at(-1).event,'error');assert.match(messages.at(-1).message,/Incomplete USB packet/);
});

test('short native writes quarantine queued packets on the same interface but leave the keyboard interface usable',()=>{
 const fs=require('node:fs'),vm=require('node:vm'),{EventEmitter}=require('node:events'),proc=new EventEmitter(),messages=[];let writes=0;
 Object.assign(proc,{argv:[],connected:true,send:m=>messages.push(m),exit(){}});
 class Native extends EventEmitter{constructor(path){super();this.path=path;}write(p){writes++;return this.path==='screen'?1:p.length;}close(){}}
 const devices=[{vendorId:0x361d,productId:0x202,usagePage:0xff00,usage:1,path:'screen'},{vendorId:0x361d,productId:0x200,usagePage:0xff00,usage:1,path:'keys'}];
 vm.runInNewContext(fs.readFileSync(require.resolve('../src/hid-worker.cjs'),'utf8'),{process:proc,require:()=>({HID:Native,devices:()=>devices})});
 proc.emit('message',{op:'open',key:1,path:'screen'});proc.emit('message',{op:'open',key:2,path:'keys'});
 proc.emit('message',{op:'write',key:1,data:Array(1024).fill(0)});
 proc.emit('message',{op:'write-batch',key:1,id:1,deadline:Date.now()+10000,packets:[Array(1024).fill(0)]});
 proc.emit('message',{op:'write',key:1,data:Array(1024).fill(0)});assert.equal(writes,1);
 proc.emit('message',{op:'write',key:2,data:Array(64).fill(0)});assert.equal(writes,2);
});
