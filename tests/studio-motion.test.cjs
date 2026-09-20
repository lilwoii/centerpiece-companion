'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const M=require('../studio/model.js'),R=require('../studio/render.js'),Motion=require('../studio/motion.js');
const fish=(overrides={})=>M.createLayer('fish',{id:'fish',x:400,y:200,width:180,height:80,motion:{type:'none',speed:1,distance:80,turn:false},...overrides});
const rule=(overrides={})=>M.createRule({id:'flee',effect:'flee',target:'fish',radius:260,distance:180,duration:2,...overrides});
const event=(overrides={})=>({id:1,type:'keyDown',key:'KeyA',time:0,x:450,y:240,strength:1,...overrides});
const pose=(layer,at,events=[],rules=[rule()],options={})=>R.renderLayerAt(layer,at,events,{rules,...options});
const center=layer=>({x:layer.x+layer.width/2,y:layer.y+layer.height/2});
const length=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);

test('motion and flee normalize, round-trip and reject invalid imported configuration',()=>{
 const original=M.createLayer('image');assert.equal(Object.hasOwn(original,'motion'),false);
 const f=M.createLayer('fish');assert.deepEqual([f.width,f.height],[180,80]);assert.deepEqual(f.motion,{type:'swim',speed:1,distance:80,turn:true});
 const p=M.createProject();p.layers=[f];p.rules=[M.createRule({effect:'flee',target:f.id})];assert.deepEqual(M.validate(JSON.parse(JSON.stringify(p))),p);assert.deepEqual([p.rules[0].radius,p.rules[0].distance],[260,180]);
 for(const bad of [null,[],{type:'script'},{speed:NaN},{speed:-1},{speed:5},{distance:601},{distance:-1},{turn:'yes'}])assert.throws(()=>M.validateLayer({...original,motion:bad}));
 for(const field of ['radius','distance'])for(const value of [NaN,-1,Infinity])assert.throws(()=>rule({[field]:value}));
 assert.throws(()=>rule({radius:19}));assert.throws(()=>rule({radius:1001}));assert.throws(()=>rule({distance:601}));
 const noCode=M.validateLayer({...f,motion:{type:'swim',script:'execute',speed:1}});assert.equal(noCode.motion.script,undefined);assert.equal(M.createRule({effect:'ripple',radius:50}).radius,undefined);
});

test('idle movement is deterministic, smooth, bounded and opt-in for every layer type',()=>{
 const plain=M.createLayer('text',{x:80,y:40,text:'Hello'}),before=JSON.stringify(plain);assert.deepEqual(pose(plain,20,[],[]),R.layerAt(plain,20));
 for(const type of ['drift','swim','orbit']){const l=M.validateLayer({...plain,motion:{type,speed:1,distance:180,turn:false}});assert.deepEqual(pose(l,0,[],[]),l);assert.notDeepEqual(pose(l,2,[],[]),l);
  assert.deepEqual(pose(l,5,[],[]),pose(l,5,[],[]));assert.ok(length(pose(l,5,[],[]),pose(l,5.001,[],[]))<.2);
  for(const t of [0,2,10,100,1e20]){const p=pose(l,t,[],[]);assert.ok(length(p,l)<=180.00001);assert.ok([p.x,p.y,p.rotation].every(Number.isFinite));}
  for(const change of [{speed:0},{distance:0},{type:'none'}]){const paused=M.validateLayer({...l,motion:{...l.motion,...change}});assert.deepEqual(pose(paused,1,[],[]),pose(paused,8,[],[]));}
 }
 assert.equal(JSON.stringify(plain),before);
});

test('nearby objects flee away, distant objects remain still and exact-center presses stay finite',()=>{
 const l=fish(),at=.44,origin=center(l),near=event({x:origin.x-40,y:origin.y}),p=pose(l,at,[near]);assert.ok(p.x>l.x);assert.equal(p.y,l.y);
 assert.deepEqual(pose(l,at,[event({x:origin.x-300,y:origin.y})]),pose(l,at));
 const exact=pose(l,at,[event(origin)]);assert.ok(length(exact,l)>100);assert.ok([exact.x,exact.y,exact.rotation].every(Number.isFinite));assert.deepEqual(exact,pose(l,at,[event(origin)]));
 assert.deepEqual(pose(l,2,[near]),pose(l,2));assert.deepEqual(pose(l,3,[near]),pose(l,3));assert.deepEqual(pose(l,at,[near],[rule({distance:0})]),pose(l,at));
});

test('proximity is measured at the press, so later motion cannot activate a missed reaction',()=>{
 const l=fish({motion:{type:'orbit',speed:2,distance:600,turn:false}}),later=center(pose(l,4,[],[])),initial=center(pose(l,0,[],[]));assert.ok(length(later,initial)>100);
 const missed=event(later),r=rule({radius:60,duration:10});assert.deepEqual(pose(l,4,[missed],[r]),pose(l,4,[],[r]));
 const hit=event({x:initial.x-10,y:initial.y});assert.notDeepEqual(pose(l,4,[hit],[r]),pose(l,4,[],[r]));
});

test('all targets include fish and moving layers while static backgrounds stay fixed',()=>{
 const f=fish(),image=M.createLayer('image',{id:'image',x:400,y:200,width:180,height:80}),text=M.createLayer('text',{id:'text',x:400,y:200,width:180,height:80}),background=M.createLayer('solid',{id:'bg'}),all=rule({target:'all'}),e=event();
 assert.notDeepEqual(pose(f,.44,[e],[all]),pose(f,.44,[],[all]));
 assert.deepEqual(pose(background,.44,[e],[all]),pose(background,.44,[],[all]));
 for(const l of [image,text]){assert.deepEqual(pose(l,.44,[e],[all]),pose(l,.44,[],[all]));const targeted=rule({target:l.id});const moved=pose(l,.44,[e],[targeted]);assert.ok(moved.x>l.x);assert.equal(moved.rotation,l.rotation);assert.deepEqual(pose(f,.44,[e],[targeted]),pose(f,.44,[],[targeted]));}
 const moving=M.validateLayer({...image,motion:{type:'drift',speed:1,distance:30,turn:false}});assert.notDeepEqual(pose(moving,.44,[e],[all]),pose(moving,.44,[],[all]));
});

test('flee respects key groups, trigger type, explicit test IDs and disabled strengths',()=>{
 const l=fish(),r=rule({keys:['KeyA','KeyB']}),base=pose(l,.44,[],[r]);
 for(const e of [event({key:'KeyC'}),event({type:'keyUp'}),event({ruleId:'different'}),event({strength:0}),event({repeat:true})])assert.deepEqual(pose(l,.44,[e],[r]),base);
 assert.notDeepEqual(pose(l,.44,[event({key:'KeyB',ruleId:r.id})],[r]),base);
 assert.deepEqual(pose(l,.44,[event()],[{...r,strength:0}]),base);assert.deepEqual(pose({...l,reactivity:0},.44,[event()],[r]),{...base,reactivity:0});
 const pointer=rule({trigger:'pointer',keys:['KeyA']});assert.notDeepEqual(pose(l,.44,[event({type:'pointer'})],[pointer]),base);assert.deepEqual(pose(l,.44,[event({type:'pointer',key:'KeyZ'})],[pointer]),base);
});

test('held keys, duplicate delivery and a pointer/key pair do not multiply a single flee gesture',()=>{
 const l=fish(),e=event(),r=rule(),base=pose(l,.44,[e],[r]);
 assert.deepEqual(pose(l,.44,[e,e,{...e,id:2,time:.1,repeat:true}],[r]),base);
 assert.deepEqual(pose(l,.44,[e,event({id:2,type:'keyUp',time:.2})],[r]),base);
 const pointer=rule({id:'pointer-flee',trigger:'pointer'});assert.deepEqual(pose(l,.44,[e,event({id:2,type:'pointer'})],[r,pointer]),base);
 // A pointer-only rule remains useful on its own, and explicit per-rule tests stay independent.
 assert.notDeepEqual(pose(l,.44,[e,event({id:2,type:'pointer'})],[pointer]),pose(l,.44,[],[pointer]));
 assert.notDeepEqual(pose(l,.44,[e,event({id:2,type:'pointer',ruleId:'pointer-flee'})],[r,pointer]),base);
});

test('separate quick presses stay continuous at event boundaries and displacements remain bounded',()=>{
 const l=fish(),events=[event(),event({id:2,type:'keyUp',time:.1}),event({id:3,time:.2,x:490,y:250})],r=rule({radius:1000,distance:600,strength:4});
 const before=pose(l,.2-1e-6,events,[r]),after=pose(l,.2+1e-6,events,[r]);assert.ok(length(before,after)<.01);
 assert.deepEqual(pose(l,.6,events,[r]),pose(l,.6,events,[r]));assert.ok(length(pose(l,.6,events,[r]),l)<=600.00001);
 for(const at of [0,.44,2,2.2])assert.ok(length(pose(l,at+1e-6,events,[r]),pose(l,Math.max(0,at-1e-6),events,[r]))<.1);
});

test('captured press positions survive rolling event history and reflect an already fleeing object',()=>{
 const l=fish(),p=M.createProject();p.layers=[l];p.rules=[rule({id:'a',key:'KeyA',duration:1,radius:200}),rule({id:'b',key:'KeyB',duration:3,radius:50})];
 const first=event(),oldPose=pose(l,.4,[first],p.rules),origins=R.captureMotionOrigins(p,.4,[first]);assert.deepEqual(origins[l.id],{...center(oldPose),rotation:oldPose.rotation});assert.ok(length(origins[l.id],center(l))>70);
 const second=event({id:2,time:.4,key:'KeyB',x:origins[l.id].x-10,y:origins[l.id].y,origins});
 const withHistory=pose(l,1.5,[first,second],p.rules),evicted=pose(l,1.5,[second],p.rules);assert.deepEqual(evicted,withHistory);assert.notDeepEqual(evicted,pose(l,1.5,[],p.rules));
 const changedOrigin={...second,origins:{[l.id]:{x:NaN,y:Infinity}}};assert.ok([pose(l,1.5,[changedOrigin],p.rules).x,pose(l,1.5,[changedOrigin],p.rules).y].every(Number.isFinite));
});

test('motion uses the monotonic preview clock across loops and samples keyframes at press time',()=>{
 const l=fish({motion:{type:'swim',speed:1,distance:160,turn:true}}),p1=pose(l,11.99,[],[],{motionTime:11.99,duration:12,loop:true}),p2=pose(l,.01,[],[],{motionTime:12.01,duration:12,loop:true});assert.ok(length(p1,p2)<2);assert.deepEqual(p2,pose(l,12.01,[],[],{motionTime:12.01}));
 const animated=fish({keyframes:[{id:'x',time:10,property:'x',value:900,easing:'linear'}]}),atPress=R.layerAt(animated,11.8),r=rule({radius:50,duration:3}),e=event({time:-.2,clock:11.8,timelineTime:11.8,...center(atPress)});
 assert.notDeepEqual(pose(animated,.2,[e],[r],{motionTime:12.2,duration:12,loop:true}),pose(animated,.2,[],[r],{motionTime:12.2,duration:12,loop:true}));
});

test('turning never flips when a moving fish crosses the opposite escape heading',()=>{
 const l=fish({motion:{type:'orbit',speed:4,distance:100,turn:true}}),r=rule({duration:30,distance:50,radius:1000}),events=[event({x:480,y:240})];let last;
 for(let at=0;at<30;at+=.01){const angle=pose(l,at,events,[r]).rotation*Math.PI/180;if(last!==undefined)assert.ok(Math.hypot(Math.cos(angle)-Math.cos(last),Math.sin(angle)-Math.sin(last))<.05);last=angle;}
});

function recorder(){const calls=[],stack=[],ctx={globalAlpha:1};for(const name of ['clearRect','fillRect','strokeRect','beginPath','closePath','moveTo','lineTo','arc','ellipse','fill','stroke','rect','clip','translate','rotate','scale','fillText','drawImage'])ctx[name]=(...args)=>{assert.ok(args.every(a=>typeof a!=='number'||Number.isFinite(a)),name);calls.push([name,...args]);};for(const name of ['createLinearGradient','createRadialGradient'])ctx[name]=(...args)=>{assert.ok(args.every(Number.isFinite));return{addColorStop(){}};};ctx.save=()=>stack.push(ctx.globalAlpha);ctx.restore=()=>{assert.ok(stack.length);ctx.globalAlpha=stack.pop();};return{ctx,calls,stack};}

test('draw and hit testing agree with the moved pose while preserving the original editing geometry',()=>{
 const l=fish({motion:{type:'swim',speed:1,distance:160,turn:true}}),p=M.createProject();p.layers=[l];p.rules=[rule(),M.createRule({effect:'pulse',target:l.id,duration:2})];const e=[event()],t=.44,position=pose(l,t,e,p.rules),c=center(position),snapshot=JSON.stringify(p);
 assert.equal(R.hitTest(p,c.x,c.y,t,e),l);assert.equal(R.hitTest(p,1800,500,t,e),null);
 const rec=recorder();R.draw(rec.ctx,p,t,e);assert.ok(rec.calls.some(call=>call[0]==='translate'&&Math.abs(call[1]-c.x)<1e-8&&Math.abs(call[2]-c.y)<1e-8));assert.ok(rec.calls.some(call=>call[0]==='scale'&&call[1]>1));assert.equal(rec.stack.length,0);assert.equal(JSON.stringify(p),snapshot);
});

test('procedural fish tails animate, pause at zero speed and use independently editable colors and seeds',()=>{
 const l=fish(),trace=(at,layer=l)=>{const r=recorder();Motion.drawFish(r.ctx,layer,at);assert.equal(r.stack.length,0);return r.calls;};assert.notDeepEqual(trace(0),trace(.2));assert.deepEqual(trace(1,{...l,speed:0}),trace(9,{...l,speed:0}));assert.notDeepEqual(trace(1),trace(1,{...l,seed:l.seed+1}));
 for(const at of [0,.1,1,12,1e20])trace(at);assert.equal(l.color,'#f0e6cf');assert.equal(l.color2,'#dc623c');
});

test('browser motion support is self-contained and large imported rule sets have bounded reaction work',()=>{
 const sandbox={};vm.createContext(sandbox);vm.runInContext(fs.readFileSync(require.resolve('../studio/motion.js'),'utf8'),sandbox);assert.equal(typeof sandbox.StudioMotion.apply,'function');
 const l=fish(),rules=Array.from({length:5000},(_,i)=>rule({id:'r'+i,radius:1000})),events=Array.from({length:256},(_,i)=>event({id:i,time:i/1000}));
 const before=performance.now(),out=pose(l,.4,events,rules);assert.ok(performance.now()-before<1500);assert.ok(length(out,l)<=600.00001);assert.ok([out.x,out.y,out.rotation].every(Number.isFinite));
});
