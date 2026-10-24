const test=require('node:test'),assert=require('node:assert/strict');
const {Som}=require('../src/som.cjs');
function client({rejectBatch=false,earlyReply=false}={}){
 const packets=[],batches=[],s=Object.create(Som.prototype);s.listeners=new Set();
 const reply=()=>{for(const listener of [...s.listeners])listener(null,32,Buffer.from([0,4]));};
 s.handle={write(packet){packets.push(packet);if(packet[3]===32)queueMicrotask(reply);return packet.length;},async writeBatch(batch){batches.push(batch.length);if(rejectBatch)throw Error('USB batch failed');for(const packet of batch)packets.push(packet);if(earlyReply)reply();}};
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
 proc.emit('message',{op:'write-batch',key:1,id:2,packets});assert.equal(writes,64);assert.equal(messages.at(-1).result,true);
 short=true;proc.emit('message',{op:'write-batch',key:1,id:3,packets});assert.equal(writes,65);assert.ok(messages.at(-1).error);
 proc.emit('message',{op:'write-batch',key:1,id:4,packets:[...packets,packets[0]]});assert.equal(writes,65);assert.ok(messages.at(-1).error);
 proc.emit('message',{op:'write-batch',key:99,id:5,packets});assert.ok(messages.at(-1).error);
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
