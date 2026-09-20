const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{spawn,execFile}=require('node:child_process');
const M=require('../studio/model.js'),NativeTools=require('./studio-native-tools.cjs');
const MAX_PAK=128*1024*1024,MAX_LOG=32*1024*1024;
const VALIDATION_REVISION=5;
const TERMINAL=new Set(['ready','failed','cancelled']);
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
function failure(code,message){return Object.assign(Error(message),{code});}
function toolFailure(tail,code){
 const missing=/fatal error C1083: Cannot open include file: ['"]([^'"\r\n]+)['"]/.exec(tail);
 if(missing)return failure('STUDIO_BUILD_SOURCE_MISSING','A required native source file is missing: '+missing[1]+'. Restart the companion after updating, then rebuild. Your editable skin was kept.');
 if(/Windows SDK must be installed/i.test(tail))return failure('STUDIO_BUILD_WINDOWS_SDK','Windows SDK is missing or its installation has not finished. Complete the C++ build tools installation, then retry.');
 if(/enumerating Visual Studio toolchains|No Visual C\+\+ installation|Visual Studio.*must be installed/i.test(tail))return failure('STUDIO_BUILD_COMPILER','Unreal could not find a compatible Visual Studio C++ toolchain. Complete the editor build tools installation, then retry.');
 const compiler=/(?:fatal )?error (?:C\d{4}|LNK\d{4}):[^\r\n]{1,280}/.exec(tail);
 if(compiler)return failure('STUDIO_BUILD_SOURCE','Native compilation stopped: '+compiler[0]+'. The full details are saved in the build log; your editable skin was kept.');
 return failure('STUDIO_BUILD_TOOL_FAILED','The native build step failed (exit '+code+'). Check the saved build log.');
}
function validateSourceBundle(bundle){
 const files=new Set(bundle.files.map(entry=>entry.path));
 for(const entry of bundle.files){
  if(entry.path.startsWith('Device/Tools/')&&entry.path.endsWith('.py')){
   for(const match of String(entry.content).matchAll(/^\s*(?:import|from)\s+(device_[a-z_]+)\b/gm)){
    if(!files.has('Device/Tools/'+match[1]+'.py'))throw failure('STUDIO_BUILD_SOURCE_MISSING','The native source bundle is incomplete: '+match[1]+'.py is missing. Restart the companion after updating, then rebuild. Your editable skin was kept.');
   }
  }
  if(!entry.path.startsWith('Device/')||! /\.(?:cpp|h|inl)$/.test(entry.path))continue;
  for(const match of String(entry.content).matchAll(/^\s*#include\s+"([^"\r\n]+\.inl)"/gm)){
   const expected=path.posix.normalize(path.posix.join(path.posix.dirname(entry.path),match[1]));
   if(!files.has(expected))throw failure('STUDIO_BUILD_SOURCE_MISSING','The native source bundle is incomplete: '+match[1]+' is missing. Restart the companion after updating, then rebuild. Your editable skin was kept.');
  }
 }
 return bundle;
}
function noLinks(file){let current=path.parse(path.resolve(file)).root;for(const part of path.resolve(file).slice(current.length).split(path.sep).filter(Boolean)){current=path.join(current,part);if(fs.existsSync(current)&&fs.lstatSync(current).isSymbolicLink())throw failure('STUDIO_BUILD_PATH','Native build folders cannot contain links or junctions.');}}
function inside(root,relative){const file=path.resolve(root,relative);if(!file.startsWith(root+path.sep))throw failure('STUDIO_BUILD_PATH','Invalid build file path.');noLinks(file);return file;}
function saveJson(file,value){const temp=file+'.'+crypto.randomUUID()+'.tmp';fs.writeFileSync(temp,JSON.stringify(value,null,2)+'\n',{flag:'wx'});try{fs.renameSync(temp,file);}catch(error){try{fs.unlinkSync(temp);}catch{}throw error;}}
function hashFile(file){const stat=fs.statSync(file);if(!stat.isFile()||stat.size<221||stat.size>MAX_PAK)throw failure('STUDIO_PAK_SIZE','The generated package is empty or exceeds 128 MB.');return{size:stat.size,sha256:crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')};}
function run(executable,args,{cwd,logFile,signal,timeoutMs=20*60*1000,onOutput=()=>{}}){
 return new Promise((resolve,reject)=>{
  if(signal?.aborted)return reject(failure('STUDIO_BUILD_CANCELLED','Build cancelled.'));
  const fd=fs.openSync(logFile,'wx');let size=0,tail='',settled=false,forcedError=null,materialError=null,reportedError=null;const scanTails={stdout:'',stderr:''};
  const child=spawn(executable,args,{cwd,windowsHide:true,shell:false,stdio:['ignore','pipe','pipe']});
  const stop=()=>{if(process.platform==='win32'&&child.pid)execFile('taskkill.exe',['/PID',String(child.pid),'/T','/F'],{windowsHide:true},()=>{});else child.kill('SIGTERM');};
  const cancel=()=>{forcedError=failure('STUDIO_BUILD_CANCELLED','Build cancelled.');stop();};
  const timer=setTimeout(()=>{forcedError=failure('STUDIO_BUILD_TIMEOUT','This build step exceeded its time limit. The diagnostic log was kept.');stop();},timeoutMs);
  signal?.addEventListener('abort',cancel,{once:true});
  const finish=(error)=>{if(settled)return;settled=true;clearTimeout(timer);signal?.removeEventListener('abort',cancel);fs.closeSync(fd);error?reject(error):resolve({tail});};
  const output=(chunk,stream)=>{if(settled)return;size+=chunk.length;if(size>MAX_LOG){forcedError=failure('STUDIO_BUILD_LOG_LIMIT','The native tool produced an unusually large log. Build stopped; diagnostics were kept.');stop();return;}try{fs.writeSync(fd,chunk);const scan=scanTails[stream]+chunk.toString('utf8');if(/Failed to compile Material|Default Material will be used in game/i.test(scan))materialError=failure('STUDIO_BUILD_MATERIAL','A skin material failed to compile. Unreal would replace it with a blank or default surface, so this build was stopped. The saved build log contains the shader error.');if(/was pruned because its Exec pin is not connected|connected value is not available and will instead be read as default/i.test(scan))materialError=failure('STUDIO_BUILD_BLUEPRINT','An interaction connection did not compile correctly. Build stopped to prevent a skin with inactive effects. The saved build log identifies the connection.');if(!reportedError&&/(?:fatal )?error (?:C\d{4}|LNK\d{4}):[^\r\n]+\r?\n/.test(scan))reportedError=toolFailure(scan,1);const runtimeMessage=/RuntimeError: ([^\r\n]{1,500})(?:\r?\n)/.exec(scan);if(runtimeMessage)reportedError=failure('STUDIO_BUILD_SCENE',runtimeMessage[1].replace(/[\x00-\x1f]/g,' ').trim());if(!reportedError&&/Could not save memory cache/.test(scan))reportedError=failure('STUDIO_BUILD_CACHE','Unreal could not save its local build cache. Close other Unreal build processes and retry. Your editable scene was kept.');scanTails[stream]=scan.slice(-768);tail=(tail+chunk.toString('utf8')).slice(-4096);onOutput(tail);}catch(error){forcedError=error;stop();}};
  child.stdout.on('data',chunk=>output(chunk,'stdout'));child.stderr.on('data',chunk=>output(chunk,'stderr'));
  child.on('error',()=>finish(failure('STUDIO_BUILD_TOOL_START','A native build tool could not start. Check the Unreal installation and C++ build tools.')));
  child.on('close',code=>finish(forcedError||materialError||(code!==0?(reportedError||toolFailure(tail,code)):null)));
 });
}
function toolPaths(folder){const root=path.resolve(folder);const paths={build:path.join(root,'Engine/Binaries/DotNET/UnrealBuildTool.exe'),editor:path.join(root,'Engine/Binaries/Win64/UE4Editor-Cmd.exe'),pak:path.join(root,'Engine/Binaries/Win64/UnrealPak.exe')};for(const file of Object.values(paths))if(!fs.existsSync(file))throw failure('STUDIO_BUILD_TOOLS','The Unreal 4.27 installation is missing a build, cook or package tool. Verify it in Epic Games Launcher.');return paths;}
function cookFiles(cookedRoot){
 const files=[];function visit(folder){for(const item of fs.readdirSync(folder,{withFileTypes:true})){const file=path.join(folder,item.name);if(item.isSymbolicLink())throw failure('STUDIO_BUILD_PATH','Cooked files cannot contain links.');if(item.isDirectory())visit(file);else if(item.isFile()){const rel=path.relative(cookedRoot,file).split(path.sep).join('/');if(!/^[A-Za-z0-9_./-]+\.(?:uasset|uexp|ubulk|umap|ufont)$/.test(rel))throw failure('STUDIO_COOK_CONTENT','An unexpected file appeared in cooked skin content.');files.push({file,relative:rel});if(files.length>5000)throw failure('STUDIO_COOK_CONTENT','This skin contains too many cooked files.');}}}noLinks(cookedRoot);visit(cookedRoot);if(!files.some(f=>f.relative==='map/M_EntryPoint.umap'))throw failure('STUDIO_ENTRY_MAP','The cook did not produce the required keyboard entry map.');return files.sort((a,b)=>a.relative.localeCompare(b.relative));
}
class StudioBuilder{
 constructor(directory,options={}){this.directory=path.resolve(directory);this.workDirectory=path.resolve(options.workDirectory||require('node:path').join(require('node:os').tmpdir(),'CCB'));noLinks(this.workDirectory);noLinks(this.directory);fs.mkdirSync(this.directory,{recursive:true});this.detect=options.detect||require('./unreal-tools.cjs').detect;this.runner=options.run||run;this.exporter=options.exporter||(project=>{const source=require.resolve('../studio/export.cjs');delete require.cache[source];return require(source).exportBundle(project);});this.inspect=options.inspect||require('./pak-inspector.cjs').inspectPak;this.onProgress=options.onProgress||(()=>{});this.jobs=new Map();this.active=null;}
 public(job){return{id:job.id,state:job.state,stage:job.stage,label:job.label,projectName:job.projectName,sceneSha256:job.sceneSha256,createdAt:job.createdAt,updatedAt:job.updatedAt,error:job.error||null,artifact:job.artifact?{validationRevision:job.artifact.validationRevision,name:job.artifact.name,size:job.artifact.size,sha256:job.artifact.sha256,deviceVerified:false}:null};}
 record(job){job.updatedAt=Date.now();saveJson(path.join(job.folder,'job.json'),this.public(job));try{this.onProgress(this.public(job));}catch{}}
 async start(input){
  if(this.active)throw failure('STUDIO_BUILD_BUSY','A native skin build is already running. Wait or cancel it first.');
  const project=M.validate(input);if(project.engineTarget!=='4.27')throw failure('STUDIO_BUILD_ENGINE','Select Unreal 4.27 for a keyboard skin. UE5 cooked assets are not compatible with this target.');
  const capabilities=require('../studio/native-compatibility.cjs').describe(project);
  if(capabilities.previewOnlyScenes.length)throw failure('STUDIO_BUILD_PREVIEW_SCENE','This release supports these scenes in the app preview only: '+capabilities.previewOnlyScenes.join(', ')+'. Keep the editable project for a future update, or choose a supported skin to build for your keyboard.');
  if(capabilities.previewOnlyBehaviors.includes('beat-events'))throw failure('STUDIO_BUILD_PREVIEW_BEAT','Test beat is an app-preview trigger, not a live music connection. Change those interactions to a key press or another supported keyboard trigger before building. Your project has not been changed.');
  const json=JSON.stringify(project,null,2)+'\n';if(Buffer.byteLength(json)>M.limits.projectBytes)throw failure('STUDIO_BUILD_SIZE','Choose a project smaller than 32 MB.');
  const id=crypto.randomUUID(),folder=inside(this.directory,id);fs.mkdirSync(folder,{recursive:false});
  const job={id,folder,state:'queued',stage:'prepare',label:'Preparing native build',projectName:project.name,sceneSha256:crypto.createHash('sha256').update(json).digest('hex'),createdAt:Date.now(),controller:new AbortController()};
  this.active=id;this.jobs.set(id,job);this.record(job);job.promise=this.execute(job,project).catch(error=>{job.state=error.code==='STUDIO_BUILD_CANCELLED'?'cancelled':'failed';job.label=job.state==='cancelled'?'Build cancelled':'Native build needs attention';job.error={code:error.code||'STUDIO_BUILD_FAILED',message:error.code?error.message:'The native build could not finish. Your Studio project was kept.'};this.record(job);}).finally(()=>{if(this.active===id)this.active=null;});return this.public(job);
 }
 editableSource(sceneSha256){
  const job=this.latest(sceneSha256);if(!job||job.state!=='ready')throw failure('STUDIO_BUILD_NOT_READY','Build this skin with Test on keyboard → Build for your keyboard first. Then open its generated project in Unreal.');
  this.artifact(job.id,sceneSha256);let folder=this.jobs.get(job.id)?.workFolder;
  if(!folder){try{folder=JSON.parse(fs.readFileSync(inside(this.directory,job.id+'/source-workspace.json'),'utf8')).folder;}catch{}}
  if(typeof folder!=='string'||path.dirname(path.resolve(folder))!==this.workDirectory||!/^b-[A-Za-z0-9]+$/.test(path.basename(folder)))throw failure('STUDIO_BUILD_SOURCE_MISSING','This build’s editable source is no longer available. Rebuild the skin to create a fresh Unreal project.');
  noLinks(folder);if(!fs.existsSync(path.join(folder,'Device/Content/map/M_EntryPoint.umap')))throw failure('STUDIO_BUILD_SOURCE_MISSING','The generated Unreal map is missing. Rebuild this skin.');return{folder,id:job.id};
 }
 async execute(job,project){
  const tools=await this.detect();if(!tools.engine427Found)throw failure('STUDIO_BUILD_ENGINE','Install Unreal 4.27 in Epic Games Launcher before building.');
  const paths=toolPaths(tools.engines?.find(e=>e.keyboardTarget)?.folder||tools.engineFolder);
  const bundle=validateSourceBundle(await require('./studio-text.cjs').prepareTextAssets(await this.exporter(project),project));
  const sourceSha256=NativeTools.sourceFingerprint(bundle);let engineBuildId='';try{engineBuildId=JSON.parse(fs.readFileSync(path.join(path.dirname(paths.editor),'UE4Editor.modules'),'utf8')).BuildId;}catch{}
  const expected={sourceSha256,engineBuildId};
  const cache=typeof engineBuildId==='string'&&/^[A-Za-z0-9_-]{1,100}$/.test(engineBuildId)?inside(this.directory,'editor-tools/'+sourceSha256+'-'+engineBuildId):null;
  const prepared=cache&&NativeTools.inspect(cache,expected);
  if(!prepared&&!tools.windowsCppFound)throw failure('STUDIO_BUILD_COMPILER','Matching prepared editor tools are not available for this source version. Install Visual Studio 2019 C++ build tools to compile them.');
  fs.mkdirSync(this.workDirectory,{recursive:true});job.workFolder=fs.mkdtempSync(path.join(this.workDirectory,'b-'));
  saveJson(inside(job.folder,'source-workspace.json'),{folder:job.workFolder});
  for(const entry of bundle.files){if(!entry.path.startsWith('Device/')&&!entry.path.startsWith('project/'))continue;const file=inside(job.workFolder,entry.path);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,entry.content,{encoding:entry.encoding==='base64'?'base64':'utf8',flag:'wx'});}
  const device=inside(job.workFolder,'Device'),uproject=path.join(device,'CenterpieceDevice.uproject');
  const stage=async(name,label,executable,args)=>{if(job.controller.signal.aborted)throw failure('STUDIO_BUILD_CANCELLED','Build cancelled.');job.state='building';job.stage=name;job.label=label;this.record(job);await this.runner(executable,args,{cwd:device,logFile:path.join(job.folder,name+'.log'),signal:job.controller.signal});};
  if(prepared){job.stage='compile';job.label='Using prepared native editor tools';this.record(job);NativeTools.install(prepared,device);}
  else{await stage('compile','Compiling native editor tools',paths.build,['UE4Editor','Win64','Development','-Project='+uproject,'-WaitMutex','-NoHotReload','-NoUBTMakefiles','-NoPCH','-NoSharedPCH','-MaxParallelActions=2']);if(cache)NativeTools.capture(device,cache,expected);}
  await stage('generate','Creating native scene and interactions',paths.editor,[uproject,'-run=pythonscript','-script='+path.join(device,'Tools/generate_device.py'),'-unattended','-nop4','-NullRHI','-stdout','-UTF8Output']);
  const generated=inside(device,'Saved/StudioDeviceGeneration.json');let report;try{report=JSON.parse(fs.readFileSync(generated,'utf8'));}catch{throw failure('STUDIO_BUILD_GENERATOR','The scene generator did not produce its completion report.');}
  if(report.sourceSceneSha256!==job.sceneSha256||report.inputBlueprintCompiled!==true)throw failure('STUDIO_BUILD_GENERATOR','The generated scene does not match this project or its input Blueprint did not compile.');
  await stage('cook','Cooking Android keyboard assets',paths.editor,[uproject,'-run=Cook','-TargetPlatform=Android_ASTC','-Map=/Game/map/M_EntryPoint','-unattended','-nop4','-NullRHI','-stdout','-UTF8Output','-UnVersioned']);
  const content=inside(device,'Saved/Cooked/Android_ASTC/CenterpieceDevice/Content'),files=cookFiles(content),response=inside(job.folder,'pak-response.txt');
  fs.writeFileSync(response,files.map(f=>'"'+f.file+'" "../../../spark/Content/'+f.relative+'"').join('\n')+'\n',{flag:'wx'});
  const pak=inside(job.folder,'skin.pak');await stage('package','Packaging the cooked skin',paths.pak,[pak,'-Create='+response,'-compress','-compressionformats=Zlib']);
  await stage('verify','Verifying package integrity',paths.pak,[pak,'-Test']);
  const meta=hashFile(pak),inspection=this.inspect(pak);if(!require('./studio-pak.cjs').contentPaths(inspection))throw failure('STUDIO_BUILD_VERIFY','The generated package did not pass its content checks.');
  const artifact={format:1,validationRevision:VALIDATION_REVISION,id:job.id,name:'skin.pak',sceneSha256:job.sceneSha256,...meta,target:'Android_ASTC',entryMap:'/Game/map/M_EntryPoint',editorCompiled:true,blueprintCompiled:true,cooked:true,packageIntegrityVerified:true,deviceVerified:false,generatedAt:Date.now()};
  saveJson(inside(job.folder,'artifact.json'),artifact);job.artifact=artifact;job.state='ready';job.stage='ready';job.label='Package built · ready for controlled keyboard testing';this.record(job);
 }
 status(id){if(!UUID.test(id||''))throw failure('STUDIO_BUILD_ID','Choose a native build.');const live=this.jobs.get(id);if(live)return this.public(live);const folder=inside(this.directory,id);let saved;try{saved=JSON.parse(fs.readFileSync(path.join(folder,'job.json'),'utf8'));}catch{throw failure('STUDIO_BUILD_MISSING','This build could not be found.');}if(saved.id!==id)throw failure('STUDIO_BUILD_ID','The saved build record is invalid.');if(!TERMINAL.has(saved.state))return{...saved,state:'failed',label:'Build interrupted',error:{code:'STUDIO_BUILD_INTERRUPTED',message:'The app closed before this build finished. Start a fresh build from your saved Studio project.'}};if(saved.state==='ready'&&saved.artifact?.validationRevision!==VALIDATION_REVISION)return{...saved,state:'failed',label:'Rebuild needed',error:{code:'STUDIO_BUILD_OUTDATED',message:'This package predates the corrected native build checks. Build your saved scene again before testing it on the keyboard.'}};return saved;}
 latest(sceneSha256){if(sceneSha256!==undefined&&!/^[a-f0-9]{64}$/.test(sceneSha256))throw failure('STUDIO_BUILD_SCENE','Choose a valid saved scene.');if(this.active){const current=this.status(this.active);if(!sceneSha256||current.sceneSha256===sceneSha256)return current;}const results=[];for(const entry of fs.readdirSync(this.directory,{withFileTypes:true}).filter(e=>e.isDirectory()&&UUID.test(e.name)).slice(0,1000)){try{const file=inside(this.directory,entry.name+'/job.json');if(fs.statSync(file).size>32768)continue;const value=this.status(entry.name);if(Number.isSafeInteger(value.createdAt)&&value.createdAt>0&&(!sceneSha256||value.sceneSha256===sceneSha256))results.push(value);}catch{}}return results.sort((a,b)=>b.createdAt-a.createdAt)[0]||null;}
 cancel(id){const job=this.jobs.get(id);if(!job)throw failure('STUDIO_BUILD_MISSING','This active build could not be found.');if(!TERMINAL.has(job.state))job.controller.abort();return this.public(job);}
 artifact(id,sceneSha256){const status=this.status(id);if(status.state!=='ready')throw failure('STUDIO_BUILD_NOT_READY','This build has not produced a verified package.');const folder=inside(this.directory,id),file=inside(folder,'skin.pak');let artifact;try{artifact=JSON.parse(fs.readFileSync(inside(folder,'artifact.json'),'utf8'));}catch{throw failure('STUDIO_BUILD_ARTIFACT','The saved package record could not be read.');}if(artifact.validationRevision!==VALIDATION_REVISION)throw failure('STUDIO_BUILD_OUTDATED','This package predates the corrected native build checks. Build the scene again.');const actual=hashFile(file);if(artifact.id!==id||artifact.sceneSha256!==sceneSha256||artifact.sha256!==actual.sha256||artifact.size!==actual.size)throw failure('STUDIO_BUILD_CHANGED','This package changed or belongs to a different project. Build the current scene again.');return{...artifact,file};}
}
module.exports={StudioBuilder,run,cookFiles,MAX_PAK,validateSourceBundle};
