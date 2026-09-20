// Source tools and read-only installation checks. No device uploads or skin activation.
async function studioRequest(action,input){
 if(action==='tools')return require('./unreal-tools.cjs').detect();
 if(action==='physical-test')return require('./studio-physical.cjs').check(input);
 if(action==='layout')return require('./layout.json');
 if(action==='collection'){
  const M=require('../studio/model.js'),fs=require('node:fs'),path=require('node:path');
  if(typeof input!=='string'||![...M.collectionScenes,'ignition'].includes(input))throw Error('Choose a collection project.');
  const file=path.join(__dirname,'../studio/examples/community-collection',input+'.cpskin');
  if(fs.statSync(file).size>M.limits.projectBytes)throw Error('This collection project is too large.');
  return M.validate(JSON.parse(fs.readFileSync(file,'utf8')));
 }
 if(action==='export'){
  if(JSON.stringify(input).length>32*1048576)throw Error('Choose a project smaller than 32 MB.');
  const project=require('../studio/model.js').validate(input);
  const result=await require('../studio/export.cjs').exportBundle(project);
  return new Uint8Array(require('../studio/zip.cjs').zip(result.files));
 }
 if(action==='inspect'){
  if(!(input instanceof ArrayBuffer)&&!ArrayBuffer.isView(input))throw Error('Choose a .pak file.');
  if(input.byteLength>128*1048576)throw Error('Choose a .pak smaller than 128 MB.');
  const bytes=Buffer.from(input instanceof ArrayBuffer?input:input.buffer,input.byteOffset||0,input.byteLength);
  return require('./pak-inspector.cjs').inspectPak(bytes);
 }
 throw Error('This Studio action is not supported.');
}
function createStudioService(directory,{builder,runExclusive,trustedBackups=[],editorDock}={}){
 const nativeBuilder=builder||new(require('./studio-build.cjs').StudioBuilder)(require('node:path').join(directory,'native-builds'));
 const device=runExclusive?new(require('./studio-device-service.cjs').StudioDeviceService)(directory,{builder:{artifact:(id,hash)=>cook.has(id)?cook.artifact(id,hash):nativeBuilder.artifact(id,hash),status:id=>cook.has(id)?cook.status(id):nativeBuilder.status(id)},runExclusive,trustedBackups,restorationProvider:require('./studio-restoration.cjs').createRestorationProvider(directory)}):null;
 let dependencies=null;
 const creatorTools=()=>dependencies||(dependencies=new(require('./studio-dependencies.cjs').StudioDependencies)(require('node:path').join(directory,'creator-tools')));
 const preferences=require('node:path').join(directory,'creator-setup.json');
 const photos=new(require('./studio-photo.cjs').PhotoAnimator)(directory);
 const unreal=new(require('./studio-unreal-workspace.cjs').UnrealWorkspace)(directory,{builder:nativeBuilder});
 const cook=new(require('./studio-unreal-cook.cjs').UnrealCook)(directory,unreal);
 return async function request(action,input){
  if(action==='unreal-capabilities')return{embedded:!!editorDock};
  if(action==='unreal-undock'){if(!editorDock)return{ok:true};return editorDock.detach();}
  if(action==='unreal-dock'){if(!editorDock)throw Error('Embedded Unreal editing is not available in this build.');let pid=unreal.processes.get(input?.id);if(!pid){await unreal.open({id:input?.id,embedded:true});return{waiting:true};}return editorDock.attach(pid,input?.bounds);}
  if(action==='unreal-cook-start'){if(nativeBuilder.active)throw Error('A Studio skin is already building. Wait for it to finish.');return cook.start(input);}
  if(action==='unreal-cook-status')return cook.status(input?.id);
  if(action==='unreal-cook-cancel')return cook.cancel(input?.id);
  if(action==='unreal-cook-download'){const a=cook.artifact(input?.id,input?.sceneSha256);return new Uint8Array(require('node:fs').readFileSync(a.file));}

  if(action==='photo-start')return photos.start(input);
  if(action==='photo-status')return photos.status();
  if(action==='photo-cancel')return photos.cancel();
  if(action==='unreal-create')return unreal.create(input);
  if(action==='unreal-list')return unreal.list();
  if(action==='unreal-open')return unreal.open(input);
  if(action==='dependencies-check')return creatorTools().check();
  if(action==='dependencies-status')return creatorTools().status();
  if(action==='dependencies-install'){
   require('node:fs').writeFileSync(preferences,JSON.stringify({automatic:true})+'\n');
   return creatorTools().install();
  }
  if(action==='dependencies-resume'){
   return require('./studio-dependencies.cjs').resumeDependencies(creatorTools(),preferences,require('../package.json').version);
  }
  if(typeof action==='string'&&action.startsWith('device-')){
   if(!device)throw Object.assign(Error('Open this project in Companion to test a skin on the physical keyboard.'),{code:'STUDIO_DEVICE_UNAVAILABLE'});
   return device.request(action,input);
  }
  if(action==='build-start'){if(cook.active)throw Error('An edited Unreal project is already building. Wait for it to finish.');return nativeBuilder.start(input);}
  if(action==='build-latest')return nativeBuilder.latest(input?.sceneSha256);
  if(action==='build-status')return nativeBuilder.status(input?.id);
  if(action==='build-cancel')return nativeBuilder.cancel(input?.id);
  if(action==='build-download'){
   const artifact=nativeBuilder.artifact(input?.id,input?.sceneSha256);
   return new Uint8Array(require('node:fs').readFileSync(artifact.file));
  }
  return studioRequest(action,input);
 };
}
module.exports={studioRequest,createStudioService};
