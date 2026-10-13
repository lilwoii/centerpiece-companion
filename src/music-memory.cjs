'use strict';
const fs=require('node:fs'),path=require('node:path'),{randomUUID}=require('node:crypto');
const {positionAt}=require('./playback-clock.cjs');
const DAY=24*60*60*1000,MAX_ART=180000,MAX_FILE=400000;
const text=(value,limit=512)=>typeof value==='string'&&!/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value)?value.slice(0,limit):'';
const source=value=>typeof value==='string'&&value.length>0&&value.length<=512&&!/[\u0000-\u001f\u007f]/.test(value)?value:'';
const artwork=value=>typeof value==='string'&&value.length<=MAX_ART&&/^data:image\/(?:png|jpeg);base64,[A-Za-z0-9+/]+={0,2}$/.test(value)?value:'';
const finite=(value,max)=>Number.isFinite(value)&&value>=0&&value<=max;
const player=(media,target)=>/^(?:chrome|msedge|firefox|brave|opera)\.exe$/i.test(media.source||'')?'web':target==='web'?'web':'desktop';
const sameTrack=(a,b)=>a&&b&&a.source===b.source&&a.title===b.title&&a.artist===b.artist&&a.album===b.album;

/** Retains display-only metadata, never a usable media session or a control target. */
class MusicMemory{
 constructor({directory,now=Date.now,maxAge=DAY}={}){
  this.now=now;this.maxAge=Number.isFinite(maxAge)&&maxAge>0?Math.min(maxAge,DAY):DAY;
  this.records=new Map();this.latest={};this.lastWrite=0;this.lastError='';
  this.file=directory?path.join(directory,'youtube-music-last.json'):null;
  if(this.file)this.load();
 }
 valid(record){
  const at=this.now();
  return record&&['desktop','web'].includes(record.target)&&!!source(record.source)&&source(record.source)===record.source&&!!text(record.title).trim()&&text(record.title)===record.title&&text(record.artist)===record.artist&&text(record.album)===record.album&&artwork(record.art)===record.art&&finite(record.duration,7*DAY/1000)&&finite(record.position,record.duration)&&finite(record.observedAt,at+60000)&&at-record.observedAt<this.maxAge;
 }
 sanitize(record){
  if(!this.valid(record))return null;
  return {target:record.target,source:record.source,title:record.title,artist:record.artist,album:record.album,art:record.art,position:record.position,duration:record.duration,observedAt:record.observedAt};
 }
 remember(record){
  const key=JSON.stringify([record.target,record.source]);this.records.delete(key);this.records.set(key,record);this.latest[record.target]=record;
  // In-memory source changes stay isolated; disk contains only one track per player type.
  while(this.records.size>12)this.records.delete(this.records.keys().next().value);
 }
 load(){
  try{
   const stat=fs.lstatSync(this.file);if(!stat.isFile()||stat.isSymbolicLink()||stat.size>MAX_FILE)return;
   const payload=JSON.parse(fs.readFileSync(this.file,'utf8'));if(payload?.format!==1||!Array.isArray(payload.tracks)||payload.tracks.length>2)return;
   for(const candidate of payload.tracks){const record=this.sanitize(candidate);if(record)this.remember(record);}
   this.lastWrite=this.now();
  }catch(error){if(error.code!=='ENOENT')this.lastError='Saved music artwork could not be read.';}
 }
 persist(force=false){
  if(!this.file||(!force&&this.now()-this.lastWrite<30000))return;
  const tracks=Object.values(this.latest).map(record=>this.sanitize(record)).filter(Boolean),payload=JSON.stringify({format:1,tracks});
  if(Buffer.byteLength(payload)>MAX_FILE)return;
  const temporary=this.file+'.'+randomUUID()+'.tmp';let created=false;
  try{
   fs.mkdirSync(path.dirname(this.file),{recursive:true});
   fs.writeFileSync(temporary,payload,{encoding:'utf8',mode:0o600,flag:'wx'});created=true;
   fs.renameSync(temporary,this.file);this.lastWrite=this.now();this.lastError='';
  }catch{this.lastError='Last-played music could not be saved locally.';}
  finally{if(created)try{fs.unlinkSync(temporary);}catch{}}
 }
 select(media,target){
  const id=source(media.source);
  if(id){const record=this.records.get(JSON.stringify([player(media,target),id]));return this.valid(record)?record:null;}
  const candidates=target==='auto'?Object.values(this.latest):[this.latest[target]];
  return candidates.filter(record=>this.valid(record)).sort((a,b)=>b.observedAt-a.observedAt)[0]||null;
 }
 update(input={},target='auto'){
  if(!['auto','desktop','web'].includes(target))throw new Error('Unknown YouTube Music player target');
  const media=input&&typeof input==='object'?input:{},at=this.now(),id=source(media.source),title=text(media.title).trim();
  if(media.available&&media.status!=='Closed'&&id&&title){
   const kind=player(media,target),old=this.records.get(JSON.stringify([kind,id]));
   const record={target:kind,source:id,title,artist:text(media.artist),album:text(media.album),art:artwork(media.art),position:0,duration:finite(media.duration,7*DAY/1000)?media.duration:0,observedAt:at};
   if(!record.art&&sameTrack(old,record)&&this.valid(old))record.art=old.art;
   record.position=Math.max(0,Math.min(record.duration,positionAt({...media,duration:record.duration},at)));
   const changed=!sameTrack(old,record)||old.art!==record.art;this.remember(record);this.persist(changed);
   return {...media,target,art:record.art,remembered:false};
  }
  const record=this.select(media,target);
  if(!record)return {...media,target,available:false,remembered:false,controls:{}};
  // Cached fields are visual only. A vanished or empty session cannot advance time,
  // enable playback controls or masquerade as an available Windows session.
  return {...media,target,available:false,remembered:true,status:'Paused',controls:{},source:record.source,title:record.title,artist:record.artist,album:record.album,art:record.art,duration:record.duration,position:record.position,rawPosition:record.position,positionTimestamp:at,timelineUpdatedAt:0,playbackRate:0,receivedAt:0,lastPlayedAt:record.observedAt};
 }
}
module.exports={MusicMemory};
