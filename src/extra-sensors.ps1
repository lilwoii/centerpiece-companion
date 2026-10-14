$ErrorActionPreference='Stop'
$r=[Console]::ReadLine()|ConvertFrom-Json
[Console]::OutputEncoding=New-Object System.Text.UTF8Encoding($false)
if($r.action -eq 'downloads'){
 $items=@();try{foreach($job in @(Get-BitsTransfer -ErrorAction Stop)){if($job.JobState -in @('Transferring','Connecting','Queued','Suspended') -and $job.BytesTotal -gt 0 -and $job.BytesTotal -lt [long]::MaxValue){$items+=@{name=$job.DisplayName;done=[double]$job.BytesTransferred;total=[double]$job.BytesTotal;status=[string]$job.JobState;source='Windows BITS'}}}}catch{}
 $steam=(Get-ItemProperty 'HKCU:\Software\Valve\Steam' -ErrorAction SilentlyContinue).SteamPath
 if($steam){$roots=@((Join-Path $steam 'steamapps'));$vdf=Join-Path $steam 'steamapps\libraryfolders.vdf';if(Test-Path -LiteralPath $vdf){$content=Get-Content -LiteralPath $vdf -Raw;foreach($m in [regex]::Matches($content,'"path"\s+"([^"]+)"')){$roots+=Join-Path ($m.Groups[1].Value.Replace('\\','\')) 'steamapps'}}
 foreach($root in ($roots|Select-Object -Unique)){foreach($file in @(Get-ChildItem -LiteralPath $root -Filter 'appmanifest_*.acf' -ErrorAction SilentlyContinue)){
  if($file.Length -gt 1048576){continue};$body=Get-Content -LiteralPath $file.FullName -Raw
  $fields=@{};foreach($m in [regex]::Matches($body,'"(name|BytesToDownload|BytesDownloaded|StateFlags)"\s+"([^"]+)"')){$fields[$m.Groups[1].Value]=$m.Groups[2].Value}
  $flags=0L;$total=0.0;$done=0.0
  if([long]::TryParse($fields.StateFlags,[ref]$flags) -and [double]::TryParse($fields.BytesToDownload,[ref]$total) -and [double]::TryParse($fields.BytesDownloaded,[ref]$done) -and $total -gt 0 -and $done -ge 0 -and $done -lt $total){$items+=@{name=$fields.name;done=$done;total=$total;status='Steam manifest';source='Steam · saved progress';observedAt=[DateTimeOffset]::new($file.LastWriteTimeUtc).ToUnixTimeMilliseconds()}}
 }} }
 @{items=@($items|Select-Object -First 20)}|ConvertTo-Json -Depth 4 -Compress
}else{throw 'Unknown sensor request'}
