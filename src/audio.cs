using System;
using System.Runtime.InteropServices;
public static class CompanionAudio {
 [ComImport,Guid("BCDE0395-E52F-467C-8E3D-C4579291692E")] class Enumerator {}
 [ComImport,Guid("A95664D2-9614-4F35-A746-DE8DB63617E6"),InterfaceType(ComInterfaceType.InterfaceIsIUnknown)] interface IEnumerator {
  void EnumAudioEndpoints(int flow,int mask,out IntPtr devices);
  void GetDefaultAudioEndpoint(int flow,int role,out IDevice device);
 }
 [ComImport,Guid("D666063F-1587-4E43-81F1-B948E807363F"),InterfaceType(ComInterfaceType.InterfaceIsIUnknown)] interface IDevice {
  void Activate(ref Guid id,int context,IntPtr parameters,[MarshalAs(UnmanagedType.IUnknown)] out object value);
 }
 [ComImport,Guid("5CDF2C82-841E-4546-9722-0CF74078229A"),InterfaceType(ComInterfaceType.InterfaceIsIUnknown)] interface IVolume {
  void RegisterControlChangeNotify(IntPtr notify);void UnregisterControlChangeNotify(IntPtr notify);void GetChannelCount(out uint count);
  void SetMasterVolumeLevel(float value,ref Guid context);void SetMasterVolumeLevelScalar(float value,ref Guid context);void GetMasterVolumeLevel(out float value);void GetMasterVolumeLevelScalar(out float value);
  void SetChannelVolumeLevel(uint channel,float value,ref Guid context);void SetChannelVolumeLevelScalar(uint channel,float value,ref Guid context);void GetChannelVolumeLevel(uint channel,out float value);void GetChannelVolumeLevelScalar(uint channel,out float value);
  void SetMute([MarshalAs(UnmanagedType.Bool)]bool mute,ref Guid context);void GetMute([MarshalAs(UnmanagedType.Bool)]out bool mute);
 }
 public static bool Mute(bool toggle){IEnumHolder holder=new IEnumHolder();try{holder.Enumerator=(IEnumerator)new Enumerator();holder.Enumerator.GetDefaultAudioEndpoint(1,2,out holder.Device);Guid id=typeof(IVolume).GUID;holder.Device.Activate(ref id,23,IntPtr.Zero,out holder.Endpoint);var volume=(IVolume)holder.Endpoint;bool muted;volume.GetMute(out muted);if(toggle){Guid context=Guid.Empty;volume.SetMute(!muted,ref context);volume.GetMute(out muted);}return muted;}finally{if(holder.Endpoint!=null)Marshal.ReleaseComObject(holder.Endpoint);if(holder.Device!=null)Marshal.ReleaseComObject(holder.Device);if(holder.Enumerator!=null)Marshal.ReleaseComObject(holder.Enumerator);}}
 class IEnumHolder{public IEnumerator Enumerator;public IDevice Device;public object Endpoint;}
}
