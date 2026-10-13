const test=require('node:test'),assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process'),path=require('node:path');

test('source discovery lists apps without querying unrelated or stalled media properties',{skip:process.platform!=='win32'},()=>{
 const helper=path.join(__dirname,'../src/media-session.ps1').replace(/'/g,"''");
 const script=`$ErrorActionPreference='Stop'
 . '${helper}'
 $script:reads=0
 function Session($id){
   $session=[pscustomobject]@{SourceAppUserModelId=$id}
   $session|Add-Member ScriptMethod TryGetMediaPropertiesAsync { $script:reads++;throw 'This unrelated app never responds' }
   return $session
 }
 $sessions=@((Session 'chrome.exe'),(Session 'youtube-music-desktop-app.exe'),(Session 'Spotify.exe'))
 $sources=@(Get-CompanionMediaSources $sessions)
 @{sources=$sources;propertyReads=$script:reads}|ConvertTo-Json -Depth 4 -Compress`;
 const result=JSON.parse(execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',script],{windowsHide:true,encoding:'utf8',timeout:15000}));
 assert.equal(result.propertyReads,0);
 assert.deepEqual(result.sources,[{id:'chrome.exe',title:''},{id:'youtube-music-desktop-app.exe',title:''}]);
});
