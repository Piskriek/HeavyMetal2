/**
 * Saving the base world: one JSON text per player, checked on load. A save lives in this browser's storage, where a
 * player can edit it, so every section is validated, and a section that is wrong falls back to its fresh value. A bad
 * save never traps a player (the rule quest.ts follows). The structures travel in the @hm/structure codec, whose decode
 * is hostile-safe. What the rules derive is rebuilt rather than trusted:
 *  - every bin piece has its box;
 *  - a box or machine whose piece is gone is dropped;
 *  - the player's carry limit is the game's.
 */
import * as L from '@hm/lattice';
import * as S from '@hm/structure';
import * as F from '@hm/substrate';
import { FIELD_RADIUS, HEAVY, ITEMS, QUEUE_MAX, RECIPE_BY_ID, type HeavyKind } from './catalog';
import { EQUIP_SLOTS, type EquipSlot } from './view';
import {
  BIN_KG, BIN_SLOTS, BRIDGE_STORE, MAX_LAYOUTS, MAX_PLANS, PLAYER, PLAYER_KG, PLAYER_SLOTS,
  createWorld, layoutPieces, pieceAt, type BaseWorld, type Job, type Layout, type Machine, type Plan,
} from './world';

/** The storage key for the base save (next to quest.ts's SAVE_KEY). */
export const BASE_SAVE_KEY = 'hm-base-v1';

/** The base world as save text. */
export function saveWorld(w: BaseWorld): string {
  return JSON.stringify({ ...w, base: S.encode(w.base) });
}

type Rec = Record<string, unknown>;
const isRec = (v: unknown): v is Rec => !!v && typeof v === 'object' && !Array.isArray(v);
const int = (v: unknown, lo: number, hi: number): number | null => (Number.isInteger(v) && (v as number) >= lo && (v as number) <= hi ? (v as number) : null);
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/** One stack: a known item, a whole count within its stack size. */
function stack(v: unknown): L.Stack | null {
  if (!isRec(v) || typeof v['item'] !== 'string') return null;
  const spec = ITEMS[v['item']], n = spec ? int(v['n'], 1, spec.stack) : null;
  return spec && n !== null ? { item: v['item'], n } : null;
}

/** A grid of `size` slots; a slot that is not a valid stack is emptied. */
const slots = (v: unknown, size: number): (L.Stack | null)[] =>
  Array.from({ length: size }, (_, i) => (Array.isArray(v) ? stack(v[i]) : null));

const NODE_KINDS: readonly F.Kind[] = ['dither', 'fold', 'chroma', 'spire'];

function field(v: unknown, fresh: F.Field, stage: number): F.Field {
  const regrown = (): F.Field => (stage === 0 ? fresh : F.regen(fresh, FIELD_RADIUS, stage));
  if (!isRec(v) || v['v'] !== 1 || num(v['seed']) === null || num(v['time']) === null || !Array.isArray(v['nodes']) || v['nodes'].length > 20000) return regrown();
  const nodes: F.Node[] = [];
  for (const n of v['nodes']) {
    if (!isRec(n) || int(n['id'], 0, Number.MAX_SAFE_INTEGER) === null || !NODE_KINDS.includes(n['kind'] as F.Kind)) return regrown();
    const [x, z, reserve, carry] = [num(n['x']), num(n['z']), num(n['reserve']), num(n['carry'])];
    if (x === null || z === null || reserve === null || carry === null || reserve < 0 || carry < 0) return regrown();
    nodes.push({ id: n['id'] as number, kind: n['kind'] as F.Kind, x, z, reserve, carry });
  }
  return { v: 1, seed: v['seed'] as number, time: v['time'] as number, nodes };
}

function machine(v: unknown, pads: ReadonlySet<number>): Machine | null {
  if (!isRec(v)) return null;
  const id = int(v['id'], 0, Number.MAX_SAFE_INTEGER), kind = v['kind'] as HeavyKind;
  if (id === null || !pads.has(id) || !(HEAVY as readonly string[]).includes(kind)) return null;
  const jobs: Job[] = [];
  for (const j of Array.isArray(v['jobs']) ? v['jobs'].slice(0, QUEUE_MAX) : []) {
    const r = isRec(j) && typeof j['recipe'] === 'string' ? RECIPE_BY_ID[j['recipe']] : undefined, done = isRec(j) ? num(j['done']) : null;
    if (r && r.machine === kind && done !== null && done >= 0) jobs.push({ recipe: r.id, done });
  }
  const out = Array.isArray(v['out']) ? v['out'].slice(0, 64).map(stack).filter((s): s is L.Stack => s !== null) : [];
  return { id, kind, jobs, out };
}

/** The base world from save text; anything missing or wrong falls back to a fresh world (or a fresh section of it). */
export function loadWorld(text: string | null, seed = 1): BaseWorld {
  const fresh = createWorld(seed);
  let raw: unknown;
  try { raw = text ? JSON.parse(text) : null; } catch { return fresh; }
  if (!isRec(raw) || raw['v'] !== 3) return fresh;
  const base = typeof raw['base'] === 'string' ? S.decode(raw['base']) : null;
  if (!base) return fresh;

  const stage = int(raw['stage'], 0, 6) ?? 0;
  const bins = new Map(base.pieces.filter((p) => p.kind === 'bin').map((p) => [p.id, p] as const));
  const pads = new Set(base.pieces.filter((p) => p.kind === 'hardpoint').map((p) => p.id));

  // boxes: the bridge store and one per bin piece, each kept once; a bin without its box gets an empty one
  const boxes: L.Box[] = [];
  for (const b of Array.isArray(raw['boxes']) ? raw['boxes'] : []) {
    if (!isRec(b)) continue;
    const id = int(b['id'], -2, Number.MAX_SAFE_INTEGER), x = num(b['x']), z = num(b['z']);
    if (id === null || x === null || z === null || boxes.some((o) => o.id === id) || (id !== BRIDGE_STORE && !bins.has(id))) continue;
    boxes.push({ id, x, z, slots: slots(b['slots'], BIN_SLOTS), maxKg: BIN_KG });
  }
  for (const [id, p] of bins) {
    const at = pieceAt(base, p);
    if (at && !boxes.some((b) => b.id === id)) boxes.push(L.box(id, at.x, at.z, BIN_SLOTS, BIN_KG));
  }

  const player = isRec(raw['player']) ? raw['player'] : {};
  const equipIn = isRec(raw['equipment']) ? raw['equipment'] : {};
  const equipment = Object.fromEntries(EQUIP_SLOTS.map((k) => [k, stack(equipIn[k])])) as Record<EquipSlot, L.Stack | null>;

  const machines: Machine[] = [];
  for (const m of Array.isArray(raw['machines']) ? raw['machines'] : []) {
    const ok = machine(m, pads);
    if (ok && !machines.some((x) => x.id === ok.id)) machines.push(ok);
  }

  const layouts: Layout[] = [];
  for (const l of Array.isArray(raw['layouts']) ? raw['layouts'].slice(0, MAX_LAYOUTS) : []) {
    if (!isRec(l) || typeof l['id'] !== 'string' || !l['id'].startsWith('layout:') || typeof l['name'] !== 'string' || typeof l['code'] !== 'string') continue;
    const name = l['name'].trim();
    if (name.length > 0 && name.length <= 32 && layoutPieces(l['code']) && !layouts.some((x) => x.id === l['id'])) layouts.push({ id: l['id'], name, code: l['code'] });
  }

  const plans: Plan[] = [];
  for (const p of Array.isArray(raw['plans']) ? raw['plans'].slice(0, MAX_PLANS) : []) {
    if (!isRec(p)) continue;
    const layout = layouts.find((l) => l.id === p['layout']), pieces = layout ? layoutPieces(layout.code) : null;
    const id = int(p['id'], 1, Number.MAX_SAFE_INTEGER), cx = num(p['cx']), cz = num(p['cz']), yaw = num(p['yaw']);
    const s = p['s'] === null ? null : int(p['s'], 0, Number.MAX_SAFE_INTEGER);
    if (!pieces || id === null || cx === null || cz === null || yaw === null || plans.some((x) => x.id === id)) continue;
    if (s === null && p['s'] !== null) continue;
    if (s !== null && !base.structures.some((st) => st.id === s)) continue;
    const left = Array.isArray(p['left']) ? p['left'].filter((n): n is number => int(n, 0, pieces.length - 1) !== null) : [];
    const ordered = [...new Set(left)].sort((a, b) => a - b);
    if (ordered.length > 0) plans.push({ id, layout: layout!.id, cx, cz, yaw, s, left: ordered });
  }

  return {
    v: 3,
    tick: int(raw['tick'], 0, Number.MAX_SAFE_INTEGER) ?? 0,
    base,
    boxes,
    player: { id: PLAYER, x: 0, z: 0, slots: slots(player['slots'], PLAYER_SLOTS), maxKg: PLAYER_KG },
    equipment,
    hotbar: int(raw['hotbar'], 0, 8) ?? 0,
    stage,
    field: field(raw['field'], fresh.field, stage),
    machines,
    layouts,
    plans,
    shelter: raw['shelter'] === true,
  };
}
