const fs=require('node:fs'),path=require('node:path');const{Studio}=require('./studio.cjs');
const{pendingChanges}=require('./studio-response.cjs');
const{keyboardError,assertBindingResult,assertSaveResult,sameBinding,sameKeymap}=require('./keyboard-errors.cjs');
const binding={behaviorId:50397,param1:0x05070045}; // Ctrl+Alt+F12, emitted by physical L1 + /.
const legacyBinding={behaviorId:50397,param1:0x05070073};
async function widgetShortcut(directory,restore=false){
 let manifest=JSON.parse(fs.readFileSync(path.join(directory,'hardware.json'),'utf8'));
 if(!manifest.verified||manifest.restored)return false;
 const file=path.join(directory,'widget-shortcut.json'),prior=fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8')):null;
 if(restore&&!prior)return false;
 if(!manifest.keyboardSerial)manifest=await require('./legacy-setup.cjs').migrateLegacySetup(directory,manifest);
 const s=new Studio();
 try{if(!s.serial||s.serial!==manifest.keyboardSerial||prior&&prior.serial!==s.serial)throw keyboardError('KEYBOARD_IDENTITY_MISMATCH','The L1 + / backup belongs to a different keyboard. No keys were changed.',{stage:'widget-shortcut'});
 const map=(await s.request({keymap:{getKeymap:true}}))?.keymap?.getKeymap,layer=map?.layers?.find(l=>l.id===1);
 if(layer?.bindings?.length!==68)throw keyboardError('KEYBOARD_LAYOUT_UNSUPPORTED','L1 + / requires a 68-key Centerpiece Pro layer. No keys were changed.',{stage:'widget-shortcut'});
 const current=layer.bindings[55],desired=restore?prior.original:binding;
 // A correctly installed shortcut needs no configuration write. A pending flag
 // elsewhere on the keyboard must not prevent an already working chord from loading.
 if(sameBinding(current,desired))return true;
 const owned=sameBinding(current,binding)||sameBinding(current,legacyBinding);
 if(prior&&!owned&&!sameBinding(current,prior.original))throw keyboardError('KEYBOARD_SHORTCUT_CHANGED','L1 + / has changed since its backup. Its current mapping was preserved.',{stage:'widget-shortcut'});
 if(await pendingChanges(s))throw keyboardError('KEYBOARD_PENDING_CHANGES','The keyboard reports pending configuration changes, so L1 + / was not changed. Use Check setup to review recovery options; XPANEL may not show this keyboard flag.',{stage:'widget-shortcut'});
 if(!prior)fs.writeFileSync(file,JSON.stringify({serial:s.serial,original:current,installed:binding,createdAt:new Date().toISOString()},null,2));
 assertBindingResult((await s.request({keymap:{setLayerBinding:{layerId:1,keyPosition:55,binding:desired}}})).keymap.setLayerBinding,'L1 + /');
 assertSaveResult((await s.request({keymap:{saveChanges:true}})).keymap.saveChanges,'L1 + /');
 layer.bindings[55]=desired;const after=(await s.request({keymap:{getKeymap:true}})).keymap.getKeymap;if(!sameKeymap(map,after))throw keyboardError('KEYBOARD_READBACK_MISMATCH','L1 + / was saved, but the keyboard readback differs from the expected settings. Run Check setup before retrying.',{stage:'widget-shortcut'});
 if(!restore&&prior)fs.writeFileSync(file,JSON.stringify({...prior,installed:binding},null,2));return true;
 // A timed-out edit may have reached the device. Never discard the entire
 // keymap to recover one shortcut: another client may have pending edits too.
 }finally{s.close();}
}
module.exports={widgetShortcut,binding};
