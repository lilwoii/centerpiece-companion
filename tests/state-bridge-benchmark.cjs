'use strict';
// Isolated Electron microbenchmark. No app modules, hardware, accounts or network.
// Run: node_modules/electron/dist/electron.exe tests/state-bridge-benchmark.cjs
const {app,BrowserWindow}=require('electron'),fs=require('node:fs'),path=require('node:path');
const directory=path.resolve(__dirname,'../verification/state-bridge-benchmark-'+process.pid);
fs.mkdirSync(directory,{recursive:true});app.setPath('userData',path.join(directory,'profile'));app.disableHardwareAcceleration();
fs.copyFileSync(path.resolve(__dirname,'../src/companion-api.js'),path.join(directory,'companion-api.js'));
fs.writeFileSync(path.join(directory,'preload.cjs'),`const {contextBridge}=require('electron');
const callbacks=new Set();let reads=0;const state={sequence:0,media:{title:'Synthetic song',artist:'Synthetic artist',art:'data:image/png;base64,'+'A'.repeat(500*1024),position:0,duration:240},desk:{config:{slots:Array.from({length:5},(_,i)=>({plugin:'synthetic-'+i,action:'toggle'})),widget:{type:'clock'},indicator:{enabled:true}},catalog:Array.from({length:100},(_,i)=>({id:'plugin-'+i,name:'Synthetic plugin '+i,category:'Test',actions:Array.from({length:8},(_,j)=>({id:'action-'+j,label:'Synthetic action '+j,enabled:true}))})),locks:{caps:false,shift:false}}};
contextBridge.exposeInMainWorld('companionNative',{subscribe(callback){callbacks.add(callback);return()=>callbacks.delete(callback);},async getState(){reads++;return state;},readCount(){return reads;},run(iterations){const start=performance.now();for(let i=0;i<iterations;i++){state.sequence++;state.media.position=state.sequence%240;for(const callback of callbacks)callback(state);}return performance.now()-start;},count(){return callbacks.size;}});`);
fs.writeFileSync(path.join(directory,'index.html'),'<!doctype html><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; script-src \'self\'"><title>Isolated state bridge benchmark</title><script src="companion-api.js"></script>');
let win;const timeout=setTimeout(()=>{console.error('Isolated state bridge benchmark timed out');app.exit(1);},120000);timeout.unref();
app.whenReady().then(async()=>{
 win=new BrowserWindow({show:false,webPreferences:{preload:path.join(directory,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true,backgroundThrottling:false}});
 win.webContents.session.setPermissionRequestHandler((_w,_p,callback)=>callback(false));
 win.webContents.session.webRequest.onBeforeRequest((details,callback)=>callback({cancel:!details.url.startsWith('file:')}));
 await win.loadFile(path.join(directory,'index.html'));
 const results=await win.webContents.executeJavaScript(`(async()=>{
 const result={subscribers:26,artworkBytes:500*1024,catalogEntries:100,iterationsPerRound:40,rounds:6,legacy:[],adapter:[]};
 for(let round=-1;round<result.rounds;round++)for(const mode of (round%2?['adapter','legacy']:['legacy','adapter'])){
  const api=mode==='adapter'?window.companion:window.companionNative,stops=[];let calls=0,reused=0,last=null,frozen=true,checksum=0;
  for(let i=0;i<result.subscribers;i++)stops.push(api.subscribe(state=>{calls++;if(state===last)reused++;last=state;frozen=frozen&&Object.isFrozen(state)&&Object.isFrozen(state.desk.catalog[0]);checksum+=state.sequence+state.desk.catalog.length+state.media.position;}));
  const nativeCallbacks=window.companionNative.count(),iterations=round<0?5:result.iterationsPerRound,ms=window.companionNative.run(iterations);for(const stop of stops)stop();
  if(calls!==iterations*result.subscribers||!checksum||window.companionNative.count()!==0)throw Error('Benchmark delivery mismatch');
  const beforeReads=window.companionNative.readCount(),readStart=performance.now(),states=await Promise.all(Array.from({length:26},()=>api.getState())),readMs=performance.now()-readStart,nativeReads=window.companionNative.readCount()-beforeReads,distinctReadStates=new Set(states).size;
  if(distinctReadStates!==26)throw Error('State read isolation mismatch');
  states[0].desk.config.slots[0].plugin='mutated';if(states[1].desk.config.slots[0].plugin==='mutated')throw Error('State mutation leaked');
  if(reused!==0)throw Error('Subscriber state reused');
  if(round>=0)result[mode].push({ms,nativeCallbacks,calls,reused,frozen,readMs,nativeReads,distinctReadStates});
  await new Promise(resolve=>setTimeout(resolve,0));
 }
 for(const mode of ['legacy','adapter']){const values=result[mode].map(r=>r.ms/result.iterationsPerRound).sort((a,b)=>a-b),reads=result[mode].map(r=>r.readMs).sort((a,b)=>a-b);result[mode+'MedianMsPerBroadcast']=(values[2]+values[3])/2;result[mode+'MedianMsPer26InitialReads']=(reads[2]+reads[3])/2;}
 result.speedup=result.legacyMedianMsPerBroadcast/result.adapterMedianMsPerBroadcast;return result;
})()`);
 fs.writeFileSync(path.join(directory,'results.json'),JSON.stringify(results,null,2));
 console.log(JSON.stringify({directory,...results},null,2));clearTimeout(timeout);win.destroy();app.quit();
}).catch(error=>{console.error(error.stack);app.exit(1);});
