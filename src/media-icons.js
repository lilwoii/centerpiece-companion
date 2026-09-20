/* Standard consumer-media symbols, shared by the editor and display renderer. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.MediaKeyIcons=factory();})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const items=Object.freeze([
  {code:0xc00b6,id:'previous',label:'Previous track',path:'M5 5v22M27 5L9 16l18 11Z'},
  {code:0xc00b5,id:'next',label:'Next track',path:'M27 5v22M5 5l18 11L5 27Z'},
  {code:0xc00cd,id:'toggle',label:'Play / pause',path:'M3 5l14 11L3 27ZM23 5v22M29 5v22'},
  {code:0xc00e9,id:'volumeup',label:'Volume up',path:'M3 12h6l7-7v22l-7-7H3ZM21 16h10M26 11v10'},
  {code:0xc00ea,id:'volumedown',label:'Volume down',path:'M3 12h6l7-7v22l-7-7H3ZM21 16h10'},
  {code:0xc00e2,id:'volumemute',label:'Mute speakers',path:'M3 12h6l7-7v22l-7-7H3ZM22 11l9 10M31 11l-9 10'}
 ]);
 const find=code=>items.find(item=>item.code===(Number(code)&0xffffff));
 function normalize(value={}){
  if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Choose valid media key icons.');
  const result={};
  for(const [key,raw] of Object.entries(value)){
   if(!/^[01]:(?:[0-9]|[1-5][0-9]|6[0-7])$/.test(key)||Object.keys(result).length>=136)throw Error('Choose a supported keyboard key for the icon.');
   const [layer,position]=key.split(':').map(Number);
   if(position===63||(layer===1&&[26,55].includes(position)))throw Error('L1 navigation keys keep their shortcut hints.');
   if(!raw||!Number.isInteger(raw.code)||!find(raw.code))throw Error('Choose a media action for the icon.');
   const color=raw.color??'#edf2fa',background=raw.background??'#243040',style=raw.style??'outline';
   if(!/^#[0-9a-f]{6}$/i.test(color)||!/^#[0-9a-f]{6}$/i.test(background)||!['outline','solid','badge'].includes(style))throw Error('Choose a supported media icon color and design.');
   result[key]={code:raw.code&0xffffff,color,background,style};
  }
  return result;
 }
 function svg(code,config={}){
  const item=find(code);if(!item)return '';
  const color=/^#[0-9a-f]{6}$/i.test(config.color||'')?config.color:'#edf2fa';
  const background=/^#[0-9a-f]{6}$/i.test(config.background||'')?config.background:'#243040';
  const style=['solid','badge'].includes(config.style)?config.style:'outline';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40">${style==='badge'?`<rect x="1" y="1" width="38" height="38" rx="9" fill="${background}" stroke="${color}" stroke-width="1.5"/>`:''}<path transform="translate(4 4)" d="${item.path}" fill="${style==='solid'?color:'none'}" stroke="${color}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
 }
 return Object.freeze({items,find,normalize,svg});
});
