const fs=require('node:fs'),path=require('node:path');
const url='https://music.youtube.com/';
const executable=/^(?:youtube[ -]?music(?:[ -]desktop(?:[ -]app)?)?|ytmdesktop)\.exe$/i;
function findDesktop(shell,{env=process.env,io=fs}={}){
 const roots=[env.APPDATA&&path.join(env.APPDATA,'Microsoft','Windows','Start Menu','Programs'),env.ProgramData&&path.join(env.ProgramData,'Microsoft','Windows','Start Menu','Programs')].filter(Boolean);
 const pending=roots.map(dir=>({dir,depth:0}));let visited=0;
 while(pending.length&&visited++<200){
  const {dir,depth}=pending.shift();let entries;try{entries=io.readdirSync(dir,{withFileTypes:true});}catch{continue;}
  for(const item of entries){const file=path.join(dir,item.name);
   if(item.isDirectory()&&depth<3){pending.push({dir:file,depth:depth+1});continue;}
   if(!item.isFile()||!/^(?:youtube[ -]?music(?:[ -]desktop(?:[ -]app)?)?|ytmdesktop)\.lnk$/i.test(item.name))continue;
   try{const link=shell.readShortcutLink(file);if(executable.test(path.win32.basename(link.target))&&path.win32.isAbsolute(link.target)&&io.existsSync(link.target))return file;}catch{}
  }
 }
 return null;
}
async function launch(shell,options={}){
 const target=require('./music-source.cjs').validateTarget(options.target);
 if(target==='web'){await shell.openExternal(url);return 'browser';}
 const desktop=findDesktop(shell,options);
 if(desktop){const error=await shell.openPath(desktop);if(error)throw Error('YouTube Music was found but could not open. Try opening it from the Windows Start menu.');return 'desktop';}
 if(target==='desktop')throw Error('YouTube Music desktop is not installed. Choose Auto or Web to open music.youtube.com in your browser.');
 await shell.openExternal(url);return 'browser';
}
module.exports={launch,findDesktop};
