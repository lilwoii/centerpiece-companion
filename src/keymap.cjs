const{Studio}=require('./studio.cjs');const fs=require('node:fs'),path=require('node:path');
const keyNames={40:'Enter',41:'Esc',42:'Backspace',43:'Tab',44:'Space',45:'-',46:'=',47:'[',48:']',49:'\\',51:';',52:"'",53:'`',54:',',55:'.',56:'/',57:'Caps Lock',73:'Insert',74:'Home',75:'Page Up',76:'Delete',77:'End',78:'Page Down',79:'Right',80:'Left',81:'Down',82:'Up',83:'Num Lock',71:'Scroll Lock',224:'Left Ctrl',225:'Left Shift',226:'Left Alt',227:'Windows',228:'Right Ctrl',229:'Right Shift',230:'Right Alt'};
for(let i=4;i<=29;i++)keyNames[i]=String.fromCharCode(i+61);for(let i=30;i<=39;i++)keyNames[i]=String((i-29)%10);for(let i=58;i<=69;i++)keyNames[i]='F'+(i-57);for(let i=104;i<=115;i++)keyNames[i]='F'+(i-91);
const choices=Object.entries(keyNames).map(([v,label])=>({value:0x70000+Number(v),label}));
choices.push(...[[0xb6,'Previous track'],[0xb5,'Next track'],[0xcd,'Play / pause'],[0xe9,'Volume up'],[0xea,'Volume down'],[0xe2,'Mute speakers']].map(([v,label])=>({value:0xc0000+v,label})));
const physical=['Esc','1','2','3','4','5','6','7','8','9','0','-','=','Backspace','Previous','Next','Tab','Q','W','E','R','T','Y','U','I','O','P','[',']','\\','Play / pause','Volume','Caps Lock','A','S','D','F','G','H','J','K','L',';',"'",'Enter','Left Shift','Z','X','C','V','B','N','M',',','.','/','Right Shift','Up','Left Ctrl','Windows','Left Alt','Space','Right Alt','L1','Right Ctrl','Left','Down','Right'];
function label(b){if(b.behaviorId===54567)return 'Layer '+b.param1;if(b.behaviorId===56811)return 'Use base key';if(b.behaviorId===29795)return 'Esc / `';if(b.behaviorId===50397){const mods=b.param1>>>24;return [(mods&1)?'Ctrl':null,(mods&2)?'Shift':null,(mods&4)?'Alt':null,choices.find(c=>c.value===(b.param1&0xffffff))?.label||'Key'].filter(Boolean).join('+');}return 'XPANEL special action';}
class KeymapEditor{
 constructor(directory){this.directory=directory;this.busy=false;this.snapshot=null;}
 async use(fn){if(this.busy)throw Error('Keyboard edit in progress.');this.busy=true;let s;try{s=new Studio();return await fn(s);}finally{s?.close();this.busy=false;}}
 async read(){return this.use(async s=>{const m=(await s.request({keymap:{getKeymap:true}})).keymap?.getKeymap;if(!m||m.layers.some(l=>l.bindings.length!==68))throw Error('This editor requires the 68-key Centerpiece layout.');this.snapshot=m;this.serial=s.serial;return{layout:require('./layout.json'),layers:m.layers.map(l=>({id:l.id||0,keys:l.bindings.map((b,i)=>({position:i,name:physical[i],binding:b,label:label(b)}))})),choices};});}
 async change(layerId,position,value,mods,swapPosition){
  if(![0,1].includes(layerId)||!Number.isInteger(position)||position<0||position>67||position===63||(layerId===1&&[26,55].includes(position)))throw Error('This key is reserved for layer and plugin navigation.');
  if(!this.snapshot)throw Error('Read the keyboard before editing.');
  if(swapPosition!==null&&(!Number.isInteger(swapPosition)||swapPosition<0||swapPosition>67||swapPosition===63||(layerId===1&&[26,55].includes(swapPosition))||swapPosition===position))throw Error('Choose a different, unreserved key to swap.');
  if(swapPosition===null&&(!choices.some(c=>c.value===value)||!Number.isInteger(mods)||mods<0||mods>7))throw Error('Choose a supported key and modifiers.');
  return this.use(async s=>{
   if(s.serial!==this.serial)throw Error('A different keyboard is connected. Read its bindings first.');
   if((await s.request({keymap:{checkUnsavedChanges:true}})).keymap.checkUnsavedChanges)throw Error('Save or discard XPANEL changes first.');
   const map=(await s.request({keymap:{getKeymap:true}})).keymap.getKeymap;
   if(JSON.stringify(map)!==JSON.stringify(this.snapshot))throw Error('Keyboard changed since it was loaded. Read it again before saving.');
   fs.mkdirSync(this.directory,{recursive:true});fs.writeFileSync(path.join(this.directory,`keymap-${Date.now()}.json`),JSON.stringify(map,null,2));
   const layer=map.layers.find(l=>(l.id||0)===layerId),before=structuredClone(layer.bindings),edits=swapPosition===null?[[position,{behaviorId:50397,param1:(mods<<24)|value}]]:[[position,before[swapPosition]],[swapPosition,before[position]]];
   let saveAttempted=false;
   try{for(const [keyPosition,binding]of edits){if((await s.request({keymap:{setLayerBinding:{layerId,keyPosition,binding}}})).keymap.setLayerBinding!==0)throw Error('Keyboard rejected the change');layer.bindings[keyPosition]=binding;}
    saveAttempted=true;
    const saved=(await s.request({keymap:{saveChanges:true}})).keymap.saveChanges;if(!saved||saved.err)throw Error('Save failed');
    const after=(await s.request({keymap:{getKeymap:true}})).keymap.getKeymap;if(JSON.stringify(map)!==JSON.stringify(after))throw Error('Readback differs. Read keyboard again to check its current state.');
    this.snapshot=after;return true;
   }catch(e){if(!saveAttempted)await s.request({keymap:{discardChanges:true}}).catch(()=>{});this.snapshot=null;throw e;}
  });
 }
}
module.exports={KeymapEditor,choices,physical,label};
