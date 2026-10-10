/**
 * The base-building catalogue (docs/BASE_BUILDING_ARCHITECTURE.md D9–D11): every item, the materials texture maps give,
 * what a blueprint unlocks and what each piece costs. Data only; `world.ts` applies it.
 *
 * A blueprint is a primitive drafted with a texture map. It unlocks every piece of its primitive's family, built in its
 * map's material: a better map builds further (support kept per step) and costs one map unit per piece. The starter
 * blueprint, bare regolith slabs from ore, needs no drafting: day one is "mine dirt, build a slab".
 */
import type { ItemDef } from '@hm/lattice';
import type { Kind, Material } from '@hm/structure';
import type { EquipSlot, ItemKind } from './view';

export interface ItemSpec extends ItemDef {
  readonly name: string;
  readonly kind: ItemKind;
  readonly tint: string;
}

export const MAPS = ['basalt', 'obsidian', 'quartz', 'moss'] as const;
export type MapId = (typeof MAPS)[number];
export const PRIMITIVES = ['cube', 'column', 'beam', 'chassis'] as const;
export type PrimitiveId = (typeof PRIMITIVES)[number];

/** Support kept per vertical / horizontal step. Regolith builds two cells out, basalt three, quartz five (light and stiff). */
export const MATERIALS: Readonly<Record<'regolith' | MapId, Material>> = {
  regolith: { vKeep: 0.85, hKeep: 0.5 },
  basalt: { vKeep: 0.9, hKeep: 0.6 },
  obsidian: { vKeep: 0.95, hKeep: 0.65 },
  quartz: { vKeep: 0.85, hKeep: 0.75 },
  moss: { vKeep: 0.8, hKeep: 0.55 },
};

const MAP_NAMES: Readonly<Record<MapId, readonly [string, string]>> = {
  basalt: ['Regolith Basalt Map', '#6b6f78'],
  obsidian: ['Polished Obsidian Map', '#2b2440'],
  quartz: ['Reflective Quartz Map', '#cfd8e6'],
  moss: ['Luminescent Moss Map', '#3ddc84'],
};
const PRIMITIVE_NAMES: Readonly<Record<PrimitiveId, readonly [string, number]>> = {
  cube: ['Structural Cube', 8],
  column: ['Cylinder Column', 6],
  beam: ['Chamfered Beam', 5],
  chassis: ['Chassis Frame', 12],
};

/** What each primitive's blueprints can build. */
export const FAMILY: Readonly<Record<PrimitiveId, readonly Kind[]>> = {
  cube: ['foundation', 'floor', 'wall', 'bin'],
  column: ['pillar', 'repeater'],
  beam: ['ramp'],
  chassis: ['airlock', 'hardpoint', 'bench', 'lifeSupport', 'weaponBench'],
};

/** Ore per piece; blueprint pieces add one unit of their map. Heavy hardpoints also need refined beams and frames. */
export const PIECE_ORE: Readonly<Record<Kind, number>> = {
  foundation: 20, floor: 10, ramp: 14, wall: 12, airlock: 20, pillar: 6, hardpoint: 60, bin: 15, bench: 25, repeater: 30,
  // structure round 4a/4b kinds: costed, but in no blueprint family until the game renders them
  halfWall: 7, windowWall: 14, doorframe: 10, door: 14, railing: 4, ladder: 6, stairs: 16, lifeSupport: 30,
  roof: 14, lowRoof: 10, roofOuter: 12, roofInner: 12, gable: 8, ridgeCap: 3, weaponBench: 30,
};
export const PIECE_EXTRA: Readonly<Partial<Record<Kind, readonly { readonly item: string; readonly n: number }[]>>> = {
  hardpoint: [{ item: 'prim-beam', n: 4 }, { item: 'prim-chassis', n: 2 }],
  repeater: [{ item: 'prim-column', n: 2 }],
};

/** Drafting a blueprint consumes one primitive, one map and some ore. */
export const DRAFT_ORE = 10;

export const STARTER = 'bp:starter';
export const blueprintId = (primitive: PrimitiveId, map: MapId): string => `bp:${primitive}:${map}`;

export interface Blueprint {
  readonly id: string;
  readonly name: string;
  readonly kinds: readonly Kind[];
  /** Material id in MATERIALS. */
  readonly mat: 'regolith' | MapId;
  /** The map unit each piece costs, or null for the starter. */
  readonly map: MapId | null;
}

export function blueprint(id: string): Blueprint | null {
  // the starter also builds the first Drafting Table and the shelter's low roof: every other blueprint is drafted at one
  if (id === STARTER) return { id, name: 'Regolith Slab Kit', kinds: ['foundation', 'floor', 'wall', 'lowRoof', 'bench', 'weaponBench'], mat: 'regolith', map: null };
  const m = /^bp:([a-z]+):([a-z]+)$/.exec(id);
  const p = m?.[1] as PrimitiveId | undefined, map = m?.[2] as MapId | undefined;
  if (!p || !map || !PRIMITIVES.includes(p) || !MAPS.includes(map)) return null;
  const [mapName] = MAP_NAMES[map];
  return { id, name: `${PRIMITIVE_NAMES[p][0]} in ${mapName.replace(/ Map$/, '')}`, kinds: FAMILY[p], mat: map, map };
}

/** The bill for one piece of `kind` built from `bp`, or null when the blueprint cannot build that kind. */
export function pieceCost(bp: Blueprint, kind: Kind): { readonly item: string; readonly n: number }[] | null {
  if (!bp.kinds.includes(kind)) return null;
  const bill = [{ item: 'ore', n: PIECE_ORE[kind] }];
  if (bp.map) bill.push({ item: `map-${bp.map}`, n: 1 });
  return [...bill, ...(PIECE_EXTRA[kind] ?? [])];
}

/** Weapon part item ids and names (the parts' bills and stages are in FORGE, below). */
const PART_IDS = ['core-semi', 'core-burst', 'core-beam', 'barrel-short', 'barrel-long', 'barrel-scatter', 'sight-iron', 'sight-scope', 'sight-holo', 'cell-compact', 'cell-extended'] as const;
const PART_NAMES: Readonly<Record<string, string>> = { 'core-semi': 'Semi-auto Core', 'core-burst': 'Burst Core', 'core-beam': 'Beam Core', 'barrel-short': 'Short Barrel', 'barrel-long': 'Long Barrel', 'barrel-scatter': 'Scatter Barrel', 'sight-iron': 'Iron Sight', 'sight-scope': 'Scope', 'sight-holo': 'Holo Sight', 'cell-compact': 'Compact Cell', 'cell-extended': 'Extended Cell' };

function buildItems(): Record<string, ItemSpec> {
  const out: Record<string, ItemSpec> = {
    ore: { name: 'Regolith Ore', kind: 'bulk', tint: '#a08a6a', stack: 50, kg: 1 },
    'pxd-mono': { name: 'Raw Pixels (mono)', kind: 'raw-pxd', tint: '#d9d9d9', stack: 100, kg: 0.2 },
    'pxd-chroma': { name: 'Raw Pixels (chroma)', kind: 'raw-pxd', tint: '#ff4fd8', stack: 100, kg: 0.2 },
    'vtx-rough': { name: 'Raw Vertices (rough)', kind: 'raw-vtx', tint: '#7dd3fc', stack: 100, kg: 0.5 },
    'vtx-fine': { name: 'Raw Vertices (fine)', kind: 'raw-vtx', tint: '#22d3ee', stack: 100, kg: 0.4 },
    [STARTER]: { name: 'Regolith Slab Kit', kind: 'blueprint', tint: '#38bdf8', stack: 1, kg: 0 },
    'tool-beam': { name: 'Extraction Beam', kind: 'tool', tint: '#22d3ee', stack: 1, kg: 6 },
    'wpn-shotgun': { name: 'Combat Shotgun', kind: 'weapon', tint: '#f59e0b', stack: 1, kg: 4 },
    'wpn-frame': { name: 'Weapon Frame', kind: 'weapon', tint: '#94a3b8', stack: 1, kg: 3 },
    'eq-visor': { name: 'Hazmat Visor', kind: 'equip', tint: '#38bdf8', stack: 1, kg: 1 },
    'eq-shield': { name: 'Sync Shield Generator', kind: 'equip', tint: '#a855f7', stack: 1, kg: 5 },
    'eq-rebreather': { name: 'Oxygen Rebreather', kind: 'equip', tint: '#14b8a6', stack: 1, kg: 3 },
  };
  for (const map of MAPS) out[`map-${map}`] = { name: MAP_NAMES[map][0], kind: 'map', tint: MAP_NAMES[map][1], stack: 20, kg: 1 };
  for (const p of PRIMITIVES) out[`prim-${p}`] = { name: PRIMITIVE_NAMES[p][0], kind: 'primitive', tint: '#94a3b8', stack: 10, kg: PRIMITIVE_NAMES[p][1] };
  for (const id of PART_IDS) out[id] = { name: PART_NAMES[id] ?? id, kind: 'part', tint: '#cbd5e1', stack: 5, kg: 0.5 };
  for (const p of PRIMITIVES) for (const map of MAPS) {
    const bp = blueprint(blueprintId(p, map))!;
    out[bp.id] = { name: bp.name, kind: 'blueprint', tint: MAP_NAMES[map][1], stack: 1, kg: 0 };
  }
  return out;
}

export const ITEMS: Readonly<Record<string, ItemSpec>> = buildItems();

/** Which equipment slot takes which item; everything else stays in the grid. */
export const EQUIP: Readonly<Record<string, EquipSlot>> = {
  'eq-visor': 'visor', 'eq-shield': 'shield', 'eq-rebreather': 'rebreather', 'tool-beam': 'beam', 'wpn-shotgun': 'sidearm', 'wpn-frame': 'sidearm',
};

// ---------------------------------------------------------------------------------------------- heavy machines and refining
/** The heavy terraformers that bolt onto a hardpoint (D3). Mills and presses also refine; projectors and water makers only pour. */
export const HEAVY = ['mill', 'press', 'projector', 'water'] as const;
export type HeavyKind = (typeof HEAVY)[number];

/** What installing one costs: heavy, expensive, and worth about twenty field machines. */
export const HEAVY_BILL: Readonly<Record<HeavyKind, readonly { readonly item: string; readonly n: number }[]>> = {
  mill: [{ item: 'ore', n: 200 }, { item: 'prim-cube', n: 6 }, { item: 'prim-chassis', n: 2 }],
  press: [{ item: 'ore', n: 260 }, { item: 'prim-cube', n: 4 }, { item: 'prim-beam', n: 4 }, { item: 'prim-chassis', n: 2 }],
  projector: [{ item: 'ore', n: 320 }, { item: 'prim-column', n: 4 }, { item: 'prim-chassis', n: 3 }, { item: 'map-quartz', n: 4 }],
  water: [{ item: 'ore', n: 380 }, { item: 'prim-column', n: 6 }, { item: 'prim-chassis', n: 3 }, { item: 'map-moss', n: 4 }],
};

export interface Recipe {
  readonly id: string;
  readonly machine: 'mill' | 'press' | 'fabricator';
  /** The plot's fidelity stage that unlocks it (none: always open). */
  readonly stage?: number;
  readonly inputs: readonly { readonly item: string; readonly n: number }[];
  readonly output: { readonly item: string; readonly n: number };
  /** Seconds of work at full power. */
  readonly seconds: number;
}

/** Mills turn raw pixels into texture maps; presses turn raw vertices into primitives. Chroma and fine grades come later in the stages. */
export const RECIPES: readonly Recipe[] = [
  { id: 'map-basalt', machine: 'mill', inputs: [{ item: 'pxd-mono', n: 20 }, { item: 'ore', n: 5 }], output: { item: 'map-basalt', n: 1 }, seconds: 30 },
  { id: 'map-obsidian', machine: 'mill', inputs: [{ item: 'pxd-mono', n: 30 }, { item: 'pxd-chroma', n: 5 }], output: { item: 'map-obsidian', n: 1 }, seconds: 45 },
  { id: 'map-quartz', machine: 'mill', inputs: [{ item: 'pxd-chroma', n: 25 }], output: { item: 'map-quartz', n: 1 }, seconds: 45 },
  { id: 'map-moss', machine: 'mill', inputs: [{ item: 'pxd-chroma', n: 15 }, { item: 'pxd-mono', n: 15 }], output: { item: 'map-moss', n: 1 }, seconds: 40 },
  { id: 'prim-cube', machine: 'press', inputs: [{ item: 'vtx-rough', n: 12 }], output: { item: 'prim-cube', n: 1 }, seconds: 20 },
  { id: 'prim-column', machine: 'press', inputs: [{ item: 'vtx-rough', n: 8 }, { item: 'vtx-fine', n: 2 }], output: { item: 'prim-column', n: 1 }, seconds: 25 },
  { id: 'prim-beam', machine: 'press', inputs: [{ item: 'vtx-rough', n: 6 }, { item: 'vtx-fine', n: 4 }], output: { item: 'prim-beam', n: 1 }, seconds: 25 },
  { id: 'prim-chassis', machine: 'press', inputs: [{ item: 'vtx-fine', n: 12 }, { item: 'vtx-rough', n: 8 }], output: { item: 'prim-chassis', n: 1 }, seconds: 50 },
];

/** Jobs a machine holds at once (the one running plus the waiting ones). */
export const QUEUE_MAX = 5;
/** The plot's anomaly field: its radius in metres (one 1 km plot). */
export const FIELD_RADIUS = 500;

// ---------------------------------------------------------------------------------------------- fabrication (owner, 2026-10-10)
// Vehicles are a fixed catalog, each printed whole at a Vehicle Fabricator. Weapons are one frame with four part slots,
// crafted at a Weapon Bench and swapped in the field. Better ones open as the plot's fidelity stage rises
// (docs/FABRICATOR_RESEARCH.md, concept sheets 19 and 20).
type Bill = readonly { readonly item: string; readonly n: number }[];

/** Stations that bolt onto a hardpoint: the heavy terraformers, and the Vehicle Fabricator (sheet 19, piece 34). */
export type StationKind = HeavyKind | 'fabricator';
export const FABRICATOR_BILL: Bill = [{ item: 'ore', n: 240 }, { item: 'prim-beam', n: 6 }, { item: 'prim-column', n: 4 }, { item: 'prim-chassis', n: 4 }];

export const VEHICLES = ['scout', 'hauler', 'crawler'] as const;
export type VehicleKind = (typeof VEHICLES)[number];
export interface VehicleSpec {
  readonly name: string;
  /** The plot's fidelity stage that unlocks it. */
  readonly stage: number;
  /** Seconds to print at full power. */
  readonly seconds: number;
  readonly seats: number;
  /** Whether it carries a storage bin on the linked network (the hauler; the future mobile outpost, D16). */
  readonly cargo: boolean;
  readonly bill: Bill;
}
export const VEHICLE: Readonly<Record<VehicleKind, VehicleSpec>> = {
  scout: { name: 'Scout', stage: 2, seconds: 120, seats: 1, cargo: false, bill: [{ item: 'ore', n: 150 }, { item: 'prim-beam', n: 6 }, { item: 'prim-column', n: 4 }, { item: 'prim-chassis', n: 2 }, { item: 'map-basalt', n: 2 }] },
  hauler: { name: 'Hauler', stage: 4, seconds: 240, seats: 2, cargo: true, bill: [{ item: 'ore', n: 300 }, { item: 'prim-cube', n: 6 }, { item: 'prim-beam', n: 4 }, { item: 'prim-chassis', n: 6 }, { item: 'map-basalt', n: 4 }] },
  crawler: { name: 'Crawler', stage: 6, seconds: 420, seats: 2, cargo: false, bill: [{ item: 'ore', n: 500 }, { item: 'prim-cube', n: 8 }, { item: 'prim-beam', n: 6 }, { item: 'prim-chassis', n: 10 }, { item: 'map-obsidian', n: 4 }, { item: 'map-quartz', n: 2 }] },
};
/** A fabricator recipe's output item names the vehicle it prints. */
export const VEHICLE_ITEM = (kind: VehicleKind): string => `vehicle:${kind}`;

export const PART_SLOTS = ['core', 'barrel', 'sight', 'cell'] as const;
export type PartSlot = (typeof PART_SLOTS)[number];
export const WEAPON_FRAME = 'wpn-frame';
export interface ForgeSpec { readonly id: string; readonly name: string; readonly slot: PartSlot | null; readonly stage: number; readonly bill: Bill }
/** What the Weapon Bench makes: the frame, then the parts for its four slots (sheet 20). */
export const FORGE: readonly ForgeSpec[] = [
  { id: WEAPON_FRAME, name: 'Weapon Frame', slot: null, stage: 1, bill: [{ item: 'ore', n: 40 }, { item: 'prim-chassis', n: 1 }, { item: 'prim-beam', n: 1 }] },
  { id: 'core-semi', name: 'Semi-auto Core', slot: 'core', stage: 1, bill: [{ item: 'ore', n: 20 }, { item: 'prim-cube', n: 1 }] },
  { id: 'core-burst', name: 'Burst Core', slot: 'core', stage: 3, bill: [{ item: 'ore', n: 30 }, { item: 'prim-cube', n: 1 }, { item: 'prim-chassis', n: 1 }] },
  { id: 'core-beam', name: 'Beam Core', slot: 'core', stage: 5, bill: [{ item: 'ore', n: 40 }, { item: 'prim-chassis', n: 2 }, { item: 'map-quartz', n: 1 }] },
  { id: 'barrel-short', name: 'Short Barrel', slot: 'barrel', stage: 1, bill: [{ item: 'ore', n: 10 }, { item: 'prim-column', n: 1 }] },
  { id: 'barrel-long', name: 'Long Barrel', slot: 'barrel', stage: 3, bill: [{ item: 'ore', n: 20 }, { item: 'prim-column', n: 2 }] },
  { id: 'barrel-scatter', name: 'Scatter Barrel', slot: 'barrel', stage: 1, bill: [{ item: 'ore', n: 15 }, { item: 'prim-column', n: 1 }, { item: 'prim-cube', n: 1 }] },
  { id: 'sight-iron', name: 'Iron Sight', slot: 'sight', stage: 1, bill: [{ item: 'ore', n: 5 }] },
  { id: 'sight-scope', name: 'Scope', slot: 'sight', stage: 3, bill: [{ item: 'ore', n: 15 }, { item: 'prim-column', n: 1 }, { item: 'map-quartz', n: 1 }] },
  { id: 'sight-holo', name: 'Holo Sight', slot: 'sight', stage: 5, bill: [{ item: 'ore', n: 20 }, { item: 'map-quartz', n: 2 }] },
  { id: 'cell-compact', name: 'Compact Cell', slot: 'cell', stage: 1, bill: [{ item: 'ore', n: 10 }, { item: 'prim-cube', n: 1 }] },
  { id: 'cell-extended', name: 'Extended Cell', slot: 'cell', stage: 3, bill: [{ item: 'ore', n: 20 }, { item: 'prim-cube', n: 2 }] },
];
export const FORGE_BY_ID: Readonly<Record<string, ForgeSpec>> = Object.fromEntries(FORGE.map((f) => [f.id, f]));

/** Every recipe by id: refining at mills and presses, and vehicles at the fabricator. */
export const RECIPE_BY_ID: Readonly<Record<string, Recipe>> = Object.fromEntries([
  ...RECIPES,
  ...VEHICLES.map((v): Recipe => ({ id: `vehicle-${v}`, machine: 'fabricator', inputs: VEHICLE[v].bill, output: { item: VEHICLE_ITEM(v), n: 1 }, seconds: VEHICLE[v].seconds, stage: VEHICLE[v].stage })),
].map((r) => [r.id, r]));
