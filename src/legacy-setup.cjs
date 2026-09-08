const fs=require('node:fs'),path=require('node:path');
const HID=require('./hid.cjs');const {Studio}=require('./studio.cjs');
async function migrateLegacySetup(directory,manifest){
 if(manifest.keyboardSerial)return manifest;
 const devices=HID.devices();
 const supported=pid=>devices.filter(d=>d.vendorId===0x361d&&d.productId===pid&&d.usagePage===0xff00&&d.usage===1);
 const keyboards=supported(0x200),displays=supported(0x202);
 if(keyboards.length!==1||displays.length!==1||displays[0].serialNumber!==manifest.serial)throw Error('Reconnect only your original Centerpiece to update its saved setup.');
 let s;
 try{
  s=new Studio();
  const map=(await s.request({keymap:{getKeymap:true}})).keymap?.getKeymap;
  const base=map?.layers.find(l=>(l.id||0)===0),layer=map?.layers.find(l=>l.id===1);
  if(!s.serial||s.serial!==keyboards[0].serialNumber||base?.bindings.length!==68||layer?.bindings.length!==68||!manifest.installedBinding||JSON.stringify(layer.bindings[26])!==JSON.stringify(manifest.installedBinding))throw Error('The saved plugin binding does not match this keyboard. Restore or set up the keyboard before enabling its widget shortcut.');
  const next={...manifest,keyboardSerial:s.serial};
  fs.writeFileSync(path.join(directory,'hardware.json'),JSON.stringify(next,null,2));
  return next;
 }finally{s?.close();}
}
module.exports={migrateLegacySetup};
