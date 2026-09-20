const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const NAMES=['SkinApi','SkinStudioDeviceBuilder'];
const FILES=NAMES.flatMap(n=>[`${n}/Binaries/Win64/UE4Editor-${n}.dll`,`${n}/Binaries/Win64/UE4Editor.modules`]);
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
function sourceFingerprint(bundle){const hash=crypto.createHash('sha256');for(const f of bundle.files.filter(f=>f.path.startsWith('Device/Plugins/')&&/\.(?:h|inl|cpp|cs|uplugin)$/.test(f.path)).sort((a,b)=>a.path.localeCompare(b.path))){hash.update(f.path+'\0');hash.update(f.content);hash.update('\0');}return hash.digest('hex');}
function read(root,relative,max=20*1048576){const file=path.resolve(root,relative);if(!file.startsWith(path.resolve(root)+path.sep))throw Error('Invalid editor tool path.');let at=path.resolve(root);if(fs.lstatSync(at).isSymbolicLink())throw Error('Editor tool bundles cannot be links.');for(const part of relative.split('/')){at=path.join(at,part);if(fs.lstatSync(at).isSymbolicLink())throw Error('Editor tool files cannot be links.');}const stat=fs.statSync(file);if(!stat.isFile()||stat.size>max)throw Error('Invalid editor tool file.');return fs.readFileSync(file);}
function inspect(root,expected){try{
 const manifest=JSON.parse(read(root,'manifest.json',65536));if(manifest.format!==1||manifest.sourceSha256!==expected.sourceSha256||manifest.engineBuildId!==expected.engineBuildId||manifest.engineVersion!=='4.27.2'||!Array.isArray(manifest.files)||manifest.files.length!==FILES.length)return null;
 const files=[];for(const name of FILES){const entry=manifest.files.find(f=>f.path===name);if(!entry)return null;const bytes=read(root,name);if(entry.sha256!==sha(bytes)||entry.size!==bytes.length)return null;if(name.endsWith('.modules')){const mod=JSON.parse(bytes);const moduleName=name.split('/')[0];if(mod.BuildId!==expected.engineBuildId||mod.Modules?.[moduleName]!==`UE4Editor-${moduleName}.dll`)return null;}files.push({path:name,bytes});}return{manifest,files};
 }catch{return null;}}
function install(bundle,device){for(const file of bundle.files){const dest=path.join(device,'Plugins',file.path);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,file.bytes,{flag:'wx'});}}
function capture(device,root,expected){
 if(fs.existsSync(root)){const existing=inspect(root,expected);if(existing)return existing;return null;}
 const files=FILES.map(name=>({path:name,bytes:read(path.join(device,'Plugins'),name)}));
 const manifest={format:1,engineVersion:'4.27.2',engineBuildId:expected.engineBuildId,sourceSha256:expected.sourceSha256,sourceLicense:'MIT',distribution:'Local editor-tool cache. Unreal Engine licensing also applies; not approved for public redistribution.',files:files.map(f=>({path:f.path,size:f.bytes.length,sha256:sha(f.bytes)}))};
 fs.mkdirSync(root,{recursive:true});for(const f of files){const dest=path.join(root,f.path);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,f.bytes,{flag:'wx'});}fs.writeFileSync(path.join(root,'manifest.json'),JSON.stringify(manifest,null,2)+'\n',{flag:'wx'});return inspect(root,expected);
}
module.exports={sourceFingerprint,inspect,install,capture,FILES};
