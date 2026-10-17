'use strict';
const fs=require('node:fs'),path=require('node:path'),{randomUUID}=require('node:crypto');
const supported=usage=>Number.isInteger(usage)&&((usage>=4&&usage<=103)||(usage>=224&&usage<=231));
function normalize(value){
 if(value?.format!==1||value.enabled!==false||!Array.isArray(value.keys)||value.keys.length>68)throw Error('DKS profiles must be version 1 drafts. Hardware activation is unavailable.');
 const seen=new Set();
 const keys=value.keys.map(key=>{
  if(!Number.isInteger(key.position)||key.position<0||key.position>67||seen.has(key.position))throw Error('Choose one mapping per physical key.');seen.add(key.position);
  const {shallow,deep,hysteresis}=key;
  if(![shallow,deep,hysteresis].every(Number.isInteger)||hysteresis<0||shallow<=hysteresis||deep<=shallow||deep>40||hysteresis>=deep-shallow)throw Error('Use depths from 0.1 to 4.0 mm, with deep above shallow and hysteresis smaller than both gaps.');
  if(!Array.isArray(key.bindings)||key.bindings.length>4)throw Error('Each key supports up to four output keys.');
  const bindings=key.bindings.map(b=>{
   if(!supported(b.usage)||![b.press,b.release,b.pulse].every(m=>Number.isInteger(m)&&m>=0&&m<=15)||(b.press&b.release)||(b.press&b.pulse)||(b.release&b.pulse))throw Error('Choose a supported output key and one action per travel stage.');
   return {usage:b.usage,press:b.press,release:b.release,pulse:b.pulse};
  });return {position:key.position,shallow,deep,hysteresis,bindings};
 });return {format:1,enabled:false,keys};
}
class DksProfiles{
 constructor(directory){this.file=path.join(directory,'dks-draft.json');}
 read(){if(!fs.existsSync(this.file))return {format:1,enabled:false,keys:[],revision:'new'};const data=JSON.parse(fs.readFileSync(this.file,'utf8'));if(typeof data.revision!=='string')throw Error('DKS draft revision is missing. The original file was preserved.');return {...normalize(data),revision:data.revision};}
 save(value){const previous=this.read();if(value.revision!==previous.revision)throw Error('DKS draft changed in another window. Reload before saving.');const next={...normalize(value),revision:randomUUID()};fs.mkdirSync(path.dirname(this.file),{recursive:true});if(fs.existsSync(this.file))fs.copyFileSync(this.file,this.file+'.previous');const temp=this.file+'.'+randomUUID()+'.tmp';try{fs.writeFileSync(temp,JSON.stringify(next,null,2),{flag:'wx'});fs.renameSync(temp,this.file);}finally{if(fs.existsSync(temp))fs.unlinkSync(temp);}return next;}
}
module.exports={normalize,supported,DksProfiles};
