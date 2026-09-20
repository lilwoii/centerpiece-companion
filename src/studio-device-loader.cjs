'use strict';
// Transport evidence: XPANEL smbpUVRn.js J/l and 37.Bad5UHmf.js yt/gt
// (captured 2026-09-07); official Skins docs confirm five native skin slots.
// No skin-delete, full-file readback, capacity query, or native slot 6+ is known.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {inspectPak}=require('./pak-inspector.cjs');
const MAX_BYTES=128*1024*1024,CHUNK=1020,HEARTBEAT=1024*1024;
// Main-process integration must also suspend its existing display queue. This
// module lock prevents two loader instances from overlapping native transfers.
let deviceOperationActive=false;
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const validSlot=n=>Number.isInteger(n)&&n>=1&&n<=5;
const validHash=s=>typeof s==='string'&&/^[a-f0-9]{64}$/.test(s);
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function fail(code,message,extra={}){return Object.assign(new Error(message),{code,...extra});}
function metadata(input,slot){
 if(!validSlot(slot)||!input||typeof input!=='object'||Array.isArray(input))throw fail('STUDIO_SKIN_METADATA','Keyboard skin information is malformed. No slot can be considered available.');
 if(input.slot!==undefined&&input.slot!==slot)throw fail('STUDIO_SKIN_METADATA','Keyboard returned information for a different skin slot.');
 if(input.empty===true)return{slot,empty:true};
 if(typeof input.fileID!=='string'||!/^[-a-z0-9]{1,100}$/i.test(input.fileID)||typeof input.fileName!=='string'||!input.fileName||input.fileName.length>120||/[\x00-\x1f\x7f]/.test(input.fileName)||!['pak','mp4','png','jpg','jpeg','mov','avi'].includes(input.fileExtension)||!Number.isSafeInteger(input.fileSize)||input.fileSize<1||input.fileSize>MAX_BYTES)throw fail('STUDIO_SKIN_METADATA','Keyboard returned incomplete skin information. Existing files were preserved.');
 return{slot,fileID:input.fileID,fileName:input.fileName,fileExtension:input.fileExtension,fileSize:input.fileSize};
}
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
function parseEnd(payload,type){
 if(payload.length<2)throw fail('STUDIO_UPLOAD_REPLY','Keyboard returned an incomplete upload acknowledgement.');
 if(payload[1]!==type)return;
 if(payload[0]===0)return true;
 let detail='The keyboard rejected this file.';
 if(payload[2]===1&&payload.length>=5){const length=payload.readUInt16LE(3);if(length&&payload.length>=5+length)detail=payload.subarray(5,5+length).toString('utf8').replace(/[\x00-\x1f\x7f]/g,' ').slice(0,240);}
 throw fail('STUDIO_UPLOAD_REJECTED',(type===1?'Skin metadata':'Skin file')+' upload failed: '+detail);
}
function parseSelection(payload,target){
 if(!payload.length||payload[0]!==target)return;
 if(payload.length===1)return true;
 let detail=payload[1]===2?'The skin slot is empty.':'The skin did not finish loading.';
 if(payload[1]===1&&payload.length>=4){const length=payload.readUInt16LE(2);if(length&&payload.length>=4+length)detail=payload.subarray(4,4+length).toString('utf8').replace(/[\x00-\x1f\x7f]/g,' ').slice(0,240);}
 throw fail('STUDIO_SKIN_ACTIVATION','Keyboard could not activate skin slot '+target+': '+detail);
}
async function current(s){return s.wait((cmd,p)=>{if(cmd!==48)return;if(p.length!==1||!validSlot(p[0]))throw fail('STUDIO_SKIN_CURRENT','The keyboard did not report a valid active skin slot.');return p[0];},()=>s.send(48),5000);}
async function details(s,slot){return s.wait((cmd,p)=>{if(cmd!==8||p[0]!==slot)return;if(p.length<2)throw fail('STUDIO_SKIN_METADATA','Skin slot '+slot+' returned no metadata. This is not proof that it is empty.');let value;try{value=JSON.parse(p.subarray(1).toString('utf8').replace(/\0+$/,''));}catch{throw fail('STUDIO_SKIN_METADATA','Skin slot '+slot+' returned invalid metadata.');}return metadata(value,slot);},()=>s.send(8,Buffer.from([slot])),5000);}
async function inventory(s){if(typeof s.identity!=='string'||!s.identity)throw fail('STUDIO_DEVICE_IDENTITY','The connected keyboard could not be identified.');const active=await current(s),slots=[];for(let slot=1;slot<=5;slot++)slots.push(await details(s,slot));if(slots[active-1].empty)throw fail('STUDIO_SKIN_CURRENT','The active keyboard skin has no stable identity.');return{active,slots};}
function artifact(bytes,expected,name,inspect=inspectPak){
 if(!Buffer.isBuffer(bytes)||bytes.length<221||bytes.length>MAX_BYTES||!validHash(expected)||sha(bytes)!==expected)throw fail('STUDIO_PAK_CHANGED','The compiled skin is missing, oversized, or no longer matches the verified build. Rebuild it before testing.');
 if(typeof name!=='string'||!name.trim()||name.length>100||/[\x00-\x1f\x7f]/.test(name))throw fail('STUDIO_SKIN_NAME','Use a skin name from 1 to 100 characters.');
 const report=inspect(bytes);
 if(report.encryptedIndex||report.version!==11)throw fail('STUDIO_PAK_ENTRY','Choose a readable PAK v11 keyboard skin.');
 if(!require('./studio-pak.cjs').contentPaths(report))throw fail('STUDIO_PAK_CONTENT','Choose a Studio-generated content package with the keyboard entry map and the expected content mount point.');
 return{bytes:Buffer.from(bytes),hash:expected,name:name.trim(),report};
}
function backup(value,before){
 if(!value||!Buffer.isBuffer(value.bytes)||value.bytes.length!==before.fileSize||value.bytes.length>MAX_BYTES||!validHash(value.sha256)||sha(value.bytes)!==value.sha256||!same(metadata(value.metadata,before.slot),before))throw fail('STUDIO_BACKUP_MISMATCH','The restoration file does not match the selected skin metadata and local checksum. Existing skin was kept.');
 if(typeof value.sourceUrl!=='string'||!/^https:\/\/assets\.freethinkerportal\.com\/[a-z0-9_./%-]+$/i.test(value.sourceUrl)||value.sourceUrl.includes('/../'))throw fail('STUDIO_BACKUP_SOURCE','Choose the matching original file from the verified XPANEL catalog.');
 return{bytes:Buffer.from(value.bytes),hash:value.sha256,meta:before,sourceUrl:value.sourceUrl};
}
class StudioDeviceLoader{
 constructor(directory,options={}){this.directory=path.join(directory,'studio-device-tests');this.defaultsDirectory=path.join(directory,'keyboard-skins');this.connect=options.connect||(()=>new(require('./som.cjs').Som)());this.inspectPak=options.inspectPak||inspectPak;this.now=options.now||Date.now;this.sleep=options.sleep||sleep;this.yield=options.yield||(()=>new Promise(resolve=>setImmediate(resolve)));this.busy=false;this.plans=new Map();}
 _paths(identity){const root=path.join(this.directory,sha(Buffer.from(identity)));return{root,journal:path.join(root,'journal.json')};}
 _read(paths){if(!fs.existsSync(paths.journal))return{format:1,owned:null,operation:null};const stat=fs.lstatSync(paths.journal);if(!stat.isFile()||stat.isSymbolicLink()||stat.size>65536)throw fail('STUDIO_RECOVERY_RECORD','The local recovery record is invalid; existing files were kept.');let value;try{value=JSON.parse(fs.readFileSync(paths.journal,'utf8'));}catch{throw fail('STUDIO_RECOVERY_RECORD','The local recovery record cannot be read.');}if(value.format!==1)throw fail('STUDIO_RECOVERY_RECORD','The local recovery format is unsupported.');if(value.owned){metadata(value.owned.meta,value.owned.slot);if(!validHash(value.owned.hash)||value.owned.meta.empty)throw fail('STUDIO_RECOVERY_RECORD','The saved Studio skin identity is invalid.');}return value;}
 _write(paths,value){fs.mkdirSync(paths.root,{recursive:true});const temporary=paths.journal+'.'+crypto.randomUUID()+'.tmp';try{fs.writeFileSync(temporary,JSON.stringify(value,null,2),{flag:'wx'});fs.renameSync(temporary,paths.journal);}catch(error){try{fs.unlinkSync(temporary);}catch{}throw fail('STUDIO_RECOVERY_SAVE','The local recovery record could not be saved. Check disk space and folder permissions.',{cause:error});}}
 _store(paths,bytes,hash){fs.mkdirSync(paths.root,{recursive:true});const file=path.join(paths.root,hash+'.bin');try{fs.writeFileSync(file,bytes,{flag:'wx'});}catch(error){if(error.code!=='EEXIST')throw fail('STUDIO_BACKUP_SAVE','The local restoration copy could not be saved.');const stat=fs.lstatSync(file);if(!stat.isFile()||stat.isSymbolicLink()||stat.size!==bytes.length||sha(fs.readFileSync(file))!==hash)throw fail('STUDIO_BACKUP_CHANGED','The stored restoration file changed. Existing skin was kept.');}}
 _bytes(paths,hash){if(!validHash(hash))throw fail('STUDIO_BACKUP_CHANGED','The restoration checksum is invalid.');const file=path.join(paths.root,hash+'.bin'),stat=fs.lstatSync(file);if(!stat.isFile()||stat.isSymbolicLink()||stat.size<1||stat.size>MAX_BYTES)throw fail('STUDIO_BACKUP_CHANGED','The restoration file is unavailable.');const bytes=fs.readFileSync(file);if(sha(bytes)!==hash)throw fail('STUDIO_BACKUP_CHANGED','The restoration file no longer matches its checksum.');return bytes;}
 _protected(identity,state,extra=[],allowActiveOwned=false){if(!Array.isArray(extra)||extra.some(v=>!validSlot(v)))throw fail('STUDIO_PROTECTED_SLOT','Protected skin slots must be from 1 to 5.');const result=new Set([...(allowActiveOwned?[]:[state.active]),...extra]),file=path.join(this.defaultsDirectory,sha(Buffer.from(identity))+'.json');if(fs.existsSync(file)){let value;try{value=JSON.parse(fs.readFileSync(file,'utf8'));}catch{throw fail('STUDIO_DEFAULT_RECORD','Your saved default-skin record cannot be read. No skin will be replaced.');}for(const name of ['original','default']){if(!validSlot(value[name]?.slot))throw fail('STUDIO_DEFAULT_RECORD','Your saved default-skin record is invalid.');result.add(value[name].slot);}}return result;}
 async _run(fn){if(this.busy||deviceOperationActive)throw fail('STUDIO_DEVICE_BUSY','A Studio keyboard test is already in progress.');this.busy=true;deviceOperationActive=true;let s;try{s=this.connect();return await fn(s);}finally{try{s?.close();}finally{this.busy=false;deviceOperationActive=false;}}}
 async inspect(){return this._run(async s=>{const state=await inventory(s),protectedSlots=[...this._protected(s.identity,state)];return{...state,protectedSlots,nativeSlots:5,canDelete:false,canReadOriginalFiles:false,canQueryFreeStorage:false};});}
 _canReplaceActiveOwned(saved,state){return !!(saved.owned&&saved.baseline&&saved.owned.slot===state.active&&same(state.slots[state.active-1],saved.owned.meta)&&saved.baseline.previousActive!==state.active&&same(state.slots[saved.baseline.previousActive-1],saved.baseline.previousActiveMeta));}
 async prepare(input){
  const built=artifact(input?.bytes,input?.sha256,input?.name,this.inspectPak);
  return this._run(async s=>{
   const state=await inventory(s),paths=this._paths(s.identity),saved=this._read(paths),protectedSlots=this._protected(s.identity,state,input.protectedSlots||[],this._canReplaceActiveOwned(saved,state));let slot=input.slot;
   if(slot===undefined){const owned=saved.owned;slot=owned&&!protectedSlots.has(owned.slot)&&same(state.slots[owned.slot-1],owned.meta)?owned.slot:state.slots.find(v=>v.empty&&!protectedSlots.has(v.slot))?.slot;}
   if(!validSlot(slot))throw fail('STUDIO_SKIN_SLOTS_FULL','All five keyboard skin slots are in use. Choose a non-default slot to replace with your Companion skin. Overlay slots 6–10 cannot hold Unreal skins.',{slots:state.slots});
   if(protectedSlots.has(slot))throw fail('STUDIO_DEFAULT_PROTECTED','The active, original and preferred default skins are protected. Choose another test slot.');
   if(saved.baseline&&saved.baseline.slot!==slot)throw fail('STUDIO_RESTORE_FIRST','Restore the current native test before borrowing another keyboard slot.');
   const before=state.slots[slot-1],owned=saved.owned&&saved.owned.slot===slot&&same(before,saved.owned.meta);let restoration=null,requiresReplacementReview=false;
   if(!before.empty){if(owned)restoration={bytes:this._bytes(paths,saved.owned.hash),hash:saved.owned.hash,meta:before,sourceUrl:null};else{if(input.replaceWithoutBackup!==true||input.backup)restoration=backup(input.backup,before);requiresReplacementReview=true;}}
   const manifest={slot,fileName:built.name,fileExtension:'pak',fileSize:built.bytes.length,fileID:crypto.randomUUID()},token=crypto.randomUUID();
   this.plans.clear();this.plans.set(token,{token,created:this.now(),identity:s.identity,state,paths,saved,protectedSlots:[...protectedSlots],slot,built,manifest:metadata(manifest,slot),restoration,requiresReplacementReview,replacedWithoutBackup:!before.empty&&!restoration});
   return{token,slot,name:built.name,bytes:built.bytes.length,sha256:built.hash,replaces:before.empty?null:before.fileName,returnTo:state.slots[state.active-1].fileName,requiresReplacementReview,replacedWithoutBackup:!before.empty&&!restoration,restoration:restoration?{fileName:before.fileName,bytes:restoration.bytes.length,sha256:restoration.hash,source:restoration.sourceUrl?'XPANEL catalog download':'Local Studio build',originalDeviceBytesReadable:false}:null,notice:requiresReplacementReview?'This replaces the chosen slot temporarily. The restoration copy matches its catalog identity, file size and local checksum; the keyboard cannot supply an original file checksum or skin-specific settings.':before.empty?'The original skins stay installed. This test uses an empty native skin slot.':'This test replaces only the previously verified Studio skin.'};
  });
 }
 async _transfer(s,type,bytes,onProgress){
  return new Promise((resolve,reject)=>{
   let done=false,ending=false;const finish=(error,value)=>{if(done)return;done=true;clearTimeout(timer);s.listeners.delete(listener);error?reject(error):resolve(value);};
   const listener=(error,cmd,p)=>{if(error)return finish(error);if(cmd!==32)return;try{const value=parseEnd(p,type);if(value!==undefined){if(!ending)return finish(fail('STUDIO_UPLOAD_STALE_REPLY','An upload acknowledgement arrived before this transfer ended.'));finish(null,value);}}catch(e){finish(e);}};
   const timer=setTimeout(()=>finish(fail('STUDIO_UPLOAD_TIMEOUT','Keyboard did not confirm the '+(type===1?'metadata':'skin file')+' upload.')),type===1?10000:180000);s.listeners.add(listener);
   (async()=>{await s.send(type);let beat=0;for(let offset=0;offset<bytes.length&&!done;offset+=CHUNK){const part=bytes.subarray(offset,offset+CHUNK);await s.send(16,part);beat+=part.length;if(beat>=HEARTBEAT){await s.send(17);beat=0;}if(offset%(CHUNK*64)===0){if(onProgress)onProgress({stage:type===1?'metadata':'upload',bytesQueued:Math.min(offset+CHUNK,bytes.length),totalBytes:bytes.length});await this.yield();}}if(done)return;ending=true;await s.send(32);})().catch(error=>finish(error));
  });
 }
 async _upload(s,manifest,bytes,onProgress){await this._transfer(s,1,Buffer.from(JSON.stringify(manifest)));await this._transfer(s,0,bytes,onProgress);const actual=await details(s,manifest.slot);if(!same(actual,manifest))throw fail('STUDIO_UPLOAD_READBACK','The uploaded skin metadata did not match. Activation was not requested.');}
 async _select(s,slot){if(await current(s)!==slot)await s.wait((cmd,p)=>cmd===48?parseSelection(p,slot):undefined,()=>s.send(48,Buffer.from([slot])),10000);const deadline=this.now()+15000;do{if(await current(s)===slot){await this.sleep(1500);if(await current(s)===slot)return;}await this.sleep(350);}while(this.now()<deadline);throw fail('STUDIO_SKIN_LOAD_TIMEOUT','The selected skin did not remain active. Return to your previous skin and inspect the native build.');}
 _operation(plan){const returnSlot=plan.slot===plan.state.active?plan.saved.baseline.previousActive:plan.state.active;return{slot:plan.slot,previousActive:returnSlot,previousActiveMeta:plan.state.slots[returnSlot-1],before:plan.state.slots[plan.slot-1],uploaded:plan.manifest,uploadedHash:plan.built.hash,backupHash:plan.restoration?.hash||null,replacedWithoutBackup:plan.replacedWithoutBackup===true,previousOwned:plan.saved.owned||null,stage:'prepared'};}
 async execute(token,options={}){
  const plan=this.plans.get(token);this.plans.delete(token);if(!plan||this.now()-plan.created>300000)throw fail('STUDIO_TEST_EXPIRED','The keyboard test review expired. Prepare the test again.');if(plan.requiresReplacementReview&&options.confirmCatalogReplacement!==true)throw fail('STUDIO_REPLACEMENT_REVIEW','Review and explicitly confirm the chosen slot and restoration copy before replacement.');
  return this._run(async s=>{
   if(s.identity!==plan.identity)throw fail('STUDIO_DEVICE_CHANGED','A different keyboard is connected. No skin was changed.');const state=await inventory(s);if(!same(state,plan.state))throw fail('STUDIO_SKINS_CHANGED','Keyboard skins changed after the test was prepared. Prepare a fresh review.');const protectedNow=this._protected(s.identity,state,[],this._canReplaceActiveOwned(plan.saved,state));if(protectedNow.has(plan.slot))throw fail('STUDIO_DEFAULT_PROTECTED','The chosen test slot is now a protected skin.');
   if(plan.saved.owned?.hash===plan.built.hash&&same(state.slots[plan.slot-1],plan.saved.owned.meta)){await this._select(s,plan.slot);if(plan.saved.operation)this._write(plan.paths,{...plan.saved,operation:{...plan.saved.operation,stage:'active'}});return{slot:plan.slot,name:plan.built.name,transportConfirmed:true,reused:true};}
   this._store(plan.paths,plan.built.bytes,plan.built.hash);if(plan.restoration)this._store(plan.paths,plan.restoration.bytes,plan.restoration.hash);const operation=this._operation(plan),baseline=plan.saved.baseline||JSON.parse(JSON.stringify(operation));this._write(plan.paths,{format:1,owned:plan.saved.owned||null,operation,baseline});
   try{operation.stage='uploading';this._write(plan.paths,{format:1,owned:plan.saved.owned||null,operation,baseline});await this._upload(s,plan.manifest,plan.built.bytes,options.onProgress);operation.stage='uploaded';this._write(plan.paths,{format:1,owned:{slot:plan.slot,meta:plan.manifest,hash:plan.built.hash},operation,baseline});
    for(const expected of state.slots)if(expected.slot!==plan.slot&&!same(await details(s,expected.slot),expected))throw fail('STUDIO_OTHER_SKIN_CHANGED','Another keyboard slot changed during upload. The previous skin will be selected only if its identity still matches.');await this._select(s,plan.slot);operation.stage='active';this._write(plan.paths,{format:1,owned:{slot:plan.slot,meta:plan.manifest,hash:plan.built.hash},operation,baseline});
    return{slot:plan.slot,name:plan.manifest.fileName,active:true,transportConfirmed:true,nativeRenderingVerified:false,originalDeviceBytesReadable:false,canRestore:baseline.replacedWithoutBackup!==true,replacedWithoutBackup:baseline.replacedWithoutBackup===true};
   }catch(error){operation.stage='failed';try{this._write(plan.paths,{format:1,owned:plan.saved.owned||null,operation,baseline});}catch{}let restored=false,selected=false;try{const recovery=await this._restore(s,plan.paths,operation,plan.saved.baseline||null);restored=recovery.restored===true;selected=true;}catch(restoreError){selected=restoreError.previousSkinSelected===true;error.recoveryError=restoreError.message;}throw fail(error.code||'STUDIO_TEST_FAILED',error.message+(restored?' The previous skin was restored.':selected?(operation.replacedWithoutBackup?' Your protected previous skin is selected. The replaced slot has no original restoration file.':' Your previous skin is selected; the borrowed slot still needs restoration.'):' Recovery needs attention; the local restoration files were kept.'),{cause:error,previousSkinRestored:restored,previousSkinSelected:selected,recoveryError:error.recoveryError||null});}
  });
 }
 async _restore(s,paths,op,keepBaseline=null){
  if(!op||!validSlot(op.slot)||!validSlot(op.previousActive)||op.slot===op.previousActive)throw fail('STUDIO_RECOVERY_RECORD','The skin recovery record is invalid.');const before=metadata(op.before,op.slot),uploaded=metadata(op.uploaded,op.slot),original=metadata(op.previousActiveMeta,op.previousActive);if(!same(await details(s,op.previousActive),original))throw fail('STUDIO_ORIGINAL_CHANGED','The previous skin was replaced outside Companion. It will not be overwritten or activated.');
  let activeMeta;
  try{activeMeta=await details(s,op.slot);if(!same(activeMeta,before)&&!same(activeMeta,uploaded))throw fail('STUDIO_TEST_SLOT_CHANGED','The test slot changed outside this transaction. It will not be overwritten.');
   if(!before.empty&&!same(activeMeta,before)&&op.replacedWithoutBackup!==true){const bytes=this._bytes(paths,op.backupHash);if(bytes.length!==before.fileSize)throw fail('STUDIO_BACKUP_CHANGED','The restoration file size no longer matches.');await this._upload(s,before,bytes);}
   await this._select(s,op.previousActive);
  }catch(error){try{if(same(await details(s,op.previousActive),original)){await this._select(s,op.previousActive);error.previousSkinSelected=true;}}catch{}throw error;}
  op.stage='restored';const retained=(before.empty||op.replacedWithoutBackup===true)&&same(activeMeta,uploaded)?{slot:op.slot,meta:uploaded,hash:op.uploadedHash}:op.previousOwned||null;this._write(paths,{format:1,owned:retained,operation:op,baseline:keepBaseline});return{active:op.previousActive,restored:op.replacedWithoutBackup!==true,previousSkinSelected:true,replacedSkinRecoverable:op.replacedWithoutBackup!==true,testSkinRetained:!!retained&&(before.empty||op.replacedWithoutBackup===true)};
 }
 async restoreLast(){return this._run(async s=>{const paths=this._paths(s.identity),saved=this._read(paths);if(!saved.operation)throw fail('STUDIO_NO_TEST','There is no native Studio test to restore on this keyboard.');const operation=saved.baseline&&saved.owned?{...saved.baseline,uploaded:saved.owned.meta,uploadedHash:saved.owned.hash}:saved.operation;return this._restore(s,paths,operation);});}
}
module.exports={StudioDeviceLoader,metadata,parseEnd,parseSelection,artifact,backup,inventory,MAX_BYTES,CHUNK,HEARTBEAT,sha};
