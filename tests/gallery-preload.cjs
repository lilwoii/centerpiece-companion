const {contextBridge}=require('electron');
const methods=Object.fromEntries([...require('node:fs').readFileSync(require('node:path').join(__dirname,'../src/preload.cjs'),'utf8').matchAll(/^\s+(\w+):/gm)].map(m=>[m[1],()=>Promise.resolve()]));
methods.getState=()=>Promise.reject(Error('Gallery-only verification; hardware is not connected.'));
methods.subscribe=methods.subscribeWindow=methods.subscribeKey=()=>()=>{};
contextBridge.exposeInMainWorld('companion',methods);
