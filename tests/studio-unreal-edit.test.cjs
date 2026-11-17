'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {validateRuntime}=require('../src/studio-unreal-cook.cjs');
const {UnrealDock}=require('../src/unreal-dock.cjs');
function fixture(t){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'studio-runtime-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));fs.mkdirSync(path.join(dir,'Plugins'),{recursive:true});fs.cpSync(path.join(__dirname,'../sdk/Device/Plugins/SkinApi'),path.join(dir,'Plugins/SkinApi'),{recursive:true});fs.writeFileSync(path.join(dir,'CenterpieceDevice.uproject'),JSON.stringify({Plugins:[{Name:'SkinApi',Enabled:true}]}));return dir;}
test('saved Blueprint project preserves the installed keyboard API contract',t=>{const dir=fixture(t);assert.doesNotThrow(()=>validateRuntime(dir));fs.writeFileSync(path.join(dir,'CenterpieceDevice.uproject'),JSON.stringify({Modules:[{Name:'CustomGame',Type:'Runtime'}]}));assert.throws(()=>validateRuntime(dir),/native game code/);});
test('unknown runtime plugins cannot silently become an unusable keyboard package',t=>{const dir=fixture(t);fs.writeFileSync(path.join(dir,'CenterpieceDevice.uproject'),JSON.stringify({Plugins:[{Name:'CustomRuntime',Enabled:true}]}));assert.throws(()=>validateRuntime(dir),/not established/);});
test('editor docking rejects invalid process and out-of-window bounds before native calls',async()=>{const dock=new UnrealDock(()=>({isDestroyed:()=>false,getContentSize:()=>[1000,700]}));await assert.rejects(dock.attach(0,{x:0,y:0,width:500,height:400}),/saved Unreal/);await assert.rejects(dock.attach(123,{x:900,y:0,width:500,height:400}),/outside/);await assert.rejects(dock.attach(123,{x:NaN,y:0,width:500,height:400}),/Invalid/);await dock.shutdown();await assert.rejects(dock.attach(123,{x:0,y:0,width:500,height:400}),/closing/);});
test('cancelling an active Unreal build signals only that job and keeps its source',t=>{const dir=fixture(t),{UnrealCook}=require('../src/studio-unreal-cook.cjs'),cook=new UnrealCook(dir,{list:()=>[]}),id='11111111-1111-4111-8111-111111111111',controller=new AbortController();cook.jobs.set(id,{id,folder:dir,state:'building',controller});assert.equal(cook.cancel(id).label,'Cancelling Unreal build…');assert.equal(controller.signal.aborted,true);assert.ok(fs.existsSync(path.join(dir,'CenterpieceDevice.uproject')));assert.throws(()=>cook.cancel('unknown'),/active Unreal/);});
function hostWorkerFixture(){
 const vm=require('node:vm'),{createRequire}=require('node:module'),{EventEmitter}=require('node:events'),{PassThrough}=require('node:stream'),file=path.resolve(__dirname,'../src/unreal-host.cjs'),localRequire=createRequire(file),child=new EventEmitter(),timers=new Set();let kills=0;
 child.stdout=new PassThrough();child.stderr=new PassThrough();child.stdin=new PassThrough();child.kill=()=>kills++;
 const context={process,__dirname:path.dirname(file),module:{exports:{}},require:n=>n==='node:child_process'?{spawn:()=>child}:localRequire(n),setTimeout:fn=>{timers.add(fn);return fn;},clearTimeout:fn=>timers.delete(fn)};
 vm.runInNewContext(fs.readFileSync(file,'utf8'),context);return{child,timers,kills:()=>kills,createHost:context.module.exports.createHost};
}
test('Unreal host pipe errors reject startup without escaping as fatal process errors',async()=>{
 for(const stream of ['stdout','stderr','stdin']){const f=hostWorkerFixture(),pending=f.createHost('1',1,'2',2),rejected=assert.rejects(pending,/connection stopped/);
  assert.doesNotThrow(()=>f.child[stream].emit('error',Error('pipe failure')));await rejected;assert.equal(f.timers.size,0);assert.equal(f.kills(),1);
  f.child.emit('exit',1);assert.equal(f.kills(),1);
 }
});
test('Unreal host retains valid startup and handles late stream failure',async()=>{
 const f=hostWorkerFixture(),pending=f.createHost('1',1,'2',2);f.child.stdout.write('{"handle":"123"}\n');const host=await pending;
 assert.equal(host.handle,'123');assert.equal(f.timers.size,0);assert.doesNotThrow(()=>f.child.stdout.emit('error',Error('late failure')));host.close();
});
