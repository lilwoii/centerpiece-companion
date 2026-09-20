$ErrorActionPreference='Stop'
[Console]::OutputEncoding=New-Object System.Text.UTF8Encoding($false)
$inputData=[Console]::ReadLine()|ConvertFrom-Json
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
using System.Threading;
public static class CompanionEditorHost {
 [StructLayout(LayoutKind.Sequential)] public struct Point {public int X,Y;}
 [StructLayout(LayoutKind.Sequential)] public struct Rect {public int Left,Top,Right,Bottom;}
 [StructLayout(LayoutKind.Sequential)] public struct Message {public IntPtr hwnd;public uint message;public UIntPtr wParam;public IntPtr lParam;public uint time;public Point pt;public uint extra;}
 [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr h,out uint pid);
 [DllImport("user32.dll")] static extern IntPtr GetWindowDpiAwarenessContext(IntPtr h);
 [DllImport("user32.dll",SetLastError=true)] static extern IntPtr SetThreadDpiAwarenessContext(IntPtr value);
 [DllImport("user32.dll")] static extern bool AreDpiAwarenessContextsEqual(IntPtr a,IntPtr b);
 [DllImport("user32.dll",CharSet=CharSet.Unicode,SetLastError=true)] static extern IntPtr CreateWindowEx(uint ex,string cls,string title,uint style,int x,int y,int width,int height,IntPtr parent,IntPtr menu,IntPtr instance,IntPtr data);
 [DllImport("user32.dll")] static extern bool DestroyWindow(IntPtr h);
 [DllImport("user32.dll")] static extern IntPtr GetParent(IntPtr h);
 [DllImport("user32.dll")] static extern IntPtr SetParent(IntPtr h,IntPtr parent);
 [DllImport("user32.dll",EntryPoint="GetWindowLongPtrW")] static extern IntPtr GetStyle(IntPtr h,int index);
 [DllImport("user32.dll",EntryPoint="SetWindowLongPtrW")] static extern IntPtr SetStyle(IntPtr h,int index,IntPtr value);
 [DllImport("user32.dll")] static extern bool GetWindowRect(IntPtr h,out Rect rect);
 [DllImport("user32.dll")] static extern bool SetWindowPos(IntPtr h,IntPtr after,int x,int y,int w,int height,uint flags);
 [DllImport("user32.dll")] static extern bool ShowWindow(IntPtr h,int command);
 [DllImport("user32.dll")] static extern int GetMessage(out Message message,IntPtr h,uint min,uint max);
 [DllImport("user32.dll")] static extern bool TranslateMessage(ref Message message);
 [DllImport("user32.dll")] static extern IntPtr DispatchMessage(ref Message message);
 [DllImport("user32.dll")] static extern bool PostThreadMessage(uint thread,uint message,UIntPtr w,IntPtr l);
 [DllImport("kernel32.dll")] static extern uint GetCurrentThreadId();
 public static void Run(long parent,uint parentPid,long source,uint sourcePid){
  uint owner;GetWindowThreadProcessId(new IntPtr(parent),out owner);if(owner!=parentPid)throw new Exception("Companion window ownership changed.");
  GetWindowThreadProcessId(new IntPtr(source),out owner);if(owner!=sourcePid)throw new Exception("Unreal window ownership changed.");
  IntPtr dpi=GetWindowDpiAwarenessContext(new IntPtr(source));
  IntPtr sourceWindow=new IntPtr(source),originalStyle=GetStyle(sourceWindow,-16);Rect originalRect;GetWindowRect(sourceWindow,out originalRect);
  if(SetThreadDpiAwarenessContext(dpi)==IntPtr.Zero)throw new Exception("Could not select the editor display mode.");
  IntPtr host=CreateWindowEx(0,"STATIC","Centerpiece Unreal editor host",0x56000000,0,0,100,100,new IntPtr(parent),IntPtr.Zero,IntPtr.Zero,IntPtr.Zero);
  if(host==IntPtr.Zero)throw new Exception("Could not create the editor host: "+Marshal.GetLastWin32Error());
  if(!AreDpiAwarenessContextsEqual(GetWindowDpiAwarenessContext(host),dpi)){DestroyWindow(host);throw new Exception("Editor host display modes did not match.");}
  uint thread=GetCurrentThreadId();
  var reader=new Thread(()=>{Console.ReadLine();PostThreadMessage(thread,0x12,UIntPtr.Zero,IntPtr.Zero);});reader.IsBackground=true;reader.Start();
  Console.WriteLine("{\"handle\":\""+host.ToInt64()+"\"}");Console.Out.Flush();
  try{Message message;while(GetMessage(out message,IntPtr.Zero,0,0)>0){TranslateMessage(ref message);DispatchMessage(ref message);}}
  finally{if(GetParent(sourceWindow)==host){SetParent(sourceWindow,IntPtr.Zero);SetStyle(sourceWindow,-16,originalStyle);SetWindowPos(sourceWindow,IntPtr.Zero,Math.Max(0,originalRect.Left),Math.Max(0,originalRect.Top),Math.Max(800,originalRect.Right-originalRect.Left),Math.Max(600,originalRect.Bottom-originalRect.Top),0x34);ShowWindow(sourceWindow,9);}DestroyWindow(host);}
 }
}
'@
[CompanionEditorHost]::Run([long]$inputData.parent,[uint32]$inputData.parentPid,[long]$inputData.source,[uint32]$inputData.sourcePid)
