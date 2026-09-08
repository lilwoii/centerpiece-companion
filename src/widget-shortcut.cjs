const fs=require('node:fs'),path=require('node:path');const{Studio}=require('./studio.cjs');
const binding={behaviorId:50397,param1:0x05070073}; // Ctrl+Alt+F24, emitted by physical L1 + /.
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
async function widgetShortcut(directory,restore=false){
 const manifest=JSON.parse(fs.readFileSync(path.join(directory,'hardware.json'),'utf8'));
 if(!manifest.verified||manifest.restored)return false;
 const file=path.join(directory,'widget-shortcut.json'),prior=fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8')):null;
 if(restore&&!prior)return false;
 const s=new Studio();let saveAttempted=false;
 try{if(s.serial!==manifest.keyboardSerial||prior&&prior.serial!==s.serial)throw Error('Widget shortcut backup belongs to a different keyboard.');
 if((await s.request({keymap:{checkUnsavedChanges:true}})).keymap.checkUnsavedChanges)throw Error('Save or discard XPANEL edits before setting up L1 + /.');
 const map=(await s.request({keymap:{getKeymap:true}})).keymap.getKeymap,layer=map.layers.find(l=>l.id===1);
 if(layer?.bindings.length!==68)throw Error('L1 + / requires the 68-key Centerpiece Pro layout.');
 const current=layer.bindings[55],desired=restore?prior.original:binding;
 if(same(current,desired))return true;
 if(prior&&!same(current,restore?binding:prior.original))throw Error('L1 + / changed outside the companion; its current mapping was preserved.');
 if(!prior)fs.writeFileSync(file,JSON.stringify({serial:s.serial,original:current,installed:binding,createdAt:new Date().toISOString()},null,2));
 if((await s.request({keymap:{setLayerBinding:{layerId:1,keyPosition:55,binding:desired}}})).keymap.setLayerBinding!==0)throw Error('Keyboard rejected the widget shortcut.');
 saveAttempted=true;const saved=(await s.request({keymap:{saveChanges:true}})).keymap.saveChanges;if(!saved||saved.err)throw Error('Keyboard did not save the widget shortcut.');
 layer.bindings[55]=desired;const after=(await s.request({keymap:{getKeymap:true}})).keymap.getKeymap;if(!same(map,after))throw Error('Widget shortcut readback differed. Reconnect before retrying.');return true;
 }catch(e){if(!saveAttempted)await s.request({keymap:{discardChanges:true}}).catch(()=>{});throw e;}finally{s.close();}
}
module.exports={widgetShortcut,binding};
