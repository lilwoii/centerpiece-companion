$ErrorActionPreference='Stop'
[Console]::OutputEncoding=New-Object System.Text.UTF8Encoding($false)
$r=[Console]::ReadLine()|ConvertFrom-Json
Add-Type -TypeDefinition @'
using System;using System.Runtime.InteropServices;using System.Text;
public static class UnrealDockWindow {
 public delegate bool EnumProc(IntPtr h,IntPtr p);
 [StructLayout(LayoutKind.Sequential)] public struct Rect {public int Left,Top,Right,Bottom;}
 [StructLayout(LayoutKind.Sequential)] public struct Point {public int X,Y;}
 [StructLayout(LayoutKind.Sequential)] public struct Placement {public uint Length,Flags,Show;public Point Min,Max;public Rect Normal;}
 [DllImport("user32.dll")] public static extern bool IsIconic(IntPtr h);
 [DllImport("user32.dll")] public static extern bool GetWindowPlacement(IntPtr h,ref Placement placement);
 [DllImport("user32.dll")] public static extern bool EnumWindows(EnumProc callback,IntPtr p);
 [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h,out uint pid);
 [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
 [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h,out Rect rect);
 [DllImport("user32.dll",CharSet=CharSet.Unicode)] public static extern int GetClassName(IntPtr h,StringBuilder text,int length);
 [DllImport("user32.dll")] public static extern IntPtr GetParent(IntPtr h);
 [DllImport("user32.dll",SetLastError=true)] public static extern IntPtr SetParent(IntPtr h,IntPtr parent);
 [DllImport("user32.dll",EntryPoint="GetWindowLongPtrW")] public static extern IntPtr GetStyle(IntPtr h,int index);
 [DllImport("user32.dll",EntryPoint="SetWindowLongPtrW")] public static extern IntPtr SetStyle(IntPtr h,int index,IntPtr value);
 [DllImport("user32.dll")] public static extern bool SetWindowPos(IntPtr h,IntPtr after,int x,int y,int w,int height,uint flags);
 [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h,int command);
 [DllImport("user32.dll")] public static extern uint GetDpiForWindow(IntPtr h);
 [DllImport("user32.dll")] public static extern IntPtr GetWindowDpiAwarenessContext(IntPtr h);
 [DllImport("user32.dll")] public static extern bool AreDpiAwarenessContextsEqual(IntPtr a,IntPtr b);
 public static bool Owned(IntPtr h,uint pid){uint owner;GetWindowThreadProcessId(h,out owner);return owner==pid;}
 public static IntPtr Find(uint pid){IntPtr best=IntPtr.Zero;long area=0;EnumWindows((h,p)=>{if(!Owned(h,pid)||!IsWindowVisible(h))return true;var name=new StringBuilder(256);GetClassName(h,name,256);Rect rect;GetWindowRect(h,out rect);if(IsIconic(h)){var placement=new Placement();placement.Length=(uint)Marshal.SizeOf(typeof(Placement));if(GetWindowPlacement(h,ref placement))rect=placement.Normal;}long size=(long)(rect.Right-rect.Left)*(rect.Bottom-rect.Top);if(name.ToString().StartsWith("UnrealWindow")&&rect.Right-rect.Left>=600&&rect.Bottom-rect.Top>=400&&size>area){best=h;area=size;}return true;},IntPtr.Zero);return best;}
}
'@
$pidValue=[uint32]$r.pid
if($r.action -eq 'probe'){
 $probe=if($r.handle -and [UnrealDockWindow]::Owned([IntPtr]([long]$r.handle),$pidValue)){[IntPtr]([long]$r.handle)}else{[UnrealDockWindow]::Find($pidValue)}
 @{handle=$probe.ToInt64().ToString();waiting=($probe -eq [IntPtr]::Zero)}|ConvertTo-Json -Compress
 exit
}
if($r.action -eq 'attach'){
 $handle=if($r.sourceHandle -and [UnrealDockWindow]::Owned([IntPtr]([long]$r.sourceHandle),$pidValue)){[IntPtr]([long]$r.sourceHandle)}else{[UnrealDockWindow]::Find($pidValue)}
 if($handle -eq [IntPtr]::Zero){@{waiting=$true}|ConvertTo-Json -Compress;exit}
 $parent=[IntPtr]([long]$r.parent)
 if(![UnrealDockWindow]::Owned($parent,[uint32]$r.parentPid)){throw 'The Companion window changed. Reopen the editor panel.'}
 if(![UnrealDockWindow]::AreDpiAwarenessContextsEqual([UnrealDockWindow]::GetWindowDpiAwarenessContext($handle),[UnrealDockWindow]::GetWindowDpiAwarenessContext($parent))){throw 'STUDIO_EDITOR_DPI_MISMATCH: Unreal and Companion use different Windows display modes. The editor window was left unchanged.'}
 if([UnrealDockWindow]::IsIconic($handle)){[void][UnrealDockWindow]::ShowWindow($handle,9)}
 $style=[UnrealDockWindow]::GetStyle($handle,-16).ToInt64()
 $rect=New-Object UnrealDockWindow+Rect;[void][UnrealDockWindow]::GetWindowRect($handle,[ref]$rect)
 $childStyle=($style -band (-bnot 0x80c40000L)) -bor 0x40000000L
 [void][UnrealDockWindow]::SetStyle($handle,-16,[IntPtr]$childStyle)
 [void][UnrealDockWindow]::SetParent($handle,$parent)
 $parentError=[Runtime.InteropServices.Marshal]::GetLastWin32Error()
 if([UnrealDockWindow]::GetParent($handle) -ne $parent){[void][UnrealDockWindow]::SetStyle($handle,-16,[IntPtr]$style);throw "Windows could not embed this editor window (Windows error $parentError). Open saved project to use Unreal in its own window."}
 $result=@{handle=$handle.ToInt64().ToString();style=$style.ToString();left=$rect.Left;top=$rect.Top;width=$rect.Right-$rect.Left;height=$rect.Bottom-$rect.Top;waiting=$false}
}else{
 $handle=[IntPtr]([long]$r.handle)
 if(![UnrealDockWindow]::Owned($handle,$pidValue)){if($r.action -in @('detach','reveal')){@{ok=$true;closed=$true}|ConvertTo-Json -Compress;exit};throw 'The Unreal editor window has closed.'}
 $result=@{ok=$true}
}
if($r.action -eq 'reveal'){[void][UnrealDockWindow]::ShowWindow($handle,9)
}elseif($r.action -eq 'detach'){
 [void][UnrealDockWindow]::SetParent($handle,[IntPtr]::Zero)
 [void][UnrealDockWindow]::SetStyle($handle,-16,[IntPtr]([long]$r.style))
 [void][UnrealDockWindow]::SetWindowPos($handle,[IntPtr]::Zero,$r.left,$r.top,$r.width,$r.height,0x34)
 [void][UnrealDockWindow]::ShowWindow($handle,$(if($r.hide){0}else{9}))
}else{
 if($r.hostHandle){
  $hostWindow=[IntPtr]([long]$r.hostHandle);$container=[IntPtr]([long]$r.container)
  if(![UnrealDockWindow]::Owned($hostWindow,[uint32]$r.hostPid) -or ![UnrealDockWindow]::Owned($container,[uint32]$r.containerPid)){throw 'Editor host ownership changed.'}
  $scale=[UnrealDockWindow]::GetDpiForWindow($container)/96.0
  [void][UnrealDockWindow]::SetWindowPos($hostWindow,[IntPtr]::Zero,[int]($r.x*$scale),[int]($r.y*$scale),[int]($r.width*$scale),[int]($r.height*$scale),0x34)
  [void][UnrealDockWindow]::SetWindowPos($handle,[IntPtr]::Zero,0,0,[int]($r.width*$scale),[int]($r.height*$scale),0x34)
 }else{
  $parent=[UnrealDockWindow]::GetParent($handle);$scale=[UnrealDockWindow]::GetDpiForWindow($parent)/96.0
  [void][UnrealDockWindow]::SetWindowPos($handle,[IntPtr]::Zero,[int]($r.x*$scale),[int]($r.y*$scale),[int]($r.width*$scale),[int]($r.height*$scale),0x34)
 }
 [void][UnrealDockWindow]::ShowWindow($handle,5)
}
$result|ConvertTo-Json -Compress
