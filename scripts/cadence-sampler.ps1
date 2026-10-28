<#
  Plan 51 wave 3: the cadence sampler (the input-audio floor rung) for a game that publishes no telemetry.

  Started by scripts/companion-bridge.mjs when the player bridges a game, stopped when the bridge closes. About 200 times a
  second it writes one line to stdout:  t fg fire jump dash peak
    t     seconds since start
    fg    1 when the bridged game's own window has focus
    fire  left mouse held, jump space held, dash shift held: read ONLY while fg is 1 (otherwise 0); no other key, never text
    peak  the game's own audio peak, 0..1, from its Windows audio session (IAudioSessionManager2 -> the sessions whose
          process is the game -> IAudioMeterInformation). Other apps' sound (music, voice chat) is not read.
  It never touches the game's process, memory or files. Nothing is stored: the bridge keeps a few seconds in memory.

  powershell -NoProfile -File scripts/cadence-sampler.ps1 -Process SomeGame.exe [-Hz 200] [-Seconds 0]
#>
param(
  [Parameter(Mandatory = $true)][string]$Process,
  [int]$Hz = 200,
  [double]$Seconds = 0
)
$ErrorActionPreference = 'Stop'

Add-Type -TypeDefinition @'
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Runtime.InteropServices;

namespace Fidelity.Cadence {
  [ComImport, Guid("A95664D2-9614-4F35-A746-DE8DB63617E6"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  interface IMMDeviceEnumerator {
    int EnumAudioEndpoints(int dataFlow, int stateMask, out IntPtr devices);
    int GetDefaultAudioEndpoint(int dataFlow, int role, out IMMDevice endpoint);
  }
  [ComImport, Guid("D666063F-1587-4E43-81F1-B948E807363F"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  interface IMMDevice {
    int Activate(ref Guid iid, int clsCtx, IntPtr activationParams, [MarshalAs(UnmanagedType.IUnknown)] out object iface);
  }
  [ComImport, Guid("77AA99A0-1BD6-484F-8BC7-2C654C9A9B6F"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  interface IAudioSessionManager2 {
    int GetAudioSessionControl(IntPtr groupingParam, int streamFlags, out IntPtr sessionControl);
    int GetSimpleAudioVolume(IntPtr groupingParam, int streamFlags, out IntPtr audioVolume);
    int GetSessionEnumerator(out IAudioSessionEnumerator sessionEnum);
  }
  [ComImport, Guid("E2F5BB11-0570-40CA-ACDD-3AA01277DEE8"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  interface IAudioSessionEnumerator {
    int GetCount(out int count);
    int GetSession(int index, [MarshalAs(UnmanagedType.IUnknown)] out object session);
  }
  [ComImport, Guid("bfb7ff88-7239-4fc9-8fa2-07c950be9c6d"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  interface IAudioSessionControl2 {
    int GetState(out int state);
    int GetDisplayName(out IntPtr name);
    int SetDisplayName(IntPtr name, IntPtr ctx);
    int GetIconPath(out IntPtr path);
    int SetIconPath(IntPtr path, IntPtr ctx);
    int GetGroupingParam(out Guid param);
    int SetGroupingParam(IntPtr param, IntPtr ctx);
    int RegisterAudioSessionNotification(IntPtr client);
    int UnregisterAudioSessionNotification(IntPtr client);
    int GetSessionIdentifier(out IntPtr id);
    int GetSessionInstanceIdentifier(out IntPtr id);
    int GetProcessId(out uint pid);
  }
  [ComImport, Guid("C02216F6-8C67-4B5B-9D00-D008E73E0064"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  interface IAudioMeterInformation {
    int GetPeakValue(out float peak);
  }
  [ComImport, Guid("BCDE0395-E52F-467C-8E3D-C4579291692E")]
  class MMDeviceEnumeratorCom { }

  public static class Sampler {
    [DllImport("user32.dll")] static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint pid);
    [DllImport("user32.dll")] static extern short GetAsyncKeyState(int vKey);
    [DllImport("winmm.dll")] static extern uint timeBeginPeriod(uint ms);
    [DllImport("winmm.dll")] static extern uint timeEndPeriod(uint ms);

    static HashSet<uint> GamePids(string name) {
      var set = new HashSet<uint>();
      foreach (var p in Process.GetProcessesByName(name)) set.Add((uint)p.Id);
      return set;
    }

    static List<IAudioMeterInformation> GameMeters(HashSet<uint> pids) {
      var meters = new List<IAudioMeterInformation>();
      try {
        var en = (IMMDeviceEnumerator)new MMDeviceEnumeratorCom();
        IMMDevice dev;
        if (en.GetDefaultAudioEndpoint(0, 1, out dev) != 0 || dev == null) return meters; // eRender, eMultimedia
        var iid = typeof(IAudioSessionManager2).GUID;
        object o;
        if (dev.Activate(ref iid, 23, IntPtr.Zero, out o) != 0) return meters; // CLSCTX_ALL
        var mgr = (IAudioSessionManager2)o;
        IAudioSessionEnumerator se;
        if (mgr.GetSessionEnumerator(out se) != 0) return meters;
        int n; se.GetCount(out n);
        for (int i = 0; i < n; i++) {
          object s; if (se.GetSession(i, out s) != 0 || s == null) continue;
          var c2 = s as IAudioSessionControl2;
          if (c2 == null) continue;
          uint pid; if (c2.GetProcessId(out pid) != 0) continue;
          if (!pids.Contains(pid)) continue;
          var m = s as IAudioMeterInformation;
          if (m != null) meters.Add(m);
        }
      } catch { }
      return meters;
    }

    public static void Run(string name, int hz, double seconds) {
      timeBeginPeriod(1);
      try {
        var sw = Stopwatch.StartNew();
        var pids = GamePids(name);
        var meters = GameMeters(pids);
        double lastScan = 0;
        double period = 1.0 / Math.Max(20, Math.Min(500, hz));
        double next = 0;
        var inv = System.Globalization.CultureInfo.InvariantCulture;
        var outw = Console.Out;
        while (seconds <= 0 || sw.Elapsed.TotalSeconds < seconds) {
          double t = sw.Elapsed.TotalSeconds;
          // the game's audio session can open late (a menu, a level load): look every half second until it is there
          if (t - lastScan >= (meters.Count == 0 ? 0.5 : 2.0)) { pids = GamePids(name); meters = GameMeters(pids); lastScan = t; }
          uint fgPid; GetWindowThreadProcessId(GetForegroundWindow(), out fgPid);
          bool fg = pids.Contains(fgPid);
          // the keys are read only while the game itself has focus: nothing typed anywhere else is ever looked at
          bool fire = fg && (GetAsyncKeyState(0x01) & 0x8000) != 0;
          bool jump = fg && (GetAsyncKeyState(0x20) & 0x8000) != 0;
          bool dash = fg && (GetAsyncKeyState(0x10) & 0x8000) != 0;
          float peak = 0;
          foreach (var m in meters) { float v; try { if (m.GetPeakValue(out v) == 0 && v > peak) peak = v; } catch { } }
          outw.WriteLine(string.Format(inv, "{0:F4} {1} {2} {3} {4} {5:F4}", t, fg ? 1 : 0, fire ? 1 : 0, jump ? 1 : 0, dash ? 1 : 0, peak));
          next += period;
          double wait = next - sw.Elapsed.TotalSeconds;
          if (wait > 0.0015) System.Threading.Thread.Sleep((int)(wait * 1000));
          else if (wait < -0.25) next = sw.Elapsed.TotalSeconds;
        }
      } finally { timeEndPeriod(1); }
    }
  }
}
'@

$name = [System.IO.Path]::GetFileNameWithoutExtension($Process)
[Console]::Out.Flush()
[Fidelity.Cadence.Sampler]::Run($name, $Hz, $Seconds)
