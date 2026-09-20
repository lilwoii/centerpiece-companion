const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {inspectPak}=require('./pak-inspector.cjs');
const MAX_BYTES=128*1024*1024,MAX_TOTAL=2*1024*1024*1024,MAX_ITEMS=100;
const validId=id=>typeof id==='string'&&/^[a-f0-9]{64}$/.test(id);
class SkinLibrary {
 constructor(directory){this.directory=path.join(directory,'skin-library');this.index=path.join(this.directory,'index.json');this.items=[];this.error='';
  if(fs.existsSync(this.index)){try{const list=JSON.parse(fs.readFileSync(this.index,'utf8'));if(!Array.isArray(list)||list.length>MAX_ITEMS||list.some(v=>!validId(v.id)||typeof v.name!=='string'||v.name.length>120||!Number.isSafeInteger(v.bytes)||v.bytes<1||v.bytes>MAX_BYTES))throw Error();this.items=list;}catch{this.error='The local skin index could not be read. Existing files were preserved; restore the index before importing.';}}
 }
 view(){return{items:this.items.map(({id,name,bytes,createdAt,archived,engine})=>({id,name,bytes,createdAt,archived:archived===true,engine:engine||'Unknown'})),error:this.error,deviceUploadAvailable:false};}
 persist(next){if(this.error)throw Error(this.error);fs.mkdirSync(this.directory,{recursive:true});const temporary=this.index+'.'+crypto.randomUUID()+'.tmp';try{fs.writeFileSync(temporary,JSON.stringify(next,null,2),{flag:'wx'});fs.renameSync(temporary,this.index);this.items=next;}catch{try{fs.unlinkSync(temporary);}catch{}throw Error('Could not save the skin library. Check free disk space and folder permissions.');}}
 find(id){if(!validId(id))throw Error('Choose a library skin.');const item=this.items.find(v=>v.id===id);if(!item)throw Error('This skin is not in the local library.');return item;}
 import(name,input){if(this.error)throw Error(this.error);if(typeof name!=='string'||!name.toLowerCase().endsWith('.pak')||name.length>240)throw Error('Choose an Unreal .pak skin file.');
  if(!(input instanceof ArrayBuffer)&&!ArrayBuffer.isView(input))throw Error('The skin file could not be read.');const bytes=Buffer.from(input instanceof ArrayBuffer?input:input.buffer,input.byteOffset||0,input.byteLength);if(!bytes.length||bytes.length>MAX_BYTES)throw Error('Choose a skin file up to 128 MB.');
  const id=crypto.createHash('sha256').update(bytes).digest('hex'),existing=this.items.find(v=>v.id===id);if(existing){if(existing.archived)this.archive(id,false);return id;}
  if(this.items.length>=MAX_ITEMS||this.items.reduce((n,v)=>n+v.bytes,0)+bytes.length>MAX_TOTAL)throw Error('The local preview library limit is 100 skins or 2 GB, including archived skins.');
  const report=inspectPak(bytes);if(report.encryptedIndex)throw Error('This package has an encrypted index. It was not imported because its structure could not be checked.');
  const item={id,name:path.win32.basename(name).replace(/[\x00-\x1f]/g,'').slice(0,120),bytes:bytes.length,createdAt:new Date().toISOString(),archived:false,engine:report.clues?.engineAssociation||'Unknown'};
  fs.mkdirSync(this.directory,{recursive:true});const destination=path.join(this.directory,id+'.pak');
  try{fs.writeFileSync(destination,bytes,{flag:'wx'});}catch(error){if(error.code!=='EEXIST')throw Error('Could not copy the skin. Check free disk space and folder permissions.');const info=fs.lstatSync(destination);if(!info.isFile()||info.isSymbolicLink()||info.size!==bytes.length||crypto.createHash('sha256').update(fs.readFileSync(destination)).digest('hex')!==id)throw Error('The stored skin does not match its content hash. Existing files were preserved.');}
  this.persist([...this.items,item]);return id;
 }
 archive(id,value){this.find(id);if(typeof value!=='boolean')throw Error('Choose archive or restore.');this.persist(this.items.map(v=>v.id===id?{...v,archived:value}:v));}
 file(id){const item=this.find(id),file=path.join(this.directory,id+'.pak');let info;try{info=fs.lstatSync(file);}catch{throw Error('The stored skin file is unavailable. Use your original source file until the local copy is repaired.');}if(!info.isFile()||info.isSymbolicLink()||info.size!==item.bytes||info.size>MAX_BYTES)throw Error('The stored skin file changed or is unavailable. Existing files were kept. Use your original source file until the local copy is repaired.');if(crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')!==id)throw Error('The stored skin no longer matches its imported copy. It was not exported. Use your original source file until the local copy is repaired.');return file;}
}
module.exports={SkinLibrary,MAX_BYTES,validId};
