'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {StudioDeviceLoader,metadata,parseEnd,parseSelection,artifact,sha,CHUNK,HEARTBEAT}=require('../src/studio-device-loader.cjs');
const clone=value=>JSON.parse(JSON.stringify(value));
const original=slot=>({slot,fileID:'original-'+slot,fileName:slot===4?'Koi':'Skin '+slot,fileExtension:slot===4?'pak':'mp4',fileSize:300});
class Device {
 constructor(){this.identity='mock-keyboard';this.active=4;this.slots=Array.from({length:5},(_,i)=>original(i+1));this.files=new Map(this.slots.map(v=>[v.slot,Buffer.alloc(v.fileSize,v.slot)]));this.log=[];this.closed=0;this.failNativeOnce=false;this.failAfterNativeOnce=false;this.unknownAfterNative=false;this.opens=[];}
 open(){const d=this,s={identity:d.identity,listeners:new Set(),close(){d.closed++;},wait(match,trigger){return new Promise((resolve,reject)=>{const listener=(error,cmd,p)=>{if(error){s.listeners.delete(listener);reject(error);return;}try{const v=match(cmd,p);if(v!==undefined){s.listeners.delete(listener);resolve(v);}}catch(e){s.listeners.delete(listener);reject(e);}};s.listeners.add(listener);try{trigger();}catch(e){s.listeners.delete(listener);reject(e);}});},send(cmd,p=Buffer.alloc(0)){p=Buffer.from(p);d.log.push({cmd,p});d.beforeSend?.(cmd,p);const emit=(cmd,p)=>{for(const fn of [...s.listeners])fn(null,cmd,p);};
   if(cmd===48){if(p.length)d.active=p[0];emit(48,Buffer.from([d.active]));}
   else if(cmd===8)emit(8,Buffer.concat([p,Buffer.from(JSON.stringify(d.slots[p[0]-1]))]));
   else if(cmd===1||cmd===0){s.kind=cmd;s.parts=[];}
   else if(cmd===16)s.parts.push(p);
   else if(cmd===32){const data=Buffer.concat(s.parts),kind=s.kind;if(kind===1)d.pending=JSON.parse(data);else{
     if(d.failNativeOnce){d.failNativeOnce=false;emit(32,Buffer.from([1,0]));return;}
     d.slots[d.pending.slot-1]=clone(d.pending);d.files.set(d.pending.slot,data);d.active=d.pending.slot;
     if(d.unknownAfterNative){d.unknownAfterNative=false;d.slots[d.pending.slot-1].fileID='external-change';}
     if(d.failAfterNativeOnce){d.failAfterNativeOnce=false;emit(32,Buffer.from([1,0]));return;}
    }emit(32,Buffer.from([0,kind]));}
  }};d.opens.push(s);return s;
 }
 writes(){return this.log.filter(v=>![8,48].includes(v.cmd)||v.cmd===48&&v.p.length);}
}
function fixture(t){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'studio-loader-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));const device=new Device(),inspector=()=>({version:11,encryptedIndex:false,mountPoint:'../../../spark/Content/',paths:['map/M_EntryPoint.umap'],unsafePaths:[]});let clock=0;const options={connect:()=>device.open(),inspectPak:inspector,sleep:async ms=>{clock+=ms;},now:()=>clock,yield:async()=>{}};const loader=new StudioDeviceLoader(dir,options),bytes=Buffer.alloc(5000,0xa5);const input={bytes,sha256:sha(bytes),name:'Native pond'};const copy=slot=>({bytes:Buffer.from(device.files.get(slot)),metadata:clone(device.slots[slot-1]),sha256:sha(device.files.get(slot)),sourceUrl:'https://assets.freethinkerportal.com/video/flames/flames_encode.mp4'});return{dir,device,loader,input,copy,options,setTime:v=>{clock=v;}};}
const code=expected=>e=>e.code===expected;

test('explicit permanent replacement requires review, preserves default and never claims overwritten file was restored',async t=>{
 const f=fixture(t),koi=clone(f.device.slots[3]);
 const review=await f.loader.prepare({...f.input,slot:5,replaceWithoutBackup:true});
 assert.equal(review.replacedWithoutBackup,true);assert.equal(review.replaces,'Skin 5');assert.equal(f.device.writes().length,0);
 await assert.rejects(f.loader.execute(review.token),code('STUDIO_REPLACEMENT_REVIEW'));
 const accepted=await f.loader.prepare({...f.input,slot:5,replaceWithoutBackup:true});
 const used=await f.loader.execute(accepted.token,{confirmCatalogReplacement:true});assert.equal(used.canRestore,false);assert.equal(f.device.active,5);assert.deepEqual(f.device.slots[3],koi);
 const returned=await f.loader.restoreLast();assert.equal(returned.restored,false);assert.equal(returned.previousSkinSelected,true);assert.equal(f.device.active,4);assert.equal(f.device.slots[4].fileName,'Native pond');
 const next=await f.loader.prepare({...f.input,name:'Next Companion skin'});assert.equal(next.slot,5);assert.equal(next.requiresReplacementReview,false);
 await f.loader.execute(next.token);assert.equal(f.device.active,5);
});

test('permanent replacement never bypasses protected slots or changed inventory',async t=>{
 const f=fixture(t);await assert.rejects(f.loader.prepare({...f.input,slot:4,replaceWithoutBackup:true}),code('STUDIO_DEFAULT_PROTECTED'));
 const review=await f.loader.prepare({...f.input,slot:5,replaceWithoutBackup:true});f.device.slots[4].fileID='changed';
 await assert.rejects(f.loader.execute(review.token,{confirmCatalogReplacement:true}),code('STUDIO_SKINS_CHANGED'));assert.equal(f.device.writes().length,0);
});
test('switching the active Companion skin reuses only its owned slot and retains the original restoration',async t=>{
 const f=fixture(t),before=clone(f.device.slots),first=await f.loader.prepare({...f.input,slot:5,backup:f.copy(5)});
 await f.loader.execute(first.token,{confirmCatalogReplacement:true});
 const bytes=Buffer.alloc(5100,0xb6),second=await f.loader.prepare({bytes,sha256:sha(bytes),name:'Second scene'});
 assert.equal(second.slot,5);assert.equal(second.requiresReplacementReview,false);
 await f.loader.execute(second.token);assert.equal(f.device.active,5);assert.equal(f.device.slots[4].fileName,'Second scene');
 await f.loader.restoreLast();assert.deepEqual(f.device.slots,before);assert.equal(f.device.active,4);
});
test('a failed switch restores the previous Companion package and keeps the XPANEL baseline recoverable',async t=>{
 const f=fixture(t),before=clone(f.device.slots),first=await f.loader.prepare({...f.input,slot:5,backup:f.copy(5)});
 await f.loader.execute(first.token,{confirmCatalogReplacement:true});
 const bytes=Buffer.alloc(5100,0xb6),second=await f.loader.prepare({bytes,sha256:sha(bytes),name:'Second scene'});f.device.failAfterNativeOnce=true;
 await assert.rejects(f.loader.execute(second.token),e=>e.code==='STUDIO_UPLOAD_REJECTED'&&e.previousSkinRestored);
 assert.equal(f.device.active,4);assert.equal(f.device.slots[4].fileName,'Native pond');
 await f.loader.restoreLast();assert.deepEqual(f.device.slots,before);
});
test('metadata and acknowledgements reject ambiguous states and expose firmware error text',()=>{
 assert.throws(()=>metadata({},2),code('STUDIO_SKIN_METADATA'));assert.deepEqual(metadata({empty:true},2),{slot:2,empty:true});assert.throws(()=>metadata({empty:true,slot:3},2),code('STUDIO_SKIN_METADATA'));
 assert.equal(parseEnd(Buffer.from([0,1]),0),undefined);assert.equal(parseEnd(Buffer.from([0,0]),0),true);assert.throws(()=>parseEnd(Buffer.from([0]),0),code('STUDIO_UPLOAD_REPLY'));
 const msg=Buffer.from('Not enough storage'),reply=Buffer.alloc(5+msg.length);reply[0]=1;reply[1]=0;reply[2]=1;reply.writeUInt16LE(msg.length,3);msg.copy(reply,5);assert.throws(()=>parseEnd(reply,0),e=>e.code==='STUDIO_UPLOAD_REJECTED'&&e.message.includes('Not enough storage'));
 assert.throws(()=>parseSelection(Buffer.from([5,2]),5),code('STUDIO_SKIN_ACTIVATION'));assert.equal(parseSelection(Buffer.from([4]),5),undefined);
});
test('artifact verification rejects changed bytes, non-PAKs and unsafe runtime files',()=>{
 const bytes=Buffer.alloc(500),hash=sha(bytes),base={version:11,paths:['Content/map/M_EntryPoint.umap']};assert.throws(()=>artifact(bytes,'0'.repeat(64),'Pond'),code('STUDIO_PAK_CHANGED'));assert.throws(()=>artifact(bytes,hash,'Pond'));
 assert.throws(()=>artifact(bytes,hash,'Pond',()=>({...base,paths:[...base.paths,'Engine/test.dll']})),code('STUDIO_PAK_CONTENT'));assert.throws(()=>artifact(bytes,hash,'Pond',()=>({...base,encryptedIndex:true})),code('STUDIO_PAK_ENTRY'));
});
test('all five occupied slots do not imply extra native slots or cause writes',async t=>{const f=fixture(t);await assert.rejects(f.loader.prepare(f.input),code('STUDIO_SKIN_SLOTS_FULL'));assert.equal(f.device.writes().length,0);assert.equal(f.device.closed,1);});
test('active, original and preferred default slots are protected',async t=>{const f=fixture(t),dir=path.join(f.dir,'keyboard-skins');fs.mkdirSync(dir);fs.writeFileSync(path.join(dir,sha(Buffer.from(f.device.identity))+'.json'),JSON.stringify({original:{slot:4},default:{slot:1}}));for(const slot of [4,1])await assert.rejects(f.loader.prepare({...f.input,slot,backup:f.copy(slot)}),code('STUDIO_DEFAULT_PROTECTED'));assert.equal(f.device.writes().length,0);});
test('occupied slot requires matching restoration bytes and explicit reviewed replacement',async t=>{const f=fixture(t);await assert.rejects(f.loader.prepare({...f.input,slot:5}),code('STUDIO_BACKUP_MISMATCH'));const wrong=f.copy(5);wrong.bytes[0]=0;await assert.rejects(f.loader.prepare({...f.input,slot:5,backup:wrong}),code('STUDIO_BACKUP_MISMATCH'));const review=await f.loader.prepare({...f.input,slot:5,backup:f.copy(5)});assert.equal(review.requiresReplacementReview,true);assert.equal(review.restoration.originalDeviceBytesReadable,false);await assert.rejects(f.loader.execute(review.token),code('STUDIO_REPLACEMENT_REVIEW'));assert.equal(f.device.writes().length,0);});
test('test preparation binds exact keyboard, inventory and a short-lived single-use token',async t=>{const f=fixture(t);const prepare=()=>f.loader.prepare({...f.input,slot:5,backup:f.copy(5)});let r=await prepare();f.device.slots[0].fileName='Changed';await assert.rejects(f.loader.execute(r.token,{confirmCatalogReplacement:true}),code('STUDIO_SKINS_CHANGED'));r=await prepare();f.device.identity='different';await assert.rejects(f.loader.execute(r.token,{confirmCatalogReplacement:true}),code('STUDIO_DEVICE_CHANGED'));r=await prepare();f.setTime(300001);await assert.rejects(f.loader.execute(r.token,{confirmCatalogReplacement:true}),code('STUDIO_TEST_EXPIRED'));assert.equal(f.device.writes().length,0);});
test('native upload journals restoration before writes and follows typed JSON/SKIN packet protocol',async t=>{const f=fixture(t),before=clone(f.device.slots),old=f.copy(5);f.input.bytes=Buffer.alloc(HEARTBEAT+3000,0xa5);f.input.sha256=sha(f.input.bytes);const review=await f.loader.prepare({...f.input,slot:5,backup:old});const paths=f.loader._paths(f.device.identity);f.device.beforeSend=cmd=>{if(cmd===1||cmd===0){assert.ok(fs.existsSync(paths.journal));assert.equal(sha(f.loader._bytes(paths,old.sha256)),old.sha256);}};const result=await f.loader.execute(review.token,{confirmCatalogReplacement:true});assert.equal(result.transportConfirmed,true);assert.equal(result.nativeRenderingVerified,false);assert.equal(f.device.active,5);assert.equal(f.device.files.get(5).equals(f.input.bytes),true);assert.deepEqual(f.device.slots.slice(0,4),before.slice(0,4));const packets=f.device.writes();assert.deepEqual(packets.filter(v=>[1,0,32].includes(v.cmd)).map(v=>v.cmd),[1,32,0,32]);assert.equal(packets.filter(v=>v.cmd===17).length,1);assert.ok(packets.filter(v=>v.cmd===16).every(v=>v.p.length<=CHUNK));assert.ok(!packets.some(v=>v.cmd===50));assert.ok(f.device.opens.every(s=>s.listeners.size===0));
 const restored=await new StudioDeviceLoader(f.dir,f.options).restoreLast();assert.equal(restored.restored,true);assert.deepEqual(f.device.slots,before);assert.equal(f.device.files.get(5).equals(old.bytes),true);assert.equal(f.device.active,4);
});
test('failed native upload rolls back without modifying Koi or requiring a new session',async t=>{const f=fixture(t),before=clone(f.device.slots);const r=await f.loader.prepare({...f.input,slot:5,backup:f.copy(5)});f.device.failAfterNativeOnce=true;await assert.rejects(f.loader.execute(r.token,{confirmCatalogReplacement:true}),e=>e.code==='STUDIO_UPLOAD_REJECTED'&&e.previousSkinRestored);assert.deepEqual(f.device.slots,before);assert.equal(f.device.active,4);assert.ok(f.device.opens.every(s=>s.listeners.size===0));});
test('readback mismatch never overwrites an unrecognized skin during rollback',async t=>{const f=fixture(t);const r=await f.loader.prepare({...f.input,slot:5,backup:f.copy(5)});f.device.unknownAfterNative=true;await assert.rejects(f.loader.execute(r.token,{confirmCatalogReplacement:true}),e=>e.code==='STUDIO_UPLOAD_READBACK'&&!e.previousSkinRestored&&e.previousSkinSelected);assert.equal(f.device.slots[4].fileID,'external-change');assert.equal(f.device.active,4);assert.equal(f.device.log.filter(v=>v.cmd===0).length,1);});
test('missing restoration file keeps recovery journal and returns safely to Koi',async t=>{const f=fixture(t),old=f.copy(5),r=await f.loader.prepare({...f.input,slot:5,backup:old});await f.loader.execute(r.token,{confirmCatalogReplacement:true});fs.unlinkSync(path.join(f.loader._paths(f.device.identity).root,old.sha256+'.bin'));f.device.log=[];await assert.rejects(f.loader.restoreLast(),e=>e.previousSkinSelected===true);assert.equal(f.device.active,4);assert.equal(f.device.log.filter(v=>v.cmd===0).length,0);assert.ok(fs.existsSync(f.loader._paths(f.device.identity).journal));});
test('empty-slot test returns to original while honestly retaining test file without delete command',async t=>{const f=fixture(t);f.device.slots[4]={slot:5,empty:true};const r=await f.loader.prepare(f.input);assert.equal(r.slot,5);assert.equal(r.requiresReplacementReview,false);await f.loader.execute(r.token);const result=await f.loader.restoreLast();assert.equal(result.testSkinRetained,true);assert.equal(f.device.active,4);assert.equal(f.device.slots[4].fileName,'Native pond');});
test('sequential Studio tests retain original catalog restoration baseline',async t=>{const f=fixture(t),before=clone(f.device.slots),old=f.copy(5);let r=await f.loader.prepare({...f.input,slot:5,backup:old});await f.loader.execute(r.token,{confirmCatalogReplacement:true});f.device.active=4;r=await f.loader.prepare({...f.input,name:'Second pond'});assert.equal(r.requiresReplacementReview,false);await f.loader.execute(r.token);await f.loader.restoreLast();assert.deepEqual(f.device.slots,before);assert.equal(f.device.files.get(5).equals(old.bytes),true);});
test('new default assignment after review blocks writes',async t=>{const f=fixture(t);const r=await f.loader.prepare({...f.input,slot:5,backup:f.copy(5)}),dir=path.join(f.dir,'keyboard-skins');fs.mkdirSync(dir);fs.writeFileSync(path.join(dir,sha(Buffer.from(f.device.identity))+'.json'),JSON.stringify({original:{slot:4},default:{slot:5}}));await assert.rejects(f.loader.execute(r.token,{confirmCatalogReplacement:true}),code('STUDIO_DEFAULT_PROTECTED'));assert.equal(f.device.writes().length,0);});
test('interrupted transfer rejects early acknowledgement and closes its listener',async t=>{const f=fixture(t),s=f.device.open();s.send=(cmd,p)=>{if(cmd===0)for(const fn of [...s.listeners])fn(null,32,Buffer.from([0,0]));};await assert.rejects(f.loader._transfer(s,0,f.input.bytes),code('STUDIO_UPLOAD_STALE_REPLY'));assert.equal(s.listeners.size,0);});
test('loader instances serialize operations and release locks on connection failure',async t=>{const f=fixture(t),other=new StudioDeviceLoader(f.dir,f.options);let release;const run=f.loader._run(()=>new Promise(r=>{release=r;}));await assert.rejects(other.inspect(),code('STUDIO_DEVICE_BUSY'));release();await run;const broken=new StudioDeviceLoader(f.dir,{connect(){throw new Error('Disconnected');}});await assert.rejects(broken.inspect(),/Disconnected/);assert.equal((await other.inspect()).nativeSlots,5);});

test('selecting the same owned package reuses it without uploading again',async t=>{const f=fixture(t);const review=await f.loader.prepare({...f.input,slot:5,backup:f.copy(5)});await f.loader.execute(review.token,{confirmCatalogReplacement:true});f.device.log=[];const again=await f.loader.prepare(f.input);const result=await f.loader.execute(again.token);assert.equal(result.reused,true);assert.equal(result.transportConfirmed,true);assert.equal(f.device.log.filter(e=>[0,1,16,32].includes(e.cmd)).length,0);});
