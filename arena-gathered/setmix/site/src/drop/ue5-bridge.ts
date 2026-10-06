/* ============================================================================
 *  scripts/ue5-bridge.ts
 *  ---------------------------------------------------------------------------
 *  THE DUAL-HORIZON BRIDGE.  Browser on monitor 1, Unreal on monitor 2.
 *
 *      bun run scripts/ue5-bridge.ts --port 8787
 *      node --experimental-strip-types scripts/ue5-bridge.ts
 *
 *  The browser client is authoritative: it owns the 120 Hz NetBus and the
 *  cartridge graphs. Unreal is a VIEWER that happens to be photorealistic.
 *  That asymmetry is the whole design — it means the game is never waiting
 *  on the editor, and closing Unreal cannot desync a session.
 *
 *  WIRE FORMAT: a 16-byte header plus a payload. Binary because at 120 Hz a
 *  JSON rover transform is ~180 bytes and this is 32; over an 8-hour session
 *  that is 600 MB versus 110 MB, on localhost, for no benefit.
 *
 *    0  u32  magic  'SMXL' 0x534D584C
 *    4  u8   version
 *    5  u8   opcode
 *    6  u16  flags
 *    8  u32  tick
 *   12  u32  payloadBytes
 *   16  …    payload
 *
 *  Zero npm dependencies: the WebSocket upgrade and RFC-6455 framing are
 *  implemented against `node:net`, because adding `ws` to a monorepo that
 *  prides itself on having none would be embarrassing.
 * ==========================================================================*/

/*  node:net and node:crypto are imported LAZILY inside createBridge() so that
 *  this module stays importable from the browser. apps/web uses the protocol
 *  half (encode/decode/Payload/connectLiveLink); only the CLI touches the
 *  server half. One file, two environments, no build-time branching. */
type Socket = {
  setNoDelay(v: boolean): void;
  write(b: Uint8Array | string): void;
  end(s?: string): void;
  destroy(): void;
  on(ev: string, fn: (...a: never[]) => void): void;
  writableLength: number;
};

/* ───────────────────────────────────────────────────── the protocol ──── */

export const MAGIC = 0x534d584c; // 'SMXL'
export const VERSION = 1;

export enum Op {
  HELLO = 0x01,
  HEARTBEAT = 0x02,
  /** four floats: the entire visual state of the planet */
  FIDELITY = 0x10,
  /** a cartridge graph changed — recompile the Substrate material */
  CARTRIDGE = 0x11,
  /** one VarDecl moved — scalar parameter poke, no recompile */
  VARIABLE = 0x12,
  /** terraform wave front — deform the Nanite landscape */
  WAVE = 0x20,
  /** sculpted SDF delta for one chunk */
  CHUNK_DELTA = 0x21,
  /** rover transform at 120 Hz */
  ROVER = 0x30,
  /** avatar transform */
  AVATAR = 0x31,
  /** mode switch; UE mirrors the camera when in FOLLOW */
  MODE = 0x32,
  /** request a full state resync (UE just connected or fell behind) */
  RESYNC = 0x40,
  /** UE → browser: "I am ready / I dropped frames / I errored" */
  ACK = 0x41,
}

export const HEADER_BYTES = 16;

export function encode(op: Op, tick: number, payload: Uint8Array, flags = 0): Uint8Array {
  const out = new Uint8Array(HEADER_BYTES + payload.length);
  const dv = new DataView(out.buffer);
  dv.setUint32(0, MAGIC, true);
  dv.setUint8(4, VERSION);
  dv.setUint8(5, op);
  dv.setUint16(6, flags, true);
  dv.setUint32(8, tick >>> 0, true);
  dv.setUint32(12, payload.length, true);
  out.set(payload, HEADER_BYTES);
  return out;
}

export interface Decoded { op: Op; tick: number; flags: number; payload: Uint8Array }

export function decode(buf: Uint8Array): Decoded | null {
  if (buf.length < HEADER_BYTES) return null;
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  if (dv.getUint32(0, true) !== MAGIC) return null;
  if (dv.getUint8(4) !== VERSION) return null;
  const len = dv.getUint32(12, true);
  if (buf.length < HEADER_BYTES + len) return null;
  return {
    op: dv.getUint8(5) as Op,
    flags: dv.getUint16(6, true),
    tick: dv.getUint32(8, true),
    payload: buf.subarray(HEADER_BYTES, HEADER_BYTES + len),
  };
}

/* ── payload builders (the only place layouts are defined) ───────────── */

export const Payload = {
  fidelity(pxd: number, vtx: number, lx: number, aq: number): Uint8Array {
    const b = new Uint8Array(16);
    new DataView(b.buffer).setFloat32(0, pxd, true);
    new DataView(b.buffer).setFloat32(4, vtx, true);
    new DataView(b.buffer).setFloat32(8, lx, true);
    new DataView(b.buffer).setFloat32(12, aq, true);
    return b;
  },
  /** pos xyz + yaw + speed + drift, 24 bytes. 120 Hz × 24 B = 2.9 kB/s. */
  transform(x: number, y: number, z: number, yaw: number, speed = 0, drift = 0): Uint8Array {
    const b = new Uint8Array(24);
    const dv = new DataView(b.buffer);
    dv.setFloat32(0, x, true); dv.setFloat32(4, y, true); dv.setFloat32(8, z, true);
    dv.setFloat32(12, yaw, true); dv.setFloat32(16, speed, true); dv.setFloat32(20, drift, true);
    return b;
  },
  wave(ox: number, oz: number, radius: number, thickness: number, dir: number): Uint8Array {
    const b = new Uint8Array(20);
    const dv = new DataView(b.buffer);
    dv.setFloat32(0, ox, true); dv.setFloat32(4, oz, true);
    dv.setFloat32(8, radius, true); dv.setFloat32(12, thickness, true);
    dv.setFloat32(16, dir, true);
    return b;
  },
  /** UTF-8 JSON — used only for cartridge graphs, which change rarely */
  json(v: unknown): Uint8Array {
    return new TextEncoder().encode(JSON.stringify(v));
  },
};

/* ═══════════════════════════════════ RFC-6455, the parts we actually use ═ */

const GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";

type NodeNet = { createServer(cb: (s: Socket) => void): {
  listen(p: number, cb: () => void): void; close(): void } };
type NodeCrypto = { createHash(a: string): {
  update(s: string): { digest(e: string): string } } };

function acceptKey(crypto: NodeCrypto, key: string): string {
  return crypto.createHash("sha1").update(key + GUID).digest("base64");
}

/** Server→client frames are never masked; we only ever send binary. */
function frame(payload: Uint8Array): Uint8Array {
  const n = payload.length;
  let header: Uint8Array;
  if (n < 126) {
    header = new Uint8Array(2);
    header[0] = 0x82;            // FIN | opcode 2 (binary)
    header[1] = n;
  } else if (n < 65536) {
    header = new Uint8Array(4);
    header[0] = 0x82; header[1] = 126;
    new DataView(header.buffer).setUint16(2, n, false);
  } else {
    header = new Uint8Array(10);
    header[0] = 0x82; header[1] = 127;
    new DataView(header.buffer).setBigUint64(2, BigInt(n), false);
  }
  const out = new Uint8Array(header.length + n);
  out.set(header, 0);
  out.set(payload, header.length);
  return out;
}

/** Client→server frames ARE masked. Returns [payload, bytesConsumed]. */
function unframe(buf: Uint8Array): [Uint8Array, number] | null {
  if (buf.length < 2) return null;
  const masked = (buf[1] & 0x80) !== 0;
  let len = buf[1] & 0x7f;
  let o = 2;
  if (len === 126) {
    if (buf.length < 4) return null;
    len = new DataView(buf.buffer, buf.byteOffset).getUint16(2, false);
    o = 4;
  } else if (len === 127) {
    if (buf.length < 10) return null;
    len = Number(new DataView(buf.buffer, buf.byteOffset).getBigUint64(2, false));
    o = 10;
  }
  const maskLen = masked ? 4 : 0;
  if (buf.length < o + maskLen + len) return null;
  const mask = buf.subarray(o, o + maskLen);
  const data = buf.subarray(o + maskLen, o + maskLen + len).slice();
  if (masked) for (let i = 0; i < data.length; i++) data[i] ^= mask[i & 3];
  return [data, o + maskLen + len];
}

/* ═══════════════════════════════════════════════════════ the bridge ══ */

export interface BridgeClient {
  id: number;
  kind: "BROWSER" | "UNREAL" | "UNKNOWN";
  socket: Socket;
  alive: boolean;
  lastTick: number;
  sent: number;
  dropped: number;
  buffer: Uint8Array;
}

export interface BridgeStats {
  clients: number;
  browsers: number;
  unreals: number;
  framesIn: number;
  framesOut: number;
  bytesIn: number;
  bytesOut: number;
  coalesced: number;
  uptimeMs: number;
}

export interface BridgeOptions {
  port?: number;
  /** ops that may be dropped if a viewer falls behind — transforms, not edits */
  coalescable?: Op[];
  /** max queued frames per client before coalescing kicks in */
  highWater?: number;
  log?: (m: string) => void;
}

const DEFAULT_COALESCABLE = [Op.ROVER, Op.AVATAR, Op.FIDELITY, Op.WAVE, Op.HEARTBEAT];

export async function createBridge(opts: BridgeOptions = {}) {
  const net = (await import(/* @vite-ignore */ "node:net")) as unknown as NodeNet;
  const crypto = (await import(/* @vite-ignore */ "node:crypto")) as unknown as NodeCrypto;
  const port = opts.port ?? 8787;
  const coalescable = new Set(opts.coalescable ?? DEFAULT_COALESCABLE);
  const highWater = opts.highWater ?? 4;
  const log = opts.log ?? ((m: string) => console.log(`[ue5-bridge] ${m}`));

  const clients = new Map<number, BridgeClient>();
  /** per-client, per-op latest frame — this IS the coalescing buffer */
  const pending = new Map<number, Map<Op, Uint8Array>>();
  let nextId = 1;
  const t0 = Date.now();
  const stats: BridgeStats = {
    clients: 0, browsers: 0, unreals: 0, framesIn: 0, framesOut: 0,
    bytesIn: 0, bytesOut: 0, coalesced: 0, uptimeMs: 0,
  };

  const server = net.createServer((socket: Socket) => {
    const id = nextId++;
    const client: BridgeClient = {
      id, kind: "UNKNOWN", socket, alive: true,
      lastTick: 0, sent: 0, dropped: 0, buffer: new Uint8Array(0),
    };
    let upgraded = false;
    socket.setNoDelay(true);     // Nagle would add 40 ms to a 120 Hz stream

    socket.on("data", (chunk: Buffer) => {
      stats.bytesIn += chunk.length;

      /* ── HTTP upgrade ──────────────────────────────────────────── */
      if (!upgraded) {
        const text = chunk.toString("latin1");
        const key = /sec-websocket-key:\s*(.+)/i.exec(text)?.[1]?.trim();
        if (!key) { socket.end("HTTP/1.1 400 Bad Request\r\n\r\n"); return; }
        const kind = /x-setmix-client:\s*unreal/i.test(text) ? "UNREAL" : "BROWSER";
        client.kind = kind;
        socket.write(
          "HTTP/1.1 101 Switching Protocols\r\n" +
          "Upgrade: websocket\r\nConnection: Upgrade\r\n" +
          `Sec-WebSocket-Accept: ${acceptKey(crypto, key)}\r\n\r\n`,
        );
        upgraded = true;
        clients.set(id, client);
        pending.set(id, new Map());
        log(`+ client ${id} (${kind}) — ${clients.size} connected`);
        // a late-joining Unreal needs the world; ask the browser for one
        if (kind === "UNREAL") broadcast(Op.RESYNC, 0, new Uint8Array(0), "BROWSER");
        return;
      }

      /* ── frame reassembly ──────────────────────────────────────── */
      const merged = new Uint8Array(client.buffer.length + chunk.length);
      merged.set(client.buffer, 0);
      merged.set(new Uint8Array(chunk), client.buffer.length);
      let rest = merged;
      for (;;) {
        const r = unframe(rest);
        if (!r) break;
        const [payload, consumed] = r;
        rest = rest.subarray(consumed);
        const msg = decode(payload);
        if (!msg) continue;
        stats.framesIn++;
        client.lastTick = msg.tick;
        // browser → every unreal; unreal ACKs → the browser
        broadcast(msg.op, msg.tick, msg.payload,
          client.kind === "BROWSER" ? "UNREAL" : "BROWSER", msg.flags);
      }
      client.buffer = rest.slice();
    });

    const bye = () => {
      clients.delete(id);
      pending.delete(id);
      log(`- client ${id} (${client.kind}) — ${clients.size} connected`);
    };
    socket.on("close", bye);
    socket.on("error", bye);
  });

  /**
   *  COALESCING, and why it is correct.
   *  Transform and fidelity frames are IDEMPOTENT SNAPSHOTS: frame N+1 fully
   *  supersedes frame N. If a viewer stalls — Unreal compiling a shader, say —
   *  queueing 400 stale rover positions helps nobody. We keep only the latest
   *  per opcode. Cartridge and chunk edits are NOT in that set: those are
   *  deltas, and dropping one would silently corrupt the mirror.
   */
  function broadcast(op: Op, tick: number, payload: Uint8Array, to: BridgeClient["kind"], flags = 0) {
    const packet = frame(encode(op, tick, payload, flags));
    for (const c of clients.values()) {
      if (c.kind !== to) continue;
      const q = pending.get(c.id)!;
      const backlog = c.socket.writableLength;
      if (backlog > highWater * 65536 && coalescable.has(op)) {
        q.set(op, packet);                 // supersede, do not queue
        c.dropped++;
        stats.coalesced++;
        continue;
      }
      // flush any superseded frames first so ordering stays sane
      for (const [, held] of q) { c.socket.write(held); stats.framesOut++; }
      q.clear();
      c.socket.write(packet);
      c.sent++;
      stats.framesOut++;
      stats.bytesOut += packet.length;
    }
  }

  return {
    listen() {
      server.listen(port, () => {
        log(`listening on ws://localhost:${port}`);
        log(`  browser : connect with new WebSocket("ws://localhost:${port}")`);
        log(`  unreal  : header  X-SetMix-Client: unreal`);
      });
      return server;
    },
    close() { for (const c of clients.values()) c.socket.destroy(); server.close(); },
    send(op: Op, tick: number, payload: Uint8Array) { broadcast(op, tick, payload, "UNREAL"); },
    stats(): BridgeStats {
      stats.clients = clients.size;
      stats.browsers = [...clients.values()].filter((c) => c.kind === "BROWSER").length;
      stats.unreals = [...clients.values()].filter((c) => c.kind === "UNREAL").length;
      stats.uptimeMs = Date.now() - t0;
      return { ...stats };
    },
  };
}

/* ─────────────────────────────── the browser side, for apps/web ───────── */

export interface LiveLinkClient {
  connected: boolean;
  send(op: Op, tick: number, payload: Uint8Array): void;
  close(): void;
}

/**
 *  Drop-in for the web client. Fails SILENTLY and permanently if the bridge
 *  is not running — live-link is a development luxury and must never be able
 *  to stall or crash the game.
 */
export function connectLiveLink(
  url = "ws://localhost:8787",
  onMessage?: (d: Decoded) => void,
): LiveLinkClient {
  let ws: WebSocket | null = null;
  const state = { connected: false };
  try {
    ws = new WebSocket(url);
    ws.binaryType = "arraybuffer";
    ws.onopen = () => { state.connected = true; };
    ws.onclose = () => { state.connected = false; };
    ws.onerror = () => { state.connected = false; };
    ws.onmessage = (e) => {
      const d = decode(new Uint8Array(e.data as ArrayBuffer));
      if (d && onMessage) onMessage(d);
    };
  } catch { /* no bridge: the game does not care */ }

  return {
    get connected() { return state.connected; },
    send(op, tick, payload) {
      if (ws && state.connected && ws.readyState === 1) ws.send(encode(op, tick, payload));
    },
    close() { ws?.close(); },
  };
}

/* ───────────────────────────────────────────────────────────── CLI ───── */

const isMain =
  typeof process !== "undefined" &&
  !!process.argv?.[1] &&
  /ue5-bridge/.test(process.argv[1]);

if (isMain) {
  const portArg = process.argv.indexOf("--port");
  const port = portArg > 0 ? Number(process.argv[portArg + 1]) : 8787;
  void createBridge({ port }).then((bridge) => {
    bridge.listen();
    setInterval(() => {
      const s = bridge.stats();
      if (s.clients === 0) return;
      console.log(
        `[ue5-bridge] ${s.browsers}B/${s.unreals}UE · in ${s.framesIn} out ${s.framesOut} ` +
        `· coalesced ${s.coalesced} · ${(s.bytesOut / 1024).toFixed(0)} kB sent`,
      );
    }, 5000);
  });
}
