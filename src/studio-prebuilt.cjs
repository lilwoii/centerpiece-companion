'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const HASH=/^[a-f0-9]{64}$/,UUID=/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/;
const fail=message=>Object.assign(Error(message),{code:'STUDIO_PREBUILT_INVALID'});
// Only packages shipped with Companion are registered here. Renderer input can
// select an exact scene hash, never a package path or replacement manifest.
class StudioPrebuilt {
 constructor(directory=path.join(__dirname,'../studio/prebuilt'),{inspect=require('./pak-inspector.cjs').inspectPak}={}){
  this.directory=path.resolve(directory);this.inspect=inspect;this.entries=new Map();
  const manifest=path.join(this.directory,'manifest.json');if(!fs.existsSync(manifest))return;
  if(fs.statSync(manifest).size>65536)throw fail('The bundled skin catalog is invalid.');
  const data=JSON.parse(fs.readFileSync(manifest,'utf8'));
  if(data.format!==1||!Array.isArray(data.entries)||data.entries.length>100)throw fail('The bundled skin catalog is invalid.');
  for(const entry of data.entries){
   if(!UUID.test(entry.id)||!HASH.test(entry.sceneSha256)||!HASH.test(entry.sha256)||!Number.isSafeInteger(entry.size)||entry.size<221||entry.size>128*1048576||entry.validationRevision!==5||typeof entry.projectName!=='string'||entry.projectName.length>200||!Number.isSafeInteger(entry.createdAt)||this.entries.has(entry.id))throw fail('A bundled skin record is invalid.');
   this.entries.set(entry.id,Object.freeze({...entry}));
  }
 }
 has(id){return this.entries.has(id);}
 latest(hash){if(!HASH.test(hash||''))return null;const entry=[...this.entries.values()].find(e=>e.sceneSha256===hash);if(!entry)return null;this.artifact(entry.id,hash);return this.status(entry.id);}
 status(id){const entry=this.entries.get(id);if(!entry)throw fail('This bundled skin is unavailable.');return{id,state:'ready',stage:'ready',label:'Included skin · no Unreal installation needed',projectName:entry.projectName,sceneSha256:entry.sceneSha256,createdAt:entry.createdAt,updatedAt:entry.createdAt,bundled:true,error:null,artifact:{validationRevision:5,name:'skin.pak',size:entry.size,sha256:entry.sha256,deviceVerified:false}};}
 artifact(id,hash){
  const entry=this.entries.get(id);if(!entry||entry.sceneSha256!==hash)throw fail('This package does not match the current design. Build the edited skin first.');
  const file=path.join(this.directory,id+'.pak');let cursor=path.parse(file).root;
  for(const part of file.slice(cursor.length).split(path.sep).filter(Boolean)){cursor=path.join(cursor,part);if(fs.lstatSync(cursor).isSymbolicLink())throw fail('Bundled skins cannot use linked paths.');}
  const stat=fs.statSync(file);if(!stat.isFile()||stat.size!==entry.size)throw fail('The bundled skin is missing or changed. Reinstall Companion.');
  const bytes=fs.readFileSync(file);if(crypto.createHash('sha256').update(bytes).digest('hex')!==entry.sha256||!require('./studio-pak.cjs').contentPaths(this.inspect(bytes)))throw fail('The bundled skin did not pass its integrity checks. Reinstall Companion.');
  return{...entry,file,name:'skin.pak',format:1,target:'Android_ASTC',entryMap:'/Game/map/M_EntryPoint',editorCompiled:true,blueprintCompiled:true,cooked:true,packageIntegrityVerified:true,deviceVerified:false};
 }
}
module.exports={StudioPrebuilt};
