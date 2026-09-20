const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {StudioBuilder,cookFiles}=require('../src/studio-build.cjs'),M=require('../studio/model.js');
test('deferred scenes and manual preview beats fail before creating any build job',async t=>{
 const {builder}=setup(t);
 const scene=M.createProject('Deferred scene');scene.layers=[M.createLayer('collection',{text:'atlas-launch'})];
 const before=JSON.stringify(scene);
 await assert.rejects(builder.start(scene),{code:'STUDIO_BUILD_PREVIEW_SCENE'});
 assert.equal(JSON.stringify(scene),before);assert.equal(builder.jobs.size,0);
 const beat=M.createProject('Manual beat');beat.rules=[M.createRule({trigger:'beat'})];
 await assert.rejects(builder.start(beat),{code:'STUDIO_BUILD_PREVIEW_BEAT'});
 assert.equal(builder.jobs.size,0);assert.equal(builder.active,null);
});
test('incomplete native source bundles identify missing inline implementations before compilation',()=>{
 const {validateSourceBundle}=require('../src/studio-build.cjs');
 const bundle={files:[{path:'Device/Source/Layer.cpp',content:'#include "GameBlueprintLogic.inl"\n'}]};
 assert.throws(()=>validateSourceBundle(bundle),error=>error.code==='STUDIO_BUILD_SOURCE_MISSING'&&error.message.includes('GameBlueprintLogic.inl'));
 bundle.files.push({path:'Device/Source/GameBlueprintLogic.inl',content:'#include "PrismBlueprintLogic.inl"\n'});
 assert.throws(()=>validateSourceBundle(bundle),/PrismBlueprintLogic/);
 bundle.files.push({path:'Device/Source/PrismBlueprintLogic.inl',content:'// complete'});
 assert.equal(validateSourceBundle(bundle),bundle);
});
test('saved scenes resolve their own build rather than the last unrelated skin',async t=>{
 const {builder}=setup(t),first=await builder.start(M.createProject('First skin'));await builder.jobs.get(first.id).promise;
 const second=await builder.start(M.createProject('Second skin'));await builder.jobs.get(second.id).promise;
 assert.equal(builder.latest(first.sceneSha256).id,first.id);
 assert.equal(builder.latest(second.sceneSha256).id,second.id);
 assert.equal(builder.latest('0'.repeat(64)),null);
 assert.throws(()=>builder.latest('../other'),{code:'STUDIO_BUILD_SCENE'});
});
test('the real exported source inventory contains every native inline and local Python dependency',async()=>{
 const bundle=await require('../studio/export.cjs').exportBundle(M.createProject());
 assert.equal(require('../src/studio-build.cjs').validateSourceBundle(bundle),bundle);
 const incomplete={files:bundle.files.filter(file=>file.path!=='Device/Tools/device_orbit.py')};
 assert.throws(()=>require('../src/studio-build.cjs').validateSourceBundle(incomplete),/device_orbit.py/);
});
test('missing native include diagnostics survive compiler failure',async t=>{
 const {root}=setup(t),{run}=require('../src/studio-build.cjs');
 const message="Layer.cpp(97): fatal error C1083: Cannot open include file: 'GameBlueprintLogic.inl': No such file or directory";
 await assert.rejects(run(process.execPath,['-e','process.stderr.write('+JSON.stringify(message)+');process.exitCode=1'],{cwd:root,logFile:path.join(root,'missing-include.log')}),{code:'STUDIO_BUILD_SOURCE_MISSING'});
});
function setup(t,{pauseAt,failAt}={}){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'companion-native-test-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const engine=path.join(root,'UE_4.27'),jobs=path.join(root,'jobs');for(const rel of ['Engine/Binaries/DotNET/UnrealBuildTool.exe','Engine/Binaries/Win64/UE4Editor-Cmd.exe','Engine/Binaries/Win64/UnrealPak.exe']){const file=path.join(engine,rel);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,'fixture');}
 const calls=[];let release;
 const builder=new StudioBuilder(jobs,{workDirectory:path.join(root,'work'),detect:async()=>({engine427Found:true,windowsCppFound:true,engineFolder:engine,androidFound:false}),exporter:p=>({files:[{path:'Device/CenterpieceDevice.uproject',content:'{}'},{path:'project/skin-studio.project.json',content:JSON.stringify(p,null,2)+'\n'}]}),inspect:()=>({version:11,mountPoint:'../../../spark/Content/',paths:['map/M_EntryPoint.umap'],unsafePaths:[],encryptedIndex:false}),run:async(executable,args,options)=>{
  const stage=path.basename(options.logFile,'.log');calls.push({stage,executable,args});fs.writeFileSync(options.logFile,stage);
  if(pauseAt===stage)await new Promise((resolve,reject)=>{release=resolve;options.signal.addEventListener('abort',()=>reject(Object.assign(Error('Build cancelled.'),{code:'STUDIO_BUILD_CANCELLED'})),{once:true});});
  if(failAt===stage)throw Object.assign(Error('Step failed.'),{code:'STUDIO_BUILD_TOOL_FAILED'});
  const dir=options.cwd,folder=path.dirname(dir),job=[...builder.jobs.values()].find(j=>j.workFolder===folder);
  if(stage==='generate'){fs.mkdirSync(path.join(dir,'Saved'),{recursive:true});fs.writeFileSync(path.join(dir,'Saved/StudioDeviceGeneration.json'),JSON.stringify({sourceSceneSha256:job.sceneSha256,inputBlueprintCompiled:true}));}
  if(stage==='cook'){const content=path.join(dir,'Saved/Cooked/Android_ASTC/CenterpieceDevice/Content/map');fs.mkdirSync(content,{recursive:true});fs.writeFileSync(path.join(content,'M_EntryPoint.umap'),'cookedfixture');}
  if(stage==='package')fs.writeFileSync(args[0],Buffer.alloc(300,7));
 }});
 return{builder,calls,root,jobs,release:()=>release?.()};
}
async function waitFor(test){for(let i=0;i<100;i++){if(test())return;await new Promise(resolve=>setTimeout(resolve,5));}assert.fail('Test stage did not start');}
test('build executes fixed native stages without Android packaging and binds its local artifact to the exact project',async t=>{
 const{builder,calls}=setup(t),p=M.createProject('Native $(text)');const started=await builder.start(p);assert.equal(started.state,'queued');await builder.jobs.get(started.id).promise;
 const status=builder.status(started.id);assert.equal(status.state,'ready');assert.equal(status.artifact.deviceVerified,false);
 assert.deepEqual(calls.map(c=>c.stage),['compile','generate','cook','package','verify']);
 assert.ok(calls.find(c=>c.stage==='cook').args.includes('-TargetPlatform=Android_ASTC'));
 assert.ok(calls.every(c=>!c.args.includes('-package')&&!c.args.includes('-deploy')));
 const artifact=builder.artifact(started.id,status.sceneSha256);assert.equal(artifact.packageIntegrityVerified,true);assert.equal(artifact.deviceVerified,false);
 assert.throws(()=>builder.artifact(started.id,'0'.repeat(64)),/different project/);
 fs.appendFileSync(artifact.file,'tampered');assert.throws(()=>builder.artifact(started.id,status.sceneSha256),/changed/);
});
test('failed generation never cooks, packages or becomes ready',async t=>{const{builder,calls}=setup(t,{failAt:'generate'});const a=await builder.start(M.createProject());await builder.jobs.get(a.id).promise;assert.equal(builder.status(a.id).state,'failed');assert.deepEqual(calls.map(c=>c.stage),['compile','generate']);assert.throws(()=>builder.artifact(a.id,a.sceneSha256),/not produced/);});
test('cancel stops a running stage and prevents concurrent jobs or later asset writes',async t=>{
 const{builder,calls}=setup(t,{pauseAt:'compile'}),a=await builder.start(M.createProject());await waitFor(()=>calls.length===1);
 await assert.rejects(builder.start(M.createProject()),/already running/);builder.cancel(a.id);await builder.jobs.get(a.id).promise;
 assert.equal(builder.status(a.id).state,'cancelled');assert.deepEqual(calls.map(c=>c.stage),['compile']);
});
test('restart marks unfinished jobs interrupted and persisted completed artifacts remain verifiable',async t=>{
 const{builder,jobs,calls,release}=setup(t,{pauseAt:'compile'}),a=await builder.start(M.createProject());await waitFor(()=>calls.length===1);
 const reopened=new StudioBuilder(jobs);assert.equal(reopened.status(a.id).error.code,'STUDIO_BUILD_INTERRUPTED');release();await builder.jobs.get(a.id).promise;
 const status=reopened.status(a.id);assert.equal(status.state,'ready');assert.equal(reopened.artifact(a.id,status.sceneSha256).cooked,true);
});
test('build identifiers and source target prevent arbitrary paths or incompatible tool execution',async t=>{
 const{builder,calls}=setup(t);for(const id of ['../outside','D:\\private',''])assert.throws(()=>builder.status(id));
 const p=M.createProject();p.engineTarget='5.x';await assert.rejects(builder.start(p),/4.27/);assert.deepEqual(calls,[]);
});
test('package inventory rejects unexpected content and requires its exact entry map',t=>{
 const{root}=setup(t),content=path.join(root,'Content');fs.mkdirSync(content);fs.writeFileSync(path.join(content,'script.py'),'untrusted');assert.throws(()=>cookFiles(content),/unexpected/);fs.unlinkSync(path.join(content,'script.py'));assert.throws(()=>cookFiles(content),/entry map/);
});

test('native tools reject shader failures even with exit zero and later success output',async t=>{
 const{root}=setup(t);const {run}=require('../src/studio-build.cjs');
 for(const [index,message] of ['Failed to compile Material /Game/Companion/Scene','Default Material will be used in game'].entries()){
  const script="process.stdout.write("+JSON.stringify(message.slice(0,10))+");setTimeout(()=>{process.stdout.write("+JSON.stringify(message.slice(10))+"+'\\n'+'ok'.repeat(5000));},30)";
  await assert.rejects(run(process.execPath,['-e',script],{cwd:root,logFile:path.join(root,'material-'+index+'.log')}),{code:'STUDIO_BUILD_MATERIAL'});
 }
});
test('successful native tool output still passes material validation',async t=>{
 const{root}=setup(t);const {run}=require('../src/studio-build.cjs');
 await run(process.execPath,['-e',"process.stdout.write('Material compiled successfully')"],{cwd:root,logFile:path.join(root,'success.log')});
});

test('inactive Blueprint connections reject otherwise successful builds',async t=>{
 const{root}=setup(t),{run}=require('../src/studio-build.cjs');
 const message='[Compiler] Get Scalar Parameter Value was pruned because its Exec pin is not connected';
 await assert.rejects(run(process.execPath,['-e','process.stdout.write('+JSON.stringify(message+'\n')+");process.stdout.write('ok'.repeat(10000))"],{cwd:root,logFile:path.join(root,'pruned.log')}),{code:'STUDIO_BUILD_BLUEPRINT'});
});

test('old ready packages require rebuilding after native validation changes',async t=>{
 const{builder,jobs}=setup(t),a=await builder.start(M.createProject());await builder.jobs.get(a.id).promise;
 const folder=path.join(jobs,a.id),artifactFile=path.join(folder,'artifact.json'),artifact=JSON.parse(fs.readFileSync(artifactFile));delete artifact.validationRevision;fs.writeFileSync(artifactFile,JSON.stringify(artifact));
 assert.throws(()=>builder.artifact(a.id,a.sceneSha256),{code:'STUDIO_BUILD_OUTDATED'});
 const jobFile=path.join(folder,'job.json'),job=JSON.parse(fs.readFileSync(jobFile));delete job.artifact.validationRevision;fs.writeFileSync(jobFile,JSON.stringify(job));
 const reopened=new StudioBuilder(jobs);assert.equal(reopened.latest().error.code,'STUDIO_BUILD_OUTDATED');assert.equal(reopened.latest().state,'failed');
});


test('scene and cache errors retain an actionable reason after long shutdown logs',async t=>{
 const{root}=setup(t),{run}=require('../src/studio-build.cjs');
 for(const [index,message,code] of [[0,'RuntimeError: Native interaction is not implemented for launch.','STUDIO_BUILD_SCENE'],[1,'Could not save memory cache','STUDIO_BUILD_CACHE']]){
  const script="process.stdout.write("+JSON.stringify(message+"\n")+");process.stdout.write('shutdown'.repeat(2000));process.exitCode=1;";
  await assert.rejects(run(process.execPath,['-e',script],{cwd:root,logFile:path.join(root,'reason-'+index+'.log')}),{code});
 }
});
