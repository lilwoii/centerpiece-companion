const test=require('node:test'),assert=require('node:assert/strict');
const {DisplayCache}=require('../src/display-cache.cjs');
test('legend toggle uploads one current frame instead of every navigation frame',async()=>{
 const uploads=[];const cache=new DisplayCache('.',(selected,c)=>`<svg xmlns="http://www.w3.org/2000/svg" width="2" height="2"><title>${c.hideLegends}</title></svg>`);
 cache.som={uploadOverlay:async slot=>uploads.push(slot),selectSlot(){}};
 const config={hideLegends:false,indicator:{enabled:true},widget:{type:'clock'}};
 await cache.apply(config,{caps:false});assert.ok(uploads.length>1);
 for(const hideLegends of [true,false,true]){uploads.length=0;await cache.apply({...config,hideLegends},{caps:false});assert.equal(uploads.length,1);assert.equal(cache.cache.size,1);}
});
test('new music highlight defaults to Spotify green, custom colors remain intact',()=>{
 const {Workspace,defaults}=require('../src/workspace.cjs');
 assert.equal(Workspace.prototype.validate(defaults()).musicNavigationColor,'#1db954');
 assert.equal(Workspace.prototype.validate({...defaults(),musicNavigationColor:'#ff9922'}).musicNavigationColor,'#ff9922');
});
test('legacy custom Right Alt shortcut survives new legend shortcut default',()=>{
 const {normalize}=require('../src/plugin-shortcuts.cjs');
 assert.equal(normalize({custom:true,position:62}).hideLegendsShortcut,false);
 assert.throws(()=>normalize({custom:true,position:62,hideLegendsShortcut:true}),/reserved/);
});
