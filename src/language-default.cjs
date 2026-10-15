'use strict';
const fs=require('node:fs'),path=require('node:path');
class LanguageDefault{
 constructor(directory){this.file=path.join(directory,'language-default.json');}
 read(som){
  if(!fs.existsSync(this.file))return null;
  const r=JSON.parse(fs.readFileSync(this.file,'utf8'));
  if(r.format!==1||r.identity!==som.identity||!Number.isInteger(r.language)||r.language<0||r.language>4||typeof r.enabled!=='boolean')throw Error('Saved default does not match this keyboard. Language switching is paused.');
  return r;
 }
 async capture(som){
  const existing=this.read(som);if(existing)return existing;
  const record={format:1,identity:som.identity,language:await som.language(),enabled:await som.legends(),positions:await som.legendPositions(),createdAt:new Date().toISOString()};
  fs.mkdirSync(path.dirname(this.file),{recursive:true});fs.writeFileSync(this.file,JSON.stringify(record),{flag:'wx',mode:0o600});return record;
 }
 async restore(som){
  const record=this.read(som);if(!record)return;
  if(await som.language()!==record.language){
   await som.language(record.language);
   // The firmware can acknowledge before its visible language has switched.
   let confirmed=false;for(let i=0;i<10;i++){await new Promise(r=>setTimeout(r,150));if(await som.language()===record.language){confirmed=true;break;}}
   if(!confirmed)throw Error('The keyboard did not restore your saved default language.');
  }
  await som.legends(record.enabled);if(await som.legends()!==record.enabled)throw Error('The keyboard did not restore your saved default artwork.');
 }
}
module.exports={LanguageDefault};
