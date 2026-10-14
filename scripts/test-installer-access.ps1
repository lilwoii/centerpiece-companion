[CmdletBinding()]
param(
    [string]$ProtectedInstallPath = 'D:\HDD fFILES\Centerpiece Companion',
    [switch]$ExerciseElevation
)

$ErrorActionPreference = 'Stop'
$projectRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$helperPath = Join-Path $projectRoot 'build\install-access.nsh'
$nsisCache = Join-Path $env:LOCALAPPDATA 'electron-builder\Cache\nsis'
$compiler = Join-Path $nsisCache 'nsis-3.0.4.1\makensis.exe'
$includePath = Join-Path $projectRoot 'node_modules\app-builder-lib\templates\nsis\include'
$pluginPath = Join-Path $nsisCache 'nsis-resources-3.4.1\plugins\x86-unicode'
foreach ($requiredPath in @($helperPath, $compiler, $includePath, $pluginPath)) {
    if (-not (Test-Path -LiteralPath $requiredPath)) { throw "Required NSIS input is unavailable: $requiredPath" }
}

$temporaryParent = [IO.Path]::GetFullPath([IO.Path]::GetTempPath())
$runRoot = Join-Path $temporaryParent ('centerpiece-installer-access-' + [Guid]::NewGuid().ToString('N'))
[void][IO.Directory]::CreateDirectory($runRoot)
$sourcePath = Join-Path $runRoot 'harness.nsi'
$exePath = Join-Path $runRoot 'harness.exe'
$scenarioPath = Join-Path $runRoot 'scenario.ini'
$resultPath = Join-Path $runRoot 'result.ini'
$expectedSid = [Security.Principal.WindowsIdentity]::GetCurrent().User.Value
$principal = [Security.Principal.WindowsPrincipal]::new([Security.Principal.WindowsIdentity]::GetCurrent())
$isAdministrator = $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
$passed = 0
$skipped = 0
$protectedFixture = $null
$originalFixtureAcl = $null

function ConvertTo-NsisLiteral([string]$Value) {
    return $Value.Replace('$', '$$').Replace('"', '$\"')
}

function Write-Scenario([string]$Mode, [string]$Directory) {
    # UTF-16 keeps paths with spaces and non-ASCII characters intact in NSIS.
    $scenario = "[Scenario]`r`nMode=$Mode`r`nDirectory=$Directory`r`nUpdateRoot=$runRoot\chosen updates`r`n"
    [IO.File]::WriteAllText($scenarioPath, $scenario, [Text.Encoding]::Unicode)
    if (Test-Path -LiteralPath $resultPath) { Remove-Item -LiteralPath $resultPath -Force }
}

function Invoke-Harness([string]$Mode, [string]$Directory, [int]$TimeoutSeconds = 30) {
    Write-Scenario $Mode $Directory
    $startInfo = [Diagnostics.ProcessStartInfo]::new()
    $startInfo.FileName = $exePath
    $startInfo.Arguments = '/S /currentuser --updated'
    $startInfo.WorkingDirectory = $runRoot
    $startInfo.UseShellExecute = $false
    $startInfo.CreateNoWindow = $true
    $process = [Diagnostics.Process]::Start($startInfo)
    try {
        if (-not $process.WaitForExit($TimeoutSeconds * 1000)) {
            throw "The harmless NSIS harness exceeded its $TimeoutSeconds second timeout (PID $($process.Id))."
        }
        $result = @{ ExitCode = $process.ExitCode }
        if (Test-Path -LiteralPath $resultPath) {
            foreach ($line in [IO.File]::ReadAllLines($resultPath)) {
                if ($line -match '^([^=\[]+?)=(.*)$') { $result[$matches[1]] = $matches[2] }
            }
        }
        return $result
    }
    finally { $process.Dispose() }
}

function Assert-Equal($Actual, $Expected, [string]$Description) {
    if ([string]$Actual -cne [string]$Expected) {
        throw "$Description (expected '$Expected', received '$Actual')."
    }
}

function Write-Passed([string]$Description) {
    $script:passed++
    Write-Output "PASS $Description"
}

function Write-Skipped([string]$Description) {
    $script:skipped++
    Write-Output "SKIP $Description"
}

function New-AppFixture([string]$Name) {
    $directory = Join-Path $runRoot $Name
    $resources = Join-Path $directory 'resources\app'
    [void][IO.Directory]::CreateDirectory($resources)
    [IO.File]::WriteAllText((Join-Path $resources 'package.json'), '{"name":"installer-access-fixture"}')
    return $directory
}

function Assert-NoProbeFiles([string]$Directory) {
    if (@(Get-ChildItem -LiteralPath $Directory -Filter 'ccu*.tmp' -Force).Count -ne 0) {
        throw 'The access helper left a temporary probe file behind.'
    }
}

try {
    # No installer/uninstaller sections, no product registry writes, and no app
    # process are present. Even the optional UAC test targets a disposable fixture.
    $source = @'
Unicode true
Name "Companion access regression harness"
OutFile "@OUTPUT@"
RequestExecutionLevel user
SilentInstall silent
!addincludedir "@INCLUDE@"
!addplugindir /x86-unicode "@PLUGINS@"
!include LogicLib.nsh
!include FileFunc.nsh
!define APP_EXECUTABLE_FILENAME "does-not-exist-installer-access-fixture.exe"
Var installMode
Var UpdateRoot
Var hasPerMachineInstallation
Var hasPerUserInstallation
Var HarnessMode
Var HarnessGracefulCount
Var HarnessInitialDirectory
Var HarnessInitialUpdateRoot
!macro customCheckAppRunning
  IntOp $HarnessGracefulCount $HarnessGracefulCount + 1
!macroend
!include "@HELPER@"

Function .onInit
  ReadINIStr $HarnessMode "$EXEDIR\scenario.ini" "Scenario" "Mode"
  ReadINIStr $INSTDIR "$EXEDIR\scenario.ini" "Scenario" "Directory"
  ReadINIStr $UpdateRoot "$EXEDIR\scenario.ini" "Scenario" "UpdateRoot"
  StrCpy $HarnessInitialDirectory $INSTDIR
  StrCpy $HarnessInitialUpdateRoot $UpdateRoot
  StrCpy $installMode "CurrentUser"
  SetShellVarContext current
  StrCpy $hasPerMachineInstallation 0
  StrCpy $hasPerUserInstallation 1
  StrCpy $HarnessGracefulCount 0
  ${If} $HarnessMode == "elevation"
    Call CompanionAcceptElevation
    Call CompanionRequireInstallAccess
  ${EndIf}
FunctionEnd

Section
  ${If} $HarnessMode == "protected-probe"
    ; Only run the helper on the real install after an entirely read-only
    ; handle check confirms that file creation is denied in that directory.
    System::Call 'kernel32::CreateFileW(w "$INSTDIR", i 2, i 7, p 0, i 3, i 0x02000000, p 0) p.r0 ?e'
    Pop $1
    ${If} $0 != -1
      System::Call 'kernel32::CloseHandle(p r0)'
      WriteINIStr "$EXEDIR\result.ini" "Result" "NotProtected" "1"
      Quit
    ${EndIf}
    ${If} $1 != 5
      WriteINIStr "$EXEDIR\result.ini" "Result" "GuardError" "$1"
      Quit
    ${EndIf}
  ${EndIf}

  Call CompanionReadAccountSid
  ${If} $CompanionAccountSid == "@SID@"
    WriteINIStr "$EXEDIR\result.ini" "Result" "SidMatches" "1"
  ${Else}
    WriteINIStr "$EXEDIR\result.ini" "Result" "SidMatches" "0"
  ${EndIf}
  ; Never serialize the SID or include it in the tool output.
  StrCpy $CompanionAccountSid ""
  ${If} $HarnessMode == "require"
    Call CompanionRequireInstallAccess
  ${Else}
    Call CompanionProbeInstallAccess
  ${EndIf}
  WriteINIStr "$EXEDIR\result.ini" "Result" "AccessError" "$CompanionAccessError"
  WriteINIStr "$EXEDIR\result.ini" "Result" "InstallMode" "$installMode"
  WriteINIStr "$EXEDIR\result.ini" "Result" "DirectoryPreserved" "0"
  ${If} $INSTDIR == $HarnessInitialDirectory
    WriteINIStr "$EXEDIR\result.ini" "Result" "DirectoryPreserved" "1"
  ${EndIf}
  ${If} $UpdateRoot == $HarnessInitialUpdateRoot
    WriteINIStr "$EXEDIR\result.ini" "Result" "UpdateRootPreserved" "1"
  ${EndIf}
  ${If} ${Silent}
    WriteINIStr "$EXEDIR\result.ini" "Result" "Silent" "1"
  ${EndIf}
  WriteINIStr "$EXEDIR\result.ini" "Result" "Raised" "$CompanionRaisedForAccess"
  WriteINIStr "$EXEDIR\result.ini" "Result" "GracefulCount" "$HarnessGracefulCount"
SectionEnd
'@
    foreach ($replacement in @{
        '@OUTPUT@' = $exePath; '@INCLUDE@' = $includePath; '@PLUGINS@' = $pluginPath
        '@HELPER@' = $helperPath; '@SID@' = $expectedSid
    }.GetEnumerator()) {
        $source = $source.Replace($replacement.Key, (ConvertTo-NsisLiteral $replacement.Value))
    }
    [IO.File]::WriteAllText($sourcePath, $source, [Text.UTF8Encoding]::new($true))
    $compileOutput = & $compiler /V2 $sourcePath 2>&1
    if ($LASTEXITCODE -ne 0) {
        # Avoid printing a generated source line containing the comparison SID.
        $safeOutput = ($compileOutput | Out-String).Replace($expectedSid, '[account identifier]')
        throw "NSIS harness compilation failed:`n$safeOutput"
    }

    $writable = New-AppFixture 'writable app'
    $packagePath = Join-Path $writable 'resources\app\package.json'
    $packageHash = (Get-FileHash -LiteralPath $packagePath -Algorithm SHA256).Hash
    $result = Invoke-Harness 'probe' $writable
    Assert-Equal $result.ExitCode 0 'Writable fixture exit code'
    Assert-Equal $result.AccessError 0 'Writable fixture access'
    Assert-Equal $result.SidMatches 1 'Current token SID comparison'
    Assert-Equal $result.DirectoryPreserved 1 'Probe must preserve the selected directory'
    Assert-Equal (Get-FileHash -LiteralPath $packagePath -Algorithm SHA256).Hash $packageHash 'Probe must preserve existing package contents'
    Assert-NoProbeFiles $writable
    Write-Passed 'writable installation, unchanged package, temporary-file cleanup, and token SID'

    $newDirectory = Join-Path $writable 'not-created\new companion'
    $result = Invoke-Harness 'probe' $newDirectory
    Assert-Equal $result.AccessError 0 'Missing destination with writable ancestor'
    Assert-Equal (Test-Path -LiteralPath (Join-Path $writable 'not-created')) $false 'Probe must not create the destination'
    Assert-NoProbeFiles $writable
    Write-Passed 'missing destination uses its existing parent without creating folders'

    $emptyDirectory = Join-Path $runRoot 'empty install'
    [void][IO.Directory]::CreateDirectory($emptyDirectory)
    $result = Invoke-Harness 'probe' $emptyDirectory
    Assert-Equal $result.AccessError 0 'Fresh directory without package.json'
    Assert-NoProbeFiles $emptyDirectory
    Write-Passed 'fresh installation without package.json'

    $readOnlyDirectory = New-AppFixture 'readonly package'
    $readOnlyPackage = Join-Path $readOnlyDirectory 'resources\app\package.json'
    [IO.File]::SetAttributes($readOnlyPackage, [IO.FileAttributes]::ReadOnly)
    $result = Invoke-Harness 'probe' $readOnlyDirectory
    Assert-Equal $result.AccessError 5 'Read-only package must report access denied'
    Assert-NoProbeFiles $readOnlyDirectory
    Write-Passed 'read-only existing package reports access denied without modification'

    $packageLock = [IO.File]::Open($packagePath, [IO.FileMode]::Open, [IO.FileAccess]::Read, [IO.FileShare]::Read)
    try {
        $result = Invoke-Harness 'probe' $writable
        Assert-Equal $result.AccessError 32 'Locked package must report a sharing violation'
        $result = Invoke-Harness 'require' $writable
        Assert-Equal $result.ExitCode 32 'A sharing violation must stop without elevation'
        Assert-NoProbeFiles $writable
        Write-Passed 'locked package reports a sharing violation and stops without requesting elevation'
    }
    finally { $packageLock.Dispose() }

    $driveLetters = [Environment]::GetLogicalDrives() | ForEach-Object { $_.Substring(0, 1) }
    $unusedLetter = @('Z','Y','X','W','V','U','T','S','R','Q') | Where-Object { $_ -notin $driveLetters } | Select-Object -First 1
    if ($unusedLetter) {
        $invalidDirectory = $unusedLetter + ':\installer-access-fixture\app'
        $result = Invoke-Harness 'probe' $invalidDirectory
        Assert-Equal $result.AccessError 3 'Unavailable drive must report path not found'
        $result = Invoke-Harness 'require' $invalidDirectory
        Assert-Equal $result.ExitCode 3 'Nonpermission failure must stop without elevation'
        Write-Passed 'unavailable drive reports a path error and stops without requesting elevation'
    }
    else { Write-Skipped 'no unused drive letter was available for invalid-drive coverage' }

    if (Test-Path -LiteralPath $ProtectedInstallPath -PathType Container) {
        $realPackage = Join-Path $ProtectedInstallPath 'resources\app\package.json'
        $realHashBefore = if (Test-Path -LiteralPath $realPackage) { (Get-FileHash -LiteralPath $realPackage -Algorithm SHA256).Hash } else { '' }
        $result = Invoke-Harness 'protected-probe' $ProtectedInstallPath
        if ($result.NotProtected -eq '1') {
            Write-Skipped 'actual install permits file creation; its contents were not probed or changed'
        }
        else {
            if ($result.ContainsKey('GuardError')) { throw "Read-only actual-install guard failed with Windows error $($result.GuardError)." }
            Assert-Equal $result.AccessError 5 'Protected actual installation access'
            $realHashAfter = if (Test-Path -LiteralPath $realPackage) { (Get-FileHash -LiteralPath $realPackage -Algorithm SHA256).Hash } else { '' }
            Assert-Equal $realHashAfter $realHashBefore 'Actual installed package must remain unchanged'
            Write-Passed 'protected actual installation reports access denied and remains unchanged'
        }
    }
    else { Write-Skipped 'actual installation path is unavailable' }

    if ($ExerciseElevation) {
        if ($isAdministrator) { Write-Skipped 'UAC handoff requires starting this harness without administrator privileges' }
        else {
            $protectedFixture = New-AppFixture 'protected UAC fixture'
            $originalFixtureAcl = Get-Acl -LiteralPath $protectedFixture
            $fixtureAcl = [Security.AccessControl.DirectorySecurity]::new()
            $fixtureAcl.SetAccessRuleProtection($true, $false)
            $inheritance = [Security.AccessControl.InheritanceFlags]'ContainerInherit, ObjectInherit'
            $propagation = [Security.AccessControl.PropagationFlags]::None
            $allow = [Security.AccessControl.AccessControlType]::Allow
            foreach ($entry in @(@('S-1-5-32-544', 'FullControl'), @('S-1-5-18', 'FullControl'), @($expectedSid, 'ReadAndExecute'))) {
                $identity = [Security.Principal.SecurityIdentifier]::new($entry[0])
                $rule = [Security.AccessControl.FileSystemAccessRule]::new($identity, [Security.AccessControl.FileSystemRights]$entry[1], $inheritance, $propagation, $allow)
                $fixtureAcl.AddAccessRule($rule)
            }
            Set-Acl -LiteralPath $protectedFixture -AclObject $fixtureAcl
            $result = Invoke-Harness 'elevation' $protectedFixture 180
            if ($result.ExitCode -eq 1223) { Write-Passed 'UAC cancellation preserves the fixture and returns cancellation' }
            else {
                Assert-Equal $result.ExitCode 0 'Elevated fixture exit code'
                Assert-Equal $result.AccessError 0 'Elevated fixture access'
                Assert-Equal $result.Raised 1 'Expected the helper UAC handoff'
                Assert-Equal $result.SidMatches 1 'Elevation must retain the initiating account'
                Assert-Equal $result.InstallMode 'CurrentUser' 'Elevation must retain per-user scope'
                Assert-Equal $result.DirectoryPreserved 1 'Elevation must retain the selected directory'
                Assert-Equal $result.UpdateRootPreserved 1 'Elevation must retain the update directory'
                Assert-Equal $result.Silent 1 'Elevated child must bypass interactive scope reset'
                Assert-Equal $result.GracefulCount 1 'Elevated child must call its graceful-close hook once'
                Write-Passed 'UAC preserves account, per-user scope, folders, silent mode, and graceful-close hook'
            }
        }
    }
    else { Write-Skipped 'interactive UAC approval/cancellation (enable with -ExerciseElevation)' }

    Write-Output "Installer access regression harness: $passed passed, $skipped skipped. No app was launched or installed."
}
finally {
    if ($protectedFixture -and $originalFixtureAcl -and (Test-Path -LiteralPath $protectedFixture)) {
        # Restore only the discretionary ACL. Reapplying a complete Get-Acl
        # object can request audit/owner privileges a medium token does not have.
        $restoreAcl = [Security.AccessControl.DirectorySecurity]::new()
        $accessSection = [Security.AccessControl.AccessControlSections]::Access
        $restoreAcl.SetSecurityDescriptorSddlForm($originalFixtureAcl.GetSecurityDescriptorSddlForm($accessSection), $accessSection)
        [IO.Directory]::SetAccessControl($protectedFixture, $restoreAcl)
    }
    # Verify the resolved deletion target is the unique temp directory created
    # by this run; never remove an app directory or a caller-supplied path.
    $cleanupPath = [IO.Path]::GetFullPath($runRoot)
    $expectedPrefix = $temporaryParent.TrimEnd('\') + '\centerpiece-installer-access-'
    if (-not $cleanupPath.StartsWith($expectedPrefix, [StringComparison]::OrdinalIgnoreCase) -or
        [IO.Path]::GetFileName($cleanupPath) -notmatch '^centerpiece-installer-access-[0-9a-f]{32}$') {
        throw 'Refusing to remove an unexpected harness directory.'
    }
    if (Test-Path -LiteralPath $cleanupPath) { Remove-Item -LiteralPath $cleanupPath -Recurse -Force }
}
