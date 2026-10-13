const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {MusicMemory}=require('../src/music-memory.cjs'),{positionAt}=require('../src/playback-clock.cjs'),{detailSVG}=require('../src/widgets.cjs');
const DAY=86400000,START=1700000000000,art='data:image/png;base64,iVBORw0KGgo=',widget={type:'youtubemusic',x:1710,y:219,width:194,height:94};
const track=(changes={})=>({available:true,status:'Playing',source:'YouTube Music.exe',title:'Desktop track',artist:'Singer',album:'Album',art,duration:180,position:10,positionTimestamp:START,controls:{play:true,pause:true},...changes});
function temp(t){const directory=fs.mkdtempSync(path.join(os.tmpdir(),'companion-music-memory-'));t.after(()=>fs.rmSync(directory,{recursive:true,force:true}));return directory;}

test('last-played time and cover freeze when the session disappears and cannot enable controls',()=>{
 let now=START;const memory=new MusicMemory({now:()=>now});memory.update(track(),'desktop');
 now+=1000;memory.update(track(),'desktop');now+=1000;
 const missing=memory.update({available:false,message:'No session',reason:'no-session'},'desktop');
 assert.equal(missing.available,false);assert.equal(missing.remembered,true);assert.equal(missing.status,'Paused');assert.deepEqual(missing.controls,{});assert.equal(missing.message,'No session');assert.equal(missing.position,11);assert.equal(missing.art,art);
 now+=60000;const later=memory.update({available:false},'desktop');assert.equal(later.position,11);assert.equal(positionAt(later,now+60000),11);
 const svg=detailSVG({widget},{youtubeMusic:later});assert.match(svg,/Desktop track/);assert.match(svg,/Last played/);assert.match(svg,/0:11/);assert.match(svg,/<image/);assert.doesNotMatch(svg,/Idle/);
});
test('empty metadata and Closed handoffs preserve the old track, but new songs do not borrow old covers',()=>{
 let now=START;const memory=new MusicMemory({now:()=>now});memory.update(track(),'desktop');now+=300;
 for(const sample of [track({title:''}),track({status:'Closed',title:'Unexpected'})]){
  const view=memory.update(sample,'desktop');assert.equal(view.title,'Desktop track');assert.equal(view.available,false);assert.equal(view.remembered,true);
 }
 const delayedArt=memory.update(track({art:''}),'desktop');assert.equal(delayedArt.art,art);assert.equal(delayedArt.remembered,false);
 const changed=memory.update(track({title:'Another song',art:''}),'desktop');assert.equal(changed.title,'Another song');assert.equal(changed.art,'');
});
test('Desktop, Web and individual browser sources keep their remembered tracks separate',()=>{
 let now=START;const memory=new MusicMemory({now:()=>now});memory.update(track(),'desktop');now+=500;
 memory.update(track({source:'chrome.exe',title:'Browser song'}),'web');now+=500;
 memory.update(track({source:'msedge.exe',title:'Edge song'}),'web');
 assert.equal(memory.update({available:false},'desktop').title,'Desktop track');assert.equal(memory.update({available:false},'web').title,'Edge song');
 assert.equal(memory.update({available:false,source:'chrome.exe'},'web').title,'Browser song');
 assert.equal(memory.update({available:false,source:'firefox.exe'},'web').remembered,false);
 assert.equal(memory.update({available:false},'auto').title,'Edge song');assert.throws(()=>memory.update({},'other'),/Unknown/);
});
test('expired or absent last-track metadata falls back to the clean player logo',()=>{
 let now=START;const memory=new MusicMemory({now:()=>now});memory.update(track(),'desktop');now+=DAY;
 const view=memory.update({available:false},'desktop');assert.equal(view.remembered,false);
 const svg=detailSVG({widget},{youtubeMusic:view});assert.match(svg,/YouTube Music/);assert.match(svg,/Desktop · Idle/);assert.doesNotMatch(svg,/Desktop track|Last played/);
});
test('one sanitized last track per player type persists locally, survives restart and throttles position writes',t=>{
 const directory=temp(t);let now=START;const memory=new MusicMemory({directory,now:()=>now});
 memory.update(track({token:'never save',playlist:['never save']}),'desktop');const file=path.join(directory,'youtube-music-last.json'),first=fs.readFileSync(file,'utf8');
 now+=500;memory.update(track(),'desktop');assert.equal(fs.readFileSync(file,'utf8'),first);
 now+=30000;memory.update(track(),'desktop');const later=JSON.parse(fs.readFileSync(file,'utf8'));assert.equal(later.tracks[0].position,40.5);
 now+=100;memory.update(track({source:'chrome.exe',title:'Web track'}),'web');now+=100;memory.update(track({source:'msedge.exe',title:'New web track'}),'web');
 const persisted=fs.readFileSync(file,'utf8');assert.doesNotMatch(persisted,/token|playlist|controls|never save|Web track/);assert.equal(JSON.parse(persisted).tracks.length,2);assert.equal(fs.readdirSync(directory).length,1);
 const restarted=new MusicMemory({directory,now:()=>now});assert.equal(restarted.update({},'desktop').title,'Desktop track');assert.equal(restarted.update({},'web').title,'New web track');
});
test('untrusted persisted fields, oversized artwork and expired records cannot become widget content',t=>{
 const directory=temp(t),file=path.join(directory,'youtube-music-last.json');let now=START;
 const record={target:'desktop',source:'YouTube Music.exe',title:'Cached',artist:'',album:'',art:'',duration:180,position:42,observedAt:START};
 for(const bad of [{...record,source:''},{...record,source:'bad\nsource'},{...record,title:'x'.repeat(513)},{...record,art:'https://example.test/image'},{...record,position:9999},{...record,observedAt:START-DAY},{...record,target:'__proto__'},{...record,art:'data:image/png;base64,'+'A'.repeat(180000)}]){
  fs.writeFileSync(file,JSON.stringify({format:1,tracks:[bad]}));assert.equal(new MusicMemory({directory,now:()=>now}).update({},'desktop').remembered,false);
 }
 fs.writeFileSync(file,'x'.repeat(400001));assert.equal(new MusicMemory({directory,now:()=>now}).update({},'desktop').remembered,false);
 fs.writeFileSync(file,JSON.stringify({format:1,tracks:[{...record,token:'not copied'}]}));const clean=new MusicMemory({directory,now:()=>now}).update({},'desktop');assert.equal(clean.title,'Cached');assert.equal(clean.token,undefined);
});
test('read-only or unavailable local storage never interrupts live playback display',t=>{
 const directory=temp(t);fs.writeFileSync(path.join(directory,'not-a-folder'),'file');
 const memory=new MusicMemory({directory:path.join(directory,'not-a-folder'),now:()=>START});
 assert.equal(memory.update(track(),'desktop').available,true);assert.equal(memory.update({},'desktop').title,'Desktop track');assert.ok(memory.lastError);
});
test('Follow uses the selected music slot player while a fixed music widget retains its own player',()=>{
 const config={widget:{...widget,type:'follow'},youtubeMusicTarget:'desktop',slots:[{plugin:'youtubemusic',mediaTarget:'web'}]},data={selected:0,youtubeMusic:track({title:'Fixed desktop'}),youtubeMusicByTarget:{desktop:track({title:'Desktop only'}),web:track({source:'chrome.exe',title:'Web only'})}};
 const followed=detailSVG(config,data);assert.match(followed,/Web only/);assert.doesNotMatch(followed,/Desktop only|Fixed desktop/);
 const fixed=detailSVG({...config,widget},data);assert.match(fixed,/Fixed desktop/);assert.doesNotMatch(fixed,/Web only/);
});
