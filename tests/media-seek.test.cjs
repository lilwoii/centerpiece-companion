const test=require('node:test'),assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process'),path=require('node:path');

test('Windows rewind seeks ten seconds behind the effective media clock',{skip:process.platform!=='win32'},()=>{
 const helper=path.join(__dirname,'../src/media-session.ps1').replace(/'/g,"''");
 const script=`$ErrorActionPreference='Stop'
 . '${helper}'
 function Target($raw,$duration,$status,$rate,$source,$now){
   $timeline=[pscustomobject]@{Position=[TimeSpan]::FromSeconds($raw);EndTime=[TimeSpan]::FromSeconds($duration);LastUpdatedTime=[DateTimeOffset]::FromUnixTimeMilliseconds($source)}
   $playback=[pscustomobject]@{PlaybackStatus=$status;PlaybackRate=$rate}
   (Get-CompanionMediaRewindTicks $timeline $playback ([DateTimeOffset]::FromUnixTimeMilliseconds($now)))/[double][TimeSpan]::TicksPerSecond
 }
 @(
   (Target 0 240 'Playing' 1 100000 165000)
   (Target 30 240 'Playing' 1.5 100000 104000)
   (Target 30 240 'Paused' 1 100000 165000)
   (Target 30 240 'Closed' 1 100000 165000)
   (Target 3 240 'Playing' 1 100000 102000)
   (Target 0 240 'Playing' 1 100000 999000)
   (Target 30 240 'Playing' 0 100000 165000)
   (Target 30 240 'Playing' $null 100000 102000)
   (Target 30 240 'Playing' 99 100000 102000)
   (Target 30 240 'Playing' 1 0 165000)
   (Target 30 240 'Playing' 1 180000 165000)
 )|ConvertTo-Json -Compress`;
 const result=execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',script],{windowsHide:true,encoding:'utf8',timeout:15000});
 assert.deepEqual(JSON.parse(result),[55,26,20,20,0,230,20,22,22,20,20]);
});
