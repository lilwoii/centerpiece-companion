'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const sharp=require('sharp');
const M=require('../studio/model.js');
const P=require('../studio/presets.js');
const project=()=>{const p=M.createProject('Model test');p.layers.push(M.createLayer('solid'));return p;};

test('all original presets validate, have independent IDs, and contain working interaction targets',()=>{
 assert.ok(P.list.length>=18);
 const names=new Set(),ids=new Set();
 for(const preset of P.list){
  assert.ok(!names.has(preset.name));assert.ok(!ids.has(preset.id));names.add(preset.name);ids.add(preset.id);
  const a=preset.create(),b=preset.create();
  assert.deepEqual(M.validate(a),a);assert.notEqual(a.id,b.id);assert.ok(a.layers.length>=3);
  assert.ok(a.rules.length>=2);assert.ok(a.rules.every(r=>r.target==='all'||a.layers.some(l=>l.id===r.target)));
  assert.ok(a.layers.every((l,i)=>l.id!==b.layers[i].id));
  a.layers[0].color='#ffffff';assert.notEqual(b.layers[0].color,'#ffffff');
 }
});
test('normalization is a new safe data object with defaults and canonical hex colors',()=>{
 const p=project();p.canvas.background='#AbC';p.layers[0].color='#fF0';delete p.layers[0].size;
 p.onLoad='alert(1)';p.layers[0].shader='arbitrary code';p.layers[0].url='https://example.com';
 const v=M.validate(p);assert.equal(v.canvas.background,'#aabbcc');assert.equal(v.layers[0].color,'#ffff00');
 assert.equal(v.layers[0].size,24);assert.equal(v.onLoad,undefined);assert.equal(v.layers[0].shader,undefined);assert.equal(v.layers[0].url,undefined);
 assert.notEqual(v,p);assert.notEqual(v.layers[0],p.layers[0]);v.layers[0].x=99;assert.equal(p.layers[0].x,0);
 const proto=M.validate(JSON.parse(JSON.stringify(p).replace('"onLoad":"alert(1)"','"__proto__":{"polluted":true}')));
 assert.equal(proto.polluted,undefined);assert.equal({}.polluted,undefined);
});
test('fixed format, supported engine, finite geometry and bounded complexity are enforced',()=>{
 const invalid=[p=>p.format='other',p=>p.version=2,p=>p.canvas.width=3840,p=>p.engineTarget='arbitrary',p=>p.duration=121,p=>p.fps=61,p=>p.fps=1.1,p=>p.layers[0].x=NaN,p=>p.layers[0].height=0,p=>p.layers[0].rotation=Infinity,p=>p.layers[0].opacity=2,p=>p.layers[0].density=201,p=>p.layers[0].density=2.5,p=>p.layers[0].visible='true',p=>p.layers[0].blend='url(javascript:1)',p=>p.layers[0].type='script',p=>p.layers[0].color='red',p=>p.layers[0].seed=-1,p=>p.name='x'.repeat(121),p=>p.layers[0].text='x'.repeat(513),p=>p.layers[0].text='bad\u0000text'];
 for(const change of invalid){const p=project();change(p);assert.throws(()=>M.validate(p));}
 const p=project();p.layers=Array.from({length:49},()=>M.createLayer('solid'));assert.throws(()=>M.validate(p),/48 layers/);
 p.layers=[];p.rules=Array.from({length:180},()=>M.createRule());assert.equal(M.validate(p).rules.length,180);p.extra='x'.repeat(M.limits.projectBytes);assert.throws(()=>M.validate(p),/32 MB/);
});
test('IDs, rule targets and physical key codes are validated',()=>{
 const p=project();p.layers.push({...p.layers[0]});assert.throws(()=>M.validate(p),/Layer IDs/);
 p.layers.pop();p.rules=[M.createRule({target:'missing'})];assert.throws(()=>M.validate(p),/no longer exists/);
 for(const key of ['any','KeyA','Digit0','ArrowDown','F24','IntlYen','Lang1','CapsLock','NumpadEnter'])assert.equal(M.createRule({key}).key,key);
 for(const key of ['<script>','a','document','F25','KeyAA',''])assert.throws(()=>M.createRule({key}));
 p.rules=[M.createRule()];p.rules.push({...p.rules[0]});assert.throws(()=>M.validate(p),/Interaction IDs/);
 p.rules=[M.createRule()];p.rules[0].trigger='eval';assert.throws(()=>M.validate(p),/trigger/);
 p.rules[0]=M.createRule();p.rules[0].effect='fetch';assert.throws(()=>M.validate(p),/effect/);
 p.rules[0]=M.createRule();p.rules[0].duration=0;assert.throws(()=>M.validate(p),/duration/);
});

test('oversized interaction imports reject before mapping rules and preserve the input',()=>{
 const p=project();p.rules=Array.from({length:M.limits.rules},(_,i)=>M.createRule({id:'rule'+i}));
 assert.equal(M.validate(p).rules.length,M.limits.rules);
 p.rules.push(M.createRule({id:'excess'}));const original=JSON.stringify(p);
 p.rules.map=()=>{throw Error('Rule mapping must not run');};
 assert.throws(()=>M.validate(p),/up to 256 interactions/);
 assert.equal(JSON.stringify(p),original);
 p.rules=Array.from({length:10000},(_,i)=>({id:'rule'+i,trigger:'keyDown',effect:'toggle'}));
 assert.throws(()=>M.validate(p),/up to 256 interactions/);
});
test('keyframes are canonical and duplicate times, foreign properties and aggregate excess reject',()=>{
 const p=project(),l=p.layers[0];l.keyframes=[{id:'b',time:8,property:'x',value:80,easing:'smooth'},{id:'a',time:2,property:'opacity',value:.5}];
 const v=M.validate(p);assert.deepEqual(v.layers[0].keyframes.map(f=>f.id),['a','b']);assert.equal(v.layers[0].keyframes[0].easing,'linear');assert.deepEqual(l.keyframes.map(f=>f.id),['b','a']);
 l.keyframes.push({id:'c',time:8,property:'x',value:5});assert.throws(()=>M.validate(p),/same time/);l.keyframes.pop();
 l.keyframes[0].time=13;assert.throws(()=>M.validate(p),/Keyframe time/);l.keyframes[0].time=8;
 l.keyframes[0].property='__proto__';assert.throws(()=>M.validate(p),/animated property/);
 const crowded=project();crowded.layers=Array.from({length:9},()=>M.createLayer('solid',{keyframes:Array.from({length:256},(_,i)=>({id:'k'+i,time:i/30,property:'x',value:i,easing:'linear'}))}));assert.throws(()=>M.validate(crowded),/2048 keyframes/);
});
test('PNG, JPEG and WebP embedded dimensions are accepted while URLs, SVG, mismatches and giant rasters reject',async()=>{
 const image=sharp({create:{width:80,height:40,channels:4,background:'#78cfff'}});
 for(const kind of ['png','jpeg','webp']){
  const data='data:image/'+kind+';base64,'+(await image.clone()[kind]().toBuffer()).toString('base64');
  const info=M.rasterInfo(data);assert.equal(info.width,80);assert.equal(info.height,40);assert.equal(info.pixels,3200);
  const p=project();p.layers[0].image=data;assert.equal(M.validate(p).layers[0].image,data);
 }
 for(const value of ['https://example.com/a.png','data:image/svg+xml;base64,PHN2Zz4=','data:image/png;base64,bm90cG5n','data:image/jpeg;base64,iVBORw0KGgo=','data:text/html;base64,PHNjcmlwdD4='])assert.throws(()=>M.rasterInfo(value));
 const huge='data:image/png;base64,'+(await sharp({create:{width:4097,height:1,channels:3,background:'#ffffff'}}).png().toBuffer()).toString('base64');assert.throws(()=>M.rasterInfo(huge),/4096/);
 const pixels='data:image/png;base64,'+(await sharp({create:{width:4096,height:4096,channels:3,background:'#ffffff'}}).png().toBuffer()).toString('base64');
 const p=project();p.layers[0].image=pixels;p.layers.push(M.createLayer('image',{image:pixels}));assert.throws(()=>M.validate(p),/16 megapixels/);
});
test('model and presets support browser UMD without Node globals',()=>{
 const sandbox={};vm.createContext(sandbox);
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../studio/model.js'),'utf8'),sandbox);
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../studio/presets.js'),'utf8'),sandbox);
 assert.equal(sandbox.StudioModel.createProject().format,'centerpiece-skin-studio');assert.equal(sandbox.StudioPresets.list.length,22);
 assert.ok(sandbox.StudioPresets.list.every(p=>p.create().layers.length>=3));
});
test('incomplete raster chunks and animated containers reject before decoding pixels',async()=>{
 const png=await sharp({create:{width:10,height:10,channels:4,background:'#ffffff'}}).png().toBuffer();
 const url=(kind,data)=>'data:image/'+kind+';base64,'+data.toString('base64');
 assert.throws(()=>M.rasterInfo(url('png',png.subarray(0,png.length-12))),/incomplete/);
 const animation=Buffer.alloc(20);animation.writeUInt32BE(8,0);animation.write('acTL',4);const apng=Buffer.concat([png.subarray(0,33),animation,png.subarray(33)]);assert.throws(()=>M.rasterInfo(url('png',apng)),/Animated images/);
 const webp=await sharp({create:{width:10,height:10,channels:4,background:'#ffffff'}}).webp().toBuffer();assert.throws(()=>M.rasterInfo(url('webp',webp.subarray(0,webp.length-2))),/header/);
 const animated=Buffer.alloc(30);animated.write('RIFF',0);animated.writeUInt32LE(22,4);animated.write('WEBPVP8X',8);animated.writeUInt32LE(10,16);animated[20]=2;assert.throws(()=>M.rasterInfo(url('webp',animated)),/Animated images/);
});
test('text styles are safe, backward compatible and survive project validation',()=>{const original=M.createLayer('text',{text:'Community 🌙'});assert.equal(original.font,'sans');assert.equal(original.textAlign,'center');const styled=M.validateLayer({...original,font:'mono',fontWeight:'700',textAlign:'right',textVertical:'bottom'});assert.equal(styled.font,'mono');assert.equal(styled.textVertical,'bottom');assert.throws(()=>M.validateLayer({...styled,font:'url(https://example.test)'}));assert.throws(()=>M.validateLayer({...styled,fontWeight:'expression(x)'}));});
test('placement aligns rotated bounds and preserves source data',()=>{const l=M.createLayer('solid',{x:100,y:80,width:200,height:100,rotation:90});const left=M.placeLayer(l,'left'),top=M.placeLayer(l,'top');assert.ok(Math.abs(left.x+50)<1e-8);assert.ok(Math.abs(top.y-50)<1e-8);assert.equal(l.x,100);assert.equal(M.placeLayer(l,'center').x,860);assert.equal(M.placeLayer(l,'middle').y,225);});
test('fit and key placement stay within the chosen rectangle',()=>{const l=M.createLayer('image',{width:400,height:400});const fit=M.placeLayer(l,'fit');assert.equal(fit.width,550);assert.equal(fit.height,550);assert.equal(fit.x,685);const key=M.placeLayer(l,'fill',{x:20,y:30,width:80,height:70});assert.deepEqual([key.x,key.y,key.width,key.height,key.rotation],[20,30,80,70,0]);});
test('placement refuses locked or animated geometry and invalid regions',()=>{const l=M.createLayer('solid');assert.throws(()=>M.placeLayer({...l,locked:true},'fill'),/Unlock/);assert.throws(()=>M.placeLayer({...l,keyframes:[{id:'move',time:1,property:'x',value:10,easing:'linear'}]},'center'),/keyframes/);assert.throws(()=>M.placeLayer(l,'bad'));assert.throws(()=>M.placeLayer(l,'fill',{x:0,y:0,width:-1,height:20}));});

test('multi-key rules retain exact key groups and reject ambiguous selections',()=>{const r=M.createRule({keys:['KeyW','KeyA','Space']});assert.deepEqual(r.keys,['KeyW','KeyA','Space']);assert.throws(()=>M.createRule({keys:[]}));assert.throws(()=>M.createRule({keys:['KeyA','KeyA']}));assert.throws(()=>M.createRule({keys:['any']}));assert.throws(()=>M.createRule({keys:['script']}));});
test('layer masks accept multiple physical positions and reject invalid indexes',()=>{assert.deepEqual(M.createLayer('solid',{keyMask:[1,2,3]}).keyMask,[1,2,3]);assert.throws(()=>M.createLayer('solid',{keyMask:[68]}));assert.throws(()=>M.createLayer('solid',{keyMask:[1,1]}));});
