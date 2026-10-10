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
  chassis: ['airlock', 'hardpoint', 'bench'],
};

/** Ore per piece; blueprint pieces add one unit of their map. Heavy hardpoints also need refined beams and frames. */
export const PIECE_ORE: Readonly<Record<Kind, number>> = {
  foundation: 20, floor: 10, ramp: 14, wall: 12, airlock: 20, pillar: 6, hardpoint: 60, bin: 15, bench: 25, repeater: 30,
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
  // the starter also builds the first Drafting Table: every other blueprint is drafted at one
  if (id === STARTER) return { id, name: 'Regolith Slab Kit', kinds: ['foundation', 'floor', 'wall', 'bench'], mat: 'regolith', map: null };
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
    'eq-visor': { name: 'Hazmat Visor', kind: 'equip', tint: '#38bdf8', stack: 1, kg: 1 },
    'eq-shield': { name: 'Sync Shield Generator', kind: 'equip', tint: '#a855f7', stack: 1, kg: 5 },
    'eq-rebreather': { name: 'Oxygen Rebreather', kind: 'equip', tint: '#14b8a6', stack: 1, kg: 3 },
  };
  for (const map of MAPS) out[`map-${map}`] = { name: MAP_NAMES[map][0], kind: 'map', tint: MAP_NAMES[map][1], stack: 20, kg: 1 };
  for (const p of PRIMITIVES) out[`prim-${p}`] = { name: PRIMITIVE_NAMES[p][0], kind: 'primitive', tint: '#94a3b8', stack: 10, kg: PRIMITIVE_NAMES[p][1] };
  for (const p of PRIMITIVES) for (const map of MAPS) {
    const bp = blueprint(blueprintId(p, map))!;
    out[bp.id] = { name: bp.name, kind: 'blueprint', tint: MAP_NAMES[map][1], stack: 1, kg: 0 };
  }
  return out;
}

export const ITEMS: Readonly<Record<string, ItemSpec>> = buildItems();

/** Which equipment slot takes which item; everything else stays in the grid. */
export const EQUIP: Readonly<Record<string, EquipSlot>> = {
  'eq-visor': 'visor', 'eq-shield': 'shield', 'eq-rebreather': 'rebreather', 'tool-beam': 'beam', 'wpn-shotgun': 'sidearm',
};
