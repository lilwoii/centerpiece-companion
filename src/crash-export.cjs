const fs=require('node:fs'),path=require('node:path');
async function save(file,report,dumpRoot){
 const candidates=[],warnings=[];let dumpCount=0;
 for(const folder of ['reports','pending','completed']){const directory=path.join(dumpRoot,folder);let entries=[];try{entries=await fs.promises.readdir(directory,{withFileTypes:true});}catch{}for(const entry of entries){if(!entry.isFile()||!entry.name.endsWith('.dmp'))continue;const source=path.join(directory,entry.name);try{const info=await fs.promises.stat(source);if(info.size<=20*1024*1024)candidates.push({source,name:entry.name,mtime:info.mtimeMs});}catch{}}}
 for(const item of candidates.sort((a,b)=>b.mtime-a.mtime).slice(0,5)){try{await fs.promises.mkdir(file+'.dumps',{recursive:true});await fs.promises.copyFile(item.source,path.join(file+'.dumps',dumpCount+'-'+item.name));dumpCount++;}catch(error){warnings.push(error.message);}}
 await fs.promises.writeFile(file,JSON.stringify({...report,nativeAppDumps:{copied:dumpCount,warnings,privacy:'Optional native app dumps are stored in the adjacent .dumps folder. They may contain process memory; share privately. Keyboard firmware dumps are not available.'}},null,2));
 return{dumpCount};
}
module.exports={save};
