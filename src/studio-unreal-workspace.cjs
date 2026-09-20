'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const Model=require('../studio/model.js');
class UnrealWorkspace {
 constructor(directory,{detect=require('./unreal-tools.cjs').detect,launch,builder}={}){
  this.root=path.resolve(directory,'unreal-projects');this.detect=detect;this.builder=builder;this.processes=new Map();
  this.launch=launch||((executable,args,cwd)=>new Promise((resolve,reject)=>{
   const child=require('node:child_process').spawn(executable,args,{cwd,shell:false,detached:true,stdio:'ignore',windowsHide:false});
   child.once('exit',()=>{for(const [id,pid]of this.processes)if(pid===child.pid)this.processes.delete(id);});
   child.once('error',reject);child.once('spawn',()=>{child.unref();resolve(child.pid);});
  }));
 }
 async create(input){
  if(this.creating)throw Error('An Unreal project is already being prepared. Please wait.');this.creating=true;
  try{return await this.createProject(input);}finally{this.creating=false;}
 }
 async createProject(input){
  const project=Model.validate(input);if(this.builder&&project.engineTarget==='4.27')return this.createNative(project);
  const bundle=await require('../studio/export.cjs').exportBundle(project);
  const id=crypto.randomUUID(),folder=path.join(this.root,id);fs.mkdirSync(folder,{recursive:true});
  for(const file of bundle.files){
   const target=path.resolve(folder,file.path);
   if(!target.startsWith(folder+path.sep))throw Error('The Unreal export contains an invalid path.');
   fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,Buffer.from(file.content,file.encoding),{flag:'wx'});
  }
  const record={id,name:project.name,engineTarget:project.engineTarget,createdAt:new Date().toISOString()};
  fs.writeFileSync(path.join(folder,'workspace.json'),JSON.stringify(record),{flag:'wx'});
  return{...record,folder,message:'A separate editable Unreal project was created. Changes in Unreal stay in this project; they do not overwrite your Companion scene.'};
 }
 async createNative(project){
  const hash=crypto.createHash('sha256').update(JSON.stringify(project,null,2)+'\n').digest('hex'),source=this.builder.editableSource(hash);
  const id=crypto.randomUUID(),folder=path.join(this.root,id);await fs.promises.mkdir(folder,{recursive:true});let bytes=0,files=0;
  const filter=async file=>{const stat=await fs.promises.lstat(file);if(stat.isSymbolicLink())throw Error('Unreal project files cannot contain links.');if(['Saved','Intermediate','DerivedDataCache','.vs'].includes(path.basename(file)))return false;if(stat.isFile()){bytes+=stat.size;files++;if(bytes>1024*1024*1024||files>10000)throw Error('The generated Unreal project exceeds its local copy limit.');}return true;};
  await fs.promises.cp(path.join(source.folder,'Device'),path.join(folder,'Device'),{recursive:true,errorOnExist:true,force:false,filter});
  await fs.promises.cp(path.join(source.folder,'project'),path.join(folder,'project'),{recursive:true,errorOnExist:true,force:false,filter});
  const record={id,name:project.name,engineTarget:'4.27',projectFile:'Device/CenterpieceDevice.uproject',buildId:source.id,createdAt:new Date().toISOString()};
  await fs.promises.writeFile(path.join(folder,'workspace.json'),JSON.stringify(record),{flag:'wx'});return{...record,folder};
 }
 async open(input){
  if(!input||typeof input.id!=='string'||! /^[a-f0-9-]{36}$/.test(input.id))throw Error('Choose a generated Unreal project.');
  const folder=path.join(this.root,input.id),record=JSON.parse(fs.readFileSync(path.join(folder,'workspace.json'),'utf8'));
  const info=await this.detect({force:true}),engine=info.engines.find(e=>record.engineTarget==='4.27'?e.keyboardTarget:e.major===5);
  if(!engine)throw Error('Install Unreal '+(record.engineTarget==='4.27'?'4.27':'5')+' in Epic Games Launcher. Companion will detect it automatically.');
  const executable=path.join(engine.folder,'Engine/Binaries/Win64',engine.major===4?'UE4Editor.exe':'UnrealEditor.exe');
  if(record.projectFile&&record.projectFile!=='Device/CenterpieceDevice.uproject')throw Error('The generated project record is invalid.');
  const projectFile=path.join(folder,record.projectFile||'Unreal/SkinStudioPreview.uproject');
  const args=[projectFile];
  if(input.embedded===true&&engine.major===4)args.push('-ini:EditorPerProjectUserSettings:[/Script/EditorStyle.EditorStyleSettings]:AssetEditorOpenLocation=MainWindow');
  const pid=await this.launch(executable,args,folder);if(Number.isSafeInteger(pid))this.processes.set(record.id,pid);
  return{id:record.id,opened:true,version:engine.version};
 }
 list(){
  if(!fs.existsSync(this.root))return[];const records=[];
  for(const entry of fs.readdirSync(this.root,{withFileTypes:true}).slice(0,1000)){
   if(!entry.isDirectory()||! /^[a-f0-9-]{36}$/.test(entry.name))continue;
   try{const file=path.join(this.root,entry.name,'workspace.json');if(fs.lstatSync(file).isSymbolicLink()||fs.statSync(file).size>4096)continue;const r=JSON.parse(fs.readFileSync(file,'utf8'));if(r.id!==entry.name||typeof r.name!=='string'||r.name.length>120)continue;records.push({id:r.id,name:r.name,createdAt:r.createdAt,engineTarget:r.engineTarget});}catch{}
  }return records.sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt)));
 }
}
module.exports={UnrealWorkspace};
