const fs=require('node:fs'),path=require('node:path'),{createHash}=require('node:crypto');
const{pendingChanges}=require('./studio-response.cjs');
const digest=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
function setupRecord(directory){try{const m=JSON.parse(fs.readFileSync(path.join(directory,'hardware.json'),'utf8'));return{present:true,verified:m.verified===true,restored:m.restored===true};}catch{return{present:false};}}
async function collectSetupReport({version,directory,Studio=require('./studio.cjs').Studio,inspect=require('./device.cjs').inspectDevice,wait=ms=>new Promise(r=>setTimeout(r,ms))}){
 const report={format:1,appVersion:version,platform:process.platform,architecture:process.arch,readOnly:true,setup:setupRecord(directory),interfaces:{},pendingSamples:[],queries:[],classification:'not_checked'};
 try{const d=await inspect(true);report.interfaces={keyboard:!!d.keyboard,display:!!d.display};for(const k of ['keyboardVersion','displayVersion'])if(typeof d[k]==='string')report[k]=d[k].replace(/[^\w. +()\/-]/g,'').slice(0,100);for(const k of ['keyboardError','displayError'])if(d[k])report.queries.push({query:k,status:'failed'});}catch{report.queries.push({query:'device_versions',status:'failed'});}
 let studio;const read=async(name,fn)=>{try{const value=await fn();report.queries.push({query:name,status:'ok'});return value;}catch(e){report.queries.push({query:name,status:'failed',code:['STUDIO_META_ERROR','STUDIO_RESPONSE_MISMATCH','STUDIO_INVALID_PENDING_STATUS'].includes(e.code)?e.code:'QUERY_FAILED'});return null;}};
 try{studio=new Studio();for(let n=0;n<3;n++){report.pendingSamples.push(await read('pending_changes',()=>pendingChanges(studio)));if(n<2)await wait(200);}
  const maps=[];for(let n=0;n<2;n++){const map=await read('keymap',async()=>{const m=(await studio.request({keymap:{getKeymap:true}}))?.keymap?.getKeymap;if(!Array.isArray(m?.layers)||!m.layers.every(l=>Array.isArray(l.bindings)))throw Error('Invalid keymap');return m;});if(map)maps.push(map);}
  if(maps.length){const m=maps[0];report.keymap={layers:m.layers.slice(0,32).map(l=>({id:l.id||0,keys:l.bindings.length})),stable:maps.length===2?digest(maps[0])===digest(maps[1]):null};const layer=m.layers.find(l=>l.id===1),base=m.layers.find(l=>(l.id||0)===0);report.compatibility={layout68:base?.bindings.length===68&&layer?.bindings.length===68,l1Layer:base?.bindings[63]?.param1===1,pluginKey:layer?.bindings[26]?.behaviorId===60498?'stock':layer?.bindings[26]?.behaviorId===50397&&layer?.bindings[26]?.param1===0x05070013?'companion':'other'};}
  const layouts=await read('physical_layouts',async()=>{const r=(await studio.request({keymap:{getPhysicalLayouts:true}}))?.keymap?.getPhysicalLayouts;if(!Array.isArray(r?.layouts))throw Error('Invalid layout');return r;});if(layouts)report.physicalLayouts={activeIndex:layouts.activeLayoutIndex||0,keyCounts:layouts.layouts.slice(0,32).map(l=>l.keys?.length||0)};
  report.classification=report.pendingSamples.some(v=>v===null)?'query_failed':report.pendingSamples.every(v=>v===true)?'pending_reported_consistently':report.pendingSamples.every(v=>v===false)?'no_pending_reported':'pending_status_changed';
 }catch{report.classification='keyboard_query_unavailable';}finally{studio?.close();}
 return report;
}
module.exports={collectSetupReport};
