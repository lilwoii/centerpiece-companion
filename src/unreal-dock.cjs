'use strict';
const path=require('node:path'),{execFile}=require('node:child_process');
const executable=path.join(process.env.SystemRoot||'C:/Windows','System32/WindowsPowerShell/v1.0/powershell.exe'),args=['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',path.join(__dirname,'unreal-dock.ps1')];
function invoke(input){return new Promise((resolve,reject)=>{const child=execFile(executable,args,{windowsHide:true,timeout:10000,maxBuffer:65536},(error,stdout)=>{if(error)return reject(Error('Windows could not dock Unreal. Use Open saved project to continue in its own window.'));try{resolve(JSON.parse(stdout));}catch{reject(Error('The editor docking response was invalid.'));}});child.stdin.on('error',()=>{});child.stdin.end(JSON.stringify(input)+'\n');});}
class UnrealDock{
 constructor(window){this.window=window;this.current=null;this.host=null;this.parked=new Map();this.busy=false;}
 async attach(pid,bounds){
  if(this.closing||this.detaching)throw Error('The editor panel is closing.');if(this.busy)return{waiting:true};const win=this.window();if(!win||win.isDestroyed())throw Error('The Companion window is closed.');
  if(!Number.isSafeInteger(pid)||pid<1)throw Error('Open the saved Unreal project first.');
  const size=win.getContentSize();for(const k of ['x','y','width','height'])if(!Number.isFinite(bounds?.[k])||bounds[k]<0)throw Error('Invalid editor panel bounds.');
  if(bounds.width<100||bounds.height<100||bounds.x+bounds.width>size[0]+2||bounds.y+bounds.height>size[1]+2)throw Error('The editor panel is outside the Companion window.');
  this.busy=true;try{if(this.current&&this.current.pid!==pid)await this.detachCore();const parent=win.getNativeWindowHandle().readBigUInt64LE().toString();
   if(!this.current){const probe=await invoke({action:'probe',pid,handle:this.parked.get(pid)?.handle});if(probe.waiting)return probe;this.host=await require('./unreal-host.cjs').createHost(parent,process.pid,probe.handle,pid);this.host.source=probe.handle;}
   let value;try{value=await invoke({action:this.current?'move':'attach',pid,sourceHandle:this.host.source,parent:this.host.handle,parentPid:this.host.pid,hostHandle:this.host.handle,hostPid:this.host.pid,container:parent,containerPid:process.pid,...bounds,...(this.current?{handle:this.current.handle}:{})});}catch(error){if(!this.current){this.host?.close();this.host=null;}throw error;}
   if(value.waiting){this.host?.close();this.host=null;return value;}
   if(!value.waiting&&!this.current){this.current={...value,pid};this.parked.delete(pid);}return value;
  }finally{this.busy=false;}
 }
 async detachCore(){if(!this.current){this.host?.close();this.host=null;return{ok:true};}const current=this.current;const result=await invoke({action:'detach',...current,hide:!this.closing});if(!this.closing&&!result.closed)this.parked.set(current.pid,current);this.current=null;this.host?.close();this.host=null;return result;}
 async detach(){this.detaching=true;try{while(this.busy)await new Promise(r=>setTimeout(r,50));return await this.detachCore();}finally{this.detaching=false;}}
 async shutdown(){this.closing=true;const result=await this.detach();for(const current of this.parked.values())await invoke({action:'reveal',...current});this.parked.clear();return result;}
}
module.exports={UnrealDock};
