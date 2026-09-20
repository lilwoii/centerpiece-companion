'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {StudioDeviceLoader,metadata,sha,MAX_BYTES}=require('./studio-device-loader.cjs');
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const HASH=/^[a-f0-9]{64}$/;
const clone=value=>structuredClone(value);
const failure=(code,message)=>Object.assign(Error(message),{code});
function inputObject(input,fields){if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(k=>!fields.includes(k)))throw failure('STUDIO_DEVICE_INPUT','Use the native build and keyboard test controls.');return input;}
function buildInput(input){inputObject(input,['id','sceneSha256','slot','replaceWithoutBackup']);if(input.replaceWithoutBackup!==undefined&&typeof input.replaceWithoutBackup!=='boolean')throw failure('STUDIO_DEVICE_INPUT','Choose whether to replace the selected skin.');if(input.replaceWithoutBackup===true&&input.slot===undefined)throw failure('STUDIO_DEVICE_INPUT','Select the exact slot to replace.');if(!UUID.test(input.id||'')||!HASH.test(input.sceneSha256||'')||input.slot!==undefined&&(!Number.isInteger(input.slot)||input.slot<1||input.slot>5))throw failure('STUDIO_DEVICE_INPUT','Choose a completed build and a keyboard skin slot from 1 to 5.');return{...input};}
function publicError(error){const recognized=/^STUDIO_[A-Z0-9_]+$/.test(error?.code||'');return{code:recognized?error.code:'STUDIO_DEVICE_FAILED',message:recognized?String(error.message).slice(0,700):'The native keyboard test could not finish. Local recovery files were kept.',...(typeof error?.previousSkinRestored==='boolean'?{previousSkinRestored:error.previousSkinRestored}:{}),...(typeof error?.previousSkinSelected==='boolean'?{previousSkinSelected:error.previousSkinSelected}:{})};}
function readChecked(file,expectedSize,expectedHash,code){
 if(typeof file!=='string'||!path.isAbsolute(file)||!HASH.test(expectedHash||''))throw failure(code,'The trusted local file record is invalid.');
 // Main-process paths only. Reject links at every component, including junctions.
 let cursor=path.parse(file).root;try{for(const part of file.slice(cursor.length).split(path.sep).filter(Boolean)){cursor=path.join(cursor,part);if(fs.lstatSync(cursor).isSymbolicLink())throw Error('Linked file');}const stat=fs.lstatSync(file);if(!stat.isFile()||stat.size!==expectedSize||stat.size<1||stat.size>MAX_BYTES)throw Error('File size');const bytes=fs.readFileSync(file);if(bytes.length!==expectedSize||sha(bytes)!==expectedHash)throw Error('Checksum');return bytes;}catch{throw failure(code,'The trusted local file is missing or changed. Prepare a new verified build or restoration copy.');}
}
class StudioDeviceService{
 constructor(directory,{builder,runExclusive,loader,trustedBackups=[],restorationProvider,onProgress}={}){
  if(!builder||typeof builder.artifact!=='function'||typeof builder.status!=='function')throw failure('STUDIO_DEVICE_CONFIG','Native keyboard testing needs the main-process build service.');
  if(typeof runExclusive!=='function')throw failure('STUDIO_DEVICE_CONFIG','Native keyboard testing needs an exclusive display runner.');
  if(!Array.isArray(trustedBackups))throw failure('STUDIO_DEVICE_CONFIG','Trusted restoration copies must be registered by the main process.');
  this.builder=builder;this.runExclusive=runExclusive;this.loader=loader||new StudioDeviceLoader(directory);this.onProgress=onProgress;this.jobs=new Map();this.reviews=new Map();this.active=null;this.backups=new Map();this.restorationProvider=restorationProvider;
  for(const entry of trustedBackups){if(!entry||!path.isAbsolute(entry.file||'')||!HASH.test(entry.sha256||'')||this.backups.has(entry.slot))throw failure('STUDIO_DEVICE_CONFIG','The trusted restoration file registration is invalid.');const meta=metadata(entry.metadata,entry.slot);if(meta.empty||typeof entry.sourceUrl!=='string'||!/^https:\/\/assets\.freethinkerportal\.com\/[a-z0-9_./%-]+$/i.test(entry.sourceUrl)||entry.sourceUrl.includes('/../'))throw failure('STUDIO_DEVICE_CONFIG','The trusted restoration catalog reference is invalid.');this.backups.set(entry.slot,Object.freeze({slot:entry.slot,file:path.resolve(entry.file),sha256:entry.sha256,metadata:meta,sourceUrl:entry.sourceUrl}));}
 }
 _public(job){return clone({id:job.id,action:job.action,state:job.state,stage:job.stage,readOnly:job.readOnly,createdAt:job.createdAt,updatedAt:job.updatedAt,progress:job.progress||null,result:job.result||null,error:job.error||null});}
 _emit(job){job.updatedAt=Date.now();try{this.onProgress?.(this._public(job));}catch{}}
 _job(action,readOnly,task){
  if(this.active)throw failure('STUDIO_DEVICE_BUSY','A native keyboard check or test is already in progress.');
  while(this.jobs.size>=24){const first=this.jobs.keys().next().value;this.jobs.delete(first);}
  const job={id:crypto.randomUUID(),action,state:'queued',stage:'queued',readOnly,createdAt:Date.now()};this.active=job.id;this.jobs.set(job.id,job);this._emit(job);
  // Respond immediately: hardware operations can outlast the iframe timeout.
  job.promise=Promise.resolve().then(async()=>{job.state='running';job.stage=readOnly?'checking':'starting';this._emit(job);job.result=await this.runExclusive(()=>task(job));job.state='ready';job.stage='ready';}).catch(error=>{job.state='failed';job.stage='failed';job.error=publicError(error);if(error?.slotChoices)job.result={slotChoices:error.slotChoices};}).finally(()=>{if(this.active===job.id)this.active=null;this._emit(job);});
  return this._public(job);
 }
 _artifact(input){const result=this.builder.artifact(input.id,input.sceneSha256);if(result.id!==input.id||result.sceneSha256!==input.sceneSha256||result.packageIntegrityVerified!==true||result.cooked!==true||result.target!=='Android_ASTC'||!Number.isSafeInteger(result.size))throw failure('STUDIO_BUILD_NOT_READY','This build has not produced a verified Android keyboard package.');const bytes=readChecked(result.file,result.size,result.sha256,'STUDIO_BUILD_CHANGED'),status=this.builder.status(input.id);return{bytes,sha256:result.sha256,name:typeof status.projectName==='string'&&status.projectName.trim()?status.projectName.trim().slice(0,100):'Studio skin'};}
 _backup(slot){const entry=this.backups.get(slot);if(!entry)return null;return{bytes:readChecked(entry.file,entry.metadata.fileSize,entry.sha256,'STUDIO_BACKUP_UNAVAILABLE'),sha256:entry.sha256,metadata:clone(entry.metadata),sourceUrl:entry.sourceUrl};}
 _choices(slots,protectedSlots=[]){return slots.map(raw=>{const v=metadata(raw,raw.slot),trusted=this.backups.get(v.slot),protectedSlot=protectedSlots.includes(v.slot);let restorationAvailable=false;if(trusted&&!v.empty&&JSON.stringify(trusted.metadata)===JSON.stringify(v)){try{this._backup(v.slot);restorationAvailable=true;}catch{}}return{slot:v.slot,name:v.empty?'Empty':v.fileName,empty:!!v.empty,protected:protectedSlot,restorationAvailable,canReviewReplacement:!protectedSlot,requiresPermanentReplacement:!protectedSlot&&!restorationAvailable&&!v.empty};});}
 readiness(){return this._job('device-readiness',true,async()=>{const state=await this.loader.inspect();return{nativeSlots:5,active:state.active,slotChoices:this._choices(state.slots,state.protectedSlots),canDelete:false,canReadOriginalFiles:false,canQueryFreeStorage:false,requiresReview:true};});}
 prepare(input){
  const request=buildInput(input);
  return this._job('device-prepare',true,async()=>{
   const built=this._artifact(request);let review;
   try{review=await this.loader.prepare({...built,replaceWithoutBackup:request.replaceWithoutBackup===true,...(request.slot!==undefined?{slot:request.slot}:{}),...(request.slot!==undefined&&this.backups.has(request.slot)?{backup:this._backup(request.slot)}:{})});}
   catch(error){if(error.code==='STUDIO_SKIN_SLOTS_FULL'){const state=await this.loader.inspect();if(this.restorationProvider){for(const entry of await this.restorationProvider(state.slots.filter(slot=>!state.protectedSlots?.includes(slot.slot)))){const meta=metadata(entry.metadata,entry.slot);readChecked(entry.file,meta.fileSize,entry.sha256,'STUDIO_BACKUP_UNAVAILABLE');this.backups.set(entry.slot,Object.freeze({...entry,metadata:meta}));}}error.slotChoices=this._choices(state.slots,state.protectedSlots);}throw error;}
   this.reviews.clear();this.reviews.set(review.token,{id:request.id,sceneSha256:request.sceneSha256});
   return{...review,buildId:request.id,sceneSha256:request.sceneSha256,reviewOnly:true};
  });
 }
 execute(input){
  inputObject(input,['token','confirmReplacement']);if(!UUID.test(input.token||'')||input.confirmReplacement!==undefined&&typeof input.confirmReplacement!=='boolean')throw failure('STUDIO_DEVICE_INPUT','Choose a prepared keyboard test.');const token=input.token,confirmReplacement=input.confirmReplacement===true,reviewed=this.reviews.get(token);if(!reviewed)throw failure('STUDIO_TEST_EXPIRED','Prepare and review the keyboard test again.');
  // Do not consume a review on a busy response: it can be retried afterward.
  return this._job('device-execute',false,async job=>{this.reviews.delete(token);this._artifact(reviewed);return this.loader.execute(token,{confirmCatalogReplacement:confirmReplacement,onProgress:value=>{job.stage=value.stage;job.progress={bytesQueued:Math.max(0,Math.min(MAX_BYTES,Number(value.bytesQueued)||0)),totalBytes:Math.max(0,Math.min(MAX_BYTES,Number(value.totalBytes)||0))};this._emit(job);}});});
 }
 restoreLast(){return this._job('device-restore',false,()=>this.loader.restoreLast());}
 status(input){inputObject(input,['id']);if(!UUID.test(input.id||''))throw failure('STUDIO_DEVICE_INPUT','Choose a native keyboard test job.');const job=this.jobs.get(input.id);if(!job)throw failure('STUDIO_DEVICE_JOB_MISSING','This keyboard test is no longer in memory. If the app restarted, use Restore previous skin to read its local recovery record.');return this._public(job);}
 request(action,input){switch(action){case'device-readiness':if(input!==undefined&&input!==null)inputObject(input,[]);return this.readiness();case'device-prepare':return this.prepare(input);case'device-execute':return this.execute(input);case'device-restore':if(input!==undefined&&input!==null)inputObject(input,[]);return this.restoreLast();case'device-status':return this.status(input);default:throw failure('STUDIO_DEVICE_ACTION','This native keyboard test action is not supported.');}}
}
module.exports={StudioDeviceService};
