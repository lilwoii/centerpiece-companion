$ErrorActionPreference = 'Stop'
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
$artKey='';$art=''
while ($null -ne ($line = [Console]::ReadLine())) {
  $request = $null
  try {
    $request = $line | ConvertFrom-Json
    $session = $manager.GetSessions() | Where-Object { $_.SourceAppUserModelId -match '(?i)spotify' } | Select-Object -First 1
    if (!$session) {
      if ($request.action -ne 'status') { throw 'Open Spotify and start a track first.' }
      $result = @{ available=$false; message='Open Spotify and start a track to connect.' }
    } elseif ($request.action -eq 'status') {
      $props = Await-WinRT ($session.TryGetMediaPropertiesAsync()) $propertiesType
      $playback = $session.GetPlaybackInfo()
      $timeline = $session.GetTimelineProperties()
      $newKey=$props.Title+'|'+$props.Artist
      if($newKey -ne $artKey){$artKey=$newKey;$art='';try{if($props.Thumbnail){
        $streamType=[Windows.Storage.Streams.IRandomAccessStreamWithContentType,Windows.Storage.Streams,ContentType=WindowsRuntime]
        $stream=Await-WinRT ($props.Thumbnail.OpenReadAsync()) $streamType; $streamInterface=[Windows.Storage.Streams.IRandomAccessStream,Windows.Storage.Streams,ContentType=WindowsRuntime]; $size=$streamInterface.GetProperty("Size").GetValue($stream)
        if($size -gt 0 -and $size -le 1048576){
          $readerType=[Windows.Storage.Streams.DataReader,Windows.Storage.Streams,ContentType=WindowsRuntime]
          $reader=$readerType::new($streamInterface.GetMethod("GetInputStreamAt").Invoke($stream,@([uint64]0)))
          $loaded=Await-WinRT ($reader.LoadAsync([uint32]$size)) ([uint32])
          $bytes=New-Object byte[] $loaded;$reader.ReadBytes($bytes)
          $mime=if($stream.ContentType -eq 'image/png'){'image/png'}else{'image/jpeg'}
          $art='data:'+$mime+';base64,'+[Convert]::ToBase64String($bytes)
          try{([System.IDisposable]$reader).Dispose()}catch{}
        };try{([System.IDisposable]$stream).Dispose()}catch{}
      }}catch{$art=''}}
      $result = @{
        available=$true; title=$props.Title; artist=$props.Artist; album=$props.AlbumTitle
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
        default { throw 'Unknown media action' }
      }
      $accepted = Await-WinRT $operation ([bool])
      if (!$accepted) { throw 'Spotify did not accept this control. Try it in Spotify, then retry.' }
      $result = @{ accepted=$true }
    }
    @{ id=$request.id; ok=$true; result=$result } | ConvertTo-Json -Depth 5 -Compress | ForEach-Object { [Console]::WriteLine($_) }
  } catch {
    @{ id=$request.id; ok=$false; error=$_.Exception.Message } | ConvertTo-Json -Compress | ForEach-Object { [Console]::WriteLine($_) }
  }
}
