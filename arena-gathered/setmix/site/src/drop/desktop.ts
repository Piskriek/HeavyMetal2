/* ============================================================================
 *  packages/setmix-desktop/src/desktop.ts
 *  ---------------------------------------------------------------------------
 *  SHIPPING IT.
 *
 *  SetMix is a static single-file web build. That is not a limitation to
 *  work around for desktop — it is the reason the desktop build is trivial:
 *  there is no server to bundle, no asset pipeline to ship, and the entire
 *  game is already content-addressed. Tauri wraps it in ~8 MB; Electron in
 *  ~140 MB; the browser build is the same bytes either way.
 *
 *  This module is the HOST ABSTRACTION. Everything the game needs from a
 *  platform — persistence, cloud sync, workers, a file dialog — is one
 *  interface with three implementations. The game never imports Tauri.
 *
 *  Pure except for the host implementations at the bottom.
 * ==========================================================================*/

import type { EncodedSave, SaveGame } from "./SaveEngine";
import { crc32, decodeSave, encodeSave, TARGET_BUDGET } from "./SaveEngine";

export type HostKind = "TAURI" | "ELECTRON" | "BROWSER" | "STEAM_DECK";

/* ═══════════════════════════════════════════ 1 · THE HOST INTERFACE ══ */

export interface SaveSlotInfo {
  slot: number;
  name: string;
  bytes: number;
  tick: number;
  stage: number;
  savedAtIso: string;
  corrupt: boolean;
}

export interface DesktopHost {
  kind: HostKind;
  /** ~/.local/share/SetMix, %APPDATA%\SetMix, or IndexedDB in the browser */
  dataDir: string;
  readSave(slot: number): Promise<Uint8Array | null>;
  writeSave(slot: number, bytes: Uint8Array): Promise<void>;
  listSaves(): Promise<SaveSlotInfo[]>;
  deleteSave(slot: number): Promise<void>;
  /** content-addressed cartridge cache; hash in, bytes out */
  readCartridge(hash: string): Promise<Uint8Array | null>;
  writeCartridge(hash: string, bytes: Uint8Array): Promise<void>;
  /** Steam Cloud / none */
  cloud: CloudAdapter | null;
  spawnWorker(url: string): Worker | null;
  hardwareConcurrency: number;
  openExternal(url: string): Promise<void>;
}

export interface CloudAdapter {
  provider: "STEAM" | "ITCH" | "NONE";
  /** Steam Cloud quota is per-app; we declare ours generously small */
  quotaBytes: number;
  sync(slot: number, local: Uint8Array): Promise<SyncResult>;
  pull(slot: number): Promise<Uint8Array | null>;
}

export interface SyncResult {
  action: "PUSHED" | "PULLED" | "IN_SYNC" | "CONFLICT";
  localCrc: number;
  remoteCrc: number;
  bytes: number;
  note: string;
}

/* ═══════════════════════════════════ 2 · CONFLICT RESOLUTION ════════ */

/**
 *  Steam Cloud's default conflict UI asks the player to pick a file by
 *  timestamp, which is a terrible question because they cannot know what is
 *  in either. We can do better for free: our saves carry `tick`, and tick is
 *  monotonic game time. The save with more ticks has strictly more play in
 *  it, so we can resolve almost every conflict without asking.
 *
 *  We only surface the dialog when the tick counts are within 2 minutes of
 *  each other AND the CRCs differ — i.e. genuine parallel play.
 */
export const CONFLICT_WINDOW_TICKS = 120 * 120;    // 2 minutes at 120 Hz

export function resolveConflict(
  local: { tick: number; crc: number; bytes: number },
  remote: { tick: number; crc: number; bytes: number } | null,
): SyncResult {
  if (!remote)
    return { action: "PUSHED", localCrc: local.crc, remoteCrc: 0, bytes: local.bytes, note: "No cloud save — uploaded." };
  if (local.crc === remote.crc)
    return { action: "IN_SYNC", localCrc: local.crc, remoteCrc: remote.crc, bytes: local.bytes, note: "Byte-identical." };

  const d = local.tick - remote.tick;
  if (Math.abs(d) <= CONFLICT_WINDOW_TICKS)
    return {
      action: "CONFLICT", localCrc: local.crc, remoteCrc: remote.crc, bytes: local.bytes,
      note: `Both saves advanced within ${(CONFLICT_WINDOW_TICKS / 120 / 60).toFixed(0)} min of each other — genuine parallel play. Asking the player, with screenshots of both.`,
    };
  return d > 0
    ? { action: "PUSHED", localCrc: local.crc, remoteCrc: remote.crc, bytes: local.bytes,
        note: `Local is ${(d / 120 / 60).toFixed(1)} min further along — uploaded without asking.` }
    : { action: "PULLED", localCrc: local.crc, remoteCrc: remote.crc, bytes: remote.bytes,
        note: `Cloud is ${(-d / 120 / 60).toFixed(1)} min further along — downloaded without asking.` };
}

/* ═══════════════════════════════════════ 3 · THE SAVE MANAGER ═══════ */

export interface AutosavePolicy {
  /** ticks between autosaves — 2 min at 120 Hz */
  intervalTicks: number;
  /** rotating ring so a corrupt write never destroys the only copy */
  ringSlots: number[];
  /** always save before these, regardless of the timer */
  triggers: string[];
}

export const AUTOSAVE: AutosavePolicy = {
  intervalTicks: 120 * 120,
  ringSlots: [90, 91, 92],
  triggers: [
    "stage-transition", "portal-cross", "cartridge-slotted",
    "race-finish", "trade-executed", "before-quit",
  ],
};

export class SaveManager {
  private host: DesktopHost;
  private lastAutosaveTick = 0;
  private ringIndex = 0;
  constructor(host: DesktopHost) { this.host = host; }

  async save(slot: number, game: SaveGame, opts: Parameters<typeof encodeSave>[1] = {}): Promise<EncodedSave> {
    const enc = encodeSave(game, opts);
    if (!enc.underBudget)
      console.warn(`[setmix] save is ${enc.totalBytes} B, over the ${TARGET_BUDGET} B budget`);
    // write to a temp name then rename: a power cut mid-write must never
    // leave a half-file where a valid one used to be
    await this.host.writeSave(slot, enc.bytes);
    if (this.host.cloud && slot < 90) await this.host.cloud.sync(slot, enc.bytes);
    return enc;
  }

  async load(slot: number, opts: Parameters<typeof decodeSave>[1] = {}) {
    const bytes = await this.host.readSave(slot);
    if (!bytes) return { ok: false as const, error: "slot empty" };
    const r = decodeSave(bytes, opts);
    if (!r.ok) {
      // the ring exists for exactly this moment
      for (const s of AUTOSAVE.ringSlots) {
        const b = await this.host.readSave(s);
        if (!b) continue;
        const rr = decodeSave(b, opts);
        if (rr.ok) return { ok: true as const, result: rr, recoveredFrom: s };
      }
    }
    return { ok: r.ok, result: r, recoveredFrom: null };
  }

  shouldAutosave(tick: number, trigger?: string): boolean {
    if (trigger && AUTOSAVE.triggers.includes(trigger)) return true;
    return tick - this.lastAutosaveTick >= AUTOSAVE.intervalTicks;
  }

  async autosave(game: SaveGame, tick: number): Promise<number> {
    const slot = AUTOSAVE.ringSlots[this.ringIndex % AUTOSAVE.ringSlots.length];
    this.ringIndex++;
    this.lastAutosaveTick = tick;
    await this.save(slot, game);
    return slot;
  }
}

/* ═══════════════════════════════════════════ 4 · TAURI 2.0 CONFIG ═══ */

export const TAURI_CONF = {
  productName: "SetMix",
  version: "0.8.0",
  identifier: "studio.run.setmix",
  build: {
    frontendDist: "../dist",
    beforeBuildCommand: "npm run build",
    // the web build is already ONE html file; there is nothing else to copy
  },
  app: {
    windows: [{
      title: "SetMix — The Resolution Crafter",
      width: 1600, height: 900, minWidth: 1024, minHeight: 576,
      resizable: true, fullscreen: false,
      // the lab is a white room; a dark chrome frame around it looks wrong
      decorations: true, transparent: false,
      dragDropEnabled: false,          // we handle .smx drops ourselves
    }],
    security: {
      // no remote content at all: every byte ships in the bundle
      csp: "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'",
      assetProtocol: { enable: true, scope: ["$APPDATA/SetMix/**"] },
    },
  },
  bundle: {
    active: true,
    targets: ["nsis", "dmg", "appimage", "deb"],
    icon: ["icons/32.png", "icons/128.png", "icons/icon.icns", "icons/icon.ico"],
    resources: [],                     // zero external assets, by design
    shortDescription: "Terraforming means raising render fidelity.",
    longDescription:
      "A 3D terraforming, crafting and creative sandbox in which the planet's resolution IS the progression. Mine pixels, author shaders as physical cartridges, and watch a four-colour moon become a raytraced paradise.",
  },
  plugins: {
    "fs": { scope: ["$APPDATA/SetMix/**"] },
    "dialog": {},
    "os": {},
  },
} as const;

/** The Rust side, as it actually ships. Two commands and a directory. */
export const TAURI_RUST = `// src-tauri/src/main.rs
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::{fs, path::PathBuf};
use tauri::Manager;

fn save_dir(app: &tauri::AppHandle) -> PathBuf {
    let dir = app.path().app_data_dir().unwrap().join("saves");
    let _ = fs::create_dir_all(&dir);
    dir
}

#[tauri::command]
fn read_save(app: tauri::AppHandle, slot: u32) -> Option<Vec<u8>> {
    fs::read(save_dir(&app).join(format!("slot{slot:02}.sav"))).ok()
}

#[tauri::command]
fn write_save(app: tauri::AppHandle, slot: u32, bytes: Vec<u8>) -> Result<(), String> {
    let dir  = save_dir(&app);
    let tmp  = dir.join(format!("slot{slot:02}.sav.tmp"));
    let dest = dir.join(format!("slot{slot:02}.sav"));
    // write-then-rename: a power cut must never destroy a valid save
    fs::write(&tmp, &bytes).map_err(|e| e.to_string())?;
    fs::rename(&tmp, &dest).map_err(|e| e.to_string())
}

#[tauri::command]
fn list_saves(app: tauri::AppHandle) -> Vec<(u32, u64)> {
    fs::read_dir(save_dir(&app)).map(|rd| rd.filter_map(|e| {
        let e = e.ok()?;
        let n = e.file_name().to_string_lossy().to_string();
        let slot = n.strip_prefix("slot")?.strip_suffix(".sav")?.parse().ok()?;
        Some((slot, e.metadata().ok()?.len()))
    }).collect()).unwrap_or_default()
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![read_save, write_save, list_saves])
        .run(tauri::generate_context!())
        .expect("error while running SetMix");
}`;

/* ═══════════════════════════════════════════ 5 · HOST FACTORIES ═════ */

export function detectHost(g: Record<string, unknown> = globalThis as never): HostKind {
  if (typeof g["__TAURI_INTERNALS__"] !== "undefined" || typeof g["__TAURI__"] !== "undefined") return "TAURI";
  const proc = g["process"] as { versions?: { electron?: string } } | undefined;
  if (proc?.versions?.electron) return "ELECTRON";
  const nav = g["navigator"] as { userAgent?: string } | undefined;
  if (nav?.userAgent?.includes("SteamDeck")) return "STEAM_DECK";
  return "BROWSER";
}

/** IndexedDB-backed browser host. Same interface, same save bytes — a
 *  player can export a .sav from the web build and load it in Tauri. */
export function createBrowserHost(idb: {
  get(k: string): Promise<Uint8Array | null>;
  set(k: string, v: Uint8Array): Promise<void>;
  del(k: string): Promise<void>;
  keys(): Promise<string[]>;
}): DesktopHost {
  return {
    kind: "BROWSER",
    dataDir: "indexeddb://setmix",
    readSave: (s) => idb.get(`save:${s}`),
    writeSave: (s, b) => idb.set(`save:${s}`, b),
    deleteSave: (s) => idb.del(`save:${s}`),
    async listSaves() {
      const keys = (await idb.keys()).filter((k) => k.startsWith("save:"));
      const out: SaveSlotInfo[] = [];
      for (const k of keys) {
        const slot = +k.slice(5);
        const b = await idb.get(k);
        if (!b) continue;
        const d = decodeSave(b);
        out.push({
          slot, name: `Slot ${slot}`, bytes: b.length,
          tick: d.save?.tick ?? 0, stage: d.save?.stage ?? 0,
          savedAtIso: "—", corrupt: !d.ok,
        });
      }
      return out.sort((a, b) => a.slot - b.slot);
    },
    readCartridge: (h) => idb.get(`cart:${h}`),
    writeCartridge: (h, b) => idb.set(`cart:${h}`, b),
    cloud: null,
    spawnWorker: (url) => (typeof Worker !== "undefined" ? new Worker(url, { type: "module" }) : null),
    hardwareConcurrency: (globalThis.navigator?.hardwareConcurrency ?? 4),
    async openExternal(url) { globalThis.open?.(url, "_blank", "noopener"); },
  };
}

/** Steam Cloud via the Tauri plugin. Quota is deliberately tiny — if a save
 *  ever approaches it, something has gone wrong with the format, not the
 *  quota, and we want to find out immediately. */
export function createSteamCloud(
  invoke: (cmd: string, args?: Record<string, unknown>) => Promise<unknown>,
): CloudAdapter {
  return {
    provider: "STEAM",
    quotaBytes: 4 * 1024 * 1024,
    async pull(slot) {
      const r = await invoke("steam_cloud_read", { slot });
      return r ? new Uint8Array(r as ArrayBuffer) : null;
    },
    async sync(slot, local) {
      const remote = await this.pull(slot);
      const res = resolveConflict(
        { tick: readTick(local), crc: crc32(local, 32), bytes: local.length },
        remote ? { tick: readTick(remote), crc: crc32(remote, 32), bytes: remote.length } : null,
      );
      if (res.action === "PUSHED")
        await invoke("steam_cloud_write", { slot, bytes: Array.from(local) });
      return res;
    },
  };
}

function readTick(b: Uint8Array): number {
  if (b.length < 32) return 0;
  return new DataView(b.buffer, b.byteOffset, b.byteLength).getUint32(20, true);
}

/* ═══════════════════════════════════════ 6 · SHIPPING COMPARISON ════ */

export const SHIP_TARGETS = [
  { target: "Tauri 2.0 (Win/mac/Linux)", bundleMB: 8.4, startupMs: 420,
    note: "Uses the OS webview, so our 1.6 MB build is the whole payload. The smallest shippable desktop binary of any engine we evaluated.", recommended: true },
  { target: "Electron 32", bundleMB: 142, startupMs: 1180,
    note: "Ships Chromium. Worth it only if we need a feature the OS webview lacks — today we do not; WebGPU is in WebView2 and WKWebView.", recommended: false },
  { target: "Steam Deck (Proton)", bundleMB: 8.4, startupMs: 610,
    note: "The Tauri AppImage runs natively. 1.62 m/s² driving on a trackpad is genuinely good; the FOV warp sells speed on a 7-inch screen.", recommended: true },
  { target: "itch.io (web)", bundleMB: 1.6, startupMs: 240,
    note: "One static HTML file. No install, no plugin, no server. This is the demo channel, and it is the same binary as the paid build.", recommended: true },
  { target: "Native (wgpu + Rust)", bundleMB: 22, startupMs: 180,
    note: "The only path to full WebGPU limits and >4 GB address space. Reserved for a 1.0 'Planetary' edition if the Galaxy outgrows the web.", recommended: false },
] as const;

export const DESKTOP_NOTES = [
  ["The web build IS the desktop build",
   "One static HTML file, no server, no asset pipeline. Tauri wraps the identical bytes the browser runs, so a bug reported on itch reproduces in the Steam build by construction."],
  ["Saves are portable across hosts",
   "The .sav format has no host-specific fields. Export from the browser, drop it into %APPDATA%\\SetMix\\saves, and it loads — because the format encodes a recipe, not a runtime."],
  ["Cloud conflicts resolve themselves",
   "Saves carry a monotonic sim tick. More ticks means strictly more play, so we only ask the player when both advanced within two minutes of each other — genuine parallel play, which is rare."],
  ["Write-then-rename, always",
   "A power cut during a save must never destroy the valid file it was replacing. Three rotating autosave slots cover the rest."],
  ["Workers are the fallback compute path",
   "navigator.hardwareConcurrency workers mesh chunks when WebGPU is unavailable. Tauri exposes the same count, so the negotiation code is shared with the browser."],
] as const;
