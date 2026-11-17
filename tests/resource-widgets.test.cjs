const test=require('node:test'),assert=require('node:assert/strict');
const {memory,network}=require('../src/resource-monitor.cjs'),{summarize,csv}=require('../src/game-performance.cjs'),{validate}=require('../src/widget-sources.cjs'),{render}=require('../src/monitor-widgets.cjs');
test('memory and probe loss are based on real bounded samples',()=>{assert.equal(memory(100,25,1).percent,75);assert.equal(memory(0,0),null);const n=network([{at:9990,reachable:true,latency:18},{at:9991,reachable:false,latency:null}],true,10000);assert.equal(n.loss,50);assert.equal(n.connected,true);assert.equal(n.reachable,false);assert.equal(network([],true).loss,null);});
test('FPS excludes other swap chains and uses mean frame time, not mean instantaneous FPS',()=>{const r=summarize([{at:9900,chain:'a',ms:10},{at:9901,chain:'a',ms:30},{at:9901,chain:'b',ms:100}],10000);assert.equal(r.fps,50);assert.equal(r.frameMs,20);assert.equal(summarize([{at:1,chain:'a',ms:10}],10000),null);assert.deepEqual(csv('"a,b",2,3'),['a,b','2','3']);});
test('source settings validate provider identifiers and default to S&P 500',()=>{assert.equal(validate().symbols,'^GSPC');assert.throws(()=>validate({symbols:'AAPL&token=bad'}));});
test('monitor displays escape remote text and hide expired readings',()=>{const now=Date.now(),svg=render('downloads',{updatedAt:now,items:[{name:'<script>',total:100,done:10,source:'Test'}]},194,94,now);assert.ok(svg.includes('&lt;script&gt;'));assert.ok(!svg.includes('<script>'));assert.match(render('performance',{updatedAt:1,fps:60,frameMs:16,graph:[]},194,94,now),/Waiting/);});
test('new widgets validate without changing existing rotation defaults',()=>{const {Workspace,defaults}=require('../src/workspace.cjs'),{types}=require('../src/widget-sources.cjs');for(const type of types){const c=Workspace.prototype.validate({...defaults(),widget:{type,text:'',x:1710,y:219,width:194,height:94}});assert.equal(c.widget.type,type);assert.ok(!c.widgetOrder.includes('performance'));}});

test('quote change uses previous trading close and preserves provider timestamp',()=>{const {quote}=require('../src/widget-sources.cjs');const r=quote({chart:{result:[{meta:{regularMarketPrice:110,previousClose:100,chartPreviousClose:90,regularMarketTime:100,currency:'USD'}}]}},'TEST',200000);assert.equal(r.change,10);assert.equal(r.observedAt,100000);assert.throws(()=>quote({chart:{result:[{meta:{regularMarketPrice:0}}]}},'TEST'));});
test('retired widget choices preserve all other saved settings',()=>{const {Workspace,defaults}=require('../src/workspace.cjs');const original=Workspace.prototype.validate(defaults());const result=Workspace.prototype.validate({...original,widget:{...original.widget,type:'battery'},widgetOrder:['appointment','battery','spotify']});assert.equal(result.widget.type,'off');assert.deepEqual(result.widgetOrder,['spotify']);assert.deepEqual(result.slots,original.slots);});
test('market request failure preserves last quote with explicit offline status',async()=>{const {WidgetSources}=require('../src/widget-sources.cjs');const s=new WidgetSources('verification/nonexistent-widget-test');s.state.market={price:12,observedAt:10,updatedAt:10};s.poll=async()=>{throw Error('Network offline');};s.sample('market');await new Promise(r=>setImmediate(r));assert.equal(s.state.market.price,12);assert.equal(s.state.market.warning,'Network offline');s.close();});

test('market symbols accept plain stock and crypto names without provider punctuation',()=>{const {validate}=require('../src/widget-sources.cjs');assert.equal(validate({symbols:'aapl, $btcusd, ethusd, spx'}).symbols,'AAPL, BTC-USD, ETH-USD, ^GSPC');assert.equal(validate({symbols:'btc, BTCUSD, BTC-USD'}).symbols,'BTC-USD');assert.throws(()=>validate({symbols:'AAPL, TSLA, NVDA, AMD, INTC'}));assert.throws(()=>validate({symbols:'https://example.com'}));});
test('four market entries render together and keep unavailable entries isolated',()=>{const now=Date.now(),items=['AAPL','BTC-USD','NVDA'].map(symbol=>({symbol,price:123.45,change:2.5,observedAt:now,updatedAt:now}));items.push({symbol:'BAD',error:'No quote'});const svg=render('market',{items,updatedAt:now},194,94,now);assert.match(svg,/BTCUSD/);assert.match(svg,/AAPL/);assert.match(svg,/NVDA/);assert.match(svg,/Waiting/);assert.equal((svg.match(/123.45/g)||[]).length,3);assert.match(svg,/data:image\/svg\+xml;base64/);});

test('watchlist edits retain existing readings while new entries load',()=>{const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{WidgetSources}=require('../src/widget-sources.cjs');const dir=fs.mkdtempSync(path.join(os.tmpdir(),'watchlist-'));const s=new WidgetSources(dir);try{s.state.market={items:[{symbol:'AAPL',price:100,change:1,updatedAt:1,observedAt:1}]};s.save({symbols:'AAPL,BTCUSD'});assert.equal(s.state.market.items[0].price,100);assert.equal(s.state.market.items[1].loading,true);assert.ok(s.state.market.updatedAt);assert.doesNotMatch(render('market',s.state.market,194,94),/Unavailable/);}finally{s.close();fs.rmSync(dir,{recursive:true,force:true});}});
test('market logos use the corresponding brand color',()=>{const {logo}=require('../src/market-logo.cjs');for(const [symbol,color]of [['TSLA','#E82127'],['BTC-USD','#F7931A'],['NVDA','#76B900']])assert.ok(Buffer.from(logo(symbol).split(',')[1],'base64').toString().includes(color));});

test('monitoring plugin readings share widget data and reject stale values',()=>{const {reading}=require('../src/widgets.cjs'),now=Date.now(),live={performance:{updatedAt:now,fps:120},ram:{updatedAt:now,percent:42},vram:{updatedAt:now,percent:67},network:{updatedAt:now,reachable:true,latency:18}};assert.equal(reading('performance',{live,now}).value,'120');assert.equal(reading('ram',{live,now}).value,'42%');assert.equal(reading('vram',{live,now}).value,'67%');assert.equal(reading('network',{live,now}).value,'18ms');assert.equal(reading('performance',{live,now:now+5000}).value,'—');});


function sensorFixture(){
 const {EventEmitter}=require('node:events'),{PassThrough}=require('node:stream'),{WidgetSources}=require('../src/widget-sources.cjs');
 const child=new EventEmitter();child.stdout=new PassThrough();child.stderr=new PassThrough();child.stdin=new PassThrough();let kills=0;child.kill=()=>{kills++;};
 const sources=new WidgetSources('verification/nonexistent-sensor-test',{spawnSensor:()=>child});return{child,sources,kills:()=>kills};
}
test('download sensor pipe failures settle once and release process tracking immediately',async()=>{
 for(const stream of ['stdout','stderr','stdin']){const f=sensorFixture(),pending=f.sources.sensor('downloads'),rejected=assert.rejects(pending,/connection stopped/);
  assert.doesNotThrow(()=>f.child[stream].emit('error',Error('broken pipe')));await rejected;assert.equal(f.sources.children.size,0);assert.equal(f.sources.sensorCancels.size,0);assert.equal(f.kills(),1);
  f.child.stdout.emit('data',Buffer.alloc(100000));f.child.emit('close',0);assert.equal(f.kills(),1);f.sources.close();
 }
});
test('closing widget sources cancels outstanding sensors without waiting for their timeout',async()=>{
 const f=sensorFixture(),pending=f.sources.sensor('downloads'),rejected=assert.rejects(pending,/closed/);f.sources.close();await rejected;assert.equal(f.kills(),1);assert.equal(f.sources.children.size,0);await assert.rejects(f.sources.sensor('downloads'),/closed/);
});
test('download sensors bound output and retain normal successful results',async()=>{
 const oversized=sensorFixture(),pending=oversized.sources.sensor('downloads'),rejected=assert.rejects(pending,/too large/);oversized.child.stdout.emit('data',Buffer.alloc(65537));await rejected;assert.equal(oversized.kills(),1);oversized.sources.close();
 const f=sensorFixture(),result=f.sources.sensor('downloads');f.child.stdout.write(JSON.stringify({items:[{name:'download',done:10,total:20}]}));f.child.emit('close',0);assert.equal((await result).items[0].done,10);assert.equal(f.sources.children.size,0);assert.equal(f.kills(),0);f.sources.close();
});


test('game capture output errors stop only the failed helper and clear stale FPS samples',()=>{
 const {EventEmitter}=require('node:events'),{PassThrough}=require('node:stream'),{GamePerformance}=require('../src/game-performance.cjs');
 const workers=[],capture=new GamePerformance({spawnProcess:()=>{const p=new EventEmitter();p.stdout=new PassThrough();p.stderr=new PassThrough();p.kill=()=>{p.killed=true;};workers.push(p);return p;}});
 capture.start('game.exe');capture.frames=[{at:Date.now(),ms:10,chain:'a'}];assert.doesNotThrow(()=>workers[0].stdout.emit('error',Error('pipe failure')));assert.equal(capture.proc,null);assert.equal(capture.frames.length,0);workers[1].emit('exit',0);assert.equal(workers[0].killed,true);
 capture.start('game.exe');const current=capture.proc;workers[0].stderr.emit('error',Error('late error'));assert.equal(capture.proc,current);assert.doesNotThrow(()=>current.stderr.emit('error',Error('second pipe failure')));assert.equal(capture.proc,null);workers.at(-1).emit('exit',0);
});
test('game capture cleanup spawn failure still terminates the original helper',()=>{
 const {EventEmitter}=require('node:events'),{PassThrough}=require('node:stream'),{GamePerformance}=require('../src/game-performance.cjs');
 const p=new EventEmitter();p.stdout=new PassThrough();p.stderr=new PassThrough();let killed=0,calls=0;p.kill=()=>killed++;
 const capture=new GamePerformance({spawnProcess:()=>{if(calls++)throw Error('helper unavailable');return p;}});capture.start('game.exe');assert.doesNotThrow(()=>capture.stop());assert.equal(killed,1);assert.equal(capture.proc,null);assert.equal(capture.reader,null);
});


test('game capture pipe failure uses the same bounded ETW session cleanup as a normal stop',()=>{
 const {EventEmitter}=require('node:events'),{PassThrough}=require('node:stream'),{GamePerformance}=require('../src/game-performance.cjs');const calls=[];
 const capture=new GamePerformance({spawnProcess:(exe,args)=>{const p=new EventEmitter();p.stdout=new PassThrough();p.stderr=new PassThrough();p.kill=()=>{p.killed=true;};calls.push({p,args});return p;}});
 capture.start('game.exe');const session=capture.sessionName;calls[0].p.stdout.emit('error',Error('pipe closed'));
 assert.equal(capture.proc,null);assert.deepEqual(calls[1].args,['--session_name',session,'--terminate_existing_session']);calls[1].p.emit('exit',0);assert.equal(calls[0].p.killed,true);
});
