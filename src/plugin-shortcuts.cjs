const fs=require('node:fs'),path=require('node:path'),{randomUUID}=require('node:crypto');
const {names:physical}=require('./shortcut-keys.js');
const {sameBinding,sameKeymap,assertBindingResult,assertSaveResult}=require('./keyboard-errors.cjs');
const plugin={behaviorId:50397,param1:0x05070013},recovery={behaviorId:60498};
function normalize(value={}){
 const custom=value.custom===true,position=custom?value.position:26,engineRecovery=value.engineRecovery!==false;
 if(!Number.isInteger(position)||position<0||position>=68||[55,63].includes(position)||engineRecovery&&position===0)throw Error('Choose a key other than L1, /, or the enabled recovery key (Esc).');
 return {custom,position,engineRecovery};
}
function label(value){return 'L1 + '+physical[normalize(value).position];}
function read(directory){try{return JSON.parse(fs.readFileSync(path.join(directory,'plugin-shortcuts.json'),'utf8'));}catch(e){if(e.code==='ENOENT')return null;throw Error('The shortcut backup could not be read.');}}
function write(directory,value){const file=path.join(directory,'plugin-shortcuts.json'),temp=file+'.'+randomUUID()+'.tmp';fs.writeFileSync(temp,JSON.stringify(value,null,2),{flag:'wx'});fs.renameSync(temp,file);}
async function configure(directory,value,{Studio=require('./studio.cjs').Studio}={}){
 const settings=normalize(value),manifest=JSON.parse(fs.readFileSync(path.join(directory,'hardware.json'),'utf8')),prior=read(directory);
 if(!manifest.verified||manifest.restored)throw Error('Wait for keyboard setup to complete first.');
 if(prior?.inProgress)throw Error('An earlier shortcut change did not finish. Its backup was kept; review the keyboard settings before retrying.');
 const s=new Studio();try{
  if(!manifest.keyboardSerial||s.serial!==manifest.keyboardSerial||prior&&prior.serial!==s.serial)throw Error('The shortcut backup belongs to a different keyboard.');
  const get=async()=>(await s.request({keymap:{getKeymap:true}})).keymap.getKeymap;
  const map=await get(),layer=map?.layers?.find(l=>l.id===1);
  if(layer?.bindings?.length!==68)throw Error('A supported 68-key L1 layer is required.');
  const expected=structuredClone(map),nextLayer=expected.layers.find(l=>l.id===1);
  // Restore only assignments still owned by this feature; never overwrite later custom edits.
  for(const entry of prior?.entries||[]){
   if(!sameBinding(layer.bindings[entry.position],entry.installed))throw Error('A saved shortcut changed in XPANEL. Its current assignment was preserved.');
   nextLayer.bindings[entry.position]=entry.original;
  }
  const targets=[...(settings.custom&&settings.position!==26?[{position:settings.position,installed:plugin}]:[]),...(settings.engineRecovery?[{position:0,installed:recovery}]:[])];
  const entries=targets.map(entry=>({...entry,original:nextLayer.bindings[entry.position]}));
  for(const entry of entries){
   if(prior?.entries?.some(old=>old.position===entry.position))continue;
   const available=[{behaviorId:56811},{behaviorId:0},...(entry.position===0?[{behaviorId:50397,param1:0x70035}]:[])];
   if(!available.some(binding=>sameBinding(binding,entry.original))){const action=entry.original.behaviorId===42547?'XPANEL Overlay '+entry.original.param1:'an XPANEL assignment';throw Object.assign(Error('L1 + '+physical[entry.position]+' already uses '+action+'. It was preserved. Choose an unused key.'),{code:'PLUGIN_SHORTCUT_CONFLICT',position:entry.position});}
  }
  for(const entry of entries)nextLayer.bindings[entry.position]=entry.installed;
  if(sameKeymap(map,expected)){write(directory,{serial:s.serial,settings,entries,inProgress:false});return settings;}
  if(await require('./studio-response.cjs').pendingChanges(s))throw Object.assign(Error('Keyboard settings are pending. Save or review those settings before changing shortcuts.'),{code:'PLUGIN_SHORTCUT_PENDING',currentSettings:prior?.settings||normalize({engineRecovery:false})});
  if(!sameKeymap(map,await get()))throw Error('Keyboard settings changed. Please retry.');
  fs.writeFileSync(path.join(directory,'shortcut-checkpoint-'+randomUUID()+'.json'),JSON.stringify({serial:s.serial,map,prior}),{flag:'wx'});
  write(directory,{serial:s.serial,settings:prior?.settings||normalize(),entries:prior?.entries||[],planned:{settings,entries},inProgress:true});
  for(let position=0;position<68;position++)if(!sameBinding(layer.bindings[position],nextLayer.bindings[position]))assertBindingResult((await s.request({keymap:{setLayerBinding:{layerId:1,keyPosition:position,binding:nextLayer.bindings[position]}}})).keymap.setLayerBinding,'Plugin shortcut');
  if(!sameKeymap(expected,await get()))throw Error('Keyboard settings changed during the operation. Backup retained; nothing was saved.');
  assertSaveResult((await s.request({keymap:{saveChanges:true}})).keymap.saveChanges);
  if(!sameKeymap(expected,await get()))throw Error('Shortcut save could not be verified. Backup retained.');
  write(directory,{serial:s.serial,settings,entries,inProgress:false});return settings;
 }finally{s.close();}
}
async function configureStartup(directory,value,deps={}){
 try{
  try{return{settings:await configure(directory,value,deps),warning:''};}
  catch(error){if(error.code!=='PLUGIN_SHORTCUT_CONFLICT'||error.position!==0)throw error;
   return {settings:await configure(directory,{...normalize(value),engineRecovery:false},deps),warning:'L1 + Esc already has an XPANEL assignment. Recovery was left off to preserve it.'};
  }
 }catch(error){
  // Only this pre-write condition can defer optional shortcuts safely. The
  // existing owned bindings have already been checked against the keyboard.
  if(error.code!=='PLUGIN_SHORTCUT_PENDING')throw error;
  return {settings:error.currentSettings,warning:'Optional shortcut changes were deferred because keyboard settings are pending. Existing shortcuts were kept; save shortcuts after reviewing those settings.'};
 }
}
module.exports={normalize,label,read,configure,configureStartup};
