/**
 * The base world: one plain-data state for a player's base, changed only by commands (docs/BASE_BUILDING_ARCHITECTURE.md
 * section 6, D6). `apply` is pure and deterministic, so a command log replays to the same state and the same hash on every
 * machine: that is what Synced mode's majority merge and Desynced mode's rollback rebase rest on.
 *
 * It joins the landed packages by id and owns no maths of theirs: @hm/structure decides where pieces may stand and what
 * falls, @hm/lattice moves items. What lives here is the game's rules between them:
 *  - building pays from the player's own grid first, then the linked network the player stands in (D9);
 *  - a bin piece is a storage box, a repeater piece is a relay, the lab's quantum bridge is the relay at the gate;
 *  - taking a piece down refunds its full cost (player first, then network); what falls in a collapse is lost (D11);
 *  - nothing may drop a bin that still holds items.
 */
import { hashValue } from '@hm/kernel';
import * as L from '@hm/lattice';
import * as S from '@hm/structure';
import * as F from '@hm/substrate';
import { DRAFT_ORE, EQUIP, FIELD_RADIUS, HEAVY, HEAVY_BILL, ITEMS, MAPS, MATERIALS, PIECE_EXTRA, PIECE_ORE, PRIMITIVES, QUEUE_MAX, RECIPE_BY_ID, STARTER, blueprint, blueprintId, pieceCost, type HeavyKind, type MapId, type PrimitiveId } from './catalog';
import { EQUIP_SLOTS, type EquipSlot, type SlotRef } from './view';

export const PLAYER = -1;
export const BRIDGE = 0;
export const PLAYER_SLOTS = 36;
export const PLAYER_KG = 120;
export const BIN_SLOTS = 24;
export const BIN_KG = 2000;
export const REPEATER_RANGE = 40;
/** The lab quantum bridge reaches this far from the gate (metres): the base network every new player starts with. */
export const BRIDGE_RANGE = 60;
/** How close the player must stand to a Drafting Table (a bench piece) to draft, metres. */
export const BENCH_REACH = 5;
/** How far the Extraction Beam reaches, metres. */
export const BEAM_RANGE = 12;

export interface Point { readonly x: number; readonly z: number }

export interface BaseWorld {
  readonly v: 2;
  /** Commands applied so far: the position in the command log. */
  readonly tick: number;
  readonly base: S.Base;
  /** One box per bin piece; a box's id is its piece's id. */
  readonly boxes: readonly L.Box[];
  /** The player's grid (id PLAYER). Slots 0..8 are the hotbar (D5). Its x/z are ignored: commands carry `at`. */
  readonly player: L.Box;
  readonly equipment: Readonly<Record<EquipSlot, L.Stack | null>>;
  readonly hotbar: number;
  /** The plot's fidelity stage, which decides what the anomaly field grows. */
  readonly stage: number;
  /** The plot's anomaly nodes (@hm/substrate). */
  readonly field: F.Field;
  /** Heavy machines, one per hardpoint (id = the hardpoint piece's id). */
  readonly machines: readonly Machine[];
}

export interface Job { readonly recipe: string; readonly done: number }
export interface Machine {
  readonly id: number;
  readonly kind: HeavyKind;
  /** The running job first, then the waiting ones. */
  readonly jobs: readonly Job[];
  /** Finished output the network had no room for; the player collects it. */
  readonly out: readonly L.Stack[];
}

export interface WorldEnv {
  heightAt(x: number, z: number): number;
  /** The lab's quantum bridge: every box within its range of the gate shares one network. */
  readonly bridge: Point & { readonly range: number };
}

type PieceSpec = Omit<S.Piece, 'id' | 'mat'>;

export type BaseCommand =
  | { readonly t: 'found'; readonly at: Point; readonly blueprint: string; readonly cx: number; readonly cz: number; readonly yaw: number }
  | { readonly t: 'place'; readonly at: Point; readonly blueprint: string; readonly piece: PieceSpec }
  | { readonly t: 'remove'; readonly at: Point; readonly id: number }
  | { readonly t: 'door'; readonly id: number; readonly open: boolean }
  | { readonly t: 'move'; readonly at: Point; readonly from: SlotRef; readonly to: SlotRef; readonly n: number }
  | { readonly t: 'quickStack'; readonly at: Point }
  | { readonly t: 'draft'; readonly at: Point; readonly primitive: string; readonly map: string }
  | { readonly t: 'hotbar'; readonly index: number }
  /** One frame (logged, so replays match): the field regrows, the beam harvests, machines work at their power share (0..1, from plotsim). */
  | { readonly t: 'tick'; readonly at: Point; readonly dt: number; readonly beam: { readonly node: number; readonly power: number } | null; readonly power: Readonly<Record<number, number>> }
  | { readonly t: 'stage'; readonly stage: number }
  | { readonly t: 'install'; readonly at: Point; readonly hardpoint: number; readonly kind: HeavyKind }
  | { readonly t: 'craft'; readonly at: Point; readonly machine: number; readonly recipe: string }
  | { readonly t: 'collect'; readonly machine: number };

export type BaseEvent =
  | { readonly type: 'refused'; readonly cmd: BaseCommand['t']; readonly why: string; readonly short?: readonly L.Stack[] }
  | { readonly type: 'placed'; readonly id: number; readonly kind: S.Kind }
  | { readonly type: 'removed'; readonly id: number; readonly collapsed: readonly number[]; readonly lost: readonly L.Stack[] }
  | { readonly type: 'drafted'; readonly blueprint: string }
  | { readonly type: 'moved'; readonly n: number }
  | { readonly type: 'stacked'; readonly n: number }
  | { readonly type: 'hotbar'; readonly index: number }
  | { readonly type: 'door'; readonly id: number; readonly open: boolean }
  | { readonly type: 'harvested'; readonly items: readonly L.Stack[]; readonly lost: readonly L.Stack[] }
  | { readonly type: 'finished'; readonly machine: number; readonly item: string; readonly n: number }
  | { readonly type: 'installed'; readonly machine: number; readonly kind: HeavyKind }
  | { readonly type: 'queued'; readonly machine: number; readonly recipe: string }
  | { readonly type: 'collected'; readonly machine: number; readonly n: number }
  | { readonly type: 'stage'; readonly stage: number };

export interface Applied { readonly world: BaseWorld; readonly events: readonly BaseEvent[] }

const NO_EQUIPMENT: Record<EquipSlot, L.Stack | null> = { visor: null, shield: null, rebreather: null, beam: null, sidearm: null };

/** A new player's base: no pieces, the starter slab kit on hotbar 1, the Extraction Beam worn, the suit's visor on. */
export function createWorld(seed = 1): BaseWorld {
  const slots: (L.Stack | null)[] = Array.from({ length: PLAYER_SLOTS }, () => null);
  slots[0] = { item: STARTER, n: 1 };
  return {
    v: 2, tick: 0, base: S.empty(), boxes: [],
    player: { id: PLAYER, x: 0, z: 0, slots, maxKg: PLAYER_KG },
    equipment: { ...NO_EQUIPMENT, beam: { item: 'tool-beam', n: 1 }, visor: { item: 'eq-visor', n: 1 } },
    hotbar: 0,
    stage: 0,
    field: F.generate(seed, FIELD_RADIUS, 0),
    machines: [],
  };
}

/** The deterministic id of a world state (stable key order). */
export const hashWorld = (w: BaseWorld): string => hashValue(w);

export const structureEnv = (env: WorldEnv): S.Env => ({ heightAt: (x, z) => env.heightAt(x, z), materials: MATERIALS });

/** The world point of a piece: its cell centre (cells and fixtures), edge middle, or corner, on its floor. */
export function pieceAt(base: S.Base, p: S.Piece): { x: number; y: number; z: number } | null {
  const st = base.structures.find((s) => s.id === p.s);
  if (!st) return null;
  const C = S.CELL;
  const local = p.kind === 'wall' || p.kind === 'airlock'
    ? (p.r === 0 ? [(p.i + 0.5) * C, p.j * C] : [p.i * C, (p.j + 0.5) * C])
    : p.kind === 'pillar' ? [p.i * C, p.j * C]
      : p.kind === 'hardpoint' ? [(p.i + 1) * C, (p.j + 1) * C]
        : [(p.i + 0.5) * C, (p.j + 0.5) * C];
  return S.toWorld(st, local[0]!, local[1]!, p.k);
}

export function relays(w: BaseWorld, env: WorldEnv): L.Relay[] {
  const out: L.Relay[] = [{ id: BRIDGE, x: env.bridge.x, z: env.bridge.z, range: env.bridge.range }];
  for (const p of w.base.pieces) {
    if (p.kind !== 'repeater') continue;
    const at = pieceAt(w.base, p);
    if (at) out.push({ id: p.id, x: at.x, z: at.z, range: REPEATER_RANGE });
  }
  return out;
}

/** The box ids of the network the player stands in (ascending), or [] out of every relay's range. */
export function networkAt(w: BaseWorld, env: WorldEnv, at: Point): number[] {
  const probe: L.Box = { id: PLAYER, x: at.x, z: at.z, slots: [], maxKg: 0 };
  const group = L.links([...w.boxes, probe], relays(w, env)).find((g) => g.includes(PLAYER)) ?? [];
  return group.filter((id) => id !== PLAYER);
}

/** All the boxes a command may touch, with the player's grid standing at `at` (so it is always the nearest). */
const withPlayer = (w: BaseWorld, at: Point): L.Box[] => [{ ...w.player, x: at.x, z: at.z }, ...w.boxes];
const split = (w: BaseWorld, all: readonly L.Box[]): Pick<BaseWorld, 'player' | 'boxes'> => ({
  player: { ...all[0]!, x: w.player.x, z: w.player.z },
  boxes: all.slice(1),
});

/** The full cost of a placed piece, from its kind and material (blueprint pieces add their map). */
export function costOf(kind: S.Kind, mat: string): L.Stack[] {
  const bill: L.Stack[] = [{ item: 'ore', n: PIECE_ORE[kind] }];
  if (mat !== 'regolith' && (MAPS as readonly string[]).includes(mat)) bill.push({ item: `map-${mat}`, n: 1 });
  return [...bill, ...(PIECE_EXTRA[kind] ?? [])];
}

const owns = (w: BaseWorld, item: string): boolean => L.count(w.player, item) > 0;
const refuse = (w: BaseWorld, cmd: BaseCommand['t'], why: string, short?: readonly L.Stack[]): Applied =>
  ({ world: w, events: [short ? { type: 'refused', cmd, why, short } : { type: 'refused', cmd, why }] });
const next = (w: BaseWorld, patch: Partial<BaseWorld>, events: readonly BaseEvent[]): Applied =>
  ({ world: { ...w, ...patch, tick: w.tick + 1 }, events });

/** Pays `bill` from the player, then the network in reach; null when short (with what is missing). */
function pay(w: BaseWorld, env: WorldEnv, at: Point, bill: readonly L.Stack[]): { ok: true; patch: Pick<BaseWorld, 'player' | 'boxes'> } | { ok: false; short: readonly L.Stack[] } {
  const r = L.pull(withPlayer(w, at), [PLAYER, ...networkAt(w, env, at)], at, bill);
  return r.ok ? { ok: true, patch: split(w, r.boxes) } : { ok: false, short: r.short };
}

export function apply(w: BaseWorld, env: WorldEnv, cmd: BaseCommand): Applied {
  switch (cmd.t) {
    case 'hotbar': {
      if (!Number.isInteger(cmd.index) || cmd.index < 0 || cmd.index > 8) return refuse(w, cmd.t, 'bad-slot');
      return next(w, { hotbar: cmd.index }, [{ type: 'hotbar', index: cmd.index }]);
    }
    case 'found':
    case 'place':
      return build(w, env, cmd);
    case 'remove':
      return takeDown(w, env, cmd.at, cmd.id);
    case 'door': {
      const base = S.setOpen(w.base, cmd.id, cmd.open);
      if (base === w.base) return refuse(w, cmd.t, 'not-a-door');
      return next(w, { base }, [{ type: 'door', id: cmd.id, open: cmd.open }]);
    }
    case 'move':
      return move(w, env, cmd);
    case 'quickStack':
      return quickStack(w, env, cmd.at);
    case 'draft':
      return draft(w, env, cmd);
    case 'tick':
      return tick(w, env, cmd);
    case 'stage': {
      const stage = Math.max(0, Math.min(6, Math.floor(cmd.stage)));
      if (!Number.isFinite(cmd.stage) || stage === w.stage) return refuse(w, cmd.t, 'same-stage');
      return next(w, { stage, field: F.regen(w.field, FIELD_RADIUS, stage) }, [{ type: 'stage', stage }]);
    }
    case 'install':
      return install(w, env, cmd);
    case 'craft':
      return craft(w, env, cmd);
    case 'collect':
      return collect(w, cmd.machine);
  }
}

/** Applies a log of commands in order (a replay). */
export function replay(w: BaseWorld, env: WorldEnv, log: readonly BaseCommand[]): Applied {
  let world = w;
  const events: BaseEvent[] = [];
  for (const cmd of log) { const r = apply(world, env, cmd); world = r.world; events.push(...r.events); }
  return { world, events };
}

function build(w: BaseWorld, env: WorldEnv, cmd: Extract<BaseCommand, { t: 'found' | 'place' }>): Applied {
  const bp = blueprint(cmd.blueprint);
  if (!bp || !owns(w, cmd.blueprint)) return refuse(w, cmd.t, 'no-blueprint');
  const kind: S.Kind = cmd.t === 'found' ? 'foundation' : cmd.piece.kind;
  const bill = pieceCost(bp, kind);
  if (!bill) return refuse(w, cmd.t, 'wrong-kind');
  const senv = structureEnv(env);
  const r = cmd.t === 'found'
    ? S.found(w.base, senv, cmd.cx, cmd.cz, cmd.yaw, bp.mat)
    : S.place(w.base, senv, { ...cmd.piece, mat: bp.mat });
  if (!r.ok) return refuse(w, cmd.t, r.why);
  const paid = pay(w, env, cmd.at, bill);
  if (!paid.ok) return refuse(w, cmd.t, 'short', paid.short);
  let boxes = paid.patch.boxes;
  if (kind === 'bin') {
    const at = pieceAt(r.base, r.base.pieces.find((p) => p.id === r.id)!)!;
    boxes = [...boxes, L.box(r.id, at.x, at.z, BIN_SLOTS, BIN_KG)];
  }
  return next(w, { base: r.base, player: paid.patch.player, boxes }, [{ type: 'placed', id: r.id, kind }]);
}

function takeDown(w: BaseWorld, env: WorldEnv, at: Point, id: number): Applied {
  const piece = w.base.pieces.find((p) => p.id === id);
  if (!piece) return refuse(w, 'remove', 'missing');
  const full = (bid: number): boolean => { const b = w.boxes.find((x) => x.id === bid); return !!b && b.slots.some((s) => s !== null); };
  if (piece.kind === 'bin' && full(id)) return refuse(w, 'remove', 'not-empty');
  const machine = (mid: number): boolean => w.machines.some((m) => m.id === mid);
  if (machine(id)) return refuse(w, 'remove', 'has-machine');
  const r = S.remove(w.base, structureEnv(env), id);
  if (r.collapsed.some(full)) return refuse(w, 'remove', 'would-spill');
  if (r.collapsed.some(machine)) return refuse(w, 'remove', 'would-drop-machine');
  const gone = new Set([id, ...r.collapsed]);
  const kept: BaseWorld = { ...w, base: r.base, boxes: w.boxes.filter((b) => !gone.has(b.id)) };
  // the refund is stored after the piece is gone, so a removed repeater no longer links what it used to
  const ids = [PLAYER, ...networkAt(kept, env, at)];
  const s = L.store(withPlayer(kept, at), ids, at, ITEMS, costOf(piece.kind, piece.mat));
  return next(w, { base: r.base, ...split(kept, s.boxes) }, [{ type: 'removed', id, collapsed: r.collapsed, lost: s.left }]);
}

/** Reads and writes one slot of the player's grid, the suit or a networked box. */
interface SlotAccess { get(): L.Stack | null; put(s: L.Stack | null): void }

function move(w: BaseWorld, env: WorldEnv, cmd: Extract<BaseCommand, { t: 'move' }>): Applied {
  const net = new Set(networkAt(w, env, cmd.at));
  const playerSlots = w.player.slots.slice();
  const equipment: Record<EquipSlot, L.Stack | null> = { ...w.equipment };
  const boxSlots = new Map<number, (L.Stack | null)[]>();
  const access = (ref: SlotRef): SlotAccess | string => {
    if (ref.at === 'inventory') {
      if (!Number.isInteger(ref.index) || ref.index < 0 || ref.index >= playerSlots.length) return 'bad-slot';
      return { get: () => playerSlots[ref.index] ?? null, put: (s) => { playerSlots[ref.index] = s; } };
    }
    if (ref.at === 'equipment') {
      if (!EQUIP_SLOTS.includes(ref.slot)) return 'bad-slot';
      return { get: () => equipment[ref.slot], put: (s) => { equipment[ref.slot] = s; } };
    }
    const b = w.boxes.find((x) => x.id === ref.box);
    if (!b) return 'bad-slot';
    if (!net.has(b.id)) return 'out-of-range';
    if (!Number.isInteger(ref.index) || ref.index < 0 || ref.index >= b.slots.length) return 'bad-slot';
    const slots = boxSlots.get(b.id) ?? b.slots.slice();
    boxSlots.set(b.id, slots);
    return { get: () => slots[ref.index] ?? null, put: (s) => { slots[ref.index] = s; } };
  };
  if (JSON.stringify(cmd.from) === JSON.stringify(cmd.to)) return refuse(w, 'move', 'nothing');
  const from = access(cmd.from), to = access(cmd.to);
  if (typeof from === 'string') return refuse(w, 'move', from);
  if (typeof to === 'string') return refuse(w, 'move', to);
  const src = from.get(), dst = to.get();
  const want = Number.isFinite(cmd.n) ? Math.floor(cmd.n) : 0;
  if (!src || want <= 0) return refuse(w, 'move', 'nothing');
  const n = Math.min(want, src.n), spec = ITEMS[src.item];
  if (!spec) return refuse(w, 'move', 'unknown-item');
  if (cmd.to.at === 'equipment' && EQUIP[src.item] !== cmd.to.slot) return refuse(w, 'move', 'wrong-slot');
  if (cmd.to.at === 'equipment' && dst && cmd.from.at !== 'inventory') return refuse(w, 'move', 'occupied');
  let moved = n;
  if (!dst) {
    to.put({ item: src.item, n }); from.put(n === src.n ? null : { item: src.item, n: src.n - n });
  } else if (dst.item === src.item) {
    moved = Math.min(n, spec.stack - dst.n);
    if (moved <= 0) return refuse(w, 'move', 'full');
    to.put({ item: src.item, n: dst.n + moved }); from.put(moved === src.n ? null : { item: src.item, n: src.n - moved });
  } else {
    if (n !== src.n) return refuse(w, 'move', 'occupied');
    if (cmd.from.at === 'equipment' && EQUIP[dst.item] !== cmd.from.slot) return refuse(w, 'move', 'wrong-slot');
    to.put(src); from.put(dst);
  }
  const player: L.Box = { ...w.player, slots: playerSlots };
  // the suit is worn, so its weight counts with the grid
  const worn = EQUIP_SLOTS.reduce((t, k) => t + (equipment[k] ? (ITEMS[equipment[k]!.item]?.kg ?? 0) * equipment[k]!.n : 0), 0);
  const before = L.kg(w.player, ITEMS) + EQUIP_SLOTS.reduce((t, k) => t + (w.equipment[k] ? (ITEMS[w.equipment[k]!.item]?.kg ?? 0) * w.equipment[k]!.n : 0), 0);
  const after = L.kg(player, ITEMS) + worn;
  if (after > PLAYER_KG + 1e-9 && after > before) return refuse(w, 'move', 'too-heavy');
  for (const [id, slots] of boxSlots) {
    const b = w.boxes.find((x) => x.id === id)!;
    if (L.kg({ ...b, slots }, ITEMS) > b.maxKg + 1e-9) return refuse(w, 'move', 'box-full');
  }
  const boxes = w.boxes.map((b) => (boxSlots.has(b.id) ? { ...b, slots: boxSlots.get(b.id)! } : b));
  return next(w, { player, equipment, boxes }, [{ type: 'moved', n: moved }]);
}

/** Valheim's "place stacks": every grid stack (not the hotbar row) of an item the network already holds goes into it. */
function quickStack(w: BaseWorld, env: WorldEnv, at: Point): Applied {
  const net = networkAt(w, env, at);
  if (net.length === 0) return refuse(w, 'quickStack', 'out-of-range');
  const held = L.totals(w.boxes, net);
  const items: L.Stack[] = [];
  for (let i = 9; i < w.player.slots.length; i++) {
    const s = w.player.slots[i];
    if (s && (held[s.item] ?? 0) > 0) items.push(s);
  }
  if (items.length === 0) return refuse(w, 'quickStack', 'nothing');
  const s = L.store(w.boxes, net, at, ITEMS, items);
  const left = new Map<string, number>();
  for (const x of s.left) left.set(x.item, (left.get(x.item) ?? 0) + x.n);
  // take what was stored out of the grid rows (never the hotbar), last slots first so the leftovers stay at the front
  const slots = w.player.slots.slice();
  let total = 0;
  for (const it of new Set(items.map((x) => x.item))) {
    let take = items.filter((x) => x.item === it).reduce((t, x) => t + x.n, 0) - (left.get(it) ?? 0);
    total += take;
    for (let i = slots.length - 1; i >= 9 && take > 0; i--) {
      const q = slots[i];
      if (!q || q.item !== it) continue;
      const k = Math.min(take, q.n);
      slots[i] = q.n - k > 0 ? { item: it, n: q.n - k } : null;
      take -= k;
    }
  }
  return next(w, { player: { ...w.player, slots }, boxes: s.boxes }, [{ type: 'stacked', n: total }]);
}

function draft(w: BaseWorld, env: WorldEnv, cmd: Extract<BaseCommand, { t: 'draft' }>): Applied {
  if (!(PRIMITIVES as readonly string[]).includes(cmd.primitive) || !(MAPS as readonly string[]).includes(cmd.map)) return refuse(w, 'draft', 'bad-recipe');
  const id = blueprintId(cmd.primitive as PrimitiveId, cmd.map as MapId);
  if (owns(w, id)) return refuse(w, 'draft', 'known');
  const bench = w.base.pieces.some((p) => {
    if (p.kind !== 'bench') return false;
    const at = pieceAt(w.base, p);
    return !!at && Math.hypot(at.x - cmd.at.x, at.z - cmd.at.z) <= BENCH_REACH;
  });
  if (!bench) return refuse(w, 'draft', 'no-bench');
  const paid = pay(w, env, cmd.at, [{ item: `prim-${cmd.primitive}`, n: 1 }, { item: `map-${cmd.map}`, n: 1 }, { item: 'ore', n: DRAFT_ORE }]);
  if (!paid.ok) return refuse(w, 'draft', 'short', paid.short);
  const d = L.deposit(paid.patch.player, ITEMS, id, 1);
  if (d.left > 0) return refuse(w, 'draft', 'no-room');
  return next(w, { player: d.box, boxes: paid.patch.boxes }, [{ type: 'drafted', blueprint: id }]);
}

/**
 * What the build ghost shows for a blueprint piece aimed at `aim`: where it snaps (or a new structure for a foundation),
 * whether the rules allow it, and whether the player can pay for it right now (D9). The HUD's verdict reads this.
 */
export function preview(w: BaseWorld, env: WorldEnv, at: Point, bpId: string, kind: S.Kind, aim: Point & { readonly y: number; readonly yaw: number }): { readonly snap: S.Snap | null; readonly cost: readonly L.Stack[]; readonly short: readonly L.Stack[] } {
  const bp = blueprint(bpId), bill = bp ? pieceCost(bp, kind) : null;
  if (!bp || !bill) return { snap: null, cost: [], short: [] };
  const snap = S.snap(w.base, structureEnv(env), kind, aim, bp.mat);
  const paid = pay(w, env, at, bill);
  return { snap, cost: bill, short: paid.ok ? [] : paid.short };
}

// ---------------------------------------------------------------------------------------------- harvest and refining
/** Where a heavy machine stands: the middle of its hardpoint pad. */
function machineAt(w: BaseWorld, id: number): Point | null {
  const p = w.base.pieces.find((q) => q.id === id);
  return p ? pieceAt(w.base, p) : null;
}

/** Runs a machine's queue for `work` seconds of full-power work; leftover work flows into the next job. */
export function runQueue(jobs: readonly Job[], work: number): { jobs: Job[]; finished: string[] } {
  const out = jobs.slice(), finished: string[] = [];
  let left = Number.isFinite(work) && work > 0 ? work : 0;
  while (left > 0 && out.length > 0) {
    const j = out[0]!, r = RECIPE_BY_ID[j.recipe];
    if (!r) { out.shift(); continue; }
    const need = r.seconds - j.done;
    if (left >= need - 1e-9) { finished.push(j.recipe); left -= need; out.shift(); } else { out[0] = { recipe: j.recipe, done: j.done + left }; left = 0; }
  }
  return { jobs: out, finished };
}

function tick(w: BaseWorld, env: WorldEnv, cmd: Extract<BaseCommand, { t: 'tick' }>): Applied {
  if (!(cmd.dt > 0) || !Number.isFinite(cmd.dt)) return refuse(w, 'tick', 'bad-dt');
  const events: BaseEvent[] = [];
  // the beam works only when it is worn and the node is within reach
  let beam: { id: number; power: number } | null = null;
  const aimed = cmd.beam;
  if (aimed && w.equipment.beam?.item === 'tool-beam') {
    const node = w.field.nodes.find((n) => n.id === aimed.node);
    if (node && Math.hypot(node.x - cmd.at.x, node.z - cmd.at.z) <= BEAM_RANGE) beam = { id: node.id, power: aimed.power };
  }
  const f = F.advance(w.field, cmd.dt, w.stage, beam);
  let player = w.player, boxes: readonly L.Box[] = w.boxes;
  if (f.items.length > 0) {
    // what the beam pulls goes into the pack, then the network in reach; past that it is lost
    const s = L.store(withPlayer(w, cmd.at), [PLAYER, ...networkAt(w, env, cmd.at)], cmd.at, ITEMS, f.items);
    ({ player, boxes } = split(w, s.boxes));
    events.push({ type: 'harvested', items: f.items, lost: s.left });
  }
  const machines = w.machines.map((m) => {
    if (m.jobs.length === 0) return m;
    const share = Math.max(0, Math.min(1, cmd.power[m.id] ?? 0));
    const r = runQueue(m.jobs, cmd.dt * share);
    if (r.finished.length === 0) return { ...m, jobs: r.jobs };
    let out = m.out.slice();
    const at = machineAt(w, m.id);
    for (const rid of r.finished) {
      const o = RECIPE_BY_ID[rid]!.output;
      events.push({ type: 'finished', machine: m.id, item: o.item, n: o.n });
      // finished parts go straight into the machine's network; what does not fit waits in the machine
      const net = at ? networkAt({ ...w, boxes }, env, at) : [];
      const s = L.store(boxes, net, at ?? cmd.at, ITEMS, [o]);
      boxes = s.boxes;
      for (const l of s.left) {
        const i = out.findIndex((x) => x.item === l.item);
        out = i >= 0 ? out.map((x, k) => (k === i ? { item: x.item, n: x.n + l.n } : x)) : [...out, l];
      }
    }
    return { ...m, jobs: r.jobs, out };
  });
  return next(w, { field: f.field, player, boxes, machines }, events);
}

function install(w: BaseWorld, env: WorldEnv, cmd: Extract<BaseCommand, { t: 'install' }>): Applied {
  if (!(HEAVY as readonly string[]).includes(cmd.kind)) return refuse(w, 'install', 'bad-kind');
  const pad = w.base.pieces.find((p) => p.id === cmd.hardpoint);
  if (!pad || pad.kind !== 'hardpoint') return refuse(w, 'install', 'no-hardpoint');
  if (w.machines.some((m) => m.id === pad.id)) return refuse(w, 'install', 'occupied');
  const paid = pay(w, env, cmd.at, HEAVY_BILL[cmd.kind]);
  if (!paid.ok) return refuse(w, 'install', 'short', paid.short);
  return next(w, { ...paid.patch, machines: [...w.machines, { id: pad.id, kind: cmd.kind, jobs: [], out: [] }] }, [{ type: 'installed', machine: pad.id, kind: cmd.kind }]);
}

function craft(w: BaseWorld, env: WorldEnv, cmd: Extract<BaseCommand, { t: 'craft' }>): Applied {
  const m = w.machines.find((x) => x.id === cmd.machine), r = RECIPE_BY_ID[cmd.recipe];
  if (!m) return refuse(w, 'craft', 'no-machine');
  if (!r || r.machine !== m.kind) return refuse(w, 'craft', 'bad-recipe');
  if (m.jobs.length >= QUEUE_MAX) return refuse(w, 'craft', 'queue-full');
  const paid = pay(w, env, cmd.at, r.inputs);
  if (!paid.ok) return refuse(w, 'craft', 'short', paid.short);
  const machines = w.machines.map((x) => (x.id === m.id ? { ...x, jobs: [...x.jobs, { recipe: r.id, done: 0 }] } : x));
  return next(w, { ...paid.patch, machines }, [{ type: 'queued', machine: m.id, recipe: r.id }]);
}

function collect(w: BaseWorld, id: number): Applied {
  const m = w.machines.find((x) => x.id === id);
  if (!m) return refuse(w, 'collect', 'no-machine');
  if (m.out.length === 0) return refuse(w, 'collect', 'nothing');
  let player = w.player, n = 0;
  const left: L.Stack[] = [];
  for (const s of m.out) {
    const d = L.deposit(player, ITEMS, s.item, s.n);
    player = d.box;
    n += s.n - d.left;
    if (d.left > 0) left.push({ item: s.item, n: d.left });
  }
  if (n === 0) return refuse(w, 'collect', 'too-heavy');
  return next(w, { player, machines: w.machines.map((x) => (x.id === id ? { ...x, out: left } : x)) }, [{ type: 'collected', machine: id, n }]);
}
