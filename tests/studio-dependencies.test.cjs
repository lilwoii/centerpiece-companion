const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {StudioDependencies,download,URL}=require('../src/studio-dependencies.cjs');
function fixture(t,options){const directory=fs.mkdtempSync(path.join(os.tmpdir(),'studio-deps-'));t.after(()=>fs.rmSync(directory,{recursive:true,force:true}));return new StudioDependencies(directory,{platform:'win32',...options});}
test('installed Microsoft tools are reused without downloading or launching an installer',async t=>{
 const calls=[],deps=fixture(t,{detect:async opts=>{calls.push(opts);return{engine427Found:true,windowsCppFound:true,windowsSdkFound:true};},powershell:async script=>{assert.match(script,/NETFXSDK/);return'ready';},download:async()=>assert.fail('Download should not run')});
 assert.equal((await deps.check({force:true})).ready,true);assert.equal(calls[0].force,true);
 deps.install();await deps.promise;assert.equal(deps.status().state,'ready');
});
test('repeated install requests share one operation and do not compete with another installer',async t=>{
 let release;const gate=new Promise(resolve=>release=resolve);let checks=0;
 const deps=fixture(t,{detect:async()=>{checks++;await gate;return{};},powershell:async script=>script.includes('Get-Process')?'1':'',download:async()=>assert.fail('No download while another installer runs')});
 deps.install();const running=deps.promise;deps.install();assert.equal(deps.promise,running);release();await running;
 assert.equal(checks,1);assert.equal(deps.status().code,'STUDIO_DEPENDENCY_BUSY');
});
test('a changed local installer cannot reach signature checking or execution',async t=>{
 const deps=fixture(t,{detect:async()=>({}),powershell:async script=>{assert.doesNotMatch(script,/Start-Process|AuthenticodeSignature/);return script.includes('Get-Process')?'0':'';},download:async file=>fs.writeFileSync(file,'untrusted installer')});
 deps.install();await deps.promise;assert.equal(deps.status().code,'STUDIO_DEPENDENCY_SIGNATURE');
});
test('downloads only use the pinned official destination and reject changed content before saving',async t=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'studio-deps-download-'));t.after(()=>fs.rmSync(directory,{recursive:true,force:true}));const file=path.join(directory,'installer.exe');
 await assert.rejects(download(file,async(url,options)=>{assert.equal(url,URL);assert.equal(options.redirect,'error');return{ok:true,body:[Buffer.from('invalid bytes')]};}),{code:'STUDIO_DEPENDENCY_SIGNATURE'});
 assert.equal(fs.existsSync(file),false);
});
test('non-Windows machines cannot launch the Windows dependency installer',t=>{
 const deps=fixture(t,{platform:'linux',detect:async()=>({})});assert.throws(()=>deps.install(),{code:'STUDIO_DEPENDENCY_PLATFORM'});
});
const {resumeDependencies}=require('../src/studio-dependencies.cjs');
test('post-update setup installs missing tools once per version and reuses installed tools',async t=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'studio-auto-deps-'));t.after(()=>fs.rmSync(directory,{recursive:true,force:true}));const file=path.join(directory,'preferences.json');let installs=0,ready=false;
 const deps={check:async()=>({engineFound:true,ready}),install:()=>{installs++;return{state:'installing'};},status:()=>({state:'idle'})};
 await resumeDependencies(deps,file,'1');await resumeDependencies(deps,file,'1');assert.equal(installs,1);
 await resumeDependencies(deps,file,'2');assert.equal(installs,2);ready=true;await resumeDependencies(deps,file,'3');assert.equal(installs,2);
});
test('post-update setup respects opt-out and does not install creator tools without Unreal',async t=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'studio-auto-deps-'));t.after(()=>fs.rmSync(directory,{recursive:true,force:true}));const file=path.join(directory,'preferences.json');const deps={check:async()=>({engineFound:false,ready:false}),install:()=>assert.fail('Installer must not run')};
 assert.equal((await resumeDependencies(deps,file,'1')).state,'engine-required');assert.equal(fs.existsSync(file),false);
 fs.writeFileSync(file,JSON.stringify({automatic:false}));assert.equal((await resumeDependencies(deps,file,'1')).state,'disabled');
});
