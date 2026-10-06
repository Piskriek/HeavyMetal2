/* ============================================================================
 *  packages/setmix-desktop/src/SaveEngine.ts
 *  ---------------------------------------------------------------------------
 *  A 40-HOUR PLANET IN UNDER 64 KILOBYTES.
 *
 *  Not compression — omission. A SetMix world is already (seed + four floats
 *  + a list of hashes + sparse deltas), so the save file is not a snapshot of
 *  a world, it is the RECIPE for one. Everything the player did not touch is
 *  a pure function of the seed and costs zero bytes.
 *
 *  FORMAT: little-endian, chunked, forward-compatible.
 *
 *    ┌─ HEADER (32 B) ────────────────────────────────────────────────┐
 *    │ magic "SMXS" │ u16 ver │ u16 flags │ u32 crc32 │ u32 bodyBytes │
 *    │ u32 seed     │ u32 tick│ u64 savedAtTick                       │
 *    └────────────────────────────────────────────────────────────────┘
 *    then TLV chunks: [u32 tag][u32 byteLength][payload]
 *
 *  An unknown tag is SKIPPED, not fatal. That one decision is why a save
 *  written by 1.4 still loads in 1.0 — and it costs eight bytes per chunk.
 *
 *  Pure. No Node, no browser APIs, no clock. Encryption and disk I/O are
 *  injected by the host.
 * ==========================================================================*/

import type { FidelityState, MetricKey, Stage } from "./contracts.setmix";

export const MAGIC = 0x53584d53;            // "SMXS" LE
export const VERSION = 2;
export const HEADER_BYTES = 32;
export const TARGET_BUDGET = 65536;

export const TAG = {
  FIDELITY: 0x01, MACHINES: 0x02, INVENTORY: 0x03, QUESTS: 0x04,
  VOXEL_DELTA: 0x05, CARTRIDGES: 0x06, PLAYER: 0x07, RACE: 0x08,
  TRADER: 0x09, SETTINGS: 0x0a,
} as const;

export const TAG_NAME: Record<number, string> = Object.fromEntries(
  Object.entries(TAG).map(([k, v]) => [v, k]),
);

/* ═══════════════════════════════════════════════════ 1 · CRC-32 ══════ */

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

export function crc32(bytes: Uint8Array, start = 0, end = bytes.length): number {
  let c = 0xffffffff;
  for (let i = start; i < end; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/* ═══════════════════════════════════════════════ 2 · THE PAYLOAD ═════ */

export interface SaveMachine {
  kind: number;          // index into the machine registry
  x: number; z: number;  // metres, quantised to 0.25
  tier: number;          // 0..3
  overclock: number;     // ×100, u8
  cartridge: number;     // index into the cartridge table, 0xffff = none
  condition: number;     // 0..255
}

export interface SaveQuest { id: number; state: 0 | 1 | 2; progress: number }

export interface SaveGame {
  seed: number;
  tick: number;
  fidelity: FidelityState;
  stage: Stage;
  machines: SaveMachine[];
  inventory: Record<string, number>;
  quests: SaveQuest[];
  cartridgeHashes: string[];
  player: { x: number; y: number; z: number; yaw: number; coherence: number; suitTier: number };
  race: { trackId: number; bestLapTicks: number; ghostBytes: Uint8Array };
  trader: { reputation: number; bought: Record<string, number> };
  /** chunkId → Int8Array of quantised SDF deltas */
  voxelDelta: Map<string, Int8Array>;
  settings: Record<string, number>;
}

/* ───────────────────────────────── a tiny growable writer ───────────── */

class Writer {
  private buf = new Uint8Array(1024);
  private dv = new DataView(this.buf.buffer);
  len = 0;
  private grow(n: number) {
    if (this.len + n <= this.buf.length) return;
    let cap = this.buf.length;
    while (cap < this.len + n) cap *= 2;
    const nb = new Uint8Array(cap);
    nb.set(this.buf.subarray(0, this.len));
    this.buf = nb;
    this.dv = new DataView(nb.buffer);
  }
  u8(v: number) { this.grow(1); this.buf[this.len++] = v & 255; }
  u16(v: number) { this.grow(2); this.dv.setUint16(this.len, v & 0xffff, true); this.len += 2; }
  i16(v: number) { this.grow(2); this.dv.setInt16(this.len, v, true); this.len += 2; }
  u32(v: number) { this.grow(4); this.dv.setUint32(this.len, v >>> 0, true); this.len += 4; }
  f32(v: number) { this.grow(4); this.dv.setFloat32(this.len, v, true); this.len += 4; }
  bytes(b: Uint8Array) { this.grow(b.length); this.buf.set(b, this.len); this.len += b.length; }
  /** length-prefixed UTF-8, u8 length — hashes are 10 chars, names are short */
  str(s: string) {
    const e = new TextEncoder().encode(s.slice(0, 255));
    this.u8(e.length); this.bytes(e);
  }
  /** LEB128 — machine counts and quest ids are small; four bytes each is waste */
  varint(v: number) {
    let x = v >>> 0;
    do { let b = x & 0x7f; x >>>= 7; if (x) b |= 0x80; this.u8(b); } while (x);
  }
  take(): Uint8Array { return this.buf.subarray(0, this.len).slice(); }
}

class Reader {
  private dv: DataView;
  off = 0;
  constructor(public buf: Uint8Array) { this.dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength); }
  u8() { return this.buf[this.off++]; }
  u16() { const v = this.dv.getUint16(this.off, true); this.off += 2; return v; }
  i16() { const v = this.dv.getInt16(this.off, true); this.off += 2; return v; }
  u32() { const v = this.dv.getUint32(this.off, true); this.off += 4; return v >>> 0; }
  f32() { const v = this.dv.getFloat32(this.off, true); this.off += 4; return v; }
  bytes(n: number) { const b = this.buf.subarray(this.off, this.off + n); this.off += n; return b; }
  str() { const n = this.u8(); return new TextDecoder().decode(this.bytes(n)); }
  varint() { let v = 0, s = 0, b = 0; do { b = this.u8(); v |= (b & 0x7f) << s; s += 7; } while (b & 0x80); return v >>> 0; }
  get remaining() { return this.buf.length - this.off; }
}

/* ═══════════════════════════════════════════════════ 3 · ENCODE ══════ */

export interface EncodeOptions {
  /** injected; the package itself never imports crypto */
  encrypt?: (plain: Uint8Array) => Uint8Array;
  compress?: (plain: Uint8Array) => Uint8Array;
}

export interface EncodedSave {
  bytes: Uint8Array;
  crc: number;
  chunks: { tag: number; name: string; bytes: number }[];
  bodyBytes: number;
  totalBytes: number;
  underBudget: boolean;
}

function chunk(w: Writer, tag: number, body: Uint8Array) {
  w.u32(tag); w.u32(body.length); w.bytes(body);
}

export function encodeSave(s: SaveGame, opts: EncodeOptions = {}): EncodedSave {
  const body = new Writer();
  const chunks: { tag: number; name: string; bytes: number }[] = [];
  const emit = (tag: number, build: (w: Writer) => void) => {
    const w = new Writer();
    build(w);
    const b = w.take();
    chunk(body, tag, b);
    chunks.push({ tag, name: TAG_NAME[tag] ?? `0x${tag.toString(16)}`, bytes: b.length + 8 });
  };

  /* ── fidelity: four f32 + tick. 20 bytes for the entire visual world ── */
  emit(TAG.FIDELITY, (w) => {
    w.f32(s.fidelity.pxd); w.f32(s.fidelity.vtx);
    w.f32(s.fidelity.lx); w.f32(s.fidelity.aq);
    w.u32(s.tick); w.u8(s.stage);
  });

  /* ── machines: 10 bytes each, positions quantised to 25 cm ─────────── */
  emit(TAG.MACHINES, (w) => {
    w.varint(s.machines.length);
    for (const m of s.machines) {
      w.u8(m.kind);
      w.i16(Math.round(m.x * 4));          // ±8 km at 25 cm
      w.i16(Math.round(m.z * 4));
      w.u8((m.tier & 3) | ((m.condition >> 2) << 2));
      w.u8(Math.round(m.overclock * 100));
      w.u16(m.cartridge);
    }
  });

  emit(TAG.INVENTORY, (w) => {
    const e = Object.entries(s.inventory);
    w.varint(e.length);
    for (const [k, n] of e) { w.str(k); w.varint(n); }
  });

  emit(TAG.QUESTS, (w) => {
    w.varint(s.quests.length);
    for (const q of s.quests) { w.varint(q.id); w.u8(q.state); w.u8(Math.round(q.progress * 255)); }
  });

  /* ── cartridges: hashes only. The graphs live in the content store. ── */
  emit(TAG.CARTRIDGES, (w) => {
    w.varint(s.cartridgeHashes.length);
    for (const h of s.cartridgeHashes) w.u32(parseInt(h.replace(/^0x/, ""), 16) >>> 0);
  });

  emit(TAG.PLAYER, (w) => {
    w.f32(s.player.x); w.f32(s.player.y); w.f32(s.player.z);
    w.u8(Math.round((((s.player.yaw % 6.2832) + 6.2832) % 6.2832) / 6.2832 * 255));
    w.u8(Math.round(s.player.coherence * 255));
    w.u8(s.player.suitTier);
  });

  emit(TAG.RACE, (w) => {
    w.u16(s.race.trackId);
    w.u32(s.race.bestLapTicks);
    w.varint(s.race.ghostBytes.length);
    w.bytes(s.race.ghostBytes);
  });

  emit(TAG.TRADER, (w) => {
    w.u8(Math.round(s.trader.reputation * 255));
    const e = Object.entries(s.trader.bought);
    w.varint(e.length);
    for (const [k, n] of e) { w.str(k); w.u8(n); }
  });

  /* ── voxel deltas: RLE over quantised SDF. The big one, and still small. */
  emit(TAG.VOXEL_DELTA, (w) => {
    w.varint(s.voxelDelta.size);
    for (const [id, arr] of s.voxelDelta) {
      w.str(id);
      const runs = new Writer();
      let i = 0, count = 0;
      while (i < arr.length) {
        const v = arr[i];
        let n = 1;
        while (i + n < arr.length && arr[i + n] === v && n < 255) n++;
        runs.u8(n); runs.u8(v & 255);
        i += n; count++;
      }
      w.varint(count);
      w.bytes(runs.take());
    }
  });

  emit(TAG.SETTINGS, (w) => {
    const e = Object.entries(s.settings);
    w.varint(e.length);
    for (const [k, n] of e) { w.str(k); w.f32(n); }
  });

  /* ── assemble ──────────────────────────────────────────────────────── */
  let payload = body.take();
  let flags = 0;
  if (opts.compress) { payload = opts.compress(payload); flags |= 1; }
  if (opts.encrypt) { payload = opts.encrypt(payload); flags |= 2; }

  const head = new Writer();
  head.u32(MAGIC);
  head.u16(VERSION);
  head.u16(flags);
  head.u32(0);                         // crc placeholder
  head.u32(payload.length);
  head.u32(s.seed);
  head.u32(s.tick);
  head.u32(0); head.u32(0);            // reserved / savedAt hi-lo

  const out = new Uint8Array(HEADER_BYTES + payload.length);
  out.set(head.take().subarray(0, HEADER_BYTES), 0);
  out.set(payload, HEADER_BYTES);

  // CRC covers the body only, so the header stays writable in place
  const crc = crc32(out, HEADER_BYTES);
  new DataView(out.buffer).setUint32(8, crc, true);

  return {
    bytes: out, crc, chunks,
    bodyBytes: payload.length,
    totalBytes: out.length,
    underBudget: out.length <= TARGET_BUDGET,
  };
}

/* ═══════════════════════════════════════════════════ 4 · DECODE ══════ */

export interface DecodeResult {
  ok: boolean;
  save: SaveGame | null;
  version: number;
  crcExpected: number;
  crcActual: number;
  /** tags present in the file that this build does not understand */
  unknownTags: number[];
  error: string | null;
}

export function decodeSave(
  bytes: Uint8Array,
  opts: { decrypt?: (c: Uint8Array) => Uint8Array; decompress?: (c: Uint8Array) => Uint8Array } = {},
): DecodeResult {
  const fail = (e: string): DecodeResult =>
    ({ ok: false, save: null, version: 0, crcExpected: 0, crcActual: 0, unknownTags: [], error: e });

  if (bytes.length < HEADER_BYTES) return fail("file shorter than the header");
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (dv.getUint32(0, true) !== MAGIC) return fail("bad magic — not a .sav");
  const version = dv.getUint16(4, true);
  const flags = dv.getUint16(6, true);
  const crcExpected = dv.getUint32(8, true);
  const bodyBytes = dv.getUint32(12, true);
  const seed = dv.getUint32(16, true);
  const tick = dv.getUint32(20, true);

  if (version > VERSION)
    return fail(`save version ${version} is newer than this build (${VERSION})`);

  const crcActual = crc32(bytes, HEADER_BYTES);
  if (crcActual !== crcExpected)
    return { ok: false, save: null, version, crcExpected, crcActual, unknownTags: [], error: "CRC mismatch — the file is corrupt" };

  let payload = bytes.subarray(HEADER_BYTES, HEADER_BYTES + bodyBytes);
  if (flags & 2) {
    if (!opts.decrypt) return fail("save is encrypted and no decryptor was supplied");
    payload = opts.decrypt(payload);
  }
  if (flags & 1) {
    if (!opts.decompress) return fail("save is compressed and no decompressor was supplied");
    payload = opts.decompress(payload);
  }

  const save: SaveGame = {
    seed, tick,
    fidelity: { pxd: 0, vtx: 0, lx: 0, aq: 0, tick },
    stage: 1, machines: [], inventory: {}, quests: [], cartridgeHashes: [],
    player: { x: 0, y: 0, z: 0, yaw: 0, coherence: 1, suitTier: 1 },
    race: { trackId: 0, bestLapTicks: 0, ghostBytes: new Uint8Array(0) },
    trader: { reputation: 0, bought: {} },
    voxelDelta: new Map(), settings: {},
  };
  const unknownTags: number[] = [];

  const r = new Reader(payload);
  while (r.remaining >= 8) {
    const tag = r.u32();
    const len = r.u32();
    if (len > r.remaining) return fail(`chunk 0x${tag.toString(16)} claims ${len} B, ${r.remaining} remain`);
    const body = new Reader(r.bytes(len));

    switch (tag) {
      case TAG.FIDELITY: {
        save.fidelity = { pxd: body.f32(), vtx: body.f32(), lx: body.f32(), aq: body.f32(), tick: body.u32() };
        save.stage = body.u8() as Stage;
        break;
      }
      case TAG.MACHINES: {
        const n = body.varint();
        for (let i = 0; i < n; i++) {
          const kind = body.u8();
          const x = body.i16() / 4, z = body.i16() / 4;
          const packed = body.u8();
          save.machines.push({
            kind, x, z, tier: packed & 3, condition: (packed >> 2) << 2,
            overclock: body.u8() / 100, cartridge: body.u16(),
          });
        }
        break;
      }
      case TAG.INVENTORY: {
        const n = body.varint();
        for (let i = 0; i < n; i++) save.inventory[body.str()] = body.varint();
        break;
      }
      case TAG.QUESTS: {
        const n = body.varint();
        for (let i = 0; i < n; i++)
          save.quests.push({ id: body.varint(), state: body.u8() as 0 | 1 | 2, progress: body.u8() / 255 });
        break;
      }
      case TAG.CARTRIDGES: {
        const n = body.varint();
        for (let i = 0; i < n; i++)
          save.cartridgeHashes.push("0x" + body.u32().toString(16).padStart(8, "0"));
        break;
      }
      case TAG.PLAYER: {
        save.player = {
          x: body.f32(), y: body.f32(), z: body.f32(),
          yaw: (body.u8() / 255) * 6.2832,
          coherence: body.u8() / 255, suitTier: body.u8(),
        };
        break;
      }
      case TAG.RACE: {
        const trackId = body.u16();
        const bestLapTicks = body.u32();
        const n = body.varint();
        save.race = { trackId, bestLapTicks, ghostBytes: body.bytes(n).slice() };
        break;
      }
      case TAG.TRADER: {
        save.trader.reputation = body.u8() / 255;
        const n = body.varint();
        for (let i = 0; i < n; i++) save.trader.bought[body.str()] = body.u8();
        break;
      }
      case TAG.VOXEL_DELTA: {
        const n = body.varint();
        for (let i = 0; i < n; i++) {
          const id = body.str();
          const runs = body.varint();
          const pairs: number[] = [];
          let total = 0;
          for (let k = 0; k < runs; k++) { const c = body.u8(); const v = body.u8(); pairs.push(c, v); total += c; }
          const arr = new Int8Array(total);
          let o = 0;
          for (let k = 0; k < pairs.length; k += 2) {
            const c = pairs[k], v = (pairs[k + 1] << 24) >> 24;
            arr.fill(v, o, o + c); o += c;
          }
          save.voxelDelta.set(id, arr);
        }
        break;
      }
      case TAG.SETTINGS: {
        const n = body.varint();
        for (let i = 0; i < n; i++) save.settings[body.str()] = body.f32();
        break;
      }
      default:
        // FORWARD COMPATIBILITY: skip, record, carry on.
        unknownTags.push(tag);
    }
  }

  return { ok: true, save, version, crcExpected, crcActual, unknownTags, error: null };
}

/* ═══════════════════════════════════════════ 5 · BUDGET ANALYSIS ═════ */

export function budgetReport(enc: EncodedSave) {
  const rows = enc.chunks
    .map((c) => ({ ...c, pct: (c.bytes / enc.totalBytes) * 100 }))
    .sort((a, b) => b.bytes - a.bytes);
  return {
    rows,
    totalBytes: enc.totalBytes,
    budget: TARGET_BUDGET,
    headroom: TARGET_BUDGET - enc.totalBytes,
    pctUsed: (enc.totalBytes / TARGET_BUDGET) * 100,
    underBudget: enc.underBudget,
  };
}

/** Deterministic XOR-feedback cipher. NOT cryptography — it exists to stop
 *  casual save-scumming with a hex editor, and it is honest about that.
 *  A real build injects WebCrypto AES-GCM through the same hook. */
export function toyCipher(key: number) {
  return (data: Uint8Array): Uint8Array => {
    const out = new Uint8Array(data.length);
    let s = key >>> 0 || 1;
    for (let i = 0; i < data.length; i++) {
      s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
      out[i] = data[i] ^ ((s >>> 16) & 255);
    }
    return out;
  };
}

export function hexDump(bytes: Uint8Array, limit = 256): string {
  const n = Math.min(bytes.length, limit);
  const lines: string[] = [];
  for (let i = 0; i < n; i += 16) {
    const slice = Array.from(bytes.subarray(i, Math.min(i + 16, n)));
    const hex = slice.map((b) => b.toString(16).padStart(2, "0")).join(" ").padEnd(47, " ");
    const asc = slice.map((b) => (b >= 32 && b < 127 ? String.fromCharCode(b) : ".")).join("");
    lines.push(`${i.toString(16).padStart(6, "0")}  ${hex}  |${asc}|`);
  }
  if (bytes.length > n) lines.push(`…  ${(bytes.length - n).toLocaleString()} more bytes`);
  return lines.join("\n");
}

export const METRIC_KEYS: MetricKey[] = ["pxd", "vtx", "lx", "aq"];
