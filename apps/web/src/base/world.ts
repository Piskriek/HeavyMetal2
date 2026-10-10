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
import { DRAFT_ORE, EQUIP, FIELD_RADIUS, HEAVY, HEAVY_BILL, ITEMS, MAPS, MATERIALS, PIECE_EXTRA, PIECE_ORE, PRIMITIVES, QUEUE_MAX, RECIPE_BY_ID, STARTER, blueprint, blueprintId, pieceCost, type Blueprint, type HeavyKind, type MapId, type PrimitiveId } from './catalog';
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
  readonly v: 3;
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
  /** Saved structure layouts (D13), oldest first. */
  readonly layouts: readonly Layout[];
  /** Layouts placed as ghosts, filling in as the player pays (D13). */
  readonly plans: readonly Plan[];
  /** Whether the free starter shelter (D15) has been placed. */
  readonly shelter: boolean;
}

/** A saved structure: the @hm/structure codec of one structure at the origin, its first foundation at cell (0, 0) first. */
export interface Layout { readonly id: string; readonly name: string; readonly code: string }
/**
 * A layout placed as a ghost: its first foundation's cell centre and yaw, the structure once that foundation stands
 * (null before), and the layout pieces still to build (indices into the layout, in build order).
 */
export interface Plan { readonly id: number; readonly layout: string; readonly cx: number; readonly cz: number; readonly yaw: number; readonly s: number | null; readonly left: readonly number[] }

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
  | { readonly t: 'collect'; readonly machine: number }
  /** Saves one of the player's structures as a layout, at a Drafting Table (D13). */
  | { readonly t: 'saveLayout'; readonly at: Point; readonly structure: number; readonly name: string }
  /** Adds a layout shared by another player (its codec text, hostile until checked). */
  | { readonly t: 'importLayout'; readonly code: string; readonly name: string }
  /** Places a layout as a ghost: (cx, cz) is its first foundation's cell centre. */
  | { readonly t: 'plan'; readonly layout: string; readonly cx: number; readonly cz: number; readonly yaw: number }
  /** Builds a plan's next pieces in order, paying as it goes, until something is short. */
  | { readonly t: 'fill'; readonly at: Point; readonly plan: number }
  | { readonly t: 'dropPlan'; readonly plan: number }
  /** Places the free starter shelter (D15), once per world. */
  | { readonly t: 'shelter'; readonly cx: number; readonly cz: number; readonly yaw: number };

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
  | { readonly type: 'stage'; readonly stage: number }
  | { readonly type: 'layout'; readonly id: string }
  | { readonly type: 'planned'; readonly plan: number }
  /** A fill: the pieces it built, how many are still to build, and how many of those the rules refused this time. */
  | { readonly type: 'filled'; readonly plan: number; readonly built: readonly number[]; readonly left: number; readonly blocked: number }
  | { readonly type: 'dropped'; readonly plan: number }
  | { readonly type: 'shelter'; readonly structure: number };

export interface Applied { readonly world: BaseWorld; readonly events: readonly BaseEvent[] }

const NO_EQUIPMENT: Record<EquipSlot, L.Stack | null> = { visor: null, shield: null, rebreather: null, beam: null, sidearm: null };

/** A new player's base: no pieces, the starter slab kit on hotbar 1, the Extraction Beam worn, the suit's visor on. */
export function createWorld(seed = 1): BaseWorld {
  const slots: (L.Stack | null)[] = Array.from({ length: PLAYER_SLOTS }, () => null);
  slots[0] = { item: STARTER, n: 1 };
  return {
    v: 3, tick: 0, base: S.empty(), boxes: [], layouts: [], plans: [], shelter: false,
    player: { id: PLAYER, x: 0, z: 0, slots, maxKg: PLAYER_KG },
    equipment: { ...NO_EQUIPMENT, beam: { item: 'tool-beam', n: 1 }, visor: { item: 'eq-visor', n: 1 } },
    hotbar: 0,
    stage: 0,
    field: F.generate(seed, FIELD_RADIUS, 0),
    machines: [],
  };
}

/** The lab bridge's own store: one bin's worth of linked storage at the gate, on the network from the first minute. */
export const BRIDGE_STORE = -2;

/**
 * The world with the bridge store standing at the gate, holding `stock` (what does not fit is dropped). Applied once to a new
 * world before its log, like createWorld, so a replay starts from `withBridgeStore(createWorld(seed), env, stock)`. A world that
 * already has the store is returned unchanged.
 */
export function withBridgeStore(w: BaseWorld, env: WorldEnv, stock: readonly L.Stack[] = []): BaseWorld {
  if (w.boxes.some((b) => b.id === BRIDGE_STORE)) return w;
  const at = { x: env.bridge.x, z: env.bridge.z };
  const s = L.store([L.box(BRIDGE_STORE, at.x, at.z, BIN_SLOTS, BIN_KG)], [BRIDGE_STORE], at, ITEMS, stock);
  return { ...w, boxes: [...s.boxes, ...w.boxes] };
}

/** The deterministic id of a world state (stable key order). */
export const hashWorld = (w: BaseWorld): string => hashValue(w);

export const structureEnv = (env: WorldEnv): S.Env => ({ heightAt: (x, z) => env.heightAt(x, z), materials: MATERIALS });

/** The world point of a piece: its cell centre (cells and fixtures), edge middle, or corner, on its floor. */
export function pieceAt(base: S.Base, p: S.Piece): { x: number; y: number; z: number } | null {
  const st = base.structures.find((s) => s.id === p.s);
  return st ? pieceAtIn(st, p) : null;
}

/** pieceAt for a structure pose that may not be in the base yet (a plan's ghost). */
export function pieceAtIn(st: S.Structure, p: Pick<S.Piece, 'kind' | 'i' | 'j' | 'k' | 'r' | 'dx' | 'dz'>): { x: number; y: number; z: number } {
  const C = S.CELL;
  const local = p.kind === 'wall' || p.kind === 'airlock'
    ? (p.r === 0 ? [(p.i + 0.5) * C, p.j * C] : [p.i * C, (p.j + 0.5) * C])
    : p.kind === 'pillar' ? [p.i * C, p.j * C]
      : p.kind === 'hardpoint' ? [(p.i + 1) * C, (p.j + 1) * C]
        : [(p.i + 0.5) * C + (p.dx ?? 0) / 100, (p.j + 0.5) * C + (p.dz ?? 0) / 100];
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

/**
 * The room a point stands in (feet at `at.y`), and whether it is pressurised (D14): sealed (every door and airlock
 * shut) with a powered life-support unit inside. A unit is powered while a relay reaches it: the lab bridge or a
 * repeater carries power and data alike. It walks the rooms of the whole base, so call it a few times a second at most.
 */
export function roomAt(w: BaseWorld, env: WorldEnv, at: { readonly x: number; readonly y: number; readonly z: number }): { readonly room: S.Room | null; readonly pressurized: boolean } {
  const all = S.rooms(w.base);
  for (const st of w.base.structures) {
    const dx = at.x - st.x, dz = at.z - st.z, c = Math.cos(st.yaw), s = Math.sin(st.yaw);
    const i = Math.floor((dx * c + dz * s) / S.CELL), j = Math.floor((-dx * s + dz * c) / S.CELL), k = Math.floor((at.y - st.y + 0.5) / S.LEVEL);
    const room = all.find((rm) => rm.s === st.id && rm.k === k && rm.cells.some(([a, b]) => a === i && b === j));
    if (!room) continue;
    const reach = relays(w, env);
    const powered = room.lifeSupport.some((id) => {
      const p = w.base.pieces.find((q) => q.id === id), q = p ? pieceAt(w.base, p) : null;
      return !!q && reach.some((r) => Math.hypot(r.x - q.x, r.z - q.z) <= r.range);
    });
    return { room, pressurized: room.sealed && powered };
  }
  return { room: null, pressurized: false };
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
    case 'saveLayout':
      return saveLayout(w, cmd);
    case 'importLayout':
      return importLayout(w, cmd);
    case 'plan':
      return plan(w, cmd);
    case 'fill':
      return fill(w, env, cmd);
    case 'dropPlan':
      if (!w.plans.some((p) => p.id === cmd.plan)) return refuse(w, cmd.t, 'no-plan');
      return next(w, { plans: w.plans.filter((p) => p.id !== cmd.plan) }, [{ type: 'dropped', plan: cmd.plan }]);
    case 'shelter':
      return shelter(w, env, cmd);
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
  if (!benchNear(w, cmd.at)) return refuse(w, 'draft', 'no-bench');
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

// ---------------------------------------------------------------------------------------------- layouts and the starter shelter
export const MAX_LAYOUTS = 32;
export const MAX_PLANS = 4;
const NAME_MAX = 32;

/** Whether a Drafting Table (a bench piece) stands within reach of `at`. */
function benchNear(w: BaseWorld, at: Point): boolean {
  return w.base.pieces.some((p) => {
    if (p.kind !== 'bench') return false;
    const q = pieceAt(w.base, p);
    return !!q && Math.hypot(q.x - at.x, q.z - at.z) <= BENCH_REACH;
  });
}

/**
 * One structure as a layout base: a single structure at the origin, its pieces renumbered in build (id) order with the
 * first ground-level foundation moved to the front and to cell (0, 0), doors shut. Null when it has no such foundation.
 */
function layoutBase(base: S.Base, s: number): S.Base | null {
  const own = base.pieces.filter((p) => p.s === s);
  const first = own.find((p) => p.kind === 'foundation' && p.k === 0);
  if (!first) return null;
  const order = [first, ...own.filter((p) => p !== first)];
  const pieces = order.map((p, n): S.Piece => {
    const { open: _shut, ...rest } = p;
    return { ...rest, id: n + 1, s: 0, i: p.i - first.i, j: p.j - first.j };
  });
  return { v: 1, structures: [{ id: 0, x: 0, y: 0, z: 0, yaw: 0 }], pieces, nextId: pieces.length + 1 };
}

const layoutCode = (b: S.Base): string | null => { try { return S.encode(b); } catch { return null; } };
const layoutId = (code: string): string => `layout:${hashValue(code).slice(0, 16)}`;

/** The pieces of a layout's code in build order (the first is its ground foundation at cell (0, 0)), or null if it is not one. */
export function layoutPieces(code: string): readonly S.Piece[] | null {
  const b = S.decode(code);
  if (!b || b.structures.length !== 1 || b.pieces.length === 0) return null;
  const first = b.pieces[0]!;
  return first.kind === 'foundation' && first.i === 0 && first.j === 0 && first.k === 0 ? b.pieces : null;
}

function addLayout(w: BaseWorld, cmd: BaseCommand['t'], b: S.Base | null, name: string): Applied {
  const label = typeof name === 'string' ? name.trim() : '';
  if (label.length === 0 || label.length > NAME_MAX) return refuse(w, cmd, 'bad-name');
  const code = b ? layoutCode(b) : null;
  if (!code || !layoutPieces(code)) return refuse(w, cmd, 'bad-code');
  const id = layoutId(code);
  if (w.layouts.some((l) => l.id === id)) return refuse(w, cmd, 'known');
  if (w.layouts.length >= MAX_LAYOUTS) return refuse(w, cmd, 'full');
  return next(w, { layouts: [...w.layouts, { id, name: label, code }] }, [{ type: 'layout', id }]);
}

function saveLayout(w: BaseWorld, cmd: Extract<BaseCommand, { t: 'saveLayout' }>): Applied {
  if (!benchNear(w, cmd.at)) return refuse(w, cmd.t, 'no-bench');
  if (!w.base.structures.some((s) => s.id === cmd.structure)) return refuse(w, cmd.t, 'no-structure');
  return addLayout(w, cmd.t, layoutBase(w.base, cmd.structure), cmd.name);
}

function importLayout(w: BaseWorld, cmd: Extract<BaseCommand, { t: 'importLayout' }>): Applied {
  if (typeof cmd.code !== 'string' || cmd.code.length > S.LIMITS.maxChars) return refuse(w, cmd.t, 'bad-code');
  const b = S.decode(cmd.code), s = b && b.structures.length === 1 ? b.structures[0]!.id : null;
  // re-normalised, so the same layout always gets the same id whoever shared it
  return addLayout(w, cmd.t, b && s !== null ? layoutBase(b, s) : null, cmd.name);
}

function plan(w: BaseWorld, cmd: Extract<BaseCommand, { t: 'plan' }>): Applied {
  const l = w.layouts.find((x) => x.id === cmd.layout), pieces = l ? layoutPieces(l.code) : null;
  if (!pieces) return refuse(w, cmd.t, 'no-layout');
  if (![cmd.cx, cmd.cz, cmd.yaw].every(Number.isFinite)) return refuse(w, cmd.t, 'bad-slot');
  if (w.plans.length >= MAX_PLANS) return refuse(w, cmd.t, 'full');
  const id = w.plans.reduce((m, p) => Math.max(m, p.id), 0) + 1;
  const p: Plan = { id, layout: cmd.layout, cx: cmd.cx, cz: cmd.cz, yaw: cmd.yaw, s: null, left: pieces.map((_, n) => n) };
  return next(w, { plans: [...w.plans, p] }, [{ type: 'planned', plan: id }]);
}

/**
 * The blueprint a layout piece is built from: one the player carries that builds `kind` in the layout's `mat`, else any
 * carried blueprint that builds `kind` (the piece takes that blueprint's material). Starter first, then pack order.
 */
function blueprintFor(w: BaseWorld, kind: S.Kind, mat: string): Blueprint | null {
  const held = [STARTER, ...w.player.slots.flatMap((s) => (s && s.item.startsWith('bp:') ? [s.item] : []))]
    .filter((id) => owns(w, id)).flatMap((id) => { const bp = blueprint(id); return bp && bp.kinds.includes(kind) ? [bp] : []; });
  return held.find((bp) => bp.mat === mat) ?? held[0] ?? null;
}

/** Places one plan piece by the rules (no payment); the first one founds the structure. */
function placePlanned(base: S.Base, env: WorldEnv, p: Plan, piece: S.Piece): S.Result {
  const senv = structureEnv(env);
  if (p.s === null) return S.found(base, senv, p.cx, p.cz, p.yaw, piece.mat);
  const placement = piece.deg !== undefined ? { dx: piece.dx, dz: piece.dz, deg: piece.deg } : {};
  return S.place(base, senv, { s: p.s, kind: piece.kind, i: piece.i, j: piece.j, k: piece.k, r: piece.r, mat: piece.mat, ...placement });
}

function addBox(boxes: readonly L.Box[], base: S.Base, id: number): readonly L.Box[] {
  const piece = base.pieces.find((q) => q.id === id)!, at = pieceAt(base, piece)!;
  return [...boxes, L.box(id, at.x, at.z, BIN_SLOTS, BIN_KG)];
}

function fill(w: BaseWorld, env: WorldEnv, cmd: Extract<BaseCommand, { t: 'fill' }>): Applied {
  const p0 = w.plans.find((x) => x.id === cmd.plan);
  const l = p0 ? w.layouts.find((x) => x.id === p0.layout) : undefined, pieces = l ? layoutPieces(l.code) : null;
  if (!p0 || !pieces) return refuse(w, cmd.t, 'no-plan');
  let world = w, p = p0, short: readonly L.Stack[] | null = null, blocked = 0;
  const built: number[] = [], left: number[] = [];
  for (const n of p0.left) {
    const piece = pieces[n]!;
    if (short) { left.push(n); continue; }
    const bp = blueprintFor(world, piece.kind, piece.mat), bill = bp ? pieceCost(bp, piece.kind) : null;
    const r = bp && bill ? placePlanned(world.base, env, p, { ...piece, mat: bp.mat }) : null;
    if (!bill || !r || !r.ok) {
      // the first foundation founds the structure: nothing else can stand before it does
      if (p.s === null) return refuse(w, cmd.t, bill ? (r?.why ?? 'blocked') : 'no-blueprint');
      blocked += 1; left.push(n); continue;
    }
    const paid = pay(world, env, cmd.at, bill);
    if (!paid.ok) { short = paid.short; left.push(n); continue; }
    const boxes = piece.kind === 'bin' ? addBox(paid.patch.boxes, r.base, r.id) : paid.patch.boxes;
    if (p.s === null) p = { ...p, s: r.base.pieces.find((q) => q.id === r.id)!.s };
    world = { ...world, base: r.base, player: paid.patch.player, boxes };
    built.push(r.id);
  }
  if (built.length === 0) return short ? refuse(w, cmd.t, 'short', short) : refuse(w, cmd.t, 'blocked');
  const done = p;
  const plans = left.length === 0 ? w.plans.filter((x) => x.id !== done.id) : w.plans.map((x) => (x.id === done.id ? { ...done, left } : x));
  const events: BaseEvent[] = [
    ...built.map((id): BaseEvent => ({ type: 'placed', id, kind: world.base.pieces.find((q) => q.id === id)!.kind })),
    { type: 'filled', plan: done.id, built, left: left.length, blocked },
  ];
  return next(w, { base: world.base, player: world.player, boxes: world.boxes, plans }, events);
}

/** Where a plan's unbuilt pieces stand, for the ghost; before founding, on the highest ground under its first cell. */
export function planGhosts(w: BaseWorld, env: WorldEnv, planId: number): readonly { readonly index: number; readonly piece: S.Piece; readonly at: { x: number; y: number; z: number }; readonly yaw: number }[] {
  const p = w.plans.find((x) => x.id === planId), l = p ? w.layouts.find((x) => x.id === p.layout) : undefined;
  const pieces = l ? layoutPieces(l.code) : null;
  if (!p || !pieces) return [];
  let st = p.s === null ? undefined : w.base.structures.find((s) => s.id === p.s);
  if (!st) {
    const c = Math.cos(p.yaw), sn = Math.sin(p.yaw), h = S.CELL / 2;
    const x = p.cx - h * c + h * sn, z = p.cz - h * sn - h * c;
    const corners = [[0, 0], [S.CELL, 0], [0, S.CELL], [S.CELL, S.CELL]] as const;
    const y = Math.max(...corners.map(([u, v]) => env.heightAt(x + u * c - v * sn, z + u * sn + v * c)));
    st = { id: -1, x, y, z, yaw: p.yaw };
  }
  const pose = st;
  return p.left.map((index) => ({ index, piece: pieces[index]!, at: pieceAtIn(pose, pieces[index]!), yaw: pose.yaw }));
}

/**
 * The starter shelter (D15): one sealed regolith cell (foundation, three walls, an airlock to the front at +z, a low
 * roof rising to the back, a Drafting Table along the back wall and a life-support unit by the door), free, placed in
 * one action and once per world. The two fixtures share the cell by free placement (R2.5).
 */
export const SHELTER: readonly Omit<S.Piece, 'id' | 's' | 'mat'>[] = [
  { kind: 'foundation', i: 0, j: 0, k: 0, r: 0 },
  { kind: 'wall', i: 0, j: 0, k: 0, r: 0 },
  { kind: 'wall', i: 0, j: 0, k: 0, r: 1 },
  { kind: 'wall', i: 1, j: 0, k: 0, r: 1 },
  { kind: 'airlock', i: 0, j: 1, k: 0, r: 0 },
  { kind: 'lowRoof', i: 0, j: 0, k: 1, r: 2 },
  { kind: 'bench', i: 0, j: 0, k: 0, r: 2, dx: 0, dz: -110, deg: 180 },
  { kind: 'lifeSupport', i: 0, j: 0, k: 0, r: 0, dx: -130, dz: 100, deg: 0 },
];

function shelter(w: BaseWorld, env: WorldEnv, cmd: Extract<BaseCommand, { t: 'shelter' }>): Applied {
  if (w.shelter) return refuse(w, cmd.t, 'known');
  const senv = structureEnv(env), mat = 'regolith';
  const f = S.found(w.base, senv, cmd.cx, cmd.cz, cmd.yaw, mat);
  if (!f.ok) return refuse(w, cmd.t, f.why);
  const s = f.base.pieces.find((q) => q.id === f.id)!.s;
  let base = f.base;
  for (const piece of SHELTER.slice(1)) {
    const r = S.place(base, senv, { ...piece, s, mat });
    if (!r.ok) return refuse(w, cmd.t, r.why);
    base = r.base;
  }
  return next(w, { base, shelter: true }, [{ type: 'shelter', structure: s }]);
}
