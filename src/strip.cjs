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
 const selection=['previous','toggle','next','fourth'].indexOf(selected);if(selection>=0)theme.motion='off';
 const rows=config.slots.map((slot,index)=>{const plugin=catalog.find(p=>p.id===slot?.plugin);const svg=plugin?icons[plugin.icon]:null;
 const custom=slot?.visual,override=appearance.tileAppearance(slot?.appearance),palette={...theme,motion:selection>=0?'off':override.motion==='inherit'?theme.motion:override.motion,accent:override.motion==='inherit'?theme.accent:override.accent},background=index===selection?theme.selectedBackground:appearance.animated(override.background||theme.slotBackground,palette,now);if(custom&&custom.kind!=='default')return `<svg x="1605" y="${15+index*86}" width="80" height="78" overflow="hidden"><rect width="80" height="78" rx="9" fill="${background}" stroke="${index===selection?'#9bb9ff':theme.tileBorder}" stroke-width="3"/>${appearance.visualSVG(custom)}</svg>`;
 const metric=reading(plugin?.id,{...data,clockSeconds:config.widget?.clockSeconds});if(metric)return `<g transform="translate(1605 ${15+index*86})"><rect width="80" height="78" rx="9" fill="${background}" stroke="${index===selection?'#9bb9ff':theme.tileBorder}" stroke-width="3"/>${metric.icon?`<g transform="translate(30 2) scale(.6)">${weatherIcon(metric.icon,config.weatherMotion===false?0:undefined,metric.windy)}</g>`:''}<text x="40" y="47" text-anchor="middle" fill="#edf2fa" font-family="Arial" font-size="${metric.value.length>6?17:24}" font-weight="bold">${escape(metric.value)}</text><text x="40" y="67" text-anchor="middle" fill="#b8c8dc" font-family="Arial" font-size="9">${escape(metric.label)}</text></g>`;
 return `<g transform="translate(1605 ${15+index*86})"><rect width="80" height="78" rx="9" fill="${background}" stroke="${index===selection?'#9bb9ff':theme.tileBorder}" stroke-width="3"/>${svg?`<image x="24" y="8" width="32" height="32" href="data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}"/>`:''}<text x="40" y="56" text-anchor="middle" font-family="Arial" font-size="11" fill="#edf2fa">${escape(plugin?.name.slice(0,11)||'EMPTY')}</text><text x="40" y="70" text-anchor="middle" font-family="Arial" font-size="9" fill="#b8c8dc">${escape(plugin?.actions.find(a=>a.id===slot?.action)?.label.slice(0,15)||'')}</text></g>`;}).join('');
 const i=config.indicator;
 // Preserve XPANEL legends. Only Companion's two L1 shortcut hints are drawn.
 const layer=locks.layer?[26,55].filter(index=>index!==26||config.stripEnabled!==false).map(index=>{const key=layout.keys[index],x=((key.x||0)+key.width/2)*1920/1800,y=((key.y||0)+key.height/2)*550/500,color=config.layerColor||i.on;return `<rect x="${x-44}" y="${y-40}" width="88" height="80" rx="8" fill="${color}" fill-opacity=".65" stroke="${color}" stroke-width="3"/><text x="${x}" y="${y+7}" text-anchor="middle" font-family="Segoe UI,Arial,sans-serif" font-size="30" font-weight="bold" fill="#111820">${index===26?'P':'/'}</text>`;}).join(''):'';
 return `<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="550">${config.stripEnabled===false?'':`<g><rect x="1597" y="5" width="96" height="397" rx="12" fill="${appearance.animated(theme.stripBackground,theme,now)}" fill-opacity=".96" stroke="${theme.border}"/>${rows}${hintSVG(theme.hint)}</g>`}${appearance.capsSVG(i,locks.caps)}${layer}${mediaKeySVG(config,locks,data)}${detailSVG(config,data)}</svg>`;
}
function mediaKeySVG(config,locks,data={}){
 const active=locks.layer?1:0,bindings=data.bindingLayers?.[active];
 return Object.entries(config.keyIcons||{}).map(([id,style])=>{
  const [layer,position]=id.split(':').map(Number);if(layer!==active)return '';
  const binding=bindings?.[position],entry=mediaIcons.find(style.code);
  if(!entry||!binding||binding.behaviorId!==50397||(binding.param1&0xffffff)!==entry.code)return '';
  const key=layout.keys[position];if(!key)return '';
  const x=((key.x||0)+key.width/2)*1920/1800,y=((key.y||0)+key.height/2)*550/500,size=Math.min(50,key.width*1920/1800-16,key.height*550/500-16);
  return `<g data-media-key="${id}"><rect x="${x-size/2-4}" y="${y-size/2-4}" width="${size+8}" height="${size+8}" rx="8" fill="${style.background}" fill-opacity=".97"/><svg x="${x-size/2}" y="${y-size/2}" width="${size}" height="${size}" viewBox="0 0 40 40">${mediaIcons.svg(entry.code,style).replace(/^<svg[^>]*>|<\/svg>$/g,'')}</svg></g>`;
 }).join('');
}
function hintSVG(h){if(h.mode==='hidden')return '';if(h.mode==='default')return '<text x="1645" y="374" text-anchor="middle" fill="#edf2fa" font-family="Arial" font-size="10">PLUGINS</text><text x="1645" y="391" text-anchor="middle" fill="#b8c8dc" font-family="Arial" font-size="12">L1 + P</text>';return `<svg x="1603" y="363" width="84" height="34" overflow="hidden">${appearance.visualSVG({kind:h.mode,...h,align:'center',vertical:'center',paddingX:2,paddingY:1},84,34)}</svg>`;}
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
class StripController extends DisplayCache {constructor(directory){super(directory,configuredSVG);}}
module.exports={SLOTS,stripSVG,configuredSVG,renderStrip,StripController,mediaKeySVG};
