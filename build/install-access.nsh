; Run before the old uninstaller. A per-user installation can still live in an
; administrator-owned folder; electron-builder only elevates all-users installs.
!include UAC.nsh
!include FileFunc.nsh

Var CompanionAccessError
Var CompanionAccountSid
Var CompanionElevationRequested
Var CompanionOriginalSid
Var CompanionOriginalDirectory
Var CompanionOriginalMode
Var CompanionOriginalUpdateRoot
Var CompanionRaisedForAccess

Function CompanionReadAccountSid
  StrCpy $CompanionAccountSid ""
  System::Call 'kernel32::GetCurrentProcess() p.r0'
  System::Call 'advapi32::OpenProcessToken(p r0, i 8, *p .r1) i.r2'
  ${If} $2 != 0
    System::Call 'advapi32::GetTokenInformation(p r1, i 1, p 0, i 0, *i .r2)'
    System::Alloc $2
    Pop $3
    ${If} $3 != 0
      System::Call 'advapi32::GetTokenInformation(p r1, i 1, p r3, i r2, *i .r2) i.r0'
      ${If} $0 != 0
        System::Call '*$3(p .r4)'
        System::Call 'advapi32::ConvertSidToStringSidW(p r4, *p .r5) i.r0'
        ${If} $0 != 0
          System::Call 'kernel32::lstrcpynW(w .r6, p r5, i ${NSIS_MAX_STRLEN})'
          StrCpy $CompanionAccountSid $6
          System::Call 'kernel32::LocalFree(p r5)'
        ${EndIf}
      ${EndIf}
      System::Free $3
    ${EndIf}
    System::Call 'kernel32::CloseHandle(p r1)'
  ${EndIf}
FunctionEnd

Function CompanionProbeInstallAccess
  StrCpy $CompanionAccessError 0
  ; Probe the closest existing parent for a new installation, without creating
  ; or changing the destination before permission has been checked.
  StrCpy $R2 $INSTDIR
  ${Do}
    IfFileExists "$R2\*.*" companion_probe_directory
    ${GetParent} "$R2" $R3
    ${If} $R3 == ""
    ${OrIf} $R3 == $R2
      StrCpy $CompanionAccessError 3
      Return
    ${EndIf}
    StrCpy $R2 $R3
  ${Loop}
  companion_probe_directory:
  System::Call 'kernel32::GetTempFileNameW(w R2, w "ccu", i 0, w .r0) i.r1 ?e'
  Pop $CompanionAccessError
  ${If} $1 == 0
    Return
  ${EndIf}
  System::Call 'kernel32::DeleteFileW(w r0) i.r1 ?e'
  Pop $CompanionAccessError
  ${If} $1 == 0
    Return
  ${EndIf}
  StrCpy $CompanionAccessError 0
  ; A writable parent alone does not establish access to an older protected app.
  ; OPEN_EXISTING checks write/delete rights without altering file contents.
  IfFileExists "$INSTDIR\resources\app\package.json" 0 companion_probe_done
  System::Call 'kernel32::CreateFileW(w "$INSTDIR\resources\app\package.json", i 0x40010000, i 7, p 0, i 3, i 0x80, p 0) p.r0 ?e'
  Pop $CompanionAccessError
  ${If} $0 == -1
    Return
  ${Else}
    System::Call 'kernel32::CloseHandle(p r0)'
    StrCpy $CompanionAccessError 0
  ${EndIf}
  companion_probe_done:
FunctionEnd

Function CompanionRequireInstallAccess
  Call CompanionProbeInstallAccess
  ${If} $CompanionAccessError == 0
    Return
  ${EndIf}
  ${If} $CompanionAccessError == 5
  ${AndIfNot} ${UAC_IsAdmin}
    Call CompanionReadAccountSid
    ${If} $CompanionAccountSid == ""
      MessageBox MB_OK|MB_ICONSTOP "Setup could not verify your Windows account. Your existing app and settings have not been changed." /SD IDOK
      SetErrorLevel 5
      Quit
    ${EndIf}
    StrCpy $CompanionElevationRequested 1
    StrCpy $CompanionOriginalSid $CompanionAccountSid
    StrCpy $CompanionOriginalDirectory $INSTDIR
    StrCpy $CompanionOriginalMode $installMode
    StrCpy $CompanionOriginalUpdateRoot $UpdateRoot
    ; The child receives the original command line. Its customInit retrieves
    ; these globals directly through UAC, not from a user-editable handoff file.
    !insertmacro UAC_RunElevated
    ${If} $0 == 0
    ${AndIf} $1 == 1
      SetErrorLevel $2
      ${If} $2 == 0
      ${AndIfNot} ${Silent}
        ; Manual installs use a silent elevated child, then open as this user.
        Exec '"$CompanionOriginalDirectory\${APP_EXECUTABLE_FILENAME}" --updated'
      ${EndIf}
      Quit
    ${EndIf}
    ${If} $0 == 1223
      MessageBox MB_OK|MB_ICONINFORMATION "Update cancelled. Windows permission is needed to update this protected app folder. Your existing app and settings are unchanged; run the update again when ready." /SD IDOK
      SetErrorLevel 1223
      Quit
    ${EndIf}
    MessageBox MB_OK|MB_ICONSTOP "Windows did not grant permission to update the app folder. Your existing app and settings have not been changed." /SD IDOK
    SetErrorLevel 5
    Quit
  ${EndIf}
  MessageBox MB_OK|MB_ICONSTOP "Setup cannot write to the app folder (Windows error $CompanionAccessError). Check the folder's permissions and available disk space, then retry. Your existing app and settings have not been changed." /SD IDOK
  SetErrorLevel $CompanionAccessError
  Quit
FunctionEnd

Function CompanionAcceptElevation
  ${IfNot} ${UAC_IsInnerInstance}
    Return
  ${EndIf}
  !insertmacro UAC_AsUser_GetGlobal $CompanionElevationRequested $CompanionElevationRequested
  ${If} $CompanionElevationRequested != 1
    Return
  ${EndIf}
  !insertmacro UAC_AsUser_GetGlobal $CompanionOriginalSid $CompanionOriginalSid
  !insertmacro UAC_AsUser_GetGlobal $CompanionOriginalDirectory $CompanionOriginalDirectory
  !insertmacro UAC_AsUser_GetGlobal $CompanionOriginalMode $CompanionOriginalMode
  !insertmacro UAC_AsUser_GetGlobal $CompanionOriginalUpdateRoot $CompanionOriginalUpdateRoot
  Call CompanionReadAccountSid
  ${If} $CompanionAccountSid == ""
  ${OrIf} $CompanionAccountSid != $CompanionOriginalSid
    MessageBox MB_OK|MB_ICONSTOP "Approve the update using the same Windows account that uses Companion. Setup stopped to protect that account's settings and installation." /SD IDOK
    SetErrorLevel 5
    Quit
  ${EndIf}
  StrCpy $INSTDIR $CompanionOriginalDirectory
  StrCpy $installMode $CompanionOriginalMode
  StrCpy $UpdateRoot $CompanionOriginalUpdateRoot
  ${If} $installMode == "CurrentUser"
    SetShellVarContext current
    StrCpy $hasPerMachineInstallation 0
    StrCpy $hasPerUserInstallation 1
  ${Else}
    SetShellVarContext all
  ${EndIf}
  StrCpy $CompanionRaisedForAccess 1
  ; The stock interactive install-mode page forces elevated children to all-
  ; users. Skip it after restoring the initiating user's chosen scope/path.
  SetSilent silent
  Call CompanionRequireInstallAccess
  ; electron-builder skips its normal running-app check for UAC children.
  ; Always wait for Companion's normal USB cleanup, never force termination.
  !insertmacro customCheckAppRunning
FunctionEnd
