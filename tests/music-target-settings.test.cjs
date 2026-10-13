const test=require('node:test'),assert=require('node:assert/strict');
const {Workspace,defaults}=require('../src/workspace.cjs');
const {validateTarget}=require('../src/music-source.cjs');
const {detailSVG}=require('../src/widgets.cjs');
const {launch}=require('../src/youtube-music-launch.cjs');
function workspace(){const w=Object.create(Workspace.prototype);w.config=w.validate(defaults());w.save=function(c){this.config=this.validate(c);return this.config;};return w;}

test('Music widget defaults to Desktop; switching it preserves independent slots and clears a previous source pin',()=>{
 const w=workspace();assert.equal(w.config.youtubeMusicTarget,'desktop');
 w.config.youtubeMusicSource='chrome.exe';const slots=structuredClone(w.config.slots),widget=structuredClone(w.config.widget);
 for(const target of ['desktop','web','auto']){w.saveMusicTarget(target);assert.equal(w.config.youtubeMusicTarget,target==='auto'?'desktop':target);assert.equal(w.config.youtubeMusicSource,'');assert.deepEqual(w.config.slots,slots);assert.deepEqual(w.config.widget,widget);}
 const before=JSON.stringify(w.config);for(const value of [null,'unknown',{},'Desktop'])assert.throws(()=>w.saveMusicTarget(value));assert.equal(JSON.stringify(w.config),before);
 assert.equal(validateTarget(),'auto');
});

test('Music idle widget is branded and never fabricates track progress',()=>{
 const w=workspace();w.config.widget={...w.config.widget,type:'youtubemusic'};
 for(const [target,label]of [['auto','Auto'],['desktop','Desktop'],['web','Web']]){
  const svg=detailSVG(w.config,{youtubeMusic:{available:false,target}});
  assert.match(svg,/YouTube Music/);assert.ok(svg.includes(label+' · Idle'));assert.match(svg,/<circle/);
  assert.doesNotMatch(svg,/Start a song|Connect YT|0:00/);
 }
 const paused=detailSVG(w.config,{youtubeMusic:{available:true,status:'Paused',title:'Loaded song',artist:'Artist',position:32,duration:200}});
 assert.match(paused,/Loaded song/);assert.match(paused,/0:32/);assert.doesNotMatch(paused,/Idle/);
});

test('Open Music respects Web selection and Desktop never launches a browser by mistake',async()=>{
 const calls=[],shell={openExternal:async url=>calls.push(['web',url]),openPath:async file=>calls.push(['desktop',file]),readShortcutLink:()=>{throw Error('No shortcut');}};
 const io={readdirSync:()=>[],existsSync:()=>false},options={io,env:{}};
 assert.equal(await launch(shell,{...options,target:'web'}),'browser');assert.deepEqual(calls,[['web','https://music.youtube.com/']]);calls.length=0;
 await assert.rejects(launch(shell,{...options,target:'desktop'}),/desktop is not installed/);assert.equal(calls.length,0);
 assert.equal(await launch(shell,{...options,target:'auto'}),'browser');
});
