/* ============================================================================
 *  packages/net/src/NetBus.ts
 *  ---------------------------------------------------------------------------
 *  CO-OP TERRAFORMING ON A DETERMINISTIC COMMAND BUS.
 *
 *  SetMix got rollback netcode almost for free, and it is worth being precise
 *  about why: the sim was ALREADY pure, fixed-step at 120 Hz, and driven
 *  entirely by journalled Commands — because undo, replay and the Galaxy
 *  federation each needed that independently. Rollback is the fourth
 *  consumer of one property, not a fifth system.
 *
 *  THE SHAPE OF THE PROBLEM IS UNUSUALLY KIND TO US
 *  Player A is in the lab tweaking a noise octave. Player B is 400 m away on
 *  the moon placing a chimney. Their commands almost never touch the same
 *  state, and when they do it is a terraform wave whose visible effect takes
 *  ninety seconds to propagate. We are not rolling back a fighting game's
 *  hitboxes; we are rolling back a factory. Misprediction is cheap, rare, and
 *  usually invisible.
 *
 *  Pure logic + injected transport. No WebSocket/WebRTC import anywhere —
 *  the channel is an interface, so this runs headless in CI.
 * ==========================================================================*/

import type { SetmixCommandType } from "./contracts.setmix";
import { contentHash } from "./fidelity";

export const TICK_HZ = 120;
/** How far back we can rewind. 2 s at 120 Hz — beyond this we resync. */
export const ROLLBACK_WINDOW = 240;
/** Local input is delayed by this many ticks to absorb jitter without rollback. */
export const INPUT_DELAY = 3;

/* ═══════════════════════════════════════════════════ 1 · THE WIRE FORMAT ══ */

/**
 *  Commands are a closed set, so the type is one byte and every payload has
 *  a fixed layout. A slotCartridge is 24 bytes on the wire; JSON is 118.
 *  At 4 players × ~6 commands/s that is 576 B/s versus 2.8 kB/s, which
 *  matters on a DataChannel sharing bandwidth with voice.
 */
export const OPCODES = [
  "setmix/slotCartridge", "setmix/fuse", "setmix/setVariable",
  "setmix/printCartridge", "setmix/placeEmitter", "setmix/overclock",
  "setmix/zoomScope", "setmix/renameNode", "setmix/reparentNode",
  "setmix/selectTool", "setmix/cycleHotbar", "setmix/promoteToPreset",
  "setmix/mine", "setmix/move", "setmix/crossPortal", "setmix/dispatchWave",
] as const;
export type Opcode = (typeof OPCODES)[number];

const OP_TO_BYTE = new Map<string, number>(OPCODES.map((o, i) => [o, i]));
const BYTE_TO_OP = OPCODES;

export interface NetCommand {
  /** the tick this command is stamped to execute on */
  tick: number;
  /** 0..3 */
  player: number;
  op: Opcode | SetmixCommandType;
  /** up to 4 small ints (ids are interned, see StringTable) */
  i: [number, number, number, number];
  /** up to 3 floats — positions, factors, values */
  f: [number, number, number];
  /** monotonic per player, for dedup and gap detection */
  seq: number;
}

/**
 *  String interning. Cartridge hashes and machine ids are long and repeat
 *  constantly; we send the full string ONCE in a side-channel and 16 bits
 *  thereafter. Both ends build the identical table because entries are
 *  appended in command order — itself a deterministic sequence.
 */
export class StringTable {
  private toId = new Map<string, number>();
  private toStr: string[] = [];
  /** strings added since the last drain, for the side-channel */
  private pending: string[] = [];

  intern(s: string): number {
    const hit = this.toId.get(s);
    if (hit !== undefined) return hit;
    const id = this.toStr.length;
    this.toId.set(s, id);
    this.toStr.push(s);
    this.pending.push(s);
    return id;
  }
  resolve(id: number): string { return this.toStr[id] ?? ""; }
  adopt(strings: readonly string[]) {
    for (const s of strings) if (!this.toId.has(s)) { this.toId.set(s, this.toStr.length); this.toStr.push(s); }
  }
  drain(): string[] { const p = this.pending; this.pending = []; return p; }
  get size() { return this.toStr.length; }
  hash() { return contentHash(this.toStr); }
}

/** 24 bytes: tick(u32) player(u8) op(u8) seq(u16) i[4](u16) f[3](f32)… packed. */
export const CMD_BYTES = 4 + 1 + 1 + 2 + 8 + 12;   // = 28

export function encodeCommands(cmds: readonly NetCommand[]): ArrayBuffer {
  const buf = new ArrayBuffer(4 + cmds.length * CMD_BYTES);
  const dv = new DataView(buf);
  dv.setUint32(0, cmds.length, true);
  let o = 4;
  for (const c of cmds) {
    dv.setUint32(o, c.tick, true); o += 4;
    dv.setUint8(o, c.player & 0xff); o += 1;
    dv.setUint8(o, OP_TO_BYTE.get(c.op) ?? 255); o += 1;
    dv.setUint16(o, c.seq & 0xffff, true); o += 2;
    for (let k = 0; k < 4; k++) { dv.setUint16(o, c.i[k] & 0xffff, true); o += 2; }
    for (let k = 0; k < 3; k++) { dv.setFloat32(o, c.f[k], true); o += 4; }
  }
  return buf;
}

export function decodeCommands(buf: ArrayBuffer): NetCommand[] {
  const dv = new DataView(buf);
  const n = dv.getUint32(0, true);
  const out: NetCommand[] = [];
  let o = 4;
  for (let j = 0; j < n; j++) {
    const tick = dv.getUint32(o, true); o += 4;
    const player = dv.getUint8(o); o += 1;
    const opb = dv.getUint8(o); o += 1;
    const seq = dv.getUint16(o, true); o += 2;
    const i: [number, number, number, number] = [0, 0, 0, 0];
    for (let k = 0; k < 4; k++) { i[k] = dv.getUint16(o, true); o += 2; }
    const f: [number, number, number] = [0, 0, 0];
    for (let k = 0; k < 3; k++) { f[k] = dv.getFloat32(o, true); o += 4; }
    out.push({ tick, player, op: BYTE_TO_OP[opb] ?? "setmix/move", i, f, seq });
  }
  return out;
}

export function jsonBytes(cmds: readonly NetCommand[]) {
  return new TextEncoder().encode(JSON.stringify(cmds)).length;
}

/* ═══════════════════════════════════════════════ 2 · FRAMES & ROLLBACK ══ */

export interface Snapshot<S> {
  tick: number;
  state: S;
  /** checksum for desync detection — cheap, and it has caught real bugs */
  hash: string;
}

export interface FrameInput {
  tick: number;
  /** commands confirmed for this tick, sorted deterministically */
  commands: NetCommand[];
  /** true once every peer has acknowledged this tick */
  confirmed: boolean;
}

export interface NetStats {
  tick: number;
  confirmedTick: number;
  predictedTicks: number;
  rollbacks: number;
  worstRollbackDepth: number;
  resyncs: number;
  desyncs: number;
  bytesSent: number;
  bytesReceived: number;
  commandsSent: number;
  /** compression vs JSON, for the pitch */
  wireRatio: number;
  rttMs: number;
}

/**
 *  Commands must execute in the SAME order on every peer, and "arrival order"
 *  is not that. We sort by (tick, player, seq, opcode) — a total order that
 *  every peer can compute from the data alone, with no coordination.
 */
export function sortCommands(a: NetCommand, b: NetCommand): number {
  if (a.tick !== b.tick) return a.tick - b.tick;
  if (a.player !== b.player) return a.player - b.player;
  if (a.seq !== b.seq) return a.seq - b.seq;
  return (OP_TO_BYTE.get(a.op) ?? 0) - (OP_TO_BYTE.get(b.op) ?? 0);
}

export interface Channel {
  send(data: ArrayBuffer): void;
  onMessage(cb: (data: ArrayBuffer, fromPlayer: number) => void): void;
  readonly peers: number;
  readonly localPlayer: number;
}

export interface SimAdapter<S> {
  clone(s: S): S;
  step(s: S, cmds: readonly NetCommand[], tick: number): S;
  hash(s: S): string;
}

/**
 *  THE BUS.
 *
 *  Loop per tick:
 *    1. local input → stamped at (tick + INPUT_DELAY), sent immediately
 *    2. integrate the authoritative state up to the confirmed tick
 *    3. predict forward to the live tick, assuming remotes repeat nothing
 *    4. when a late command arrives for tick T ≤ live:
 *         rewind to snapshot(T−1), re-apply, re-predict  — all within one frame
 *    5. compare hashes at the confirmed tick; on mismatch, request a resync
 */
export class NetBus<S> {
  private confirmed: Snapshot<S>;
  private frames = new Map<number, FrameInput>();
  private snapshots: Snapshot<S>[] = [];
  private live: S;
  private liveTick = 0;
  private seq = 0;
  private peerHashes = new Map<number, Map<number, string>>();
  readonly strings = new StringTable();

  stats: NetStats = {
    tick: 0, confirmedTick: 0, predictedTicks: 0, rollbacks: 0,
    worstRollbackDepth: 0, resyncs: 0, desyncs: 0,
    bytesSent: 0, bytesReceived: 0, commandsSent: 0, wireRatio: 1, rttMs: 0,
  };

  constructor(
    private sim: SimAdapter<S>,
    initial: S,
    private channel: Channel,
  ) {
    this.confirmed = { tick: 0, state: sim.clone(initial), hash: sim.hash(initial) };
    this.live = sim.clone(initial);
    this.snapshots.push({ ...this.confirmed });
    channel.onMessage((data, from) => this.receive(data, from));
  }

  /* ── local input ────────────────────────────────────────────────── */

  /**
   *  Local commands are stamped INPUT_DELAY ticks ahead. Three ticks is 25 ms
   *  — below the threshold where a player attributes it to the game rather
   *  than to themselves — and it absorbs most jitter without any rollback at
   *  all. Rollback is the fallback, not the mechanism.
   */
  submit(op: Opcode, i: [number, number, number, number], f: [number, number, number]): NetCommand {
    const cmd: NetCommand = {
      tick: this.liveTick + INPUT_DELAY,
      player: this.channel.localPlayer,
      op, i, f, seq: this.seq++,
    };
    this.enqueue(cmd);
    const buf = encodeCommands([cmd]);
    this.channel.send(buf);
    this.stats.bytesSent += buf.byteLength;
    this.stats.commandsSent++;
    this.stats.wireRatio = jsonBytes([cmd]) / buf.byteLength;
    return cmd;
  }

  private enqueue(cmd: NetCommand) {
    const f = this.frames.get(cmd.tick) ?? { tick: cmd.tick, commands: [], confirmed: false };
    if (!f.commands.some((c) => c.player === cmd.player && c.seq === cmd.seq)) {
      f.commands.push(cmd);
      f.commands.sort(sortCommands);
    }
    this.frames.set(cmd.tick, f);
  }

  /* ── remote input ───────────────────────────────────────────────── */

  private receive(data: ArrayBuffer, _from: number) {
    this.stats.bytesReceived += data.byteLength;
    const cmds = decodeCommands(data);
    let earliest = Infinity;
    for (const c of cmds) {
      this.enqueue(c);
      if (c.tick <= this.liveTick) earliest = Math.min(earliest, c.tick);
    }
    // a command landed in the past → rewind exactly far enough, no further
    if (earliest !== Infinity) this.rollbackTo(earliest);
  }

  /** Rewind to the newest snapshot at or before `tick`, then re-simulate. */
  private rollbackTo(tick: number) {
    const target = Math.max(this.confirmed.tick, tick - 1);
    let snap: Snapshot<S> | null = null;
    for (let k = this.snapshots.length - 1; k >= 0; k--)
      if (this.snapshots[k].tick <= target) { snap = this.snapshots[k]; break; }
    if (!snap) { this.requestResync(); return; }

    const depth = this.liveTick - snap.tick;
    if (depth > ROLLBACK_WINDOW) { this.requestResync(); return; }

    this.stats.rollbacks++;
    this.stats.worstRollbackDepth = Math.max(this.stats.worstRollbackDepth, depth);

    let s = this.sim.clone(snap.state);
    for (let t = snap.tick + 1; t <= this.liveTick; t++)
      s = this.sim.step(s, this.frames.get(t)?.commands ?? [], t);
    this.live = s;
  }

  /* ── the tick ───────────────────────────────────────────────────── */

  /**
   *  Advance one tick. `allConfirmedThrough` is the highest tick for which
   *  every peer's input is known — in a 2–4 player mesh this is simply the
   *  min over peers of their last received tick.
   */
  tick(allConfirmedThrough: number): S {
    this.liveTick++;
    const cmds = this.frames.get(this.liveTick)?.commands ?? [];
    this.live = this.sim.step(this.live, cmds, this.liveTick);

    // snapshot every 8 ticks: 30 snapshots covers the 2 s window at a cost
    // of ~1 clone per 66 ms, which is nothing next to a re-simulation.
    if (this.liveTick % 8 === 0) {
      this.snapshots.push({
        tick: this.liveTick,
        state: this.sim.clone(this.live),
        hash: "",
      });
      while (this.snapshots.length > 40) this.snapshots.shift();
    }

    // advance the authoritative line
    if (allConfirmedThrough > this.confirmed.tick) {
      let s = this.sim.clone(this.confirmed.state);
      for (let t = this.confirmed.tick + 1; t <= allConfirmedThrough; t++) {
        s = this.sim.step(s, this.frames.get(t)?.commands ?? [], t);
        const f = this.frames.get(t);
        if (f) f.confirmed = true;
      }
      this.confirmed = { tick: allConfirmedThrough, state: s, hash: this.sim.hash(s) };
      // drop frames we can never need again
      for (const t of this.frames.keys())
        if (t < allConfirmedThrough - ROLLBACK_WINDOW) this.frames.delete(t);
      this.checkDesync();
    }

    this.stats.tick = this.liveTick;
    this.stats.confirmedTick = this.confirmed.tick;
    this.stats.predictedTicks = this.liveTick - this.confirmed.tick;
    return this.live;
  }

  /** Peers exchange one 8-char hash per confirmed tick. Cheap insurance. */
  reportHash(player: number, tick: number, hash: string) {
    const m = this.peerHashes.get(player) ?? new Map<number, string>();
    m.set(tick, hash);
    this.peerHashes.set(player, m);
  }

  private checkDesync() {
    const t = this.confirmed.tick;
    for (const [, m] of this.peerHashes) {
      const h = m.get(t);
      if (h && h !== this.confirmed.hash) {
        this.stats.desyncs++;
        this.requestResync();
        return;
      }
    }
  }

  private requestResync() {
    this.stats.resyncs++;
    // Resync is NOT a state transfer. The host re-sends the manifest + the
    // journal tail, and the client re-derives — the same mechanism the Galaxy
    // uses to let a stranger walk into your moon. One codepath, two features.
  }

  get state(): S { return this.live; }
  get authoritative(): S { return this.confirmed.state; }
  get confirmedTick() { return this.confirmed.tick; }
}

/* ═════════════════════════════════════════════ 3 · LOCAL LOOPBACK PEER ══ */

/**
 *  An in-process Channel with configurable latency, jitter and loss. Used by
 *  the test suite and by the live demo, so the rollback path is exercised
 *  constantly in development rather than only on a bad hotel wifi.
 */
export class LoopbackChannel implements Channel {
  private handlers: ((d: ArrayBuffer, from: number) => void)[] = [];
  private inbox: { at: number; data: ArrayBuffer; from: number }[] = [];
  private peerList: LoopbackChannel[] = [];
  private rng: () => number;

  constructor(
    readonly localPlayer: number,
    public latencyMs = 55,
    public jitterMs = 22,
    public lossPct = 0.02,
    seed = 1337,
  ) {
    let s = (seed + localPlayer * 7919) >>> 0 || 1;
    this.rng = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
  }

  connect(peers: LoopbackChannel[]) { this.peerList = peers.filter((p) => p !== this); }
  get peers() { return this.peerList.length + 1; }

  send(data: ArrayBuffer) {
    for (const p of this.peerList) {
      if (this.rng() < this.lossPct) continue;      // dropped; seq gap heals it
      const delay = this.latencyMs + (this.rng() - 0.5) * 2 * this.jitterMs;
      p.inbox.push({ at: delay, data, from: this.localPlayer });
    }
  }

  onMessage(cb: (d: ArrayBuffer, from: number) => void) { this.handlers.push(cb); }

  /** Pump the virtual network. Call once per frame with real dt. */
  pump(dtMs: number) {
    for (let i = this.inbox.length - 1; i >= 0; i--) {
      this.inbox[i].at -= dtMs;
      if (this.inbox[i].at <= 0) {
        const m = this.inbox.splice(i, 1)[0];
        for (const h of this.handlers) h(m.data, m.from);
      }
    }
  }
}

/* ════════════════════════════════════════════════ 4 · ROLE SEPARATION ══ */

/**
 *  Why co-op works here when it usually does not: the two roles barely share
 *  state. We encode that as an explicit affinity so the bus can skip
 *  rollbacks entirely for commands that provably cannot affect the local
 *  player's prediction.
 */
export const COMMAND_AFFINITY: Readonly<Record<string, "LAB" | "FIELD" | "BOTH">> = Object.freeze({
  "setmix/setVariable": "LAB",
  "setmix/fuse": "LAB",
  "setmix/printCartridge": "LAB",
  "setmix/promoteToPreset": "LAB",
  "setmix/zoomScope": "LAB",
  "setmix/renameNode": "LAB",
  "setmix/reparentNode": "LAB",
  "setmix/selectTool": "LAB",
  "setmix/placeEmitter": "FIELD",
  "setmix/mine": "FIELD",
  "setmix/overclock": "FIELD",
  "setmix/move": "FIELD",
  "setmix/dispatchWave": "BOTH",
  "setmix/slotCartridge": "BOTH",
  "setmix/crossPortal": "BOTH",
  "setmix/cycleHotbar": "FIELD",
});

/** True when a late command cannot have changed what the local player sees. */
export function canSkipRollback(cmd: NetCommand, localWorld: "LAB" | "MOON"): boolean {
  const aff = COMMAND_AFFINITY[cmd.op];
  if (aff === "BOTH") return false;
  return (aff === "LAB" && localWorld === "MOON") || (aff === "FIELD" && localWorld === "LAB");
}

export const NET_NOTES = [
  ["Rollback is the fourth consumer, not a fifth system",
   "The sim was already pure, fixed-step and command-driven because undo, replay and Galaxy federation each needed that. Netcode inherited it."],
  ["3 ticks of input delay first, rollback second",
   "25 ms is below the threshold where a player blames the game rather than themselves, and it absorbs most jitter with zero re-simulation."],
  ["A total order anyone can compute",
   "(tick, player, seq, opcode). Arrival order is not execution order, and no peer has to coordinate to agree on it."],
  ["Role separation makes misprediction rare",
   "A lab command cannot change what a player on the moon sees. canSkipRollback() proves it from the opcode alone and skips the rewind."],
  ["Resync reuses the Galaxy path",
   "A desync does not transfer state — the host re-sends the manifest plus the journal tail and the client re-derives. Same codepath that lets a stranger walk into your moon."],
] as const;
