const {test}=require('node:test'),assert=require('node:assert/strict');
const M=require('../studio/model.js'),{check}=require('../src/studio-physical.cjs'),{exportBundle}=require('../studio/export.cjs');
const native=require('../studio/native-compatibility.cjs');
const readyTools={engine427Found:true,engineVersion:'4.27.2',windowsCppFound:true,androidFound:true,android:{sdkFound:true,ndks:['21.4.7075529'],javaFound:true},checkedAt:123};
test('physical check distinguishes installed tools from a verified package and performs no apply',async()=>{
 const project=M.createProject('My skin'),before=M.clone(project);let calls=0;
 const result=await check(project,{detect:async()=>{calls++;return readyTools;}});
 assert.equal(calls,1);assert.deepEqual(project,before);assert.equal(result.readOnly,true);assert.equal(result.hardwareAccess,false);
 assert.equal(result.canApply,false);assert.equal(result.applied,false);assert.equal(result.code,'STUDIO_NATIVE_TEST_NOT_READY');
 assert.equal(result.requirements.find(r=>r.id==='engine').status,'detected');
 assert.equal(result.requirements.find(r=>r.id==='matching-package').status,'missing');
 assert.equal(result.requirements.find(r=>r.id==='device-loader').status,'unverified');
 assert.deepEqual(result.nextActions,['export','xpanel-skins']);
});
test('project fingerprint identifies the exact source export and changes when its contents change',async()=>{
 const p=M.createProject('Before'),a=await check(p,{detect:async()=>readyTools});
 const manifest=JSON.parse(exportBundle(p).files.find(f=>f.path==='export-manifest.json').content);
 assert.equal(a.project.sceneSha256,manifest.sceneSha256);p.name='After';
 assert.notEqual((await check(p,{detect:async()=>readyTools})).project.sceneSha256,a.project.sceneSha256);
});
test('UE5 and incomplete toolchains provide concrete requirements without accepting caller readiness flags',async()=>{
 const p=M.createProject();p.engineTarget='5.x';p.canApply=true;p.verifiedBuild=true;
 const result=await check(p,{detect:async()=>({engineFound:true,engine427Found:false,engineVersion:'5.8.2',androidFound:false,canBuildKeyboardPak:true,keyboardCompatibilityVerified:true})});
 for(const id of ['engine','source-target','windows-cpp'])assert.equal(result.requirements.find(r=>r.id===id).status,'missing',id);
 assert.equal(result.canApply,false);assert.equal(result.applied,false);assert.equal(result.nextActions[0],'unreal-setup');
});
test('invalid projects fail before reading tools and never accept a path or a device command',async()=>{
 let calls=0;for(const input of [{path:'D:\\Koi.pak'},{command:48,slot:4},{format:'invalid'},null])await assert.rejects(check(input,{detect:async()=>{calls++;return readyTools;}}));assert.equal(calls,0);
});
test('native cloud gameplay is available while unfinished games remain preview-only',()=>{
 const p={layers:[{type:'fish',motion:{type:'swim'}},{type:'image',motion:{type:'none'}},{type:'collection',text:'cloud-courier'},{type:'collection',text:'lighthouse-watch'},{type:'collection',text:'atlas-launch'}],rules:[{effect:'flee'}]};
 assert.deepEqual(native.describe(p),{nativeSceneSources:['cloud-courier'],previewOnlyScenes:['lighthouse-watch','atlas-launch'],previewOnlyBehaviors:[]});
 assert.deepEqual(native.describe({layers:[{type:'image',motion:{type:'none'}}],rules:[]}).previewOnlyBehaviors,[]);
});
test('physical check does not expose local engine folders or detector internals',async()=>{
 const result=await check(M.createProject(),{detect:async()=>({...readyTools,engineFolder:'C:\\Users\\Private\\UE',secret:'private'})});
 assert.doesNotMatch(JSON.stringify(result),/Private|secret|engineFolder/);
});
test('fish, movement and flee survive source export without stale native implementation blockers',async()=>{
 const p=M.createProject('Editable pond');p.layers.push(M.createLayer('fish',{motion:{type:'swim',speed:1,distance:80,turn:true}}));p.rules.push(M.createRule({effect:'flee',radius:260,distance:180}));
 const bundle=exportBundle(p),files=new Map(bundle.files.map(f=>[f.path,f.content])),manifest=JSON.parse(files.get('export-manifest.json'));
 assert.deepEqual(manifest.previewOnlyBehaviors,[]);
 assert.match(files.get('Reference/Browser/motion.js'),/flee/);
 assert.deepEqual(JSON.parse(files.get('project/skin-studio.project.json')),M.validate(p));
 assert.equal(manifest.cookedPakIncluded,false);assert.ok(bundle.warnings.length>0);
 const result=await check(p,{detect:async()=>readyTools});assert.deepEqual(result.source.previewOnlyBehaviors,manifest.previewOnlyBehaviors);
 assert.match(result.requirements.find(r=>r.id==='native-scene').detail,/verification/);assert.equal(result.canApply,false);
});

test('asset-only native skin cooking does not require Android app build dependencies',async()=>{
 const result=await check(M.createProject(),{detect:async()=>({...readyTools,androidFound:false,android:{}})});
 assert.equal(result.requirements.some(r=>['android-sdk','android-ndk','java'].includes(r.id)),false);
 assert.equal(result.requirements.find(r=>r.id==='engine').status,'detected');
});
