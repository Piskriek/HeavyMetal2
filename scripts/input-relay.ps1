<#
  Plan 53: the input relay's synthetic-keys transport. The player chose it (a box ticked, the word RELAY typed) for one
  bridged game, this session only.

  The bridge starts it for that game and writes one line per press to stdin:
    down mouse1 | up mouse1 | down space | up e ...   (only the keys in $Allowed; anything else is refused)
  Each press is sent with Windows SendInput ONLY while the game's own window is in front. If another window is in front,
  the press is dropped, so nothing is ever typed into another program. Each line gets one answer on stdout:
    sent <line>  |  dropped <line>: <why>

  It never reads the game's process or memory. Run by the bridge with pwsh (its own RemoteSigned policy); no policy change.
  pwsh -NoProfile -File scripts/input-relay.ps1 -Process cs2.exe
#>
param([Parameter(Mandatory = $true)][string]$Process)
$ErrorActionPreference = 'Stop'

Add-Type -TypeDefinition @'
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Runtime.InteropServices;

namespace Fidelity.Relay {
  public static class Keys {
    [StructLayout(LayoutKind.Sequential)] struct MOUSEINPUT { public int dx, dy; public uint mouseData, dwFlags, time; public IntPtr dwExtraInfo; }
    [StructLayout(LayoutKind.Sequential)] struct KEYBDINPUT { public ushort wVk, wScan; public uint dwFlags, time; public IntPtr dwExtraInfo; }
    [StructLayout(LayoutKind.Explicit)] struct UNION { [FieldOffset(0)] public MOUSEINPUT mi; [FieldOffset(0)] public KEYBDINPUT ki; }
    [StructLayout(LayoutKind.Sequential)] struct INPUT { public uint type; public UNION u; }
    [DllImport("user32.dll", SetLastError = true)] static extern uint SendInput(uint n, INPUT[] inputs, int size);
    [DllImport("user32.dll")] static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint pid);
    [DllImport("user32.dll")] static extern uint MapVirtualKey(uint code, uint mapType);

    const uint INPUT_MOUSE = 0, INPUT_KEYBOARD = 1;
    const uint KEYEVENTF_KEYUP = 0x2, KEYEVENTF_SCANCODE = 0x8;
    static readonly Dictionary<string, ushort> VK = new Dictionary<string, ushort> {
      { "space", 0x20 }, { "e", 0x45 }, { "f", 0x46 }, { "q", 0x51 }, { "r", 0x52 }, { "shift", 0x10 }, { "ctrl", 0x11 },
    };

    static HashSet<uint> GamePids(string name) {
      var set = new HashSet<uint>();
      foreach (var p in Process.GetProcessesByName(name)) set.Add((uint)p.Id);
      return set;
    }

    /** One press; the answer the bridge logs. */
    public static string Press(string game, string line) {
      var parts = line.Trim().Split(' ');
      if (parts.Length != 2 || (parts[0] != "down" && parts[0] != "up")) return "dropped " + line + ": not a press";
      bool down = parts[0] == "down";
      string key = parts[1];
      if (key != "mouse1" && key != "mouse2" && !VK.ContainsKey(key)) return "dropped " + line + ": not an allowed key";
      uint fg; GetWindowThreadProcessId(GetForegroundWindow(), out fg);
      if (!GamePids(game).Contains(fg)) return "dropped " + line + ": the game's window is not in front";
      var input = new INPUT();
      if (key == "mouse1" || key == "mouse2") {
        input.type = INPUT_MOUSE;
        input.u.mi.dwFlags = key == "mouse1" ? (down ? 0x2u : 0x4u) : (down ? 0x8u : 0x10u);
      } else {
        input.type = INPUT_KEYBOARD;
        ushort vk = VK[key];
        // games read the scan code (raw input), so send it as one
        input.u.ki.wScan = (ushort)MapVirtualKey(vk, 0);
        input.u.ki.dwFlags = KEYEVENTF_SCANCODE | (down ? 0u : KEYEVENTF_KEYUP);
      }
      uint sent = SendInput(1, new[] { input }, Marshal.SizeOf(typeof(INPUT)));
      return sent == 1 ? "sent " + line : "dropped " + line + ": SendInput refused";
    }
  }
}
'@

$name = [System.IO.Path]::GetFileNameWithoutExtension($Process)
while ($null -ne ($line = [Console]::In.ReadLine())) {
  if ($line.Trim().Length -eq 0) { continue }
  [Console]::Out.WriteLine([Fidelity.Relay.Keys]::Press($name, $line))
  [Console]::Out.Flush()
}
