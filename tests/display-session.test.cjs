const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function fixture(){
 const clients=[],control={serial:'keyboard-a'},manifest={serial:'keyboard-a',verified:true,ownedSlots:[9,10],originalSlot:1};
 class Som{constructor(){this.serial=control.serial;this.closed=0;clients.push(this);}close(){this.closed++;}}
 const box={module:{exports:{}},setTimeout,clearTimeout,require:name=>name==='./som.cjs'?{Som}:name==='node:fs'?{existsSync:()=>true,readFileSync:()=>JSON.stringify(manifest)}:require(name)};
 vm.runInNewContext(fs.readFileSync(require.resolve('../src/display-cache.cjs'),'utf8'),box);
 return{cache:new box.module.exports.DisplayCache('.',()=>''),clients,control,manifest};
}
test('reinitializing a display releases its previous USB client and stale frame mappings',()=>{
 const f=fixture();assert.equal(f.cache.connect(),true);const first=f.cache.som;f.cache.cache.set('idle:0',9);
 assert.equal(f.cache.connect(),true);assert.equal(first.closed,1);assert.equal(f.cache.cache.size,0);
 f.cache.detach();assert.ok(f.clients.every(c=>c.closed===1));
});
test('an identity mismatch closes only the rejected new client and keeps the original session recoverable',()=>{
 const f=fixture();f.cache.connect();const first=f.cache.som;f.control.serial='keyboard-b';
 assert.throws(()=>f.cache.connect(),/own local setup/);assert.equal(f.cache.som,first);assert.equal(first.closed,0);assert.equal(f.clients[1].closed,1);
 f.cache.detach();assert.equal(first.closed,1);
});
test('an active upload or status read cannot have its session replaced',()=>{
 for(const field of ['updating','watching']){const f=fixture();f.cache.connect();const first=f.cache.som;f.cache[field]=true;
 assert.throws(()=>f.cache.connect(),/busy/i);assert.equal(f.clients.length,1);assert.equal(f.cache.som,first);assert.equal(first.closed,0);f.cache[field]=false;f.cache.detach();}
});
