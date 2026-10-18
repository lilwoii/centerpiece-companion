$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'media-session.ps1')
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)
Add-Type -AssemblyName System.Runtime.WindowsRuntime
$managerType = [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager, Windows.Media.Control, ContentType=WindowsRuntime]
$propertiesType = [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionMediaProperties, Windows.Media.Control, ContentType=WindowsRuntime]
$asTask = [System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { $_.Name -eq 'AsTask' -and $_.IsGenericMethod -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1' } | Select-Object -First 1
function Await-WinRT($operation, $resultType) {
  $task = $asTask.MakeGenericMethod($resultType).Invoke($null, @($operation))
  if (!$task.Wait(5000)) { throw 'Windows media request timed out' }
  return $task.Result
}
$manager = Await-WinRT ($managerType::RequestAsync()) $managerType
$artCache=@{};$installedMusicIds=@();$installedMusicChecked=[datetime]::MinValue;$managerRefreshed=[datetime]::UtcNow
while ($null -ne ($line = [Console]::ReadLine())) {
  $request = $null
  try {
    $request = $line | ConvertFrom-Json
    $sources=@(); $label=if($request.provider -eq 'youtube'){'YouTube'}else{'Spotify'}
    if(!$manager){$manager=Await-WinRT ($managerType::RequestAsync()) $managerType;$managerRefreshed=[datetime]::UtcNow}
    $sessions=@($manager.GetSessions())
    $target=if($request.target){[string]$request.target}else{'auto'}
    if($request.provider -eq 'youtubemusic') {
      $label='YouTube Music'
      # Installed Chrome/Edge web apps have their own registered app IDs.
      # Read the Windows app list only; never inspect browser profiles or cookies.
      if($target -ne 'desktop' -and ([datetime]::UtcNow-$installedMusicChecked).TotalSeconds -ge 60){
        $installedMusicChecked=[datetime]::UtcNow
        try{$installedMusicIds=@(Get-StartApps -ErrorAction Stop | Where-Object { $_.Name -match '(?i)^YouTube\s*Music(?:\s*\([^)]*\))?$' } | ForEach-Object { $_.AppID })}catch{}
      }
    }
    $selection=Get-CompanionMediaSelection $sessions $request.provider $request.source $installedMusicIds $target
    $session=$selection.session
    if(!$session -and ([datetime]::UtcNow-$managerRefreshed).TotalSeconds -ge 3){
      # Reacquire after an app restart/resume instead of retaining a stale manager.
      # This is a read-only discovery retry; playback commands are sent only once.
      $managerRefreshed=[datetime]::UtcNow
      $manager=Await-WinRT ($managerType::RequestAsync()) $managerType
      $sessions=@($manager.GetSessions())
      $selection=Get-CompanionMediaSelection $sessions $request.provider $request.source $installedMusicIds $target
      $session=$selection.session
    }
    if($request.provider -eq 'youtubemusic'){$sources=@(Get-CompanionMediaSources $sessions $target $installedMusicIds)}
    if (!$session) {
      $message=if($selection.reason -eq 'ambiguous'){'Several media sessions match this player. Pause or close the other media sessions, then retry. No playback command was sent.'}elseif($selection.reason -eq 'source-unavailable'){'The selected media source is not available for this player choice. Choose a matching source or Automatic source in Connections.'}elseif($request.provider -eq 'youtube'){'No browser playback session is available. Open YouTube in your browser; Companion reconnects when Windows reports its media.'}elseif($label -eq 'Spotify'){'Open Spotify and start a track to connect.'}elseif($target -eq 'desktop'){'No YouTube Music desktop playback session is available. Open the desktop player; Companion reconnects automatically when Windows reports its media.'}elseif($target -eq 'web'){'No YouTube Music web playback session is available. Open the installed web app or browser player. Windows may need playback to start once before it reports media.'}else{'No identified YouTube Music playback session is available. Open the desktop player or installed web app. For a browser tab, select Web as your player. Windows may need playback to start once before it reports media.'}
      if ($request.action -ne 'status') { throw $message }
      $result = @{ available=$false; reason=$selection.reason; message=$message; sources=$sources; target=$target }
    } elseif ($request.action -eq 'status') {
      $props = Await-WinRT ($session.TryGetMediaPropertiesAsync()) $propertiesType
      foreach($entry in $sources){if($entry.id -ceq $session.SourceAppUserModelId){$entry.title=$props.Title}}
      $playback = $session.GetPlaybackInfo()
      $timeline = $session.GetTimelineProperties()
      $newKey=$session.SourceAppUserModelId+'|'+$props.Title+'|'+$props.Artist+'|'+$props.AlbumTitle
      $art=Get-CompanionMediaArtwork $artCache $newKey $request.provider {
        $stream=$null;$reader=$null
        try{if($props.Thumbnail){
          $streamType=[Windows.Storage.Streams.IRandomAccessStreamWithContentType,Windows.Storage.Streams,ContentType=WindowsRuntime]
          $stream=Await-WinRT ($props.Thumbnail.OpenReadAsync()) $streamType; $streamInterface=[Windows.Storage.Streams.IRandomAccessStream,Windows.Storage.Streams,ContentType=WindowsRuntime]; $size=$streamInterface.GetProperty("Size").GetValue($stream)
          if($size -gt 0 -and $size -le 1048576){
            $readerType=[Windows.Storage.Streams.DataReader,Windows.Storage.Streams,ContentType=WindowsRuntime]
            $reader=$readerType::new($streamInterface.GetMethod("GetInputStreamAt").Invoke($stream,@([uint64]0)))
            $loaded=Await-WinRT ($reader.LoadAsync([uint32]$size)) ([uint32])
            $bytes=New-Object byte[] $loaded;$reader.ReadBytes($bytes)
            $mime=if($stream.ContentType -eq 'image/png'){'image/png'}else{'image/jpeg'}
            return 'data:'+$mime+';base64,'+[Convert]::ToBase64String($bytes)
          }
        }}finally{if($reader){try{([System.IDisposable]$reader).Dispose()}catch{}}if($stream){try{([System.IDisposable]$stream).Dispose()}catch{}}}
      }
      $result = @{
        available=($playback.PlaybackStatus.ToString() -ne 'Closed'); title=$props.Title; artist=$props.Artist; album=$props.AlbumTitle
        source=$session.SourceAppUserModelId; sources=$sources; target=$target
        playbackRate=if($null -eq $playback.PlaybackRate){1.0}else{[double]$playback.PlaybackRate}
        status=$playback.PlaybackStatus.ToString(); position=$timeline.Position.TotalSeconds
        duration=$timeline.EndTime.TotalSeconds
        rawPosition=$timeline.Position.TotalSeconds; timelineUpdatedAt=$timeline.LastUpdatedTime.ToUnixTimeMilliseconds()
        art=$art
        controls=@{ toggle=$playback.Controls.IsPlayPauseToggleEnabled; next=$playback.Controls.IsNextEnabled; previous=$playback.Controls.IsPreviousEnabled }
      }
    } else {
      $operation = switch ($request.action) {
        'toggle' { $session.TryTogglePlayPauseAsync() }
        'play' { $session.TryPlayAsync() }
        'pause' { $session.TryPauseAsync() }
        'next' { $session.TrySkipNextAsync() }
        'previous' { $session.TrySkipPreviousAsync() }
        'rewind' { $timeline=$session.GetTimelineProperties();$seekTicks=Get-CompanionMediaRewindTicks $timeline ($session.GetPlaybackInfo());$session.TryChangePlaybackPositionAsync($seekTicks) }
        default { throw 'Unknown media action' }
      }
      $accepted = Await-WinRT $operation ([bool])
      if (!$accepted) { throw "$label did not accept this control. Try it in the music app, then retry." }
      $result = @{ accepted=$true }
    }
    @{ id=$request.id; ok=$true; result=$result } | ConvertTo-Json -Depth 5 -Compress | ForEach-Object { [Console]::WriteLine($_) }
  } catch {
    # Drop a stale manager after a failed read/control; rediscover on the next
    # request without replaying a playback command.
    $manager=$null
    @{ id=$request.id; ok=$false; error=$_.Exception.Message } | ConvertTo-Json -Compress | ForEach-Object { [Console]::WriteLine($_) }
  }
}
