const crypto=require('node:crypto');
const Model=require('../studio/model.js');
const native=require('../studio/native-compatibility.cjs');

// No keyboard handle, package uploader or shell runner is accepted here.
// Finding an editor or inspecting PAK metadata cannot authorize a skin upload.
async function check(input,{detect=require('./unreal-tools.cjs').detect}={}){
 const project=Model.validate(input),json=JSON.stringify(project,null,2)+'\n';
 if(Buffer.byteLength(json,'utf8')>Model.limits.projectBytes)throw Error('Choose a Studio project smaller than 32 MB.');
 const tools=await detect(),source=native.describe(project),requirements=[];
 const add=(id,status,label,detail)=>requirements.push({id,status,label,detail});
 add('engine',tools.engine427Found===true?'detected':'missing','Unreal Engine 4.27',tools.engine427Found===true?'A completed Unreal 4.27 installation was detected.':'Install Unreal 4.27 in Epic Games Launcher. Companion detects completed installations automatically.');
 if(project.engineTarget!=='4.27')add('source-target','missing','Keyboard source target','This project targets Unreal 5 source work. Choose Unreal 4.27 in Export for the current keyboard runtime; newer cooked assets are not assumed compatible.');
 add('windows-cpp',tools.windowsCppFound===true?'detected':'missing','Windows C++ build tools',tools.windowsCppFound===true?'Visual Studio 2019 C++ tools were detected. A native compile still needs to pass.':'Install Visual Studio 2019 C++ build tools before compiling the native source plugins.');
 if(tools.windowsSdkFound!==undefined)add('windows-sdk',tools.windowsSdkFound?'detected':'missing','Windows SDK',tools.windowsSdkFound?'Windows development tools were detected.':'Install the Windows SDK with the creator build tools.');
 if(tools.netFxSdkFound!==undefined)add('netfx-sdk',tools.netFxSdkFound?'detected':'missing','.NET development SDK',tools.netFxSdkFound?'.NET development tools were detected.':'Install the .NET Framework development SDK with the creator build tools.');
 const previews=[...source.previewOnlyScenes,...source.previewOnlyBehaviors];
 add('native-scene','unverified','Native scene and interactions',previews.length?'These preview features still need native Unreal implementations: '+previews.join(', ')+'.':'The exported Unreal scene source still needs compilation and visual/input verification.');
 add('matching-package','missing','A built package of this design','Build a compatible .pak from this exact saved project. A PNG preview or an unrelated imported .pak cannot stand in for the edited scene.');
 add('device-loader','unverified','Verified keyboard loading','Build this design, then review a test slot before upload. A successful transfer still needs a visual and key-reaction check on the physical keyboard.');
 return{format:1,readOnly:true,hardwareAccess:false,applied:false,canApply:false,previewOnly:previews.length>0,previewReason:source.previewOnlyScenes.length?'This scene is available in the app preview. Keyboard builds for '+source.previewOnlyScenes.join(', ')+' are planned for a later update.':source.previewOnlyBehaviors.length?'Test beat works in the app preview only. Change it to a key-press trigger to build this skin for your keyboard.':null,code:'STUDIO_NATIVE_TEST_NOT_READY',
  message:'This design is ready for the app preview. Physical keyboard testing still requires a native build and a verified loading path.',
  project:{id:project.id,name:project.name,engineTarget:project.engineTarget,sceneSha256:crypto.createHash('sha256').update(json).digest('hex')},
  tools:{engine427Found:tools.engine427Found===true,engineVersion:tools.engineVersion||null,androidFound:tools.androidFound===true,windowsCppFound:tools.windowsCppFound===true,checkedAt:tools.checkedAt||null},
  source,requirements,nextActions:tools.engine427Found===true?['export','xpanel-skins']:['unreal-setup','export','xpanel-skins']};
}
module.exports={check};
