const fs=require('node:fs'),path=require('node:path');
const {Som}=require('./som.cjs'),{Studio}=require('./studio.cjs');
const {setup,pluginBinding:binding}=require('./setup-transaction.cjs');
const {sameBinding,sameKeymap,assertBindingResult,assertSaveResult}=require('./keyboard-errors.cjs');
const {arrowRestorations}=require('./plugin-arrow-bindings.cjs');
async function restore(directory){
 await require('./widget-shortcut.cjs').widgetShortcut(directory,true);
 const file=path.join(directory,'hardware.json'),backup=JSON.parse(fs.readFileSync(file,'utf8'));
 const s=new Studio();let som;
 try{
  som=new Som();if(som.serial!==backup.serial||backup.keyboardSerial&&s.serial!==backup.keyboardSerial)throw Error('A different keyboard is connected.');
  if((await s.request({keymap:{checkUnsavedChanges:true}})).keymap.checkUnsavedChanges)throw Error('Save XPANEL edits first.');
  const map=(await s.request({keymap:{getKeymap:true}})).keymap.getKeymap,layer=map.layers.find(l=>l.id===1);
  if(!sameBinding(layer.bindings[26],binding))throw Error('L1+P changed outside this app; restoration stopped.');
  const changes=[{position:26,original:backup.originalBinding},...arrowRestorations(layer,backup)];
  for(const item of changes){
   assertBindingResult((await s.request({keymap:{setLayerBinding:{layerId:1,keyPosition:item.position,binding:item.original}}})).keymap.setLayerBinding,'Restoration');
   layer.bindings[item.position]=item.original;
  }
  if(!sameKeymap(map,(await s.request({keymap:{getKeymap:true}})).keymap.getKeymap))throw Error('Configuration changed during restoration; nothing was saved.');
  assertSaveResult((await s.request({keymap:{saveChanges:true}})).keymap.saveChanges);
  if(!sameKeymap(map,(await s.request({keymap:{getKeymap:true}})).keymap.getKeymap))throw Error('Restoration readback differed.');
  await som.activate(backup.originalSlot||0);backup.restored=true;fs.writeFileSync(file,JSON.stringify(backup,null,2));
 }finally{s.close();som?.close();}
}
module.exports={setup,restore};
