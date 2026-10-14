'use strict';
const fs=require('node:fs'),path=require('node:path');
const {physical,label}=require('./keymap.cjs');
const {languageLabel}=require('./language-labels.js');
const media=require('./media-icons.js');
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
// No opaque rectangles: native legends are switched off only after all replacement
// frames have been uploaded successfully. Positions are read, never rewritten.
function svg(model,config,locks,data){
 if(!model)return '';
 const active=locks.layer?1:0,bindings=data.bindingLayers?.[active]||data.bindingLayers?.[0];
 return model.positions.map((p,i)=>{
  let binding=bindings?.[i];if(binding?.behaviorId===56811)binding=data.bindingLayers?.[0]?.[i];
  let text=binding?label(binding):physical[i];
  if(binding?.behaviorId===54567)text='L'+binding.param1;
  if(text==='XPANEL special action')text=physical[i];
  const custom=config.keyIcons?.[active+':'+i],customEntry=custom&&media.find(custom.code);
  if(customEntry&&binding?.behaviorId===50397&&(binding.param1&0xffffff)===customEntry.code&&(customEntry.mods===undefined||(binding.param1>>>24)===customEntry.mods))return '';
  const icon=binding?.behaviorId===50397?media.find(binding.param1&0xffffff):null;
  if(icon&&(icon.mods===undefined||(binding.param1>>>24)===icon.mods))return `<g data-legend="${i}" transform="translate(${p.x-16} ${p.y-16})">${media.svg(icon.code,{color:'#ffffff',background:'#000000',style:'solid',size:32}).replace(/<svg /,'<svg width="32" height="32" ')}</g>`;
  text=languageLabel(text,model.language,locks);
  const size=Array.from(text).length>3?12:22;
  return `<text data-legend="${i}" x="${p.x}" y="${p.y}" dy=".35em" text-anchor="middle" font-family="Segoe UI,Nirmala UI,Leelawadee UI,Microsoft YaHei,Yu Gothic,Malgun Gothic,Arial,sans-serif" font-weight="bold" font-size="${size}" fill="#ffffff">${escape(text)}</text>`;
 }).join('');
}
class PhysicalLegends{
 constructor(directory){this.file=path.join(directory,'physical-legends-recovery.json');this.model=null;this.session=null;}
 read(som){if(!fs.existsSync(this.file))return null;const record=JSON.parse(fs.readFileSync(this.file,'utf8'));if(record.format!==1||typeof record.enabled!=='boolean'||typeof record.identity!=='string')throw Error('The original legend backup is invalid; language changes are paused.');if(record.identity!==som.identity)throw Error('The legend backup belongs to another keyboard. Reconnect the original keyboard first.');return record;}
 async restore(som){const record=this.read(som);if(record){await som.legends(record.enabled);if(await som.legends()!==record.enabled)throw Error('Could not restore original keyboard legends.');fs.unlinkSync(this.file);}this.model=null;this.session=null;}
 async prepare(som,language){
  if(this.session!==som){await this.restore(som);this.session=som;}
  const positions=await som.legendPositions();
  if(!this.read(som)){const enabled=await som.legends();fs.mkdirSync(path.dirname(this.file),{recursive:true});fs.writeFileSync(this.file,JSON.stringify({format:1,identity:som.identity,enabled}),{flag:'wx',mode:0o600});}
  this.model={positions,language};return this.model;
 }
 async commit(som){await som.legends(false);if(await som.legends()!==false)throw Error('The keyboard did not confirm Companion legend control.');}
}
module.exports={PhysicalLegends,svg};
