const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
test('a completed network probe reaches live plugin data while another sensor is still pending',async()=>{
 let collector,release;class ResourceMonitor{constructor(options){this.options=options;this.state={};collector=this;}sample(){}deliver(value){this.state.network=value;this.options?.onUpdate?.(value);}}
 const sourceRequire=require('node:module').createRequire(require.resolve('../src/live-data.cjs'));const box={module:{exports:{}},require:name=>name==='./resource-monitor.cjs'?{ResourceMonitor}:sourceRequire(name)};
 vm.runInNewContext(fs.readFileSync(require.resolve('../src/live-data.cjs'),'utf8'),box);
 const live=new box.module.exports.LiveData({request:()=>new Promise(resolve=>release=resolve)});live.monitorNetwork=true;live.lastSensors=Date.now();
 const pending=live.sample(),reading={connected:true,reachable:true,latency:13,loss:0,samples:1,updatedAt:Date.now()};collector.deliver(reading);
 try{assert.equal(live.busy,true);assert.equal(live.state.network,reading);assert.equal(require('../src/widgets.cjs').reading('network',{live:live.state}).value,'13ms');}finally{release(null);await pending;}
});
test('the real collector publishes probe completion once and ignores completion after shutdown',()=>{
 let complete;const sourceRequire=require('node:module').createRequire(require.resolve('../src/resource-monitor.cjs'));
 const box={module:{exports:{}},__dirname:require('node:path').dirname(require.resolve('../src/resource-monitor.cjs')),process,require:name=>name==='node:child_process'?{execFile:(_file,_args,_options,callback)=>{complete=callback;return{kill(){}};}}:sourceRequire(name)};
 vm.runInNewContext(fs.readFileSync(require.resolve('../src/resource-monitor.cjs'),'utf8'),box);
 const updates=[],r=new box.module.exports.ResourceMonitor({onUpdate:value=>updates.push(value)});r.sample(true);
 assert.equal(updates.length,0);complete(null,JSON.stringify({reachable:true,latency:17}));assert.equal(updates.length,1);assert.equal(updates[0].latency,17);assert.equal(r.busy,false);r.close();
 const stopped=new box.module.exports.ResourceMonitor({onUpdate:()=>assert.fail('closed collector must stay silent')});stopped.sample(true);stopped.close();complete(null,JSON.stringify({reachable:true,latency:18}));
});
