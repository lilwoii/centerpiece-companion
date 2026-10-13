const test=require('node:test'),assert=require('node:assert/strict');
const {MusicPlayers}=require('../src/music-players.cjs');
const {Workspace,defaults}=require('../src/workspace.cjs');
const {validateSlot}=require('../src/catalog.cjs');
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return{promise,resolve};};
const track=(target,extra={})=>({available:true,status:'Paused',source:target==='web'?'chrome.exe':'youtube-music-desktop-app.exe',title:target+' song',artist:'Artist',duration:200,position:45,...extra});
function fixture(){const calls=[],bridges={};const players=new MusicPlayers({bridgeFactory:target=>bridges[target]={source:'',request:async action=>{calls.push([target,action]);return action==='status'?track(target):{accepted:true};},close:()=>calls.push([target,'close'])}});return{players,bridges,calls};}

test('two slots route to independent players without moving the widget player',async()=>{
 const f=fixture(),w=Object.create(Workspace.prototype);w.config=Workspace.prototype.validate({...defaults(),slots:[{plugin:'youtubemusic',action:'toggle',mediaTarget:'desktop'},{plugin:'youtubemusic',action:'next',mediaTarget:'web'},null,null]});w.youtubeMusic=f.players;
 await w.run(0);await w.run(1);assert.deepEqual(f.calls,[['desktop','toggle'],['web','next']]);assert.equal(f.players.target,'desktop');f.players.close();
});

test('Web discovery cannot delay desktop metadata and paused songs stay controllable',async()=>{
 const f=fixture(),gate=deferred();f.bridges.web.request=()=>gate.promise;
 const web=f.players.refresh('web');const desktop=await f.players.refresh('desktop');
 assert.equal(desktop.available,true);assert.equal(desktop.status,'Paused');assert.equal(desktop.position,45);
 await f.players.request('toggle',{target:'desktop'});assert.deepEqual(f.calls.at(-1),['desktop','toggle']);
 gate.resolve(track('web'));await web;assert.equal(f.players.view('web').title,'web song');assert.equal(f.players.view('desktop').title,'desktop song');f.players.close();
});

test('disconnected player keeps a frozen last song without creating a live control target',async()=>{
 const f=fixture();await f.players.refresh('desktop');f.bridges.desktop.request=async()=>({available:false,reason:'no-session'});
 const remembered=await f.players.refresh('desktop');assert.equal(remembered.available,false);assert.equal(remembered.remembered,true);assert.equal(remembered.title,'desktop song');assert.equal(remembered.position,45);assert.deepEqual(remembered.controls,{});f.players.close();
});

test('old in-flight source results and close results cannot overwrite the new state',async()=>{
 const f=fixture(),gate=deferred();f.bridges.desktop.request=()=>gate.promise;
 const pending=f.players.refresh('desktop');f.players.source='other-source.exe';gate.resolve(track('desktop'));await pending;assert.equal(f.players.view().available,false);
 const next=deferred();f.bridges.desktop.request=()=>next.promise;const closing=f.players.refresh('desktop');f.players.close();next.resolve(track('desktop'));await closing;assert.equal(f.players.view().available,false);await assert.rejects(f.players.request('toggle'),/closed/);
});

test('changing widget players clears invisible source pins and source cache stays isolated',async()=>{
 const f=fixture();await f.players.refresh('desktop');f.players.source='missing-desktop-source.exe';
 f.bridges.desktop.request=async()=>({available:false,reason:'source-unavailable'});
 assert.equal((await f.players.refresh('desktop')).remembered,false);
 f.players.target='web';f.players.source='';assert.equal(f.bridges.desktop.source,'');assert.equal(f.bridges.web.source,'');
 f.players.source='chrome.exe';assert.equal(f.bridges.web.source,'chrome.exe');
 f.players.target='desktop';f.players.source='';assert.equal(f.bridges.web.source,'');f.players.close();
});

test('synchronous connection errors permit retry and closing before queued refresh starts sends nothing',async()=>{
 const f=fixture();f.bridges.desktop.request=()=>{throw Error('temporarily unavailable');};
 assert.equal((await f.players.refresh()).available,false);assert.equal(f.players.pending.desktop,undefined);
 f.bridges.desktop.request=async()=>track('desktop');assert.equal((await f.players.refresh()).available,true);
 f.calls.length=0;f.bridges.web.request=async()=>{f.calls.push('late request');return track('web');};
 const pending=f.players.refresh('web');f.players.close();await pending;assert.ok(!f.calls.includes('late request'));
});

test('legacy shared modes migrate once; later widget changes preserve per-slot player choices',()=>{
 const input={...defaults(),youtubeMusicTarget:'web',slots:[{plugin:'youtubemusic',action:'toggle'}, {plugin:'youtubemusic',action:'next',mediaTarget:'desktop'},null,null]};
 const w=Object.create(Workspace.prototype);w.config=w.validate(input);w.save=c=>w.config=w.validate(c);
 assert.equal(w.config.slots[0].mediaTarget,'web');assert.equal(w.config.slots[1].mediaTarget,'desktop');
 w.saveMusicTarget('desktop');assert.equal(w.config.slots[0].mediaTarget,'web');assert.equal(w.config.slots[1].mediaTarget,'desktop');
 assert.equal(w.validate({...input,youtubeMusicTarget:'auto'}).slots[0].mediaTarget,'desktop');
 const legacyWeb=w.validate({...input,youtubeMusicTarget:'auto',youtubeMusicSource:'chrome.exe'});assert.equal(legacyWeb.youtubeMusicTarget,'web');assert.equal(legacyWeb.slots[0].mediaTarget,'web');
 assert.equal(w.validate({...input,youtubeMusicTarget:'auto',youtubeMusicSource:'youtube-music-desktop-app.exe'}).youtubeMusicTarget,'desktop');
 assert.throws(()=>validateSlot({plugin:'youtubemusic',action:'toggle',mediaTarget:'auto'}));
});

