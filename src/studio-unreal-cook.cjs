'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {run,cookFiles,MAX_PAK}=require('./studio-build.cjs');
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
function validateRuntime(device){
 const read=file=>{if(fs.statSync(file).size>131072)throw Error('An Unreal descriptor is too large.');return JSON.parse(fs.readFileSync(file,'utf8'));};
 const project=read(path.join(device,'CenterpieceDevice.uproject'));
 if(project.Modules?.some(m=>!['Editor','Developer','EditorNoCommandlet'].includes(m.Type)))throw Error('This project adds native game code. The keyboard cannot load new C++ game modules from a skin. Use Blueprints based on its existing runtime classes.');
 const allowed=new Set(['SkinApi','SkinStudioDeviceBuilder','PythonScriptPlugin','EditorScriptingUtilities']);
 for(const plugin of project.Plugins||[])if(plugin.Enabled&&!allowed.has(plugin.Name))throw Error('Keyboard support for plugin '+String(plugin.Name).slice(0,80)+' is not established. Disable it before building for this keyboard.');
 for(const name of fs.readdirSync(path.join(device,'Plugins')))if(!['SkinApi','SkinStudioDeviceBuilder'].includes(name))throw Error('Additional native plugins cannot be installed on the keyboard by a skin package.');
 const expectedRoot=path.join(__dirname,'../sdk/Device/Plugins/SkinApi'),actualRoot=path.join(device,'Plugins/SkinApi');
 function verify(folder,relative=''){for(const entry of fs.readdirSync(folder,{withFileTypes:true})){const rel=path.join(relative,entry.name);if(entry.isDirectory())verify(path.join(folder,entry.name),rel);else if(/\.(h|cpp|cs|uplugin)$/.test(entry.name)){const actual=path.join(actualRoot,rel);if(!fs.existsSync(actual)||!fs.readFileSync(actual).equals(fs.readFileSync(path.join(folder,entry.name))))throw Error('The keyboard API declarations were modified. Restore SkinApi from a fresh Studio export before building.');}}}verify(expectedRoot);
}
class UnrealCook{
 constructor(directory,workspaces,{detect=require('./unreal-tools.cjs').detect,runner=run}={}){this.root=path.resolve(directory,'unreal-builds');this.workspaces=workspaces;this.detect=detect;this.runner=runner;this.active=null;this.jobs=new Map();}
 has(id){return UUID.test(id||'')&&(this.jobs.has(id)||fs.existsSync(path.join(this.root,id,'status.json')));}
 cancel(id){const job=this.jobs.get(id);if(!job)throw Error('Choose an active Unreal build.');if(['queued','building'].includes(job.state)){job.label='Cancelling Unreal build…';job.controller.abort();this.save(job);}return this.status(id);}
 save(job){const value={id:job.id,state:job.state,label:job.label,projectName:job.projectName,sceneSha256:job.sceneSha256,error:job.error||null,artifact:job.artifact||null};fs.writeFileSync(path.join(job.folder,'status.json'),JSON.stringify(value));return value;}
 status(id){if(!UUID.test(id||''))throw Error('Choose an Unreal build.');const job=this.jobs.get(id);if(job)return this.save(job);const value=JSON.parse(fs.readFileSync(path.join(this.root,id,'status.json'),'utf8'));if(['queued','building'].includes(value.state))return{...value,state:'failed',error:{message:'The app closed before this Unreal build finished. Build the saved project again.'}};return value;}
 start(input){
  if(this.active)throw Error('An Unreal build is already running.');
  const record=this.workspaces.list().find(r=>r.id===input?.id);if(!record||record.engineTarget!=='4.27')throw Error('Choose a saved Unreal 4.27 project.');
  const folder=path.join(this.workspaces.root,record.id);if(!fs.existsSync(path.join(folder,'Device/CenterpieceDevice.uproject')))throw Error('This is a source-preview export. Open a built native skin in Unreal first.');
  const id=crypto.randomUUID(),job={id,folder:path.join(this.root,id),state:'queued',label:'Copying your saved Unreal edits',projectName:record.name+' · Unreal edit',sceneSha256:crypto.createHash('sha256').update(id).digest('hex'),controller:new AbortController()};fs.mkdirSync(job.folder,{recursive:true});this.jobs.set(id,job);this.active=id;this.save(job);
  job.promise=this.execute(job,folder).catch(error=>{job.state='failed';job.error={code:error.code||'STUDIO_UNREAL_BUILD',message:error.message};this.save(job);}).finally(()=>{this.active=null;});return this.save(job);
 }
 async execute(job,source){
  const tools=await this.detect(),engine=tools.engines?.find(e=>e.keyboardTarget);if(!engine)throw Error('Install Unreal 4.27 to build this skin.');
  const root=path.join(require('node:os').tmpdir(),'CCB');await fs.promises.mkdir(root,{recursive:true});const snapshot=await fs.promises.mkdtemp(path.join(root,'u-'));let bytes=0,files=0;
  await fs.promises.cp(source,snapshot,{recursive:true,filter:async file=>{const stat=await fs.promises.lstat(file);if(stat.isSymbolicLink())throw Error('Unreal source cannot contain links.');if(['Saved','Intermediate','DerivedDataCache','.vs'].includes(path.basename(file)))return false;if(stat.isFile()&&(++files>10000||(bytes+=stat.size)>1024*1024*1024))throw Error('This Unreal project is too large.');return true;}});
  const device=path.join(snapshot,'Device'),project=path.join(device,'CenterpieceDevice.uproject'),editor=path.join(engine.folder,'Engine/Binaries/Win64/UE4Editor-Cmd.exe');validateRuntime(device);
  const stage=async(name,label,exe,args)=>{job.state='building';job.label=label;this.save(job);await this.runner(exe,args,{cwd:device,logFile:path.join(job.folder,name+'.log'),signal:job.controller.signal});};
  await stage('compile','Compiling your saved editor project',path.join(engine.folder,'Engine/Binaries/DotNET/UnrealBuildTool.exe'),['UE4Editor','Win64','Development','-Project='+project,'-WaitMutex','-NoHotReload','-NoUBTMakefiles','-NoPCH','-NoSharedPCH','-MaxParallelActions=2']);
  // Deliberately do not run the Studio generator: it would overwrite user-authored assets.
  await stage('cook','Cooking your edited Blueprints and materials',editor,[project,'-run=Cook','-TargetPlatform=Android_ASTC','-Map=/Game/map/M_EntryPoint','-unattended','-nop4','-NullRHI','-stdout','-UTF8Output','-UnVersioned']);
  const content=path.join(device,'Saved/Cooked/Android_ASTC/CenterpieceDevice/Content'),entries=cookFiles(content),response=path.join(job.folder,'pak-response.txt');
  fs.writeFileSync(response,entries.map(f=>'"'+f.file+'" "../../../spark/Content/'+f.relative+'"').join('\n'));
  const pak=path.join(job.folder,'skin.pak'),pakTool=path.join(engine.folder,'Engine/Binaries/Win64/UnrealPak.exe');
  await stage('package','Packaging your edited skin',pakTool,[pak,'-Create='+response,'-compress','-compressionformats=Zlib']);await stage('verify','Checking the edited package',pakTool,[pak,'-Test']);
  const size=fs.statSync(pak).size;if(size<1||size>MAX_PAK)throw Error('The skin exceeds the keyboard package size limit.');
  if(!require('./studio-pak.cjs').contentPaths(require('./pak-inspector.cjs').inspectPak(pak)))throw Error('The package has incompatible content paths.');
  job.artifact={id:job.id,sceneSha256:job.sceneSha256,size,sha256:crypto.createHash('sha256').update(fs.readFileSync(pak)).digest('hex'),target:'Android_ASTC',cooked:true,packageIntegrityVerified:true};job.state='ready';job.label='Edited Unreal package ready for keyboard testing';this.save(job);
 }
 artifact(id,hash){const status=this.status(id),file=path.join(this.root,id,'skin.pak');if(status.state!=='ready'||status.sceneSha256!==hash||!status.artifact)throw Error('Choose a completed Unreal build.');const size=fs.statSync(file).size;if(size!==status.artifact.size||size>MAX_PAK||crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')!==status.artifact.sha256)throw Error('The Unreal package changed. Rebuild it.');return{...status.artifact,file};}
}
module.exports={UnrealCook,validateRuntime};
