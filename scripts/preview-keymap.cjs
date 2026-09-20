'use strict';
// Isolated UI fixture. Does not connect to a keyboard or load saved hardware maps.
const {choices,physical,label}=require('../src/keymap.cjs');
function create(){
 const aliases={Esc:'Esc','⌫':'Backspace',Cap:'Caps Lock',Caps:'Caps Lock',Ctrl:'Left Ctrl',Win:'Windows',Alt:'Left Alt',Shift:'Left Shift','↑':'Up','←':'Left','↓':'Down','→':'Right','⏮':'Previous track','⏭':'Next track','⏯':'Play / pause',Vol:'Volume up'};
 const keys=physical.map((name,position)=>{const option=choices.find(c=>c.label===(aliases[name]||name));const binding=position===63?{behaviorId:54567,param1:1}:{behaviorId:50397,param1:({14:0xc00b6,15:0xc00b5,30:0xc00cd,31:0xc00e9})[position]||option?.value||0x70004};return{position,name,binding,label:label(binding)};});
 return{sample:true,layout:require('../src/layout.json'),choices,layers:[{id:0,keys},{id:1,keys:keys.map(k=>({...k,binding:{...k.binding}}))}]};
}
function change(map,input){
 const {layer,position,value,mods,swap}=input||{};const reserved=p=>p===63||(layer===1&&[26,55].includes(p));
 if(![0,1].includes(layer)||!Number.isInteger(position)||position<0||position>67||reserved(position))throw Error('Choose an unreserved sample key.');
 const next=structuredClone(map),keys=next.layers.find(l=>l.id===layer).keys;
 if(swap!==null){if(!Number.isInteger(swap)||swap<0||swap>67||swap===position||reserved(swap))throw Error('Choose a different unreserved sample key.');[keys[position].binding,keys[swap].binding]=[keys[swap].binding,keys[position].binding];keys[swap].label=label(keys[swap].binding);}
 else{if(!choices.some(c=>c.value===value)||!Number.isInteger(mods)||mods<0||mods>7)throw Error('Choose a supported binding.');keys[position].binding={behaviorId:50397,param1:(mods<<24)|value};}
 keys[position].label=label(keys[position].binding);return next;
}
module.exports={create,change};
