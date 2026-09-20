'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const M=require('../studio/model.js'),P=require('../studio/pond-presets.js');

test('original pond preset distinguishes an editable Studio project from a native skin',()=>{
 assert.equal(P.list.length,1);const entry=P.list[0],p=entry.create();
 assert.equal(entry.nativeVerified,false);assert.equal(entry.nativeStatus,'browser-project');
 assert.ok(entry.tags.includes('Nature'));assert.ok(entry.tags.includes('Ocean & water'));
 assert.match(p.description,/only fish close/);assert.match(p.description,/Select a koi in Layers/);
 assert.match(p.description,/not a compiled keyboard skin/);assert.deepEqual(M.validate(p),p);
});

test('five koi are independently editable and continuously swim with varied appearances',()=>{
 const p=P.create(),fish=p.layers.filter(l=>l.type==='fish');assert.equal(fish.length,5);
 assert.equal(new Set(fish.map(l=>l.id)).size,5);assert.equal(new Set(fish.map(l=>l.seed)).size,5);
 assert.equal(new Set(fish.map(l=>l.color)).size,5);
 for(const l of fish){assert.equal(l.locked,false);assert.equal(l.motion.type,'swim');assert.ok(l.motion.speed>0);assert.ok(l.motion.distance>0);assert.equal(l.motion.turn,true);assert.ok(l.speed>0);assert.ok(l.x>0&&l.x+l.width<1920);assert.ok(l.y>0&&l.y+l.height<550);}
 assert.ok(p.layers.some(l=>['wave','plasma'].includes(l.type)&&l.speed>0));
 assert.ok(p.layers.filter(l=>l.type!=='fish').every(l=>l.locked),'Scenery starts locked so transparent artwork cannot intercept fish selection');
});

test('keyboard and pointer disturb the water but flee rules only target individual nearby fish',()=>{
 const p=P.create(),fishIds=new Set(p.layers.filter(l=>l.type==='fish').map(l=>l.id)),flee=p.rules.filter(r=>r.effect==='flee');
 assert.equal(flee.length,10);
 for(const r of flee){assert.ok(fishIds.has(r.target));assert.equal(r.radius,215);assert.equal(r.distance,180);assert.equal(r.key,'any');}
 for(const id of fishIds)assert.deepEqual(flee.filter(r=>r.target===id).map(r=>r.trigger),['keyDown','pointer']);
 const ripples=p.rules.filter(r=>r.effect==='ripple');assert.equal(ripples.length,2);assert.ok(ripples.every(r=>r.target==='all'));
 assert.ok(p.layers.filter(l=>l.type!=='fish').every(l=>!flee.some(r=>r.target===l.id)));
});

test('pond project stays portable and new previews never reuse a mutated scene',()=>{
 const a=P.create(),b=P.create(),image=a.layers.find(l=>l.type==='image');
 assert.equal(M.rasterInfo(image.image).width,1920);assert.equal(M.rasterInfo(image.image).height,550);
 assert.ok(Buffer.byteLength(JSON.stringify(a))<250000);
 a.layers.find(l=>l.type==='fish').motion.distance=0;a.layers[0].color='#ffffff';a.rules[0].strength=0;
 assert.ok(b.layers.find(l=>l.type==='fish').motion.distance>0);assert.notEqual(b.layers[0].color,'#ffffff');assert.ok(b.rules[0].strength>0);
});

test('browser preset requires no fetch, installed engine or proprietary Koi package',()=>{
 const sandbox={StudioModel:M};vm.createContext(sandbox);vm.runInContext(fs.readFileSync(path.join(__dirname,'../studio/pond-presets.js'),'utf8'),sandbox);
 const p=M.validate(sandbox.StudioPondPresets.list[0].create());assert.equal(p.id,'pond-stillwater');assert.equal(p.layers.filter(l=>l.type==='fish').length,5);
});

test('pond interaction moves a nearby koi while distant fish keep their swimming paths',()=>{
 const R=require('../studio/render.js'),p=P.create(),fish=p.layers.filter(l=>l.type==='fish'),options={rules:p.rules,duration:p.duration};
 const atPress=R.renderLayerAt(fish[0],2,[],options),event={type:'keyDown',key:'KeyA',time:2,x:atPress.x+atPress.width/2-20,y:atPress.y+atPress.height/2,strength:1};
 const idle=R.renderLayerAt(fish[0],2.7,[],options),reactive=R.renderLayerAt(fish[0],2.7,[event],options);
 assert.ok(Math.hypot(reactive.x-idle.x,reactive.y-idle.y)>30);
 for(const far of fish.slice(2)){const a=R.renderLayerAt(far,2.7,[],options),b=R.renderLayerAt(far,2.7,[event],options);assert.equal(a.x,b.x);assert.equal(a.y,b.y);assert.equal(a.rotation,b.rotation);}
 const before=R.renderLayerAt(fish[0],0,[],options),after=R.renderLayerAt(fish[0],4,[],options);assert.notEqual(before.x,after.x);
});
