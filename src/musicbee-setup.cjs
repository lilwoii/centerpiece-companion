const fs=require('node:fs/promises'),path=require('node:path'),{createHash,randomUUID}=require('node:crypto'),{execFile}=require('node:child_process'),{promisify}=require('node:util');
const RELEASE=Object.freeze({version:'1.0',url:'https://github.com/HenryPDT/mb_MediaControl/releases/download/1.0/mb_MediaControl.dll',sha256:'bd9b6eb5649c2432c65438e4cd5c78ef1b620acdd3fca5ba69e2ff8770b8d5a9',file:'mb_MediaControl.dll'});
const hash=b=>createHash('sha256').update(b).digest('hex');
async function discover(){
 const {stdout}=await promisify(execFile)('powershell.exe',['-NoProfile','-NonInteractive','-Command',"[Console]::OutputEncoding=New-Object System.Text.UTF8Encoding($false); @(Get-Process MusicBee -ErrorAction SilentlyContinue | ForEach-Object {$_.Path} | Where-Object {$_} | Select-Object -Unique) | ConvertTo-Json -Compress"],{windowsHide:true,timeout:10000,maxBuffer:65536});
 const value=stdout.trim()?JSON.parse(stdout):[];return Array.isArray(value)?value:[value];
}
async function destination(executables,env=process.env){
 const files=[...new Set(executables.map(p=>path.resolve(p)))];
 if(files.length!==1)throw Error(files.length?'Close the extra MusicBee installation, then try setup again.':'Open MusicBee, then add its plugin or apply its widget again.');
 const exe=files[0];if(path.basename(exe).toLowerCase()!=='musicbee.exe')throw Error('Could not verify the MusicBee installation.');
 const root=path.dirname(exe),store=/[\\/]WindowsApps[\\/]50072StevenMayall\.MusicBee_[^\\/]+[\\/]/i.test(exe);
 let directory,kind;
 if(store){if(!env.LOCALAPPDATA)throw Error('Windows local app-data folder is unavailable.');directory=path.join(env.LOCALAPPDATA,'Packages','50072StevenMayall.MusicBee_kcr266et74avj','LocalCache','Roaming','MusicBee','Plugins');kind='Microsoft Store';}
 else{
  const portable=await fs.stat(path.join(root,'MusicBee3Settings.ini')).then(s=>s.isFile()).catch(()=>false);
  if(portable){directory=path.join(root,'Plugins');kind='Portable';}
  else{if(!env.APPDATA)throw Error('Windows app-data folder is unavailable.');directory=path.join(env.APPDATA,'MusicBee','Plugins');kind='Desktop';}
 }
 return{directory,kind};
}
async function download(fetcher=fetch,release=RELEASE){
 const response=await fetcher(release.url,{signal:AbortSignal.timeout(30000)});
 if(!response.ok)throw Error('MusicBee setup download failed. Check your connection and try again.');
 const limit=8*1024*1024;if(Number(response.headers.get('content-length'))>limit)throw Error('MusicBee setup download exceeded its size limit.');
 const chunks=[];let size=0;for await(const chunk of response.body){size+=chunk.length;if(size>limit)throw Error('MusicBee setup download exceeded its size limit.');chunks.push(Buffer.from(chunk));}
 const bytes=Buffer.concat(chunks);if(hash(bytes)!==release.sha256)throw Error('MusicBee setup checksum did not match. Nothing was installed.');
 if(bytes.length<64||bytes[0]!==0x4d||bytes[1]!==0x5a)throw Error('MusicBee setup file is not a Windows plugin.');return bytes;
}
async function install({find=discover,env=process.env,fetcher=fetch,release=RELEASE}={}){
 const target=await destination(await find(),env),file=path.join(target.directory,release.file);
 const existing=await fs.readFile(file).catch(e=>{if(e.code!=='ENOENT')throw e;return null;});
 if(existing){if(hash(existing)!==release.sha256)throw Error('A different Media Control version is already installed. Existing files were kept. Enable it in MusicBee Preferences → Plugins, then restart MusicBee.');return{installed:true,kind:target.kind,message:'Media Control is already installed. Restart MusicBee if it is not connected yet.'};}
 const bytes=await download(fetcher,release);await fs.mkdir(target.directory,{recursive:true});
 const temporary=path.join(target.directory,'.companion-media-'+randomUUID()+'.tmp');
 try{await fs.writeFile(temporary,bytes,{flag:'wx'});if(hash(await fs.readFile(temporary))!==release.sha256)throw Error('MusicBee setup verification failed.');await fs.copyFile(temporary,file,require('node:fs').constants.COPYFILE_EXCL);}
 finally{await fs.unlink(temporary).catch(()=>{});}
 return{installed:true,kind:target.kind,message:'Media Control installed for '+target.kind+'. Restart MusicBee, then play a track. If prompted, enable Media Control in Preferences → Plugins.'};
}
let pending;function setup(){if(!pending)pending=install().finally(()=>{pending=null;});return pending;}
module.exports={RELEASE,discover,destination,download,install,setup};
