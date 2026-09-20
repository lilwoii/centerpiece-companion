$ErrorActionPreference='Stop'
[Console]::OutputEncoding=New-Object System.Text.UTF8Encoding($false)
$request=[Console]::ReadLine()|ConvertFrom-Json
$root='HKLM:\SYSTEM\CurrentControlSet\Control\Keyboard Layouts'
if($request.action -eq 'list'){
 $items=@(Get-ChildItem $root | ForEach-Object {$p=Get-ItemProperty $_.PSPath;if($_.PSChildName -match '^[0-9a-fA-F]{8}$'){@{id=$_.PSChildName;name=$p.'Layout Text';ime=!!$p.'Ime File'}}})
 ConvertTo-Json -InputObject $items -Compress
 exit
}
if($request.action -eq 'current'){
 Add-Type -TypeDefinition @"
using System;using System.Runtime.InteropServices;
public static class ActiveKeyboardLayout {
 [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
 [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hwnd,IntPtr id);
 [DllImport("user32.dll")] public static extern IntPtr GetKeyboardLayout(uint thread);
}
"@
 $thread=[ActiveKeyboardLayout]::GetWindowThreadProcessId([ActiveKeyboardLayout]::GetForegroundWindow(),[IntPtr]::Zero)
 $value=[ActiveKeyboardLayout]::GetKeyboardLayout($thread).ToInt64()
 $id=('{0:x8}' -f ($value -band 0xffffffffL))
 if(!(Test-Path -LiteralPath ($root+'\'+$id)) -and (($value -shr 16) -band 0xf000L) -eq 0xf000L){
  $variant=(($value -shr 16) -band 0x0fffL);$suffix=('{0:x4}' -f ($value -band 0xffffL))
  $match=Get-ChildItem $root|Where-Object {$_.PSChildName -like ('*'+$suffix)}|Where-Object {$props=Get-ItemProperty $_.PSPath;$props.'Layout Id' -and [Convert]::ToInt32($props.'Layout Id',16) -eq $variant}|Select-Object -First 1
  if($match){$id=$match.PSChildName}
 }
 if(!(Test-Path -LiteralPath ($root+'\'+$id))){$id=('{0:x8}' -f ($value -band 0xffffL))}
 if(!(Test-Path -LiteralPath ($root+'\'+$id))){$id='00000409'}
 if(($value -band 0xffffL) -eq 0x0412){$id='korean-2'}
 @{id=$id}|ConvertTo-Json -Compress
 exit
}
if($request.action -ne 'map' -or $request.id -notmatch '^[0-9a-fA-F]{8}$' -or !(Test-Path -LiteralPath ($root+'\'+$request.id))){throw 'Choose a Windows keyboard layout.'}
Add-Type -TypeDefinition @'
using System; using System.Text; using System.Runtime.InteropServices;
public static class KeyboardLanguage {
 [DllImport("user32.dll",CharSet=CharSet.Unicode)] public static extern IntPtr LoadKeyboardLayout(string name,uint flags);
 [DllImport("user32.dll")] public static extern bool UnloadKeyboardLayout(IntPtr hkl);
 [DllImport("user32.dll")] public static extern uint MapVirtualKeyEx(uint code,uint type,IntPtr layout);
 [DllImport("user32.dll",CharSet=CharSet.Unicode)] public static extern int ToUnicodeEx(uint key,uint scan,byte[] state,StringBuilder output,int size,uint flags,IntPtr layout);
 public static string Label(IntPtr layout,uint scan,bool shift){var state=new byte[256];if(shift)state[16]=128;var text=new StringBuilder(16);uint vk=MapVirtualKeyEx(scan,1,layout);int n=ToUnicodeEx(vk,scan,state,text,16,4,layout);return n==0?"":text.ToString();}
}
'@
# Only inspect a layout in this short-lived helper. No activation or Windows language-list writes.
$layout=[KeyboardLanguage]::LoadKeyboardLayout($request.id,128)
if($layout -eq [IntPtr]::Zero){throw 'This Windows layout cannot be loaded. Install its language support in Windows Settings.'}
try{
 $scans=@(1,2,3,4,5,6,7,8,9,10,11,12,13,14,0,0,15,16,17,18,19,20,21,22,23,24,25,26,27,43,0,0,58,30,31,32,33,34,35,36,37,38,39,40,28,42,44,45,46,47,48,49,50,51,52,53,54,0,29,0,56,57,0,0,0,0,0,0)
 $labels=@($scans|ForEach-Object {if($_ -gt 0){[KeyboardLanguage]::Label($layout,$_, $false)}else{''}})
 $shift=@($scans|ForEach-Object {if($_ -gt 0){[KeyboardLanguage]::Label($layout,$_, $true)}else{''}})
 @{id=$request.id;name=(Get-ItemProperty -LiteralPath ($root+'\'+$request.id)).'Layout Text';labels=$labels;shift=$shift}|ConvertTo-Json -Depth 4 -Compress
}finally{[void][KeyboardLanguage]::UnloadKeyboardLayout($layout)}
