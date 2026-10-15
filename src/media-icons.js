/* Standard consumer-media symbols, shared by the editor and display renderer. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.MediaKeyIcons=factory();})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const items=Object.freeze([
  {code:0x70046,mods:8,id:'screenshot',label:'Screenshot',path:'M3 9h7l3-4h7l3 4h6v19H3ZM22 18a6 6 0 1 0-12 0a6 6 0 1 0 12 0'},
  {code:0x70013,mods:1,id:'print',label:'Print (Ctrl + P)',path:'M8 11V3h16v8M8 23H3V11h26v12h-5M8 19h16v11H8ZM24 15h1'},
  {code:0xc00b6,id:'previous',label:'Previous track',path:'M5 5v22M27 5L9 16l18 11Z'},
  {code:0xc00b5,id:'next',label:'Next track',path:'M27 5v22M5 5l18 11L5 27Z'},
  {code:0xc00cd,id:'toggle',label:'Play / pause',path:'M3 5l14 11L3 27ZM23 5v22M29 5v22'},
  {code:0xc00e9,id:'volumeup',label:'Volume up',path:'M3 12h6l7-7v22l-7-7H3ZM21 16h10M26 11v10'},
  {code:0xc00ea,id:'volumedown',label:'Volume down',path:'M3 12h6l7-7v22l-7-7H3ZM21 16h10'},
  {code:0xc00e2,id:'volumemute',label:'Mute speakers',path:'M3 12h6l7-7v22l-7-7H3ZM22 11l9 10M31 11l-9 10'}
 ]);
 const find=(code,mods)=>items.find(item=>item.code===(Number(code)&0xffffff)&&(mods===undefined||!(item.mods)||item.mods===mods));
 function normalize(value={}){
  if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Choose valid media key icons.');
  const result={};
  for(const [key,raw] of Object.entries(value)){
   if(!/^[01]:(?:[0-9]|[1-5][0-9]|6[0-7])$/.test(key)||Object.keys(result).length>=136)throw Error('Choose a supported keyboard key for the icon.');
   const [layer,position]=key.split(':').map(Number);
   if(position===63||(layer===1&&[26,55].includes(position)))throw Error('L1 navigation keys keep their shortcut hints.');
   if(!raw||!Number.isInteger(raw.code)||!find(raw.code))throw Error('Choose a media action for the icon.');
   const color=raw.color??'#edf2fa',background=raw.background??'#243040',style=raw.style??'outline';
   if(!/^#[0-9a-f]{6}$/i.test(color)||!/^#[0-9a-f]{6}$/i.test(background)||!['outline','solid','badge','glossy'].includes(style))throw Error('Choose a supported media icon color and design.');
   result[key]={code:raw.code&0xffffff,color,background,style};
   for(const [field,min,max] of [['size',16,88],['offsetX',-100,100],['offsetY',-100,100]])if(raw[field]!==undefined){if(!Number.isFinite(raw[field])||raw[field]<min||raw[field]>max)throw Error('Choose an icon size from 16–88 px and offsets within 100 px.');result[key][field]=raw[field];}
  }
  return result;
 }
 function svg(code,config={}){
  const item=find(code);if(!item)return '';
  const color=/^#[0-9a-f]{6}$/i.test(config.color||'')?config.color:'#edf2fa';
  const background=/^#[0-9a-f]{6}$/i.test(config.background||'')?config.background:'#243040';
  const style=['solid','badge','glossy'].includes(config.style)?config.style:config.style==='outline'?'outline':'glossy';
  if(style==='glossy'){
   const palettes={previous:['#aabaff','#5864d9','#bc89ef'],next:['#99e7da','#25a9c7','#eb87d8'],toggle:['#e0a1fa','#9865dc','#92bbef'],screenshot:['#9edfff','#398ed7','#8f83eb'],print:['#a6e7e5','#408fc8','#bf8de7'],volumeup:['#f8b0c5','#e85f91','#b181ef'],volumedown:['#ddaff8','#a95ac9','#ee8ebf'],volumemute:['#e0b1f8','#a360d4','#e38edb']};
   const [light,base,end]=palettes[item.id],id='key-'+item.id+'-'+color.slice(1)+'-'+background.slice(1),tint=config.background&&background!=='#243040'?background:base;
   const symbols={previous:'M5 18h3v15H5ZM29 18L12 25.5 29 33Z',next:'M29 18h3v15h-3ZM8 18l17 7.5L8 33Z',toggle:'M6 18l14 7.5L6 33ZM23 18h4v15h-4ZM30 18h4v15h-4',screenshot:'M7 17h7l2-3h8l2 3h7v16H7ZM25 25a5 5 0 1 0-10 0a5 5 0 1 0 10 0',print:'M12 13h16v7H12ZM7 21h26v10h-5v-5H12v5H7ZM14 28h12v7H14ZM28 23h2v2h-2'};
   const symbol=symbols[item.id]?`<path d="${symbols[item.id]}" fill="${color}" fill-rule="evenodd"/>`:`<path transform="translate(5 12) scale(.85)" d="${item.path}" fill="none" stroke="${color}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`;
   return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><defs><linearGradient id="${id}" x2="1" y2="1"><stop stop-color="${light}"/><stop offset=".58" stop-color="${tint}"/><stop offset="1" stop-color="${end}"/></linearGradient><linearGradient id="${id}-shine" x2="0" y2="1"><stop stop-color="#ffffff" stop-opacity=".35"/><stop offset="1" stop-color="#ffffff" stop-opacity="0"/></linearGradient></defs><rect x="1" y="1" width="38" height="38" rx="3" fill="url(#${id})"/><rect x="1.5" y="1.5" width="37" height="21" rx="2.5" fill="url(#${id}-shine)"/><path d="M3 38h34" stroke="#152245" stroke-opacity=".25"/>${symbol}</svg>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40">${style==='badge'?`<rect x="1" y="1" width="38" height="38" rx="9" fill="${background}" stroke="${color}" stroke-width="1.5"/>`:''}<path transform="translate(4 4)" d="${item.path}" fill="${style==='solid'?color:'none'}" stroke="${color}" stroke-width="${['screenshot','print'].includes(item.id)?3.4:2.4}" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
 }
 return Object.freeze({items,find,normalize,svg});
});
