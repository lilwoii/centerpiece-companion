const test=require('node:test'),assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process'),path=require('node:path');
const {MediaBridge}=require('../src/media.cjs');
const selector=path.join(__dirname,'../src/media-session.ps1').replace(/'/g,"''");
function runSelection(script){
 const setup=`. '${selector}'
function Session($id,$state='Paused') { $s=[pscustomobject]@{SourceAppUserModelId=$id;State=$state};$s|Add-Member ScriptMethod GetPlaybackInfo { [pscustomobject]@{PlaybackStatus=$this.State} };return $s }
$desktop=Session 'youtube-music-desktop-app.exe';$squirrel=Session 'com.squirrel.youtube_music_desktop_app.youtube-music-desktop-app.exe';$pwa=Session 'Chrome._crx_music.Profile1';$chrome=Session 'chrome.exe';$edge=Session 'msedge.exe';$spotify=Session 'Spotify.exe';$ids=@('Chrome._crx_music.Profile1')
function Pick($sessions,$target='auto',$source='') { $result=Get-CompanionMediaSelection $sessions 'youtubemusic' $source $ids $target;[pscustomobject]@{id=$result.session.SourceAppUserModelId;reason=$result.reason} }
`;
 return JSON.parse(execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',setup+script],{windowsHide:true,encoding:'utf8',timeout:15000}));
}
test('Auto keeps native desktop priority when PWA and browser media are playing',{skip:process.platform!=='win32'},()=>{
 const results=runSelection(`$pwa.State='Playing';$chrome.State='Playing';@(
 (Pick @($desktop,$pwa,$chrome)),
 (Pick @($squirrel,$pwa,$chrome)),
 (Pick @($pwa,$chrome)),
 (Pick @($chrome)),
 (Pick @($desktop,$squirrel,$pwa))
)|ConvertTo-Json -Compress`);
 assert.deepEqual(results,[
  {id:'youtube-music-desktop-app.exe',reason:''},
  {id:'com.squirrel.youtube_music_desktop_app.youtube-music-desktop-app.exe',reason:''},
  {id:'Chrome._crx_music.Profile1',reason:''},
  {id:null,reason:'no-session'},
  {id:null,reason:'ambiguous'}
 ]);
});
test('Desktop isolates native executables and never sends to an active web player',{skip:process.platform!=='win32'},()=>{
 const results=runSelection(`$pwa.State='Playing';$chrome.State='Playing';@(
 (Pick @($desktop,$pwa,$chrome) 'desktop'),
 (Pick @($pwa,$chrome) 'desktop'),
 (Pick @($desktop,$pwa,$chrome) 'desktop' 'chrome.exe'),
 (Pick @($desktop,$pwa,$chrome) 'desktop' 'youtube-music-desktop-app.exe')
)|ConvertTo-Json -Compress`);
 assert.deepEqual(results,[{id:'youtube-music-desktop-app.exe',reason:''},{id:null,reason:'no-session'},{id:null,reason:'source-unavailable'},{id:'youtube-music-desktop-app.exe',reason:''}]);
});
test('Web prefers identified PWA, then a unique active browser, without desktop fallback',{skip:process.platform!=='win32'},()=>{
 const results=runSelection(`$desktop.State='Playing';$chrome.State='Playing';@(
 (Pick @($desktop,$pwa,$chrome) 'web'),
 (Pick @($desktop,$chrome,$edge) 'web'),
 (Pick @($desktop,$edge) 'web'),
 (Pick @($desktop) 'web'),
 (Pick @($desktop,$pwa,$chrome) 'web' 'youtube-music-desktop-app.exe'),
 (Pick @($desktop,$pwa,$chrome) 'web' 'Chrome._crx_music.Profile1'),
 (Pick @($desktop,$pwa,$chrome) 'web' 'chrome.exe')
)|ConvertTo-Json -Compress`);
 assert.deepEqual(results,[{id:'Chrome._crx_music.Profile1',reason:''},{id:'chrome.exe',reason:''},{id:'msedge.exe',reason:''},{id:null,reason:'no-session'},{id:null,reason:'source-unavailable'},{id:'Chrome._crx_music.Profile1',reason:''},{id:'chrome.exe',reason:''}]);
});
test('Ambiguity, missing sources and empty sessions report why no session was chosen',{skip:process.platform!=='win32'},()=>{
 const results=runSelection(`$chrome.State='Playing';$edge.State='Playing';$otherChrome=Session 'chrome.exe' 'Paused';@(
 (Pick @($chrome,$edge) 'web'),
 (Pick @($chrome,$otherChrome) 'web' 'chrome.exe'),
 (Pick @($desktop,$spotify) 'auto' 'Spotify.exe'),
 (Pick @($desktop) 'web' 'chrome.exe'),
 (Pick @() 'desktop'),
 (Pick @() 'web'),
 (Pick @() 'auto'),
 (Pick @($chrome) 'auto' 'chrome.exe')
)|ConvertTo-Json -Compress`);
 assert.deepEqual(results,[{id:null,reason:'ambiguous'},{id:null,reason:'ambiguous'},{id:null,reason:'source-unavailable'},{id:null,reason:'source-unavailable'},{id:null,reason:'no-session'},{id:null,reason:'no-session'},{id:null,reason:'no-session'},{id:'chrome.exe',reason:''}]);
});
test('MediaBridge includes current target on every status and action request',async()=>{
 const bridge=new MediaBridge('youtubemusic'),requests=[];bridge.start=()=>{};
 bridge.process={stdin:{write:line=>{const data=JSON.parse(line),pending=bridge.pending.get(data.id);requests.push(data);clearTimeout(pending.timer);bridge.pending.delete(data.id);pending.resolve({available:true});}}};
 await bridge.request('status');bridge.target='web';bridge.source='chrome.exe';await bridge.request('toggle');bridge.target='desktop';await bridge.request('next');
 assert.deepEqual(requests.map(({target,action})=>({target,action})),[{target:'auto',action:'status'},{target:'web',action:'toggle'},{target:'desktop',action:'next'}]);
 assert.equal(requests[1].source,'chrome.exe');assert.ok(requests.every(r=>r.provider==='youtubemusic'));
 bridge.target='invalid';await assert.rejects(()=>bridge.request('status'),/player target/);assert.equal(requests.length,3);
});
test('Closed sessions never override live players or make a duplicate source ambiguous',{skip:process.platform!=='win32'},()=>{
 const results=runSelection(`$desktop.State='Closed';$chrome.State='Closed';$liveDesktop=Session 'youtube-music-desktop-app.exe' 'Paused';$liveChrome=Session 'chrome.exe' 'Stopped';@(
 (Pick @($desktop,$pwa)),
 (Pick @($desktop,$liveDesktop) 'desktop'),
 (Pick @($desktop,$liveDesktop) 'desktop' 'youtube-music-desktop-app.exe'),
 (Pick @($chrome,$liveChrome) 'web'),
 (Pick @($chrome,$liveChrome) 'web' 'chrome.exe'),
 (Pick @($desktop) 'auto'),
 (Pick @($desktop) 'desktop'),
 (Pick @($chrome) 'web')
)|ConvertTo-Json -Compress`);
 assert.deepEqual(results,[{id:'Chrome._crx_music.Profile1',reason:''},{id:'youtube-music-desktop-app.exe',reason:''},{id:'youtube-music-desktop-app.exe',reason:''},{id:'chrome.exe',reason:''},{id:'chrome.exe',reason:''},{id:null,reason:'no-session'},{id:null,reason:'no-session'},{id:null,reason:'no-session'}]);
});
test('Source chooser omits closed sessions and retains paused/stopped sessions without reading titles',{skip:process.platform!=='win32'},()=>{
 const results=runSelection(`$desktop.State='Closed';$chrome.State='Stopped';$pwa|Add-Member ScriptMethod TryGetMediaPropertiesAsync { throw 'Metadata must not be queried' };@(Get-CompanionMediaSources @($desktop,$chrome,$pwa,$spotify))|ConvertTo-Json -Compress`);
 assert.deepEqual(results.map(r=>r.id).sort(),['Chrome._crx_music.Profile1','chrome.exe']);assert.ok(results.every(r=>r.title===''));
});

test('Source chooser offers only sources routable by the selected player mode',{skip:process.platform!=='win32'},()=>{
 const results=runSelection(`$other=Session 'VLC.exe';$closed=Session 'YouTubeMusic.exe' 'Closed';$namedWeb=Session 'YouTubeMusic.WebApp';$edge.State='Stopped';
$sessions=@($desktop,$squirrel,$pwa,$namedWeb,$chrome,$edge,$spotify,$other,$closed)
foreach($s in $sessions){$s|Add-Member ScriptMethod TryGetMediaPropertiesAsync { throw 'Discovery must not read titles' }}
$rows=@();foreach($target in @('desktop','web')){foreach($entry in @(Get-CompanionMediaSources $sessions $target $ids)){
 $pick=Pick $sessions $target $entry.id
 $rows+=[pscustomobject]@{target=$target;id=$entry.id;title=$entry.title;routed=$pick.id;reason=$pick.reason}
}};$rows|ConvertTo-Json -Compress`);
 assert.deepEqual(results.filter(r=>r.target==='desktop').map(r=>r.id),['youtube-music-desktop-app.exe','com.squirrel.youtube_music_desktop_app.youtube-music-desktop-app.exe']);
 assert.deepEqual(results.filter(r=>r.target==='web').map(r=>r.id),['Chrome._crx_music.Profile1','YouTubeMusic.WebApp','chrome.exe','msedge.exe']);
 for(const result of results){assert.equal(result.routed,result.id);assert.equal(result.reason,'');assert.equal(result.title,'');}
});

test('Mode-filtered source discovery is empty for only incompatible or closed players',{skip:process.platform!=='win32'},()=>{
 const results=runSelection(`$desktop.State='Closed';$pwa.State='Closed';$chrome.State='Closed';
[pscustomobject]@{desktop=@(Get-CompanionMediaSources @($desktop,$pwa,$chrome,$spotify) 'desktop' $ids).Count;web=@(Get-CompanionMediaSources @($desktop,$pwa,$chrome,$spotify) 'web' $ids).Count;legacy=@(Get-CompanionMediaSources @($desktop,$edge,$spotify)).Count}|ConvertTo-Json -Compress`);
 assert.deepEqual(results,{desktop:0,web:0,legacy:1});
});


test('Spotify recovers from closed/unreadable sessions and prefers the live player',{skip:process.platform!=='win32'},()=>{
 const results=runSelection(`$closed=Session 'Spotify.exe' 'Closed';$paused=Session 'Spotify.exe' 'Paused';$live=Session 'SpotifyAB.SpotifyMusic_zpdnekdrzrea0!Spotify' 'Playing';$broken=Session 'Spotify.exe';$broken|Add-Member -Force ScriptMethod GetPlaybackInfo { throw 'Disconnected' };$other=Session 'other.exe' 'Playing';function Spotify($items){$r=Get-CompanionMediaSelection $items 'spotify' '';[pscustomobject]@{id=$r.session.SourceAppUserModelId;reason=$r.reason}};@((Spotify @($closed,$paused,$live)),(Spotify @($broken,$live)),(Spotify @($closed,$paused)),(Spotify @($closed,$broken,$other)),(Spotify @($live,(Session 'Spotify.exe' 'Playing'))))|ConvertTo-Json -Compress`);
 assert.deepEqual(results,[{id:'SpotifyAB.SpotifyMusic_zpdnekdrzrea0!Spotify',reason:''},{id:'SpotifyAB.SpotifyMusic_zpdnekdrzrea0!Spotify',reason:''},{id:'Spotify.exe',reason:''},{id:null,reason:'no-session'},{id:null,reason:'ambiguous'}]);
});
