const test=require('node:test'),assert=require('node:assert/strict');const languages=require('../src/languages.cjs');
test('language labels fall back safely while a lookup is pending',()=>{const {languageLabel}=require('../src/language-labels.js');assert.equal(languageLabel('A',{id:'auto'}),'A');});
test('Windows Russian, Korean and automatic layouts produce usable labels',{skip:process.platform!=='win32'},async()=>{const ru=await languages.map('00000419'),ko=await languages.map('korean-2'),auto=await languages.map('auto');assert.equal(ru.labels[17],'й');assert.equal(ru.labels.length,68);assert.equal(ko.labels[17],'ㅂ');assert.equal(auto.id,'auto');assert.equal(auto.labels.length,68);assert.ok(auto.resolvedId);});
test('language IDs reject paths and commands',async()=>{await assert.rejects(languages.map('../layout'));await assert.rejects(languages.map('00000409;whoami'));});
test('the selector exposes the requested layouts with both Japanese input modes',async()=>{
 const choices=await languages.list();assert.deepEqual(choices.map(c=>c.id),['qwerty','00000409','00000809','korean-2','00000411','japanese-kana','00000419','00000804','00000407']);
 choices[0].name='changed';assert.notEqual((await languages.list())[0].name,'changed');
});
test('all eight layouts have complete four-state labels and correct input keys',{skip:process.platform!=='win32'},async()=>{
 const maps={};for(const {id}of await languages.list()){const m=maps[id]=await languages.map(id);for(const state of ['labels','shift','caps','capsShift']){assert.equal(m[state].length,68,id+' '+state);assert.ok(m[state].every(s=>typeof s==='string'&&s.trim()&&!/[\x00-\x1f]/.test(s)),id+' '+state);}}
 assert.equal(maps.qwerty.shift[2],'@');assert.equal(maps['00000809'].shift[2],'"');assert.equal(maps['00000809'].shift[3],'£');
 assert.equal(maps['korean-2'].labels[17],'ㅂ');assert.equal(maps['korean-2'].shift[17],'ㅃ');
 assert.equal(maps['00000419'].labels[17],'й');assert.equal(maps['00000419'].caps[17],'Й');
 assert.equal(maps['00000407'].labels[22],'z');assert.equal(maps['00000407'].labels[46],'y');assert.equal(maps['00000407'].labels[27],'ü');
 for(const id of ['00000411','00000804']){assert.equal(maps[id].ime,true);assert.deepEqual(maps[id].labels,maps.qwerty.labels);assert.deepEqual(maps[id].shift,maps.qwerty.shift);}
 const kana=maps['japanese-kana'];assert.equal(kana.labels[17],'た');assert.equal(kana.labels[19],'い');assert.equal(kana.shift[19],'ぃ');assert.equal(kana.shift[46],'っ');assert.equal(kana.shift[55],'・');assert.equal(kana.labels[29],'む');assert.deepEqual(kana.caps,kana.labels);assert.deepEqual(kana.capsShift,kana.shift);
 const {languageLabel}=require('../src/language-labels.js');assert.equal(languageLabel('Esc / `',kana),'Esc / ろ');
 const {Workspace,defaults}=require('../src/workspace.cjs');assert.equal(Workspace.prototype.validate({...defaults(),languageId:'japanese-kana',physicalLanguage:true}).languageId,'japanese-kana');
});
function languageWorkerFixture(){
 const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),{createRequire}=require('node:module'),{EventEmitter}=require('node:events'),{PassThrough}=require('node:stream');
 const file=path.resolve(__dirname,'../src/languages.cjs'),localRequire=createRequire(file),child=new EventEmitter(),timers=new Set();let kills=0;
 child.stdout=new PassThrough();child.stderr=new PassThrough();child.stdin=new PassThrough();child.kill=()=>kills++;
 const context={process,__dirname:path.dirname(file),module:{exports:{}},require:n=>n==='node:child_process'?{spawn:()=>child}:localRequire(n),setTimeout:fn=>{timers.add(fn);return fn;},clearTimeout:fn=>timers.delete(fn)};
 vm.runInNewContext(fs.readFileSync(file,'utf8'),context);return{child,timers,kills:()=>kills,languages:context.module.exports};
}
test('layout helper pipe errors reject safely and release the timeout',async()=>{
 for(const name of ['stdout','stderr','stdin']){const f=languageWorkerFixture(),promise=f.languages.map('00000409'),rejection=assert.rejects(promise,/lookup is unavailable/);
  assert.doesNotThrow(()=>f.child[name].emit('error',Error('pipe failure')));await rejection;assert.equal(f.timers.size,0);assert.equal(f.kills(),1);
  f.child.stdout.emit('data','x'.repeat(200001));f.child.emit('close',0);assert.equal(f.kills(),1);
 }
});
test('layout lookup drains final stdout after process exit and bounds late output',async()=>{
 const f=languageWorkerFixture(),promise=f.languages.map('00000409');f.child.emit('exit',0);
 f.child.stdout.write(JSON.stringify({labels:Array(68).fill('x')}));f.child.emit('close',0);assert.equal((await promise).labels.length,68);assert.equal(f.timers.size,0);assert.equal(f.kills(),0);
 const large=languageWorkerFixture(),rejected=assert.rejects(large.languages.map('00000409'),/too large/);large.child.stdout.write('x'.repeat(200001));await rejected;assert.equal(large.timers.size,0);assert.equal(large.kills(),1);
});
