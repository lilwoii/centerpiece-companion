; Used by both installation and uninstallation. Never kill a USB transfer.
!macro customCheckAppRunning
  ${nsProcess::FindProcess} "${APP_EXECUTABLE_FILENAME}" $R0
  ${If} $R0 == 0
    IfFileExists "$INSTDIR\${APP_EXECUTABLE_FILENAME}" 0 companion_wait
    Exec '"$INSTDIR\${APP_EXECUTABLE_FILENAME}" --quit'
    companion_wait:
    StrCpy $R1 0
    ${Do}
      Sleep 500
      ${nsProcess::FindProcess} "${APP_EXECUTABLE_FILENAME}" $R0
      ${If} $R0 == 603
        ${ExitDo}
      ${EndIf}
      IntOp $R1 $R1 + 1
      ${If} $R1 >= 120
        MessageBox MB_OK|MB_ICONEXCLAMATION "The companion has not finished releasing the keyboard. Setup will stop without forcing it closed. Quit the companion from its tray menu, then retry." /SD IDOK
        Abort
      ${EndIf}
    ${Loop}
  ${ElseIf} $R0 != 603
    MessageBox MB_OK|MB_ICONEXCLAMATION "Setup could not check whether the companion is running. Close it from its tray menu and retry." /SD IDOK
    Abort
  ${EndIf}
!macroend

!ifndef BUILD_UNINSTALLER
!include nsDialogs.nsh
!include FileFunc.nsh

Var LocationDialog
Var InstallLocationField
Var UpdateLocationField
Var UpdateRoot

!macro customPageAfterChangeDir
  Page custom CompanionLocations CompanionLocationsLeave

Function CompanionLocations
  !insertmacro MUI_HEADER_TEXT "Choose app and update locations" "Choose folders on the drives you want to use."
  ${If} $UpdateRoot == ""
    ReadINIStr $UpdateRoot "$INSTDIR\install-locations.ini" "Storage" "UpdateRoot"
    ${If} $UpdateRoot == ""
      StrCpy $UpdateRoot "$INSTDIR-updates"
    ${EndIf}
  ${EndIf}
  nsDialogs::Create 1018
  Pop $LocationDialog
  ${If} $LocationDialog == error
    Abort
  ${EndIf}
  ${NSD_CreateLabel} 0 0 100% 22u "Install the companion here (for example, D:\Apps\Centerpiece Companion):"
  Pop $0
  ${NSD_CreateDirRequest} 0 24u 78% 13u "$INSTDIR"
  Pop $InstallLocationField
  ${NSD_CreateBrowseButton} 80% 24u 20% 14u "Browse..."
  Pop $0
  ${NSD_OnClick} $0 BrowseCompanionInstall
  ${NSD_CreateLabel} 0 52u 100% 22u "Download future updates here (a separate drive is allowed):"
  Pop $0
  ${NSD_CreateDirRequest} 0 76u 78% 13u "$UpdateRoot"
  Pop $UpdateLocationField
  ${NSD_CreateBrowseButton} 80% 76u 20% 14u "Browse..."
  Pop $0
  ${NSD_OnClick} $0 BrowseCompanionUpdates
  ${NSD_CreateLabel} 0 103u 100% 48u "Updates use a dedicated subfolder at this location. Your personal settings and encrypted connections stay in your Windows account. Windows still needs some free space on its system drive."
  Pop $0
  nsDialogs::Show
FunctionEnd

Function BrowseCompanionInstall
  Pop $0
  ${NSD_GetText} $InstallLocationField $1
  nsDialogs::SelectFolderDialog "Choose app folder" "$1"
  Pop $1
  ${If} $1 != error
    ${NSD_SetText} $InstallLocationField "$1"
  ${EndIf}
FunctionEnd

Function BrowseCompanionUpdates
  Pop $0
  ${NSD_GetText} $UpdateLocationField $1
  nsDialogs::SelectFolderDialog "Choose update download folder" "$1"
  Pop $1
  ${If} $1 != error
    ${NSD_SetText} $UpdateLocationField "$1"
  ${EndIf}
FunctionEnd

Function CompanionLocationsLeave
  ${NSD_GetText} $InstallLocationField $INSTDIR
  ${NSD_GetText} $UpdateLocationField $UpdateRoot
  StrCpy $0 $INSTDIR 2 1
  StrCpy $1 $UpdateRoot 2 1
  ${If} $0 != ":\"
  ${OrIf} $1 != ":\"
    MessageBox MB_OK|MB_ICONEXCLAMATION "Choose local drive folders, such as D:\Apps\Centerpiece Companion and D:\Updates."
    Abort
  ${EndIf}
  ${GetFileName} "$INSTDIR" $2
  ${If} $2 != "${APP_FILENAME}"
    StrCpy $INSTDIR "$INSTDIR\${APP_FILENAME}"
  ${EndIf}
  ClearErrors
  CreateDirectory "$UpdateRoot\.centerpiece-companion-updates"
  FileOpen $0 "$UpdateRoot\.centerpiece-companion-updates\write-check.tmp" w
  ${If} ${Errors}
    MessageBox MB_OK|MB_ICONEXCLAMATION "The update folder is not writable. Choose another folder."
    Abort
  ${EndIf}
  FileClose $0
  Delete "$UpdateRoot\.centerpiece-companion-updates\write-check.tmp"
FunctionEnd

!macroend

!macro customInstall
  ${If} $UpdateRoot == ""
    ReadINIStr $UpdateRoot "$INSTDIR\install-locations.ini" "Storage" "UpdateRoot"
  ${EndIf}
  ${If} $UpdateRoot == ""
    StrCpy $UpdateRoot "$INSTDIR-updates"
  ${EndIf}
  FileOpen $0 "$INSTDIR\install-locations.ini" w
  FileWriteWord $0 0xFEFF
  FileClose $0
  WriteINIStr "$INSTDIR\install-locations.ini" "Storage" "UpdateRoot" "$UpdateRoot"
!macroend

!endif
