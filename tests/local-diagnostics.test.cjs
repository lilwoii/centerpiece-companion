const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {write}=require('../src/local-diagnostics.cjs');
test('diagnostics save beneath the supplied writable user directory',t=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'companion-diagnostics-'));t.after(()=>fs.rmSync(directory,{recursive:true,force:true}));
 assert.equal(write(directory,{networkMonitor:{enabled:true}}),true);assert.equal(JSON.parse(fs.readFileSync(path.join(directory,'diagnostics/state.json'))).networkMonitor.enabled,true);
 const source=fs.readFileSync(require.resolve('../src/main.cjs'),'utf8');const body=source.slice(source.indexOf('function diagnostics(){'),source.indexOf("app.on('second-instance'"));assert.match(body,/app.getPath\('userData'\)/);assert.doesNotMatch(body,/__dirname/);
});
test('diagnostic file permission failures never escape into the Electron main loop',()=>{
 assert.equal(write('unused',{}, {mkdirSync(){throw Object.assign(Error('Denied'),{code:'EPERM'});}}),false);
 assert.equal(write('unused',{}, {mkdirSync(){},writeFileSync(){throw Error('Disk full');}}),false);
});
