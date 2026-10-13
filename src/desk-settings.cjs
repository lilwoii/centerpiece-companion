'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const LIMIT=8*1024*1024;
function problem(message){return Object.assign(Error(message),{code:'SETTINGS_PRESERVED'});}
class DeskSettings{
 constructor(file,validate){this.file=file;this.validate=validate;this.raw=null;this.error='';this.backups=path.join(path.dirname(file),'settings-backups');}
 read(){try{const stat=fs.lstatSync(this.file);if(!stat.isFile()||stat.isSymbolicLink()||stat.size>LIMIT)throw problem('Saved settings cannot be read safely. The original file has been preserved.');return fs.readFileSync(this.file,'utf8');}catch(e){if(e.code==='ENOENT')return null;throw e;}}
 decode(raw){const c=JSON.parse(raw);if(c?.slots?.length===3)c.slots.push(null);return this.validate(c);}
 backup(raw){if(raw===null)return;this.decode(raw);fs.mkdirSync(this.backups,{recursive:true});const hash=crypto.createHash('sha256').update(raw).digest('hex'),file=path.join(this.backups,'desk-'+hash+'.json');if(!fs.existsSync(file))fs.writeFileSync(file,raw,{encoding:'utf8',mode:0o600,flag:'wx'});const entries=fs.readdirSync(this.backups).filter(n=>/^desk-[a-f0-9]{64}\.json$/.test(n)).map(n=>({file:path.join(this.backups,n),stat:fs.lstatSync(path.join(this.backups,n))})).filter(e=>e.stat.isFile()&&!e.stat.isSymbolicLink()).sort((a,b)=>b.stat.mtimeMs-a.stat.mtimeMs);for(const e of entries.slice(20))if(e.file!==file)fs.unlinkSync(e.file);}
 load(fallback){try{this.raw=this.read();if(this.raw===null)return fallback;const config=this.decode(this.raw);this.backup(this.raw);return config;}catch(e){this.error='Your saved settings could not be loaded. They have been preserved; automatic changes are paused. Restore a settings backup or contact support.';return fallback;}}
 save(config){if(this.error)throw problem(this.error);const valid=this.validate(config),current=this.read();if(current!==this.raw)throw problem('Saved settings changed outside this app. Close and reopen Companion before saving; the existing file has been preserved.');this.backup(current);const raw=JSON.stringify(valid,null,2),temporary=this.file+'.'+crypto.randomUUID()+'.tmp';fs.mkdirSync(path.dirname(this.file),{recursive:true});try{fs.writeFileSync(temporary,raw,{encoding:'utf8',mode:0o600,flag:'wx'});fs.renameSync(temporary,this.file);}finally{try{fs.unlinkSync(temporary);}catch{}}this.raw=raw;return valid;}
}
module.exports={DeskSettings};
