const appearance=require('./appearance.cjs');
const mediaIcons=require('./media-icons.js');
const sharp = require('sharp');
const fs = require('node:fs');
const path = require('node:path');
const { Som } = require('./som.cjs');
const SLOTS = { idle: 2, previous: 3, toggle: 4, next: 5 };
const {catalog}=require('./catalog.cjs');
const icons=require('./icons.json');
const{reading,weatherIcon,detailSVG}=require('./widgets.cjs');const layout=require('./layout.json');const{physical}=require('./keymap.cjs');
const{languageLabel}=require('./language-labels.js');
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
function configuredSVG(selected,config,locks,data={}){
 const theme=appearance.appearance(config.appearance),now=data.animationTime??data.now??Date.now();
 if(theme.transparentPlugins){theme.stripOpacity=0;theme.tileOpacity=0;}
 const selection=['previous','toggle','next','fourth'].indexOf(selected);if(selection>=0)theme.motion='off';
 const rows=config.slots.map((slot,index)=>{const plugin=catalog.find(p=>p.id===slot?.plugin);const svg=plugin?icons[plugin.icon]:null;
 const custom=slot?.visual,override=appearance.tileAppearance(slot?.appearance),palette={...theme,motion:selection>=0?'off':override.motion==='inherit'?theme.motion:override.motion,accent:override.motion==='inherit'?theme.accent:override.accent},background=index===selection?theme.selectedBackground:appearance.animated(override.background||theme.slotBackground,palette,now);if(custom&&custom.kind!=='default'&&!(custom.kind==='icon'&&slot.plugin!=='decoration'&&custom.imageMode!=='fill'))return `<svg x="1605" y="${15+index*86}" width="80" height="78" overflow="hidden"><rect width="80" height="78" rx="9" fill="${background}" fill-opacity="${theme.tileOpacity}" stroke-opacity="${index===selection?1:theme.tileOpacity}" stroke="${index===selection?'#9bb9ff':theme.tileBorder}" stroke-width="3"/>${appearance.visualSVG(custom)}</svg>`;
 const metric=reading(plugin?.id,{...data,clockSeconds:config.widget?.clockSeconds});if(metric)return `<g transform="translate(1605 ${15+index*86})"><rect width="80" height="78" rx="9" fill="${background}" fill-opacity="${theme.tileOpacity}" stroke-opacity="${index===selection?1:theme.tileOpacity}" stroke="${index===selection?'#9bb9ff':theme.tileBorder}" stroke-width="3"/>${custom?.kind==='icon'&&custom.icon?`<image x="25" y="1" width="30" height="30" href="${custom.icon}"/>`:metric.icon?`<g transform="translate(30 2) scale(.6)">${weatherIcon(metric.icon,config.weatherMotion===false?0:undefined,metric.windy)}</g>`:''}<text x="40" y="47" text-anchor="middle" fill="#edf2fa" font-family="Arial" font-size="${metric.value.length>6?17:24}" font-weight="bold">${escape(metric.value)}</text><text x="40" y="${metric.forecast?60:67}" text-anchor="middle" fill="#b8c8dc" font-family="Arial" font-size="9">${escape(metric.label)}</text>${metric.forecast?`<text x="40" y="73" text-anchor="middle" fill="#ffb45b" font-family="Arial" font-size="8">${escape(metric.forecast)}</text>`:""}</g>`;
 return `<g transform="translate(1605 ${15+index*86})"><rect width="80" height="78" rx="9" fill="${background}" fill-opacity="${theme.tileOpacity}" stroke-opacity="${index===selection?1:theme.tileOpacity}" stroke="${index===selection?'#9bb9ff':theme.tileBorder}" stroke-width="3"/>${custom?.kind==='icon'&&custom.icon?`<image x="16" y="1" width="48" height="48" href="${custom.icon}"/>`:svg?`<image x="24" y="8" width="32" height="32" href="data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}"/>`:''}<text x="40" y="56" text-anchor="middle" font-family="Arial" font-size="11" fill="#edf2fa">${escape(plugin?.name.slice(0,11)||'EMPTY')}</text><text x="40" y="70" text-anchor="middle" font-family="Arial" font-size="9" fill="#b8c8dc">${escape(plugin?.actions.find(a=>a.id===slot?.action)?.label.slice(0,15)||'')}</text></g>`;}).join('');
 const i=theme.transparentCaps?{...config.indicator,enabled:config.indicator.enabled&&locks.caps}:config.indicator;
 // Preserve XPANEL legends. Only Companion's two L1 shortcut hints are drawn.
 const legendHint=locks.layer&&config.pluginShortcuts?.hideLegendsShortcut?keyHighlight(62,config.legendShortcutColor||'#ff4040',''):'';
 const musicHint=selection>=0&&['spotify','youtubemusic'].includes(config.slots[selection]?.plugin)?[65,67,56].map(position=>keyHighlight(position,config.musicNavigationColor||'#1db954','')).join(''):'';
 const pluginPosition=config.pluginShortcuts?.custom?config.pluginShortcuts.position:26;const layer=locks.layer?[pluginPosition,55].filter(index=>index!==pluginPosition||config.stripEnabled!==false).map(index=>{const key=layout.keys[index],x=((key.x||0)+key.width/2)*1920/1800,y=((key.y||0)+key.height/2)*550/500,color=config.layerColor||i.on;return `<rect x="${x-44}" y="${y-40}" width="88" height="80" rx="8" fill="${color}" fill-opacity=".65" stroke="${color}" stroke-width="3"/><text x="${x}" y="${y+7}" text-anchor="middle" font-family="Segoe UI,Arial,sans-serif" font-size="${index===55?30:Math.min(30,Math.floor(110/physical[index].length))}" font-weight="bold" fill="#111820">${config.hideLegends?'':escape(index===pluginPosition?physical[index]:'/')}</text>`;}).join(''):'';
 return `<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="550">${config.stripEnabled===false?'':`<g><rect x="1597" y="5" width="96" height="397" rx="12" fill="${appearance.animated(theme.stripBackground,theme,now)}" fill-opacity="${theme.stripOpacity}" stroke-opacity="${theme.stripOpacity}" stroke="${theme.border}"/>${rows}${hintSVG(theme.hint,config.pluginShortcuts)}</g>`}${appearance.capsSVG(i,locks.caps)}${layer}${legendHint}${musicHint}${mediaKeySVG(config,locks,data)}${detailSVG(config,data)}</svg>`;
}
function keyHighlight(position,color,text){
 const key=layout.keys[position],x=(key.x||0)*1920/1800,y=(key.y||0)*550/500,w=key.width*1920/1800,h=key.height*550/500;
 return `<g data-navigation-key="${position}"><rect x="${x+4}" y="${y+4}" width="${w-8}" height="${h-8}" rx="8" fill="${color}" fill-opacity=".65"/><text x="${x+w/2}" y="${y+h/2+9}" text-anchor="middle" font-family="Segoe UI" font-size="26" fill="#111820">${text}</text></g>`;
}
function mediaKeySVG(config,locks,data={}){
 if(config.hideLegends)return '';
 const active=locks.layer?1:0,bindings=data.bindingLayers?.[active];
 return Object.entries(config.keyIcons||{}).map(([id,style])=>{
  const [layer,position]=id.split(':').map(Number);if(layer!==active)return '';
  const binding=bindings?.[position],entry=mediaIcons.find(style.code);
  if(!entry||!binding||binding.behaviorId!==50397||(binding.param1&0xffffff)!==entry.code||(entry.mods!==undefined&&(binding.param1>>>24)!==entry.mods))return '';
  const key=layout.keys[position];if(!key)return '';
  const x=((key.x||0)+key.width/2)*1920/1800+(style.offsetX||0),y=((key.y||0)+key.height/2)*550/500+(style.offsetY||0),size=style.size??Math.min(50,key.width*1920/1800-16,key.height*550/500-16);
  return `<g data-media-key="${id}">${style.style==='glossy'?'':`<rect x="${x-size/2-4}" y="${y-size/2-4}" width="${size+8}" height="${size+8}" rx="8" fill="${style.background}" fill-opacity=".97"/>`}<svg x="${x-size/2}" y="${y-size/2}" width="${size}" height="${size}" viewBox="0 0 40 40">${mediaIcons.svg(entry.code,style).replace(/^<svg[^>]*>|<\/svg>$/g,'')}</svg></g>`;
 }).join('');
}
function hintSVG(h,shortcuts){const shortcut=require('./plugin-shortcuts.cjs').label(shortcuts);if(h.mode==='hidden')return '';if(h.mode==='default')return '<text x="1645" y="374" text-anchor="middle" fill="#edf2fa" font-family="Arial" font-size="10">PLUGINS</text><text x="1645" y="391" text-anchor="middle" fill="#b8c8dc" font-family="Arial" font-size="'+Math.min(12,Math.floor(140/shortcut.length))+'">'+escape(shortcut)+'</text>';return `<svg x="1603" y="363" width="84" height="34" overflow="hidden">${appearance.visualSVG({kind:h.mode,...h,align:'center',vertical:'center',paddingX:2,paddingY:1},84,34)}</svg>`;}
function stripSVG(selected = 'idle') {
  const items = [
    {id:'previous', y:104, label:'PREV', icon:'<path d="M22 0V28M48 0L27 14L48 28Z"/>'},
    {id:'toggle', y:196, label:'PLAY', icon:'<path d="M20 0L40 14L20 28Z"/><path d="M47 0V28M55 0V28"/>'},
    {id:'next', y:288, label:'NEXT', icon:'<path d="M50 0V28M24 0L45 14L24 28Z"/>'}
  ];
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="550" viewBox="0 0 1920 550"><g transform="translate(1597 5)"><rect width="96" height="397" rx="12" fill="#111820" fill-opacity=".96" stroke="#48607a"/><circle cx="48" cy="36" r="22" fill="#1db954"/><path d="M34 30Q48 24 62 31M36 37Q48 32 60 38M39 44Q49 40 58 45" fill="none" stroke="#07140c" stroke-width="3" stroke-linecap="round"/><text x="48" y="79" text-anchor="middle" fill="#edf2fa" font-family="Arial" font-size="15" font-weight="bold">SPOTIFY</text>${items.map(item => `<g transform="translate(8 ${item.y})"><rect width="80" height="80" rx="9" fill="${selected===item.id?'#9bb9ff':'#243040'}"/><g transform="translate(3 12)" fill="${selected===item.id?'#111820':'#edf2fa'}" stroke="${selected===item.id?'#111820':'#edf2fa'}" stroke-width="3" stroke-linejoin="round">${item.icon}</g><text x="40" y="66" text-anchor="middle" font-family="Arial" font-size="12" font-weight="bold" fill="${selected===item.id?'#111820':'#b8c8dc'}">${item.label}</text></g>`).join('')}<text x="48" y="389" text-anchor="middle" font-family="Arial" font-size="10" fill="#b8c8dc">L1 + P</text></g></svg>`;
}
async function renderStrip(selected) { return sharp(Buffer.from(stripSVG(selected))).png().toBuffer(); }
const{DisplayCache}=require('./display-cache.cjs');
class StripController extends DisplayCache {
 constructor(directory){super(directory,configuredSVG);this.legends=new(require('./physical-legends.cjs').PhysicalLegends)(directory);this.languageDefault=new(require('./language-default.cjs').LanguageDefault)(directory);}
 key(...args){return super.key(...args)+(this.legends?.model?':letters-'+Number(args[1]??this.caps)+((args[3]??this.shift)?':shift':''):'');}
 setLocks(locks){this.shift=!!locks.shift;super.setLocks(locks);}
 frame(selected,caps,layer,shift=this.shift){const base=super.frame(selected,caps,layer);return base.slice(0,-6)+require('./physical-legends.cjs').svg(this.legends.model,this.config,{caps,layer,shift:!!shift},this.data)+'</svg>';}
 evictionCandidates(choices){if(!this.legends.model)return super.evictionCandidates(choices);return choices.filter(([key])=>!key.includes('idle:'));}
 initialStates(){
  if(!this.legends.model)return super.initialStates();
  const states=[["idle",false,false,false],["idle",true,false,false],["idle",false,false,true],["idle",true,false,true],...['previous','toggle','next','fourth'].map(n=>[n,this.caps,false,!!this.shift])].slice(0,this.capacity);
  const desired=[this.desired,this.caps,this.desired==='idle'&&this.layer,!!this.shift];
  if(!states.some(s=>this.key(...s)===this.key(...desired)))states[states.length-1]=desired;
  return states;
 }
 async apply(config,locks){
  let previousLanguage,changedLanguage=false;
  try{
   if(config.hideLegends){
    await this.legends.prepare(this.som,null);
   }else if(config.languageId!=='qwerty'&&config.physicalLanguage===true){
    const language=this.legends.model?.language?.id===config.languageId?this.legends.model.language:await require('./languages.cjs').map(config.languageId);
    await this.legends.prepare(this.som,language);
   }else{
    await this.legends.restore(this.som);
    if(config.languageId==='qwerty')await this.languageDefault.restore(this.som);
    const native=config.languageId==='qwerty'?undefined:require('./native-language.cjs').nativeId({id:config.languageId});
    if(native!==undefined){
     previousLanguage=await this.som.language();
     if(previousLanguage!==native){changedLanguage=true;await this.som.language(native);}
     if(await this.som.language()!==native){
      // Some firmware accepts the command but retains its current language.
      // Restore that state and use the same transparent renderer as UK/Kana.
      if(changedLanguage){await this.som.language(previousLanguage);if(await this.som.language()!==previousLanguage)throw Error('The previous legend language could not be restored.');changedLanguage=false;}
      await this.legends.prepare(this.som,await require('./languages.cjs').map(config.languageId));
     }
    }
   }
   await super.apply(config,locks);
   if(this.legends.model)await this.legends.commit(this.som);
  }catch(error){if(this.som)try{await this.legends.restore(this.som);if(changedLanguage){await this.som.language(previousLanguage);if(await this.som.language()!==previousLanguage)throw Error('The previous legend language could not be restored.');}}catch(restoreError){throw Error(error.message+' '+restoreError.message);}throw error;}
 }
 async close(){if(this.som)await this.legends.restore(this.som);return super.close();}
}
module.exports={SLOTS,stripSVG,configuredSVG,renderStrip,StripController,mediaKeySVG};
