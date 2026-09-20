'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const M=require('../studio/model.js');
const P=require('../studio/presets.js');
const R=require('../studio/render.js');

test('pointer and Caps interactions respect chosen keys and a targeted test only fires its rule',()=>{
 const pointer=M.createRule({id:'a',trigger:'pointer',keys:['KeyA'],key:'any'}),caps=M.createRule({id:'b',trigger:'caps',keys:['CapsLock'],key:'any'});
 assert.equal(R.matches(pointer,{type:'pointer',key:'KeyA'}),true);assert.equal(R.matches(pointer,{type:'pointer',key:'KeyB'}),false);
 assert.equal(R.matches(caps,{type:'caps',key:'CapsLock'}),true);assert.equal(R.matches(caps,{type:'caps',key:'KeyB'}),false);
 assert.equal(R.matches(pointer,{type:'pointer',key:'KeyA',ruleId:'a'}),true);assert.equal(R.matches(pointer,{type:'pointer',key:'KeyA',ruleId:'b'}),false);
});

test('PNG game capture freezes the displayed simulation without creating an export session or sharing state',()=>{
 const p=M.createProject('Game export');p.layers=[M.createLayer('collection',{text:'cloud-courier'})];
 const live=recorder();R.draw(live.ctx,p,.2,[],{gameTime:1.2,gameEvents:[{id:1,type:'keyDown',key:'Space',time:1}]});
 const captured=R.captureGames(live.ctx),key=Object.keys(captured)[0],frozen=JSON.stringify(captured);
 const exported=recorder();R.draw(exported.ctx,p,.2,[],{capturedGames:captured});assert.deepEqual(exported.calls,live.calls);assert.equal(Object.keys(R.captureGames(exported.ctx)).length,0);
 assert.equal(JSON.stringify(captured),frozen);captured[key].state.score=999;assert.notEqual(R.captureGames(live.ctx)[key].state.score,999);
});

function recorder(){
 const calls=[],state={},stack=[];let nextGradient=0;
 const methods=['clearRect','fillRect','strokeRect','beginPath','closePath','moveTo','lineTo','arc','ellipse','fill','stroke','rect','clip','translate','rotate','scale','fillText','drawImage'];
 const context={calls};
 for(const method of methods)context[method]=(...args)=>{assert.ok(args.every(a=>typeof a!=='number'||Number.isFinite(a)),method+' received invalid number');calls.push([method,...args]);};
 for(const method of ['createLinearGradient','createRadialGradient'])context[method]=(...args)=>{assert.ok(args.every(Number.isFinite));const id='gradient'+nextGradient++;calls.push([method,id,...args]);return{id,addColorStop(position,color){assert.ok(position>=0&&position<=1);assert.ok(!color.includes('NaN'));calls.push(['stop',id,position,color]);}};};
 context.save=()=>{stack.push({...state});calls.push(['save']);};context.restore=()=>{assert.ok(stack.length,'unbalanced restore');Object.assign(state,stack.pop());calls.push(['restore']);};
 const proxy=new Proxy(context,{set(obj,key,value){state[key]=value;calls.push(['set',key,value?.id||value]);obj[key]=value;return true;}});
 return{ctx:proxy,calls,stack};
}
function project(type='solid',overrides={}){const p=M.createProject();p.layers=[M.createLayer(type,{color:'#ff0000',...overrides})];return p;}

test('from-scratch lightning remains key reactive with ambient animation off and changes origin for each press',()=>{
 const p=project('lightning',{speed:0});p.rules=[M.createRule({effect:'lightning',trigger:'keyDown',target:p.layers[0].id,duration:.5})];
 const paint=(t,events)=>{const c=recorder();R.draw(c.ctx,p,t,events);assert.equal(c.stack.length,0);return c.calls;};
 const press=time=>({type:'keyDown',key:'KeyA',time,x:420,y:320,strength:1});
 const idle=paint(1,[]),first=paint(1.01,[press(1)]),second=paint(2.01,[press(2)]);
 assert.notDeepEqual(first,idle);assert.notDeepEqual(first.filter(c=>c[0]==='moveTo'),second.filter(c=>c[0]==='moveTo'));
 assert.deepEqual(first,paint(1.01,[press(1)]));assert.deepEqual(paint(2,[]),paint(2,[press(1)]));
});

test('custom tornado animation is deterministic and speed zero freezes its motion',()=>{
 const p=project('tornado');const paint=t=>{const c=recorder();R.draw(c.ctx,p,t);assert.equal(c.stack.length,0);return c.calls;};
 assert.notDeepEqual(paint(1),paint(2));assert.deepEqual(paint(1),paint(1));p.layers[0].speed=0;assert.deepEqual(paint(1),paint(10));
});
function trace(p,time=1,events=[]){const rec=recorder();const result=R.draw(rec.ctx,p,time,events);assert.equal(rec.stack.length,0);return{...rec,result};}
const event=(key='KeyA',time=0,type='keyDown')=>({key,time,type,x:300,y:200,strength:1});
function withRule(effect,overrides={}){const p=project();p.rules=[M.createRule({effect,target:p.layers[0].id,duration:1,...overrides})];return p;}

test('toggle state retained outside bounded event history survives unrelated events',()=>{
 const p=withRule('toggle',{key:'KeyA'}),id=p.rules[0].id,base={[id]:true};
 const recent=Array.from({length:256},()=>event('KeyB',1));
 assert.equal(R.activeRules(p,recent,2,base).filter(x=>x.rule.effect==='toggle').length,1);
 recent.shift();recent.push(event('KeyA',2));
 assert.equal(R.activeRules(p,recent,2,base).filter(x=>x.rule.effect==='toggle').length,0);
 assert.equal(R.activeRules(p,[],2,{}).length,0);
});

test('all effect types and presets render without invalid Canvas operations, deterministically',()=>{
 for(const type of M.types){const p=project(type,{text:type==='collection'?'lantern-festival':'Skin Studio\nAnimated canvas'}),a=trace(p,2.3),b=trace(p,2.3);assert.deepEqual(a.calls,b.calls,type);assert.ok(a.calls.length>15);}
 for(const preset of P.list){const p=preset.create();assert.deepEqual(trace(p,2.3).calls,trace(p,2.3).calls,preset.name);assert.ok(trace(p,2.3).calls.length>150);}
});
test('ambient effects materially animate while speed zero remains still',()=>{
 for(const type of ['gradient','wave','ripple','particles','stars','rain','snow','fireflies','orbit','aurora','plasma','grid','rings']){
  const p=project(type);assert.notDeepEqual(trace(p,1).calls,trace(p,1.5).calls,type+' must animate');p.layers[0].speed=0;assert.deepEqual(trace(p,1).calls,trace(p,1.5).calls,type+' must pause');
 }
});
test('keyframes interpolate each property with easing and hold endpoints without mutating source',()=>{
 const l=M.createLayer('solid',{x:10,keyframes:[{id:'x0',time:0,property:'x',value:20,easing:'linear'},{id:'x1',time:2,property:'x',value:100,easing:'ease-in'},{id:'o1',time:4,property:'opacity',value:0,easing:'linear'}]});
 const original=JSON.stringify(l);assert.equal(R.layerAt(l,-1).x,10);assert.equal(R.layerAt(l,0).x,20);assert.equal(R.layerAt(l,1).x,40);assert.equal(R.layerAt(l,2).x,100);assert.equal(R.layerAt(l,20).x,100);assert.equal(R.layerAt(l,2).opacity,.5);assert.equal(R.layerAt(l,4).opacity,0);assert.equal(JSON.stringify(l),original);
 assert.equal(R.ease(.5,'ease-out'),.75);assert.equal(R.ease(.5,'smooth'),.5);assert.equal(R.ease(2,'linear'),1);
});
test('hit selection respects stacking, locks, invisibility, opacity, animation and rotation',()=>{
 const p=project('solid',{id:'back',x:0,y:0,width:500,height:400});const front=M.createLayer('solid',{id:'front',x:100,y:100,width:200,height:100});p.layers.push(front);
 assert.equal(R.hitTest(p,150,150).id,'front');front.locked=true;assert.equal(R.hitTest(p,150,150).id,'back');front.locked=false;front.visible=false;assert.equal(R.hitTest(p,150,150).id,'back');front.visible=true;front.opacity=0;assert.equal(R.hitTest(p,150,150).id,'back');front.opacity=1;
 front.rotation=90;assert.equal(R.hitTest(p,200,60).id,'front');assert.equal(R.hitTest(p,105,105).id,'back');assert.equal(R.hitTest(p,900,500),null);assert.equal(R.hitTest(p,NaN,3),null);
 front.rotation=0;front.keyframes=[{id:'x',time:1,property:'x',value:600,easing:'linear'}];assert.equal(R.hitTest(p,650,140,1).id,'front');assert.equal(front.x,100);
});
test('rules trigger only for matched events, expire correctly, and produce visible output',()=>{
 for(const effect of ['ripple','burst','flash','heat','pulse']){
  const p=withRule(effect,{key:'KeyA'}),base=trace(p,.5).calls;
  assert.deepEqual(trace(p,.5,[event('KeyB')]).calls,base,effect+' wrong key');assert.deepEqual(trace(p,.5,[event('KeyA',0,'keyUp')]).calls,base,effect+' wrong trigger');
  assert.notDeepEqual(trace(p,.5,[event()]).calls,base,effect+' must alter canvas');assert.deepEqual(trace(p,2,[event()]).calls,trace(p,2).calls,effect+' expired');
  if(effect==='pulse')assert.ok(trace(p,.5,[event()]).calls.some(c=>c[0]==='scale'&&c[1]>1));
 }
 const p=withRule('ripple',{trigger:'pointer'});assert.notDeepEqual(trace(p,.5,[event('any',0,'pointer')]).calls,trace(p,.5).calls);
});
test('toggle persists beyond duration until another matching event, including hidden-layer toggle on',()=>{
 const p=withRule('toggle',{key:'KeyA',duration:.05});
 const painted=events=>trace(p,100,events).calls.some(c=>c[0]==='set'&&c[1]==='fillStyle'&&c[2]==='#ff0000');
 assert.equal(painted([]),true);assert.equal(painted([event('KeyA',0)]),false);assert.equal(painted([event('KeyA',0),event('KeyA',90)]),true);
 assert.equal(painted([event('KeyA',0),event('KeyB',90)]),false);p.layers[0].visible=false;assert.equal(painted([]),false);assert.equal(painted([event()]),true);
});
test('targeted reactions preserve unrelated layers and all-target reactions cover the canvas',()=>{
 const p=withRule('toggle');p.layers.push(M.createLayer('solid',{color:'#00ff00'}));const calls=trace(p,1,[event()]).calls;
 assert.ok(!calls.some(c=>c[0]==='set'&&c[1]==='fillStyle'&&c[2]==='#ff0000'));assert.ok(calls.some(c=>c[0]==='set'&&c[1]==='fillStyle'&&c[2]==='#00ff00'));
 p.rules[0].target='all';assert.ok(!trace(p,1,[event()]).calls.some(c=>c[0]==='set'&&c[1]==='fillStyle'&&['#ff0000','#00ff00'].includes(c[2])));
 p.rules[0].effect='flash';p.rules[0].duration=2;assert.ok(trace(p,1,[event()]).calls.some(c=>c[0]==='fillRect'&&c[3]===1920&&c[4]===550));
});
test('heatmap reacts to key locations and event preprocessing bounds malformed inputs',()=>{
 const p=project('heatmap');assert.notDeepEqual(trace(p,.3,[event('KeyA',0)]).calls,trace(p,.3).calls);
 const events=R.eventsAt([null,{type:'execute',time:0},{type:'keyDown',time:NaN},event('KeyA',2),{...event(),x:Infinity,y:-900,strength:100}],1);
 assert.equal(events.length,1);assert.equal(events[0].x,960);assert.equal(events[0].y,0);assert.equal(events[0].strength,4);assert.equal(R.eventsAt(Array.from({length:500},()=>event()),1).length,256);
});
test('browser image renderer loads only embedded raster and uses decoded cache',()=>{
 const images=[];class FakeImage{constructor(){images.push(this);}set src(value){this.url=value;this.onload();}}
 const sandbox={Image:FakeImage,StudioModel:M};vm.createContext(sandbox);vm.runInContext(fs.readFileSync(path.join(__dirname,'../studio/render.js'),'utf8'),sandbox);
 const p=project('image',{image:''});p.layers[0].image='https://example.com/remote.png';sandbox.StudioRender.draw(recorder().ctx,p,0,[]);assert.equal(images.length,0);
 p.layers[0].image='data:image/png;base64,AAAA';const c=recorder();sandbox.StudioRender.draw(c.ctx,p,0,[]);sandbox.StudioRender.draw(c.ctx,p,1,[]);assert.equal(images.length,1);assert.equal(c.calls.filter(call=>call[0]==='drawImage').length,2);
 sandbox.StudioRender.clearImageCache();sandbox.StudioRender.draw(recorder().ctx,p,0,[]);assert.equal(images.length,2);
});
test('reaction budget preserves newest effects and persistent toggles under heavy activity',()=>{
 const p=project();p.rules=Array.from({length:95},()=>M.createRule({effect:'flash',duration:30}));p.rules.push(M.createRule({effect:'toggle'}));
 const many=Array.from({length:255},(_,i)=>event('KeyA',i/10));const active=R.activeRules(p,R.eventsAt(many,26),26);
 assert.equal(active.filter(a=>a.rule.effect!=='toggle').length,256);assert.equal(active.filter(a=>a.rule.effect==='toggle').length,1);assert.equal(active.limited,true);
 assert.equal(active.find(a=>a.rule.effect!=='toggle').event.time,25.4);assert.equal(trace(p,26,many).result.reactionLimited,true);
 p.rules=[M.createRule({effect:'toggle',strength:0})];assert.equal(R.activeRules(p,R.eventsAt([event()],1),1).length,0);
 p.rules[0].strength=1;assert.equal(R.activeRules(p,R.eventsAt([{...event(),strength:0}],1),1).length,0);
});
test('image preparation waits for decode, rejects corrupt pixels, and releases old project cache',async()=>{
 const images=[];class FakeImage{constructor(){images.push(this);}set src(value){this.url=value;}}
 const sandbox={Image:FakeImage,StudioModel:M};vm.createContext(sandbox);vm.runInContext(fs.readFileSync(path.join(__dirname,'../studio/render.js'),'utf8'),sandbox);
 const p=project('image');p.layers[0].image='data:image/png;base64,AAAA';let finished=false;const pending=sandbox.StudioRender.prepareImages(p).then(n=>{finished=true;return n;});await Promise.resolve();assert.equal(finished,false);images[0].onload();assert.equal(await pending,1);
 const q=project('image');q.layers[0].image='data:image/png;base64,BBBB';const failed=sandbox.StudioRender.prepareImages(q);images[1].onerror();await assert.rejects(failed,/could not be decoded/);
 sandbox.StudioRender.draw(recorder().ctx,p,0,[]);assert.equal(images.length,3,'old project bitmap no longer retained');
});
test('custom typography reaches Canvas with selected weight, font and placement',()=>{const p=project('text',{text:'Hello',width:300,height:100,font:'mono',fontWeight:'700',textAlign:'right',textVertical:'bottom',fontSize:20});const {calls}=trace(p);assert.ok(calls.some(c=>c[0]==='set'&&c[1]==='font'&&c[2]==='700 20px Consolas, monospace'));const text=calls.find(c=>c[0]==='fillText');assert.equal(text[2],291);assert.ok(text[3]>80&&text[3]<100);});

test('selected-key reactions do not fire for unrelated keys',()=>{const rule=M.createRule({keys:['KeyW','Space']});assert.equal(R.matches(rule,{type:'keyDown',key:'KeyA'}),false);assert.equal(R.matches(rule,{type:'keyDown',key:'Space'}),true);});
test('rocket launch, nebula, meteors and masked layers render with bounded finite coordinates',()=>{const launch=P.list.find(p=>p.id==='ignition').create();for(const at of [0,.1,1,3,6,7,18]){const rec=recorder();R.draw(rec.ctx,launch,at,[{type:'keyDown',key:'Space',time:0,x:960,y:480,strength:1}]);assert.equal(rec.stack.length,0);}const masked=project('solid',{keyMask:[1,2,3]});const result=trace(masked);assert.ok(result);});
