const fs=require('node:fs'),path=require('node:path'),{randomUUID}=require('node:crypto');
const {Som}=require('./som.cjs'),{Studio}=require('./studio.cjs');
const {setup,pluginBinding:binding,validateRestorationRecord}=require('./setup-transaction.cjs');
const {sameBinding,sameKeymap,assertBindingResult,assertSaveResult,keyboardError}=require('./keyboard-errors.cjs');
const {arrowRestorations}=require('./plugin-arrow-bindings.cjs');
async function restore(directory){
 const file=path.join(directory,'hardware.json');let backup;
 try{backup=JSON.parse(fs.readFileSync(file,'utf8'));}catch{throw keyboardError('SETUP_BACKUP_UNREADABLE','The original keyboard backup could not be read. It was preserved; use Check setup before restoring.');}
 // A partial recovery record can be reviewed by setup, but cannot safely supply
 // original bindings for restoration. Validate before restoring any shortcuts.
 if(!backup||Array.isArray(backup)||typeof backup.serial!=='string'||!backup.serial||backup.originalBinding===undefined||backup.originalSlot===undefined||backup.keyboardSerial!==undefined&&(typeof backup.keyboardSerial!=='string'||!backup.keyboardSerial)||backup.pluginArrows!==undefined&&(!Array.isArray(backup.pluginArrows)||backup.pluginArrows.some(item=>!item||typeof item!=='object'||Array.isArray(item))))throw keyboardError('SETUP_BACKUP_UNREADABLE','The original keyboard backup is incomplete or invalid. It was preserved; use Check setup before restoring.');
 validateRestorationRecord(backup);
 const s=new Studio();let som;
 try{
  som=new Som();if(som.serial!==backup.serial||backup.keyboardSerial&&s.serial!==backup.keyboardSerial)throw Error('A different keyboard is connected.');
  if(require('./plugin-shortcuts.cjs').read(directory))await require('./plugin-shortcuts.cjs').configure(directory,{custom:false,engineRecovery:false,hideLegendsShortcut:false},{recoverInterrupted:true});
  await require('./widget-shortcut.cjs').widgetShortcut(directory,true);
  if(await require('./studio-response.cjs').pendingChanges(s))throw Error('Save XPANEL edits first.');
  const map=(await s.request({keymap:{getKeymap:true}})).keymap.getKeymap,layer=map.layers.find(l=>l.id===1);
  if(!sameBinding(layer.bindings[26],binding)&&!sameBinding(layer.bindings[26],backup.originalBinding))throw Error('L1+P changed outside this app; restoration stopped.');
  const changes=[...(sameBinding(layer.bindings[26],backup.originalBinding)?[]:[{position:26,original:backup.originalBinding}]),...arrowRestorations(layer,backup)];
  for(const item of changes){
   assertBindingResult((await s.request({keymap:{setLayerBinding:{layerId:1,keyPosition:item.position,binding:item.original}}})).keymap.setLayerBinding,'Restoration');
   layer.bindings[item.position]=item.original;
  }
  if(!sameKeymap(map,(await s.request({keymap:{getKeymap:true}})).keymap.getKeymap))throw Error('Configuration changed during restoration; nothing was saved.');
  // A previous failed save may have left the original bindings only in RAM.
  // Explicit restoration must save again even when no binding edits remain.
  assertSaveResult((await s.request({keymap:{saveChanges:true}})).keymap.saveChanges);
  if(!sameKeymap(map,(await s.request({keymap:{getKeymap:true}})).keymap.getKeymap))throw Error('Restoration readback differed.');
  await som.activate(backup.originalSlot||0);backup.restored=true;const temporary=file+'.'+randomUUID()+'.tmp';
  try{fs.writeFileSync(temporary,JSON.stringify(backup,null,2),{flag:'wx'});fs.renameSync(temporary,file);}catch(error){try{fs.unlinkSync(temporary);}catch{}throw error;}
 }finally{s.close();som?.close();}
}
module.exports={setup,restore};
