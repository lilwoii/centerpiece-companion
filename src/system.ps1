$ErrorActionPreference='Stop'
Add-Type -TypeDefinition @'
using System; using System.Runtime.InteropServices; using System.Threading;
public class CompanionInput {
 [DllImport("shell32.dll",CharSet=CharSet.Unicode)] static extern int SHGetKnownFolderPath(ref Guid folder,uint flags,IntPtr token,out IntPtr path);
 [DllImport("shell32.dll",CharSet=CharSet.Unicode)] static extern int SHSetKnownFolderPath(ref Guid folder,uint flags,IntPtr token,string path);
 public static string ScreenshotFolder(string destination){var id=new Guid("B7BEDE81-DF94-4682-A7D8-57A52620B86F");if(!String.IsNullOrEmpty(destination)){if(!System.IO.Directory.Exists(destination))throw new Exception("Choose an existing folder.");Marshal.ThrowExceptionForHR(SHSetKnownFolderPath(ref id,0,IntPtr.Zero,destination));}IntPtr result;Marshal.ThrowExceptionForHR(SHGetKnownFolderPath(ref id,0x4000,IntPtr.Zero,out result));try{return Marshal.PtrToStringUni(result);}finally{Marshal.FreeCoTaskMem(result);}}
 [DllImport("user32.dll")] public static extern void keybd_event(byte key, byte scan, uint flags, UIntPtr extra);
 [DllImport("user32.dll")] public static extern short GetKeyState(int key);
 [DllImport("user32.dll")] static extern IntPtr GetForegroundWindow();
 [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr window,out uint process);
 public static string ForegroundApp(){uint id;GetWindowThreadProcessId(GetForegroundWindow(),out id);if(id==0)return "";try{using(var p=System.Diagnostics.Process.GetProcessById((int)id)){return p.ProcessName+".exe";}}catch{return "";}}
 public static volatile bool Caps, Shift; static bool leftShift,rightShift;
 static void EmitLocks(){Console.WriteLine("{\"event\":\"locks\",\"caps\":"+(Caps?"true":"false")+",\"shift\":"+(Shift?"true":"false")+"}");}
 static long lastActivity; static bool down; static IntPtr hook; static Hook callback=OnKey;
 delegate IntPtr Hook(int code, IntPtr message, IntPtr data);
 [StructLayout(LayoutKind.Sequential)] struct Message {public IntPtr window;public uint message;public UIntPtr w;public IntPtr l;public uint time;public int x,y;public uint extra;}
 [DllImport("user32.dll")] static extern IntPtr SetWindowsHookEx(int id,Hook proc,IntPtr module,uint thread);
 [DllImport("user32.dll")] static extern IntPtr CallNextHookEx(IntPtr hook,int code,IntPtr message,IntPtr data);
 [DllImport("user32.dll")] static extern int GetMessage(out Message msg,IntPtr window,uint min,uint max);
 [DllImport("kernel32.dll",CharSet=CharSet.Auto)] static extern IntPtr GetModuleHandle(string name);
 static IntPtr OnKey(int code,IntPtr message,IntPtr data){
  // Emit a throttled activity signal without recording or transmitting key identities.
  if(code>=0&&(message.ToInt32()==0x100||message.ToInt32()==0x104)){long now=Environment.TickCount; if(now-lastActivity>100||now<lastActivity){lastActivity=now;Console.WriteLine("{\"event\":\"activity\"}");}}
  // Caps Lock state remains separate.
  if(code>=0 && Marshal.ReadInt32(data)==20){int m=message.ToInt32();if(m==0x100||m==0x104){if(!down){Caps=!Caps;EmitLocks();}down=true;}else if(m==0x101||m==0x105)down=false;}
  if(code>=0){int key=Marshal.ReadInt32(data),m=message.ToInt32();if(key==160||key==161||key==16){bool press=m==0x100||m==0x104;if(press||m==0x101||m==0x105){if(key==161)rightShift=press;else leftShift=press;bool next=leftShift||rightShift;if(next!=Shift){Shift=next;EmitLocks();}}}}
  return CallNextHookEx(hook,code,message,data);
 }
 public static void Start(){var ready=new ManualResetEvent(false);var thread=new Thread(()=>{Caps=(GetKeyState(20)&1)!=0;leftShift=(GetKeyState(160)&0x8000)!=0;rightShift=(GetKeyState(161)&0x8000)!=0;Shift=leftShift||rightShift;hook=SetWindowsHookEx(13,callback,GetModuleHandle(null),0);ready.Set();Message m;while(GetMessage(out m,IntPtr.Zero,0,0)>0){}});thread.IsBackground=true;thread.Start();if(!ready.WaitOne(3000)||hook==IntPtr.Zero)throw new Exception("Could not observe Caps Lock state.");}
}
'@
[CompanionInput]::Start()
Add-Type -Path (Join-Path $PSScriptRoot 'audio.cs')
while($null -ne ($line=[Console]::ReadLine())){
 $r=$null
 try{
  $r=$line|ConvertFrom-Json
  if($r.action -eq 'locks'){ $result=@{caps=[CompanionInput]::Caps;shift=[CompanionInput]::Shift} }
  elseif($r.action -eq 'foreground-app'){ $result=[CompanionInput]::ForegroundApp() }
  elseif($r.action -eq 'screenshot-folder'){ $result=[CompanionInput]::ScreenshotFolder($null) }
  elseif($r.action -eq 'set-screenshot-folder'){ $result=[CompanionInput]::ScreenshotFolder([string]$r.codes) }
  elseif($r.action -eq 'mic-status' -or $r.action -eq 'mic-toggle'){ $result=@{muted=[CompanionAudio]::Mute($r.action -eq 'mic-toggle')} }
  elseif($r.action -eq 'windows-location'){
   Add-Type -AssemblyName System.Runtime.WindowsRuntime
   $geoType=[Windows.Devices.Geolocation.Geolocator,Windows.Devices.Geolocation,ContentType=WindowsRuntime]
   $positionType=[Windows.Devices.Geolocation.Geoposition,Windows.Devices.Geolocation,ContentType=WindowsRuntime]
   $geo=New-Object $geoType
   $method=[System.WindowsRuntimeSystemExtensions].GetMethods()|Where-Object{$_.Name -eq 'AsTask' -and $_.IsGenericMethod -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1'}|Select-Object -First 1
   $task=$method.MakeGenericMethod($positionType).Invoke($null,@($geo.GetGeopositionAsync()))
   if(!$task.Wait(12000)){throw 'Windows location is unavailable. Choose a city manually.'}
   $pos=$task.Result.Coordinate.Point.Position
   $result=@{latitude=$pos.Latitude;longitude=$pos.Longitude;name='Windows location'}
  }
  elseif($r.action -eq 'keys'){
   if($r.codes.Count -lt 1 -or $r.codes.Count -gt 4){throw 'Invalid shortcut'}
   foreach($k in $r.codes){if($k -lt 1 -or $k -gt 255){throw 'Invalid key'}}
   $pressed=@()
   try {foreach($k in $r.codes){[CompanionInput]::keybd_event([byte]$k,0,0,[UIntPtr]::Zero);$pressed+= $k}}
   finally {[array]::Reverse($pressed);foreach($k in $pressed){[CompanionInput]::keybd_event([byte]$k,0,2,[UIntPtr]::Zero)}}
   $result=@{accepted=$true}
  }else{throw 'Unknown input action'}
  @{id=$r.id;ok=$true;result=$result}|ConvertTo-Json -Compress|ForEach-Object{[Console]::WriteLine($_)}
 }catch{@{id=$r.id;ok=$false;error=$_.Exception.Message}|ConvertTo-Json -Compress|ForEach-Object{[Console]::WriteLine($_)}}
}
