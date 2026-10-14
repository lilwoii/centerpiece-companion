const test=require('node:test'),assert=require('node:assert/strict');const{readUpdateRoot}=require('../src/update-storage.cjs');
test('update storage follows a separately selected drive with an app-owned subfolder',()=>{const ini=Buffer.from('[Storage]\r\nUpdateRoot=M:\\Updates\r\n');assert.equal(readUpdateRoot(ini,'D:\\Apps\\Centerpiece Companion\\app.exe'),'M:\\Updates\\.centerpiece-companion-updates');});
test('Unicode installer settings and older installations select the correct drive',()=>{const ini=Buffer.concat([Buffer.from([255,254]),Buffer.from('[Storage]\r\nUpdateRoot=D:\\My Updates\r\n','utf16le')]);assert.equal(readUpdateRoot(ini,'C:\\App\\app.exe'),'D:\\My Updates\\.centerpiece-companion-updates');assert.equal(readUpdateRoot(undefined,'D:\\Apps\\Centerpiece Companion\\app.exe'),'D:\\Apps\\Centerpiece Companion-updates\\.centerpiece-companion-updates');});
test('network and relative update destinations are rejected',()=>{for(const root of ['\\\\server\\share','relative-folder','https://example.com'])assert.throws(()=>readUpdateRoot(Buffer.from('UpdateRoot='+root),'D:\\App\\app.exe'));});
function storageMock({denyFallback=false,files={},deniedWrite,fullDrive=false}={}){
 const vm=require('node:vm'),realFS=require('node:fs'),writes=[],created=[],probes=[],removed=[];
 const fakeFS={
  readFileSync(p){if(!(p in files))throw Object.assign(Error('Missing file'),{code:'ENOENT'});return Buffer.from(files[p]);},
  mkdirSync(p){if(p.startsWith('D:\\Locked')||denyFallback&&p.startsWith('C:\\UserData\\.centerpiece-companion-updates'))throw Object.assign(Error('Access denied'),{code:'EPERM'});if(fullDrive)throw Object.assign(Error('Disk full'),{code:'ENOSPC'});created.push(p);},
  openSync(p){probes.push(p);if(deniedWrite?.(p))throw Object.assign(Error('Access denied'),{code:'EACCES'});return 1;},
  writeSync:()=>{},closeSync:()=>{},unlinkSync:p=>removed.push(p),writeFileSync:(...args)=>writes.push(args)
 };
 const box={module:{exports:{}},Buffer,require:n=>n==='node:fs'?fakeFS:n==='node:path'?require('node:path').win32:require(n)};
 vm.runInNewContext(realFS.readFileSync(require.resolve('../src/update-storage.cjs'),'utf8'),box);
 return{...box.module.exports,writes,created,probes,removed,app:{getPath:n=>n==='exe'?'D:\\App\\app.exe':'C:\\UserData'}};
}
test('protected update folder falls back to the account cache without replacing the preferred drive',async()=>{
 const files={'C:\\UserData\\update-location.ini':'[Storage]\nUpdateRoot=D:\\Locked\n','D:\\App\\install-locations.ini':'[Storage]\nUpdateRoot=D:\\Installer\n'},s=storageMock({files});
 const preferred=s.updateStorage(s.app);
 assert.equal(preferred,'D:\\Locked\\.centerpiece-companion-updates');
 assert.equal(await s.chooseWritableStorage(s.app,preferred,{showOpenDialog:()=>assert.fail('Unexpected folder prompt')}),'C:\\UserData\\.centerpiece-companion-updates');
 assert.equal(s.writes.length,0);
 assert.equal(s.updateStorage(s.app),preferred);
 assert.ok(s.created.some(p=>p.endsWith('pending')));
});
test('empty and invalid account preferences do not hide the installer update location',()=>{
 for(const preference of ['[Storage]\n','[Storage]\nUpdateRoot=\n','[Storage]\nUpdateRoot=relative\n']){
  const s=storageMock({files:{'C:\\UserData\\update-location.ini':preference,'D:\\App\\install-locations.ini':'[Storage]\r\nUpdateRoot=M:\\Updates\r\n'}});
  assert.equal(s.updateStorage(s.app),'M:\\Updates\\.centerpiece-companion-updates');
 }
});
test('denied writes in an existing pending folder also use the account fallback',async()=>{
 const s=storageMock({deniedWrite:p=>p.startsWith('D:\\Preferred\\centerpiece-companion-updater\\pending')});
 assert.equal(await s.chooseWritableStorage(s.app,'D:\\Preferred',{showOpenDialog:()=>assert.fail('Unexpected folder prompt')}),'C:\\UserData\\.centerpiece-companion-updates');
 assert.equal(s.writes.length,0);
});
test('when both caches are protected the chosen writable folder is saved',async()=>{const s=storageMock({denyFallback:true});let calls=0;const result=await s.chooseWritableStorage(s.app,'D:\\Locked\\.centerpiece-companion-updates',{showOpenDialog:async()=>{calls++;return{filePaths:['D:\\Writable'],canceled:false};}});assert.equal(calls,1);assert.equal(result,'D:\\Writable\\.centerpiece-companion-updates');assert.equal(s.writes.length,1);assert.match(s.writes[0][1],/UpdateRoot=D:\\Writable/);assert.ok(s.created.some(p=>p.endsWith('pending')));});
test('cancelling folder recovery performs no download-location writes',async()=>{const s=storageMock({denyFallback:true});assert.equal(await s.chooseWritableStorage(s.app,'D:\\Locked',{showOpenDialog:async()=>({canceled:true})}),null);assert.equal(s.writes.length,0);});
test('a second denied folder is never saved and writable folders require no picker',async()=>{const s=storageMock({denyFallback:true});await assert.rejects(()=>s.chooseWritableStorage(s.app,'D:\\Locked',{showOpenDialog:async()=>({filePaths:['D:\\Locked'],canceled:false})}));assert.equal(s.writes.length,0);assert.equal(await s.chooseWritableStorage(s.app,'D:\\Writable',{showOpenDialog:()=>assert.fail('Unexpected folder prompt')}),'D:\\Writable');});
test('full disks report the original failure without persisting a different location',async()=>{const s=storageMock({fullDrive:true});await assert.rejects(()=>s.chooseWritableStorage(s.app,'D:\\Preferred',{showOpenDialog:()=>assert.fail('Unexpected folder prompt')}),{code:'ENOSPC'});assert.equal(s.writes.length,0);});
test('installer temporary directory is write-checked and the probe is removed',()=>{const s=storageMock();assert.equal(s.prepareUpdateTemp('D:\\Preferred'),'D:\\Preferred\\temporary');assert.equal(s.probes.length,1);assert.deepEqual(s.removed,s.probes);const denied=storageMock({deniedWrite:()=>true});assert.throws(()=>denied.prepareUpdateTemp('D:\\Preferred'),{code:'EACCES'});});
