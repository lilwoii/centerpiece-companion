const test=require('node:test'),assert=require('node:assert/strict');
const {Workspace,defaults}=require('../src/workspace.cjs');
const {detailSVG}=require('../src/widgets.cjs');
const {PlaybackClock,positionAt}=require('../src/playback-clock.cjs');
const {validateSource}=require('../src/music-source.cjs');
const {validateOrder,nextWidget}=require('../src/widget-cycle.cjs');
const {execFileSync}=require('node:child_process');
const path=require('node:path');
const widget={type:'youtubemusic',text:'',x:1710,y:219,width:194,height:94};
test('media helper parses in the Windows PowerShell version used by the desktop app',{skip:process.platform!=='win32'},()=>{
 const file=path.join(__dirname,'../src/media.ps1').replace(/'/g,"''");
 const result=execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',`$tokens=$null;$errors=$null;[System.Management.Automation.Language.Parser]::ParseFile('${file}',[ref]$tokens,[ref]$errors)|Out-Null;if($errors.Count){throw ($errors.Message -join '; ')};'parsed'`],{windowsHide:true,encoding:'utf8',timeout:15000});
 assert.equal(result.trim(),'parsed');
});
test('YouTube Music configuration preserves website actions and opts into widget rotation',()=>{
 const c=Workspace.prototype.validate({...defaults(),youtubeMusicSource:'chrome.exe',widget,slots:[{plugin:'youtubemusic',action:'toggle'},null,null,null]});
 assert.equal(c.youtubeMusicSource,'chrome.exe');assert.equal(c.widget.type,'youtubemusic');
 assert.equal(require('../src/catalog.cjs').validateSlot({plugin:'youtubemusic',action:'open'}).action,'open');
 assert.ok(!validateOrder().includes('youtubemusic'));assert.equal(nextWidget('spotify',['spotify','youtubemusic','clock']),'youtubemusic');
 for(const bad of [null,{},'x'.repeat(513),'chrome.exe\ncommand','Spotify.exe'])assert.throws(()=>validateSource(bad));
 assert.equal(validateSource(), '');
});
test('YouTube Music playback never dispatches to Spotify or global media keys',async()=>{
 const calls=[],w=Object.create(Workspace.prototype);w.media={request:()=>assert.fail('Spotify must not receive YouTube controls')};w.system={request:()=>assert.fail('Global media keys must not be sent')};w.youtubeMusic={request:async a=>calls.push(a)};
 for(const action of ['toggle','previous','next','rewind']){w.config={slots:[{plugin:'youtubemusic',action}]};await w.run(0);}
 assert.deepEqual(calls,['toggle','previous','next','rewind']);w.youtubeMusic.request=async()=>{throw Error('Music source disconnected');};await assert.rejects(()=>w.run(0),/disconnected/);
});
test('YouTube widget shows its own artwork, escaped track text and red progress, including Follow mode',()=>{
 const art='data:image/png;base64,iVBORw0KGgo=',data={media:{available:true,title:'Spotify only'},youtubeMusic:{available:true,title:'YT <song>',artist:'Artist & name',art,position:60,duration:120,status:'Paused'}};
 for(const type of ['youtubemusic','follow']){
  const svg=detailSVG({widget:{...widget,type},slots:[{plugin:'youtubemusic'}]},data);
  assert.match(svg,/YT &lt;song&gt;/);assert.match(svg,/Artist &amp; name/);assert.match(svg,/width="89" height="4" rx="2" fill="#ff0033"/);assert.match(svg,/width="54" height="54"/);assert.match(svg,/1:00/);assert.ok(!svg.includes('Spotify only'));
 }
 const missing=detailSVG({widget},{});assert.match(missing,/YouTube Music/);assert.doesNotMatch(missing,/Start a song/);assert.ok(!/NaN|undefined/.test(missing));
 data.youtubeMusic.art='https://untrusted.test/a.png';assert.ok(!detailSVG({widget},data).includes('<image'));
});
test('independent clocks advance, pause and change tracks without moving Spotify',()=>{
 const yt=new PlaybackClock(),spotify=new PlaybackClock();const base={available:true,title:'Track',artist:'Artist',duration:200,status:'Playing',rawPosition:10,timelineUpdatedAt:1000};
 const s=spotify.update({...base,rawPosition:80},1000,1000),y=yt.update(base,1000,1000);
 assert.equal(positionAt(y,3000),12);assert.equal(positionAt(s,3000),82);
 const paused=yt.update({...base,status:'Paused',rawPosition:12,timelineUpdatedAt:3000},3000,3000);assert.equal(positionAt(paused,9000),12);
 const changed=yt.update({...base,title:'New song',rawPosition:0,timelineUpdatedAt:9000},9000,9000);assert.equal(positionAt(changed,10000),1);
 assert.equal(spotify.last.media.position,80);
});
test('Windows selector isolates providers and refuses ambiguous or missing browser sessions',{skip:process.platform!=='win32'},()=>{
 const file=path.join(__dirname,'../src/media-session.ps1').replace(/'/g,"''");
 const script=`. '${file}'
 $sessions=@([pscustomobject]@{SourceAppUserModelId='Spotify.exe'},[pscustomobject]@{SourceAppUserModelId='chrome.exe'},[pscustomobject]@{SourceAppUserModelId='YouTube Music.exe'})
 $results=@()
 $results+=(Find-CompanionMediaSession $sessions 'spotify' '').SourceAppUserModelId
 $results+=(Find-CompanionMediaSession $sessions 'youtubemusic' '').SourceAppUserModelId
 $results+=(Find-CompanionMediaSession $sessions 'youtubemusic' 'chrome.exe').SourceAppUserModelId
 $results+=($null -eq (Find-CompanionMediaSession $sessions 'youtubemusic' 'Spotify.exe'))
 $results+=($null -eq (Find-CompanionMediaSession $sessions 'youtubemusic' 'msedge.exe'))
 $results+=($null -eq (Find-CompanionMediaSession @($sessions[0],$sessions[1]) 'youtubemusic' ''))
 $results+=($null -eq (Find-CompanionMediaSession @($sessions[1],$sessions[1]) 'youtubemusic' 'chrome.exe'))
 $results+=(Find-CompanionMediaSession @([pscustomobject]@{SourceAppUserModelId='Chrome._crx_music.Profile1'}) 'youtubemusic' '' @('Chrome._crx_music.Profile1')).SourceAppUserModelId
 $results+=($null -eq (Find-CompanionMediaSession @($sessions[1]) 'youtubemusic' '' @('chrome.exe')))
 $results|ConvertTo-Json -Compress`;
 const out=execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',script],{windowsHide:true,encoding:'utf8',timeout:15000});
 assert.deepEqual(JSON.parse(out),['Spotify.exe','YouTube Music.exe','chrome.exe',true,true,true,true,'Chrome._crx_music.Profile1',true]);
});

test('applied music widgets join shortcut rotation without duplicates or reordering existing choices',()=>{
 const {includeWidget}=require('../src/widget-cycle.cjs');const original=['spotify','weather','off'];
 assert.deepEqual(includeWidget(original,'youtubemusic'),['spotify','weather','youtubemusic','off']);
 assert.deepEqual(includeWidget(['youtubemusic','off'],'youtubemusic'),['youtubemusic','off']);
 assert.deepEqual(includeWidget(original,'follow'),original);assert.deepEqual(original,['spotify','weather','off']);
});
test('automatic source priority follows playing desktop/browser and refuses simultaneous browsers',{skip:process.platform!=='win32'},()=>{
 const file=path.join(__dirname,'../src/media-session.ps1').replace(/'/g,"''");
 const script=`. '${file}'
 function Session($id,$playing){$s=[pscustomobject]@{SourceAppUserModelId=$id;State=$playing};$s|Add-Member ScriptMethod GetPlaybackInfo { [pscustomobject]@{PlaybackStatus=$this.State} };return $s}
 $desktop=Session 'YouTube Music.exe' 'Playing';$browser=Session 'chrome.exe' 'Playing';$edge=Session 'msedge.exe' 'Playing'
 $results=@()
 $results+=(Find-CompanionMediaSession @($browser,$desktop) 'youtubemusic' '').SourceAppUserModelId
 $desktop.State='Paused'
 $results+=(Find-CompanionMediaSession @($desktop,$browser) 'youtubemusic' '').SourceAppUserModelId
 $browser.State='Paused'
 $results+=(Find-CompanionMediaSession @($desktop,$browser) 'youtubemusic' '').SourceAppUserModelId
 $browser.State='Playing'
 $results+=($null -eq (Find-CompanionMediaSession @($browser,$edge) 'youtubemusic' ''))
 $results+=(Find-CompanionMediaSession @($browser,$edge) 'youtubemusic' 'msedge.exe').SourceAppUserModelId
 $results|ConvertTo-Json -Compress`;
 assert.deepEqual(JSON.parse(execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',script],{windowsHide:true,encoding:'utf8',timeout:15000})),['YouTube Music.exe','YouTube Music.exe','YouTube Music.exe',true,'msedge.exe']);
});
test('Open YouTube Music prefers a desktop shortcut and uses Windows default browser only if absent',async()=>{
 const {launch}=require('../src/youtube-music-launch.cjs');const calls=[];
 const io={readdirSync:()=>[{name:'YouTube Music.lnk',isDirectory:()=>false,isFile:()=>true}],existsSync:()=>true};
 const shell={readShortcutLink:()=>({target:'C:\\Apps\\YouTube Music.exe'}),openPath:async p=>{calls.push(['app',p]);return '';},openExternal:async u=>calls.push(['url',u])};
 assert.equal(await launch(shell,{env:{APPDATA:'C:/Users/test'},io}),'desktop');assert.equal(calls[0][0],'app');
 calls.length=0;shell.readShortcutLink=()=>({target:'C:\\Apps\\chrome_proxy.exe'});
 assert.equal(await launch(shell,{env:{APPDATA:'C:/Users/test'},io}),'browser');assert.deepEqual(calls,[['url','https://music.youtube.com/']]);
 shell.readShortcutLink=()=>({target:'C:\\Apps\\YouTube Music.exe'});shell.openPath=async()=> 'launch failed';
 await assert.rejects(()=>launch(shell,{env:{APPDATA:'C:/Users/test'},io}),/could not open/);
});

test('YouTube browser widget and controls are separate from the Music desktop session',async()=>{
 const calls=[],w=Object.create(Workspace.prototype);w.config={slots:[{plugin:'youtube',action:'next'}]};w.youtube={request:async action=>calls.push(action)};w.youtubeMusic={request:()=>assert.fail('Music must not receive video action')};await w.run(0);assert.deepEqual(calls,['next']);
 const c=Workspace.prototype.validate({...defaults(),widget:{...widget,type:'youtube'}});assert.equal(c.widget.type,'youtube');
 const svg=detailSVG(c,{youtube:{available:true,title:'Video title',artist:'Channel',position:70,duration:200,status:'Paused'},youtubeMusic:{title:'Wrong music'}});assert.match(svg,/Video title/);assert.match(svg,/1:10/);assert.ok(!svg.includes('Wrong music'));
});
