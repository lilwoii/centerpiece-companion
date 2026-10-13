const test=require('node:test'),assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process'),path=require('node:path');
const helper=path.join(__dirname,'../src/media-session.ps1').replace(/'/g,"''");
function run(script){
 const setup=`$ErrorActionPreference='Stop'
. '${helper}'
$cache=@{};$start=[datetime]'2026-01-01T00:00:00Z';$script:reads=@();$script:candidate=''
function Sample([int]$ms,[string]$key='song-b',[string]$provider='youtubemusic') {
 $script:sampleTime=$ms
 $art=Get-CompanionMediaArtwork $cache $key $provider { $script:reads+=$script:sampleTime;if($script:candidate -eq 'throw'){throw 'Temporary thumbnail failure'};return $script:candidate } ($start.AddMilliseconds($ms))
 return [pscustomobject]@{at=$ms;key=$key;art=$art}
}
`;
 return JSON.parse(execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',setup+script],{windowsHide:true,encoding:'utf8',timeout:15000}));
}
test('YouTube Music replaces an early old cover, then stops thumbnail reads after the transition',{skip:process.platform!=='win32'},()=>{
 const result=run(`$script:candidate='old-cover';$rows=@((Sample 0),(Sample 100));$script:candidate='new-cover';$rows+=(Sample 250);$rows+=(Sample 500);$rows+=(Sample 750);$rows+=(Sample 1000);$rows+=(Sample 1500);$rows+=(Sample 2000);$rows+=(Sample 60000);@{rows=$rows;reads=$script:reads}|ConvertTo-Json -Depth 4 -Compress`);
 assert.deepEqual(result.reads,[0,250,750,1500]);assert.deepEqual(result.rows.map(x=>x.art),['old-cover','old-cover',...Array(7).fill('new-cover')]);
});
test('failed reconciliation preserves the current image while a new track clears the previous cache',{skip:process.platform!=='win32'},()=>{
 const result=run(`$script:candidate='b-cover';$rows=@((Sample 0));$script:candidate='throw';$rows+=(Sample 250);$script:candidate='';$rows+=(Sample 750);$rows+=(Sample 1000 'song-c');$script:candidate='c-cover';$rows+=(Sample 1250 'song-c');@{rows=$rows;reads=$script:reads}|ConvertTo-Json -Depth 4 -Compress`);
 assert.deepEqual(result.rows.map(x=>x.art),['b-cover','b-cover','b-cover','','c-cover']);assert.deepEqual(result.reads,[0,250,750,1000,1250]);
});
test('missing music covers retry after the transition and delayed polling does not replay all missed reads',{skip:process.platform!=='win32'},()=>{
 const result=run(`$rows=@((Sample 0),(Sample 1700),(Sample 1800),(Sample 2199));$script:candidate='late-cover';$rows+=(Sample 2200);$rows+=(Sample 10000);@{rows=$rows;reads=$script:reads}|ConvertTo-Json -Depth 4 -Compress`);
 assert.deepEqual(result.reads,[0,1700,2200]);assert.equal(result.rows[4].art,'late-cover');assert.equal(result.rows[5].art,'late-cover');
});
test('Spotify and regular YouTube retain successful artwork and their two-second missing-cover retry',{skip:process.platform!=='win32'},()=>{
 for(const provider of ['spotify','youtube']){
  const result=run(`$rows=@((Sample 0 'song-a' '${provider}'),(Sample 250 'song-a' '${provider}'),(Sample 750 'song-a' '${provider}'),(Sample 1500 'song-a' '${provider}'));$script:candidate='cover';$rows+=(Sample 2000 'song-a' '${provider}');$rows+=(Sample 60000 'song-a' '${provider}');@{rows=$rows;reads=$script:reads}|ConvertTo-Json -Depth 4 -Compress`);
  assert.deepEqual(result.reads,[0,2000]);assert.equal(result.rows[4].art,'cover');assert.equal(result.rows[5].art,'cover');
 }
});
