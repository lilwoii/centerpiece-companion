const fs=require('node:fs'),path=require('node:path');
const RECOVERABLE_STORAGE_ERRORS=new Set(['EACCES','EPERM','EROFS','ENOENT','ENOTDIR']);

function configuredRoot(bytes){
 const text=bytes?.subarray(0,2).equals(Buffer.from([255,254]))?bytes.toString('utf16le'):bytes?.toString('utf8')||'';
 return text.replace(/^\uFEFF/,'').match(/^[ \t]*UpdateRoot[ \t]*=([^\r\n]*)$/mi)?.[1]?.trim()||null;
}
function readUpdateRoot(bytes,exe){
 const root=configuredRoot(bytes)||path.win32.dirname(exe)+'-updates';
 if(!/^[a-z]:\\/i.test(root)||/[\x00-\x1f]/.test(root))throw Error('Choose a local update folder by running the installer again.');
 return path.win32.join(path.win32.normalize(root),'.centerpiece-companion-updates');
}
function updateStorage(app){
 const exe=app.getPath('exe');
 for(const file of [path.join(app.getPath('userData'),'update-location.ini'),path.join(path.dirname(exe),'install-locations.ini')]){
  try{
   const bytes=fs.readFileSync(file);
   // An empty or damaged user preference must not hide a valid installer setting.
   if(configuredRoot(bytes))return readUpdateRoot(bytes,exe);
  }catch{}
 }
 return readUpdateRoot(undefined,exe);
}
function probeWritable(folder){
 const probe=path.join(folder,'.write-check-'+require('node:crypto').randomUUID());let fd;
 try{fd=fs.openSync(probe,'wx');fs.writeSync(fd,'test');}
 finally{if(fd!==undefined){try{fs.closeSync(fd);}finally{fs.unlinkSync(probe);}}}
}
function checkWritable(base){
 for(const folder of [base,path.join(base,'centerpiece-companion-updater'),path.join(base,'centerpiece-companion-updater','pending'),path.join(base,'temporary')]){
  fs.mkdirSync(folder,{recursive:true});probeWritable(folder);
 }
}
async function chooseWritableStorage(app,current,dialog){
 // Protected custom install folders can also protect their sibling update folder.
 // Use an account-owned cache without replacing the user's preferred location.
 const fallback=path.join(app.getPath('userData'),'.centerpiece-companion-updates');
 for(const base of new Set([current,fallback])){
  try{checkWritable(base);return base;}
  catch(error){if(!RECOVERABLE_STORAGE_ERRORS.has(error.code))throw error;}
 }
 const result=await dialog.showOpenDialog({title:'Choose a writable folder for update downloads',message:'Windows denied access to the saved update folder and your account update cache. Choose a folder you can write to on your preferred drive.',defaultPath:path.dirname(current),properties:['openDirectory','createDirectory']});
 if(result.canceled||!result.filePaths?.length)return null;
 const selected=result.filePaths[0],base=readUpdateRoot(Buffer.from('UpdateRoot='+selected),app.getPath('exe'));
 checkWritable(base);
 fs.writeFileSync(path.join(app.getPath('userData'),'update-location.ini'),'[Storage]\nUpdateRoot='+selected+'\n');
 return base;
}
function prepareUpdateTemp(base){const temp=path.join(base,'temporary');fs.mkdirSync(temp,{recursive:true});probeWritable(temp);return temp;}
module.exports={readUpdateRoot,updateStorage,prepareUpdateTemp,checkWritable,chooseWritableStorage};
