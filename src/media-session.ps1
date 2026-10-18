function Test-CompanionMediaPlaying($session) {
  try { return $session.GetPlaybackInfo().PlaybackStatus.ToString() -eq 'Playing' } catch { return $false }
}
function Test-CompanionMediaClosed($session) {
  # Windows can retain a closed session during a player restart or track change.
  # This synchronous status read does not request unrelated media metadata.
  try { return $session.GetPlaybackInfo().PlaybackStatus.ToString() -eq 'Closed' } catch { return $false }
}
function Get-CompanionMediaArtwork([hashtable]$cache, [string]$key, [string]$provider, [scriptblock]$readThumbnail, [datetime]$now=[datetime]::UtcNow) {
  $changed=!$cache.ContainsKey('key') -or $cache.key -ne $key
  if($changed){$cache.key=$key;$cache.art='';$cache.changed=$now;$cache.checked=[datetime]::MinValue;$cache.checkpoint=-1}
  $age=($now-$cache.changed).TotalMilliseconds
  $checkpoint=if($age -ge 1500){3}elseif($age -ge 750){2}elseif($age -ge 250){1}else{0}
  $retrySeconds=if($provider -eq 'youtubemusic'){0.5}else{2}
  # Windows may expose the next title before replacing the previous thumbnail.
  # Reconcile only a few transition samples, then leave successful covers cached.
  $reconcile=$provider -eq 'youtubemusic' -and $checkpoint -gt $cache.checkpoint
  if($changed -or $reconcile -or (!$cache.art -and ($now-$cache.checked).TotalSeconds -ge $retrySeconds)){
    $cache.checked=$now;$cache.checkpoint=$checkpoint
    try{$candidate=& $readThumbnail;if($candidate -is [string] -and $candidate){$cache.art=$candidate}}catch{}
  }
  return [string]$cache.art
}
function Get-CompanionMediaRewindTicks($timeline, $playback, [DateTimeOffset]$now=[DateTimeOffset]::UtcNow) {
  # Some media apps retain the track-start position and only advance the clock.
  # Seek relative to the effective playback position, not that stale raw value.
  $position=[Math]::Max([double]0,[double]$timeline.Position.Ticks)
  $duration=[Math]::Max([double]0,[double]$timeline.EndTime.Ticks)
  if($playback.PlaybackStatus.ToString() -eq 'Playing') {
    $rate=1.0
    if($null -ne $playback.PlaybackRate){
      $reportedRate=[double]$playback.PlaybackRate
      if(![double]::IsNaN($reportedRate) -and ![double]::IsInfinity($reportedRate) -and $reportedRate -ge 0 -and $reportedRate -le 16){$rate=$reportedRate}
    }
    $sourceTime=$timeline.LastUpdatedTime.ToUnixTimeMilliseconds()
    if($sourceTime -gt 0){
      $age=[Math]::Max([double]0,[double](($now.ToUnixTimeMilliseconds()-$sourceTime)/1000.0))
      $position+=$age*$rate*[TimeSpan]::TicksPerSecond
    }
  }
  $position=[Math]::Min([double]$duration,[Math]::Max([double]0,[double]$position))
  return [int64][Math]::Max([double]0,[double]($position-[TimeSpan]::FromSeconds(10).Ticks))
}
function Get-CompanionMediaSources($sessions, $target='auto', $installedMusicIds=@()) {
  # Source discovery must not wait on unrelated apps' media metadata. A stalled
  # browser session must not prevent a healthy desktop session from updating.
  # Only offer sources that the chosen player can actually route controls to.
  # Auto retains the legacy all-source discovery contract for existing callers.
  if($target -cnotin @('auto','desktop','web')){throw 'Unknown YouTube Music player target'}
  foreach($session in $sessions) {
    $id=$session.SourceAppUserModelId
    if($id -match '(?i)spotify'){continue}
    if($target -eq 'desktop' -and !(Test-CompanionDesktopMusicId $id)){continue}
    if($target -eq 'web' -and !((Test-CompanionWebMusicId $id $installedMusicIds) -or (Test-CompanionBrowserMediaId $id))){continue}
    if(Test-CompanionMediaClosed $session){continue}
    @{id=$id;title=''}
  }
}
function Test-CompanionBrowserMediaId($id) {
  return $id -match '(?i)^(chrome|msedge|firefox|brave|opera)\.exe$'
}
function Test-CompanionDesktopMusicId($id) {
  # Match executable identities, including Squirrel's com.squirrel.<app> prefix.
  # A named Chrome/Edge web-app registration is not a native desktop player.
  return $id -match '(?i)(^|[.\\])(?:youtube[ ._-]*music(?:[ ._-]*desktop(?:[ ._-]*app)?)?|ytmdesktop(?:app)?)\.exe$'
}
function Test-CompanionWebMusicId($id, $installedMusicIds=@()) {
  if((Test-CompanionDesktopMusicId $id) -or (Test-CompanionBrowserMediaId $id) -or $id -match '(?i)spotify'){return $false}
  return $installedMusicIds -ccontains $id -or $id -match '(?i)youtube[ ._-]*music|ytmdesktop'
}
function Select-CompanionMediaCandidate($candidates) {
  $candidates=@($candidates)
  $playing=@($candidates | Where-Object { Test-CompanionMediaPlaying $_ })
  if($playing.Count -eq 1){return [pscustomobject]@{session=$playing[0];reason=''}}
  if($playing.Count -eq 0 -and $candidates.Count -eq 1){return [pscustomobject]@{session=$candidates[0];reason=''}}
  $reason=if($candidates.Count -eq 0){'no-session'}else{'ambiguous'}
  return [pscustomobject]@{session=$null;reason=$reason}
}
function Get-CompanionMediaSelection($sessions, $provider, $source, $installedMusicIds=@(), $target='auto') {
  if($provider -eq 'spotify') {
    # A restarted Spotify can coexist with its stale/closed Windows session.
    # Prefer a uniquely playing session; never let the first closed entry win.
    $live=@($sessions | Where-Object {
      if($_.SourceAppUserModelId -notmatch '(?i)spotify'){return $false}
      try { return $_.GetPlaybackInfo().PlaybackStatus.ToString() -ne 'Closed' } catch { return $false }
    })
    return Select-CompanionMediaCandidate $live
  }
  # Discard only Closed: paused/stopped tracks remain readable and controllable.
  # Filter before grouping so a stale duplicate ID cannot create ambiguity or
  # let a closed native session take priority over a live installed web app.
  $sessions=@($sessions | Where-Object { !(Test-CompanionMediaClosed $_) })
  if($provider -eq 'youtube'){
    return Select-CompanionMediaCandidate @($sessions | Where-Object { Test-CompanionBrowserMediaId $_.SourceAppUserModelId })
  }
  if($provider -ne 'youtubemusic'){throw 'Unknown music provider'}
  if(!$target){$target='auto'}
  if($target -cnotin @('auto','desktop','web')){throw 'Unknown YouTube Music player target'}
  $native=@($sessions | Where-Object { Test-CompanionDesktopMusicId $_.SourceAppUserModelId })
  $webApps=@($sessions | Where-Object { Test-CompanionWebMusicId $_.SourceAppUserModelId $installedMusicIds })
  $browsers=@($sessions | Where-Object { Test-CompanionBrowserMediaId $_.SourceAppUserModelId })
  if($source) {
    $allowed=if($target -eq 'desktop'){$native}elseif($target -eq 'web'){@($webApps)+@($browsers)}else{@($sessions | Where-Object { $_.SourceAppUserModelId -notmatch '(?i)spotify' })}
    $candidates=@($allowed | Where-Object { $_.SourceAppUserModelId -ceq $source })
    # Even a playing session cannot disambiguate multiple tabs sharing an
    # explicitly chosen browser ID. Never dispatch to a guessed tab.
    if($candidates.Count -eq 1){return [pscustomobject]@{session=$candidates[0];reason=''}}
    return [pscustomobject]@{session=$null;reason=$(if($candidates.Count -gt 1){'ambiguous'}else{'source-unavailable'})}
  }
  if($target -eq 'desktop'){return Select-CompanionMediaCandidate $native}
  # Keep Auto on an open desktop session, including paused playback, even when
  # the installed web app or an unrelated browser video is playing.
  if($target -eq 'auto' -and $native.Count -gt 0){return Select-CompanionMediaCandidate $native}
  if($webApps.Count -gt 0){return Select-CompanionMediaCandidate $webApps}
  # Generic browser sessions expose no website identity. Only the user's Web
  # choice opts into that browser routing; Auto never guesses a music tab.
  if($target -eq 'web'){return Select-CompanionMediaCandidate $browsers}
  return [pscustomobject]@{session=$null;reason='no-session'}
}
function Find-CompanionMediaSession($sessions, $provider, $source, $installedMusicIds=@(), $target='auto') {
  return (Get-CompanionMediaSelection $sessions $provider $source $installedMusicIds $target).session
}
