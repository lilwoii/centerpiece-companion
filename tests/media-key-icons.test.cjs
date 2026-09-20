const test=require('node:test'),assert=require('node:assert/strict'),sharp=require('sharp');
const M=require('../src/media-icons.js'),{choices}=require('../src/keymap.cjs');
const {Workspace,defaults}=require('../src/workspace.cjs'),{mediaKeySVG,configuredSVG}=require('../src/strip.cjs');
const validate=c=>Workspace.prototype.validate.call({},c);
const map=(layer,position,code)=>({bindingLayers:{[layer]:Array.from({length:68},(_,i)=>({behaviorId:50397,param1:i===position?code:0x70004}))}});
test('media quick choices exactly match the existing device consumer usages',()=>{
 assert.equal(M.items.length,6);
 for(const item of M.items){assert.ok(choices.some(c=>c.value===item.code&&c.label===item.label));assert.equal(M.find(item.code),item);}
 assert.equal(M.find(0x70004),undefined);
});
test('icon settings are opt-in, bounded, preserve old setups and reject unsafe values',()=>{
 assert.deepEqual(validate(defaults()).keyIcons,{});
 const config={...defaults(),keyIcons:{'0:14':{code:0xc00b6,color:'#aabbcc',background:'#112233',style:'badge'}}};
 assert.deepEqual(validate(config).keyIcons,config.keyIcons);
 for(const value of [{'0:68':{code:0xc00b6}},{'1:26':{code:0xc00b6}},{'0:63':{code:0xc00b6}},{'0:14':{code:0x70004}},{'0:14':{code:0xc00b6,color:'url(x)'}},{'0:14':{code:0xc00b6,style:'<script>'}}])assert.throws(()=>M.normalize(value));
});
test('only the active layer and still-matching real binding receive the icon',()=>{
 const config=validate({...defaults(),keyIcons:{'0:14':{code:0xc00b6},'1:14':{code:0xc00b5}}});
 assert.match(mediaKeySVG(config,{layer:false},map(0,14,0xc00b6)),/data-media-key="0:14"/);
 assert.equal(mediaKeySVG(config,{layer:false},map(0,14,0xc00b5)),'');
 assert.equal(mediaKeySVG(config,{layer:false},{}),'');
 assert.equal(mediaKeySVG(config,{layer:true},map(0,14,0xc00b6)),'');
 assert.match(mediaKeySVG(config,{layer:true},map(1,14,0xc00b5)),/data-media-key="1:14"/);
 const special=map(0,14,0xc00b6);special.bindingLayers[0][14].behaviorId=54567;
 assert.equal(mediaKeySVG(config,{layer:false},special),'');
});
test('all icon designs rasterize and remain within their physical key',async()=>{
 for(const item of M.items)for(const style of ['outline','solid','badge']){
  const config=validate({...defaults(),keyIcons:{'0:14':{code:item.code,style,color:'#00cc88',background:'#142536'}}});
  const svg=configuredSVG('idle',config,{caps:false},map(0,14,item.code));
  assert.match(svg,/data-media-key="0:14"/);assert.ok(!/NaN|undefined/.test(svg));
  await sharp(Buffer.from(svg)).png().toBuffer();
 }
});
