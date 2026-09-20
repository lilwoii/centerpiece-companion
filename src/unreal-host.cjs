'use strict';
const path=require('node:path'),{spawn}=require('node:child_process');
function createHost(parent,parentPid,source,sourcePid){return new Promise((resolve,reject)=>{
 const child=spawn(path.join(process.env.SystemRoot||'C:/Windows','System32/WindowsPowerShell/v1.0/powershell.exe'),['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',path.join(__dirname,'unreal-host.ps1')],{windowsHide:true,stdio:['pipe','pipe','pipe']});
 let output='',settled=false;const timer=setTimeout(()=>fail(Error('The editor host took too long to start.')),15000);
 function fail(error){if(settled)return;settled=true;clearTimeout(timer);child.kill();reject(error);}
 child.stdin.on('error',()=>{});child.stderr.resume();child.on('error',fail);child.on('exit',()=>fail(Error('The editor host could not start.')));
 child.stdout.setEncoding('utf8');child.stdout.on('data',chunk=>{if(settled)return;output+=chunk;if(output.length>4096)return fail(Error('Invalid editor host response.'));const end=output.indexOf('\n');if(end<0)return;try{const value=JSON.parse(output.slice(0,end));if(!/^[1-9][0-9]*$/.test(value.handle))throw Error();settled=true;clearTimeout(timer);resolve({handle:value.handle,pid:child.pid,child,close:()=>{child.stdin.end('\n');}});}catch{fail(Error('Invalid editor host response.'));}});
 child.stdin.write(JSON.stringify({parent,parentPid,source,sourcePid})+'\n');
 });}
module.exports={createHost};
