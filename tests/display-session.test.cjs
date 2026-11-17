const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function fixture(){
 const clients=[],control={serial:'keyboard-a'},manifest={serial:'keyboard-a',verified:true,ownedSlots:[9,10],originalSlot:1};
 class Som{constructor(){this.serial=control.serial;this.closed=0;clients.push(this);}close(){this.closed++;}}
 const box={module:{exports:{}},setTimeout,clearTimeout,require:name=>name==='./som.cjs'?{Som}:name==='node:fs'?{existsSync:()=>true,readFileSync:()=>JSON.stringify(manifest)}:name==='./overlay-allocation.cjs'?require('../src/overlay-allocation.cjs'):require(name)};
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

function stripFixture(){
 const {StripController}=require('../src/strip.cjs'),strip=new StripController('missing-test-only-strip-directory'),events=[];
 strip.som={activate:async()=>events.push('activate'),close:()=>events.push('close')};strip.manifest={originalSlot:1};
 strip.legends={model:null,restore:async()=>events.push('legends')};return{strip,events};
}
const turn=()=>new Promise(resolve=>setTimeout(resolve,25));

test('strip close blocks new live work immediately and deduplicates legend restoration',async()=>{
 const {strip,events}=stripFixture();let release;strip.pluginAnimationPromise=new Promise(resolve=>{release=resolve;});
 const first=strip.close(),second=strip.close();assert.equal(strip.closing,true);assert.throws(()=>strip.connect(),/busy/i);assert.deepEqual(events,[]);
 release();await Promise.all([first,second]);assert.deepEqual(events,['legends','activate','close']);
});

test('strip close waits for active overlay work before restoring native legends',async()=>{
 const {strip,events}=stripFixture();strip.updating=true;const closing=strip.close();await turn();assert.deepEqual(events,[]);
 strip.updating=false;await closing;assert.deepEqual(events,['legends','activate','close']);
});

test('strip close waits for pending language preparation and never commits new legends afterward',async()=>{
 const {strip,events}=stripFixture();let release;strip.legends.prepare=()=>new Promise(resolve=>{release=resolve;});strip.legends.commit=async()=>events.push('commit');
 const applying=strip.apply({hideLegends:true},{}),rejected=assert.rejects(applying,/restoration is pending/i);const closing=strip.close();await turn();assert.deepEqual(events,[]);
 release();await rejected;await closing;assert.equal(events.includes('commit'),false);assert.deepEqual(events.slice(-2),['activate','close']);assert.equal(strip.som,null);
});

test('failed strip legend restoration keeps the session retryable and blocks live updates',async()=>{
 const {strip,events}=stripFixture();let attempts=0;strip.legends.restore=async()=>{attempts++;if(attempts===1)throw Error('legend reply missing');events.push('legends');};
 await assert.rejects(strip.close(),/legend reply missing/);assert.equal(strip.closing,true);assert.notEqual(strip.som,null);assert.deepEqual(events,[]);
 await strip.close();assert.equal(attempts,2);assert.deepEqual(events,['legends','activate','close']);
});

test('late strip legend restoration cannot close a replacement display session',async()=>{
 const {strip,events}=stripFixture();let release;strip.legends.restore=()=>new Promise(resolve=>{release=resolve;});const closing=strip.close();
 strip.detach();const replacement={close(){assert.fail('replacement must stay open');}};strip.som=replacement;release();await closing;assert.equal(strip.som,replacement);assert.deepEqual(events,['close']);
});
