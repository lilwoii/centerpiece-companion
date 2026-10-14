const test=require('node:test'),assert=require('node:assert/strict'),sharp=require('sharp');
const {validateSlot}=require('../src/catalog.cjs'),{configuredSVG,mediaKeySVG}=require('../src/strip.cjs'),{defaults,Workspace}=require('../src/workspace.cjs');
test('custom artwork preserves music action and player across validation and rendering',async()=>{
 const icon='data:image/png;base64,'+(await sharp({create:{width:128,height:128,channels:4,background:'#ac12ff'}}).png().toBuffer()).toString('base64');
 const slot=validateSlot({plugin:'youtubemusic',action:'next',mediaTarget:'desktop',visual:{kind:'icon',icon}});assert.equal(slot.action,'next');assert.equal(slot.mediaTarget,'desktop');
 const config=Workspace.prototype.validate({...defaults(),slots:[slot,null,null,null]});const svg=configuredSVG('idle',config,{caps:false});assert.ok(svg.includes(icon));assert.match(svg,/Next/);await sharp(Buffer.from(svg)).png().toBuffer();
});
test('printer artwork matches Ctrl+P, never a plain P binding',()=>{
 const config=Workspace.prototype.validate({...defaults(),keyIcons:{'0:14':{code:0x70013,color:'#abcdef'}}});const bindings=Array.from({length:68},()=>({behaviorId:50397,param1:0x70013}));assert.equal(mediaKeySVG(config,{layer:false},{bindingLayers:{0:bindings}}),'');bindings[14].param1=0x1070013;assert.match(mediaKeySVG(config,{layer:false},{bindingLayers:{0:bindings}}),/data-media-key/);
});
