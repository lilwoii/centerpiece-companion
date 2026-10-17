const test=require('node:test'),assert=require('node:assert/strict');
const {Workspace,defaults}=require('../src/workspace.cjs');
const {configuredSVG,mediaKeySVG}=require('../src/strip.cjs');
const {svg}=require('../src/physical-legends.cjs');
test('hidden legends remove replacement lettering and custom icons without removing plugin content',()=>{
 const config=Workspace.prototype.validate({...defaults(),hideLegends:true,keyIcons:{'0:26':{code:0x70013,color:'#ffffff',background:'#000000',style:'glossy'}}});
 const data={bindingLayers:{0:Array(68).fill({behaviorId:50397,param1:0x1070013})}};
 assert.equal(svg({positions:[{x:2,y:3}]},config,{},data),'');
 assert.equal(mediaKeySVG(config,{},data),'');
 assert.match(configuredSVG('idle',config,{},data),/PLUGINS/);
});
test('music highlights exist only for the selected Spotify or YouTube Music slot',()=>{
 const config=Workspace.prototype.validate(defaults());config.musicNavigationColor='#ff9922';
 for(const plugin of ['spotify','youtubemusic']){
  config.slots[0]={plugin,action:'toggle'};
  const selected=configuredSVG('previous',config,{});
  for(const position of [65,67,56])assert.match(selected,new RegExp('data-navigation-key="'+position+'"'));
  assert.match(selected,/#ff9922/);
  assert.doesNotMatch(configuredSVG('idle',config,{}),/data-navigation-key/);
 }
 config.slots[0]={plugin:'weather',action:'display'};
 assert.doesNotMatch(configuredSVG('previous',config,{}),/data-navigation-key/);
});
test('hide legends shortcut highlight uses saved color only on L1',()=>{
 const config=Workspace.prototype.validate({...defaults(),legendShortcutColor:'#ff1122'});
 assert.match(configuredSVG('idle',config,{layer:true}),/data-navigation-key="62"/);
 assert.match(configuredSVG('idle',config,{layer:true}),/#ff1122/);
 assert.doesNotMatch(configuredSVG('idle',config,{layer:false}),/data-navigation-key="62"/);
 config.pluginShortcuts.hideLegendsShortcut=false;
 assert.doesNotMatch(configuredSVG('idle',config,{layer:true}),/data-navigation-key="62"/);
});
