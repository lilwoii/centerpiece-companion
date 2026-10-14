const test=require('node:test'),assert=require('node:assert/strict');
const {DisplaySleep,allowed,minutes}=require('../src/display-sleep.cjs');
test('every offered duration retains minutes without one-byte truncation',async()=>{
 for(const value of allowed){let now=0;const writes=[],s=new DisplaySleep({now:()=>now,setEnabled:async value=>writes.push(value)});await s.configure(value);now=value*60000-1;await s.reconcile();assert.deepEqual(writes,[]);now=value*60000;await s.reconcile();assert.deepEqual(writes,value?[false]:[]);if(value){s.activity();await s.reconcile();assert.deepEqual(writes,[false,true]);}await s.close();}
 for(const invalid of [-1,1,255,256,721,'10',NaN])assert.throws(()=>minutes(invalid));
});
test('a key during the sleep command immediately queues wake and never remains asleep',async()=>{
 let now=0,release;const writes=[],s=new DisplaySleep({now:()=>now,setEnabled:value=>{writes.push(value);return value?Promise.resolve():new Promise(r=>release=r);}});await s.configure(10);now=600000;const sleeping=s.reconcile();s.activity();release();await sleeping;assert.deepEqual(writes,[false,true]);assert.equal(s.asleep,false);
});
test('never, timer changes and quitting wake the display',async()=>{
 let now=0;const writes=[],s=new DisplaySleep({now:()=>now,setEnabled:async v=>writes.push(v)});await s.configure(10);now=600000;await s.reconcile();await s.configure(0);assert.deepEqual(writes,[false,true]);await s.configure(10);now+=600000;await s.reconcile();await s.close();assert.equal(writes.at(-1),true);assert.equal(s.asleep,false);
});
test('failed hardware commands do not report the display asleep',async()=>{let now=0;const s=new DisplaySleep({now:()=>now,setEnabled:async()=>{throw Error('disconnected');}});await s.configure(10);now=600000;await assert.rejects(s.reconcile(),/disconnected/);assert.equal(s.asleep,false);});
