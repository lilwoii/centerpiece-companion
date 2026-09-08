const test=require('node:test'),assert=require('node:assert/strict');
const {shutdownGate}=require('../src/shutdown.cjs');
test('repeated quit cannot bypass pending USB cleanup',async()=>{
 let release,cleaned=0,finished=0,prevented=0;
 const gate=shutdownGate(async()=>{cleaned++;await new Promise(r=>release=r);},()=>finished++,()=>assert.fail());
 const event={preventDefault(){prevented++;}};
 const pending=gate(event);await Promise.resolve();gate(event);
 assert.equal(prevented,2);assert.equal(cleaned,1);assert.equal(finished,0);
 release();await pending;gate(event);assert.equal(finished,1);assert.equal(prevented,2);
});
test('cleanup failure keeps app alive and permits a clean retry',async()=>{
 let tries=0,failures=0,finished=0;
 const gate=shutdownGate(async()=>{if(++tries===1)throw Error('busy');},()=>finished++,()=>failures++);
 await gate({preventDefault(){}});assert.equal(finished,0);assert.equal(failures,1);
 await gate({preventDefault(){}});assert.equal(finished,1);
});
