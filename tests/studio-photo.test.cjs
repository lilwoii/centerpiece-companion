'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {PhotoAnimator}=require('../src/studio-photo.cjs'),{UnrealWorkspace}=require('../src/studio-unreal-workspace.cjs'),M=require('../studio/model.js');
test('photo extraction rejects paths, SVG and oversized input before starting a worker',()=>{
 const p=new PhotoAnimator('unused');for(const image of ['file:///C:/secret.png','https://example.com/photo.png','data:image/svg+xml;base64,PHN2Zz4=',null])assert.throws(()=>p.start({image}));
 assert.equal(p.status().state,'idle');
});
test('photo cancellation marks the job cancelled and terminates its worker',()=>{
 const p=new PhotoAnimator('unused');let stopped=0;p.job={id:'test',state:'working'};p.worker={terminate:()=>{stopped++;}};p.abort=new AbortController();
 assert.equal(p.cancel().state,'cancelled');assert.equal(p.abort.signal.aborted,true);assert.equal(stopped,1);assert.equal(p.worker,null);
});
test('generated Unreal workspace opens only a detected editor with a generated project argument',async t=>{
 const folder=fs.mkdtempSync(path.join(os.tmpdir(),'studio-workspace-test-'));t.after(()=>fs.rmSync(folder,{recursive:true,force:true}));const calls=[];
 const workspace=new UnrealWorkspace(folder,{detect:async()=>({engines:[{folder:'D:/UE_4.27',major:4,version:'4.27.2',keyboardTarget:true}]}),launch:async(...args)=>calls.push(args)});
 const project=M.createProject('My photo skin'),saved=await workspace.create(project);
 assert.ok(fs.existsSync(path.join(saved.folder,'Unreal/SkinStudioPreview.uproject')));
 assert.equal(JSON.parse(fs.readFileSync(path.join(saved.folder,'Unreal/Content/Studio/Scene.json'))).name,'My photo skin');
 await workspace.open({id:saved.id,path:'C:/untrusted.exe',command:'ignored'});assert.equal(calls.length,1);assert.equal(calls[0][1].length,1);assert.ok(calls[0][1][0].endsWith('SkinStudioPreview.uproject'));
 await workspace.open({id:saved.id,embedded:true});assert.deepEqual(calls[1][1],[calls[0][1][0],'-ini:EditorPerProjectUserSettings:[/Script/EditorStyle.EditorStyleSettings]:AssetEditorOpenLocation=MainWindow']);
 await assert.rejects(workspace.open({id:'../../elsewhere'}),/generated Unreal/);
 const second=await workspace.create(project);assert.notEqual(second.id,saved.id);assert.ok(fs.existsSync(saved.folder));
});
test('photo subject motion and reactions survive validation and serialization',()=>{
 const project=M.createProject();const layer=M.createLayer('image',{motion:{type:'swim',speed:1.2,distance:150,turn:true}});project.layers.push(layer);project.rules.push(M.createRule({target:layer.id,effect:'flee'}));
 const roundtrip=M.validate(JSON.parse(JSON.stringify(project)));assert.deepEqual(roundtrip.layers[0].motion,layer.motion);assert.equal(roundtrip.rules[0].target,layer.id);
});
test('drawn paths keep even travel speed and return to their start when looped',()=>{
 const pathTool=require('../studio/motion-path.js'),layer=M.createLayer('image',{width:100,height:50});
 const f=pathTool.frames([{x:100,y:100},{x:500,y:100},{x:500,y:300}],layer,12,{samples:25});
 assert.equal(f.length,50);assert.equal(f[0].value,50);assert.equal(f.at(-2).value,f[0].value);assert.equal(f.at(-1).value,f[1].value);assert.equal(f.at(-1).time,12);
 const project=M.createProject();layer.keyframes=f.map(frame=>({...frame,id:M.uid()}));project.layers.push(layer);assert.doesNotThrow(()=>M.validate(project));
 assert.throws(()=>pathTool.frames([{x:NaN,y:10},{x:20,y:30}],layer,12),/inside/);
 assert.throws(()=>pathTool.frames([{x:1,y:1},{x:1,y:1}],layer,12),/longer/);
});
