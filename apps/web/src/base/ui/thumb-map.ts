// ============================================================================
// File: apps/web/src/base/ui/thumb-map.ts
// TICKET-04 (OPUS_NOTE_11 Item A):
// Pure mapping from items, blueprints, structure kinds, and machine kinds onto
// packed 3D asset IDs in apps/web/src/assets/gen/registry.json.
// ============================================================================

import { ITEMS, blueprint, type MapId } from '../catalog';
import { VAULT_BY_ID } from '@hm/vault';

export interface ThumbRef {
  readonly item?: string;
  readonly kind?: string;
  readonly machine?: string;
  readonly id?: string;
  readonly tint?: string;
}

/**
 * Every valid asset ID in apps/web/src/assets/gen/registry.json.
 * Kept as a pure constant set so thumb-map.ts has zero JSON-loader dependency
 * under bundler/node moduleResolution, and verified against registry.json in tests.
 */
export const REGISTRY_ASSET_IDS: ReadonlySet<string> = new Set<string>([
  'scout-body',
  'scout-wheel',
  'hauler-body',
  'hauler-wheel',
  'crawler-body',
  'crawler-arm',
  'fabricator-frame',
  'fabricator-head',
  'mill',
  'press-frame',
  'press-ram',
  'projector-mast',
  'projector-head',
  'watermaker',
  'bin',
  'repeater',
  'drafting',
  'weapon-bench',
  'barrel-short',
  'barrel-long',
  'barrel-scatter',
  'core-semi',
  'core-burst',
  'core-beam',
  'sight-iron',
  'sight-scope',
  'sight-holo',
  'cell-compact',
  'cell-extended',
  'wall',
  'pillar',
  'floor',
  'airlock',
  'weapon-frame',
  'foundation',
  'ramp',
  'roof-pitched',
  'roof-low',
  'roof-corner-outer',
  'roof-corner-inner',
  'ridge-cap',
  'gable',
  'half-wall',
  'window-wall',
  'life-support',
  'scout-shell',
  'doorframe',
  'door-leaf',
  'stairs',
  'hardpoint',
  'gate',
  'capacitor-bank',
  'capacitor-can',
  'breaker-panel',
  'breaker-handle',
  'relay-cabinet',
  'control-box',
  'operator-console',
  'console-lever',
  'preset-bench',
  'preset-combiner',
  'preset-rack',
  'planet-table',
  'vehicle-seat',
  'scout-chassis',
  'headlight',
  'her-desk',
  'cot',
  'wall-radio',
  'armory-rail',
  'steering-wheel',
  'crate-large',
  'crate-small',
  'cardboard-stack',
  'filing-cabinet',
  'server-rack',
  'locker',
  'toolbox',
  'coolant-can',
  'sample-case',
  'old-monitor',
  'datacentre-hall',
  'chiller-block',
  'shipping-container',
  'pylon-tower',
  'overpass-segment',
  'rubble-slab',
  'tool-cabinet-a',
  'barrier-block-a',
  'water-tank-square-a',
  'substation-block-a',
  'cooling-tower-square-b',
  'gantry-crane-solid-a',
  'billboard-blank-b',
  'warehouse-small-b',
  'road-section-a',
  'sign-gantry-b',
  'fuel-tank-square-b',
  'boulder-block-b',
  'lab-bunker-a',
  'radar-panel-b',
  'pump-house-a',
  'conveyor-housing-b',
  'wrecked-truck-cab-c',
  'workbench-old-a',
  'shelving-closed-b',
  'specimen-freezer-a',
  'portable-office-b',
  'comms-mast-solid-a',
  'wrecked-van-a',
  'datacentre-annex-b',
  'silo-square-a',
  'checkpoint-booth-a',
  'office-block-ruin-b',
  'gas-cabinet-c',
  'drum-square-b',
  'generator-small-a',
  'battery-pack-a',
  'cable-reel-square-a',
  'terminal-old-a',
  'container-crushed-a',
  'bench-jig',
  'bench-printer',
  'tool-wall',
  'tool-drill',
  'tool-wrench',
  'tool-mallet',
  'tool-scanner',
  'tool-screwdriver',
  'turret-base',
  'turret-yoke',
  'turret-gun',
]);

/**
 * Structure & blueprint piece kinds (@hm/structure Kind + registry aliases) -> registry.json asset IDs.
 */
export const KIND_THUMB_ASSETS: Readonly<Record<string, string>> = {
  foundation: 'foundation',
  floor: 'floor',
  ramp: 'ramp',
  wall: 'wall',
  airlock: 'airlock',
  pillar: 'pillar',
  hardpoint: 'hardpoint',
  bin: 'bin',
  bench: 'drafting',
  repeater: 'repeater',
  halfWall: 'half-wall',
  windowWall: 'window-wall',
  doorframe: 'doorframe',
  door: 'door-leaf',
  railing: 'half-wall',
  ladder: 'stairs',
  stairs: 'stairs',
  lifeSupport: 'life-support',
  roof: 'roof-pitched',
  pitchedRoof: 'roof-pitched',
  lowRoof: 'roof-low',
  roofOuter: 'roof-corner-outer',
  roofOuterCorner: 'roof-corner-outer',
  roofInner: 'roof-corner-inner',
  roofInnerCorner: 'roof-corner-inner',
  gable: 'gable',
  ridgeCap: 'ridge-cap',
  weaponBench: 'weapon-bench',
  // TICKET-13: the perimeter turret's thumbnail is its packed base plate
  turret: 'turret-base',
};

/**
 * Field, heavy, and station machine kinds (@hm/plotsim MachineKind + StationKind) -> registry.json asset IDs.
 */
export const MACHINE_THUMB_ASSETS: Readonly<Record<string, string>> = {
  drill: 'tool-drill',
  rockDrill: 'tool-drill',
  'rock-drill': 'tool-drill',
  mill: 'mill',
  textureMill: 'mill',
  'texture-mill': 'mill',
  pylon: 'repeater',
  relayPylon: 'repeater',
  'relay-pylon': 'repeater',
  press: 'press-frame',
  shapePress: 'press-frame',
  'shape-press': 'press-frame',
  power: 'generator-small-a',
  powerCell: 'generator-small-a',
  'power-cell': 'generator-small-a',
  powerUnit: 'generator-small-a',
  'power-unit': 'generator-small-a',
  generator: 'generator-small-a',
  projector: 'projector-mast',
  lightTower: 'projector-mast',
  'light-tower': 'projector-mast',
  lightProjector: 'projector-mast',
  'light-projector': 'projector-mast',
  water: 'watermaker',
  waterGen: 'watermaker',
  'water-gen': 'watermaker',
  waterMaker: 'watermaker',
  'water-maker': 'watermaker',
  watermaker: 'watermaker',
  'heavy-mill': 'mill',
  'heavy-press': 'press-frame',
  'heavy-projector': 'projector-mast',
  'heavy-water': 'watermaker',
  fabricator: 'fabricator-frame',
  vehicleFabricator: 'fabricator-frame',
  'vehicle-fabricator': 'fabricator-frame',
  weaponBench: 'weapon-bench',
  'weapon-bench': 'weapon-bench',
  bench: 'drafting',
  workbench: 'drafting',
};

/**
 * Explicit item IDs -> registry.json asset IDs.
 * Note: Raw pixels (pxd-*), raw vertices (vtx-*), texture maps (map-*), bulk ore,
 * and terrain cartridges intentionally do NOT map to a 3D mesh so useItemThumb
 * falls back to swatchFor(ref).
 */
export const ITEM_THUMB_ASSETS: Readonly<Record<string, string>> = {
  // Weapon frame & weapons
  'wpn-frame': 'weapon-frame',
  'wpn-shotgun': 'weapon-frame',
  'weapon-frame': 'weapon-frame',
  // Weapon parts (FORGE)
  'core-semi': 'core-semi',
  'core-burst': 'core-burst',
  'core-beam': 'core-beam',
  'barrel-short': 'barrel-short',
  'barrel-long': 'barrel-long',
  'barrel-scatter': 'barrel-scatter',
  'sight-iron': 'sight-iron',
  'sight-scope': 'sight-scope',
  'sight-holo': 'sight-holo',
  'cell-compact': 'cell-compact',
  'cell-extended': 'cell-extended',
  // Tools & equipment with 3D meshes
  'tool-beam': 'tool-scanner',
  'eq-visor': 'headlight',
  'equip_visor': 'headlight',
  'eq-shield': 'battery-pack-a',
  'equip_shield': 'battery-pack-a',
  'eq-rebreather': 'coolant-can',
  'equip_rebreather': 'coolant-can',
  // Structural primitives
  'prim-cube': 'foundation',
  'prim_cube': 'foundation',
  'prim-column': 'pillar',
  'prim_col': 'pillar',
  'prim-beam': 'ramp',
  'prim_beam': 'ramp',
  'prim-chassis': 'hardpoint',
  'prim_frame': 'hardpoint',
  // Vehicles & vehicle recipes
  scout: 'scout-body',
  hauler: 'hauler-body',
  crawler: 'crawler-body',
  'vehicle:scout': 'scout-body',
  'vehicle:hauler': 'hauler-body',
  'vehicle:crawler': 'crawler-body',
  'vehicle-scout': 'scout-body',
  'vehicle-hauler': 'hauler-body',
  'vehicle-crawler': 'crawler-body',
  // Starter blueprint
  'bp:starter': 'foundation',
};

const PRIMITIVE_FAMILY_SIGNATURE_ASSET: Readonly<Record<string, string>> = {
  cube: 'wall',
  column: 'pillar',
  beam: 'ramp',
  chassis: 'hardpoint',
};

function validRegistryId(id: string | undefined | null): string | null {
  if (!id) return null;
  return REGISTRY_ASSET_IDS.has(id) ? id : null;
}

/**
 * Maps an item, structure kind, or machine kind onto a valid asset ID in
 * apps/web/src/assets/gen/registry.json, or null when the item uses a 2D swatch
 * (raw pixels, raw vertices, texture maps, cartridges, bulk ore).
 */
export function thumbAssetFor(ref: { item?: string; kind?: string; machine?: string }): string | null {
  if (!ref) return null;

  // 1. Explicit machine lookup
  if (ref.machine) {
    const mHit = MACHINE_THUMB_ASSETS[ref.machine] ?? KIND_THUMB_ASSETS[ref.machine];
    const valid = validRegistryId(mHit ?? ref.machine);
    if (valid) return valid;
  }

  // 2. Structure kind or machine kind passed via ref.kind
  if (ref.kind) {
    const kHit = KIND_THUMB_ASSETS[ref.kind] ?? MACHINE_THUMB_ASSETS[ref.kind];
    const valid = validRegistryId(kHit ?? ref.kind);
    if (valid) return valid;
  }

  // 3. Item ID lookup
  if (ref.item) {
    const rawItem = ref.item;

    // Swatch-only categories (raw pixels, vertices, texture maps, bulk ore) return null
    if (
      rawItem === 'ore' ||
      rawItem === 'anomaly-core' ||
      rawItem.startsWith('pxd-') ||
      rawItem.startsWith('vtx-') ||
      rawItem.startsWith('map-') ||
      rawItem.startsWith('cartridge:') ||
      rawItem.startsWith('preset:')
    ) {
      return null;
    }

    const direct = ITEM_THUMB_ASSETS[rawItem];
    if (direct && REGISTRY_ASSET_IDS.has(direct)) return direct;

    // Blueprints: bp:starter or bp:<primitive>:<map>
    if (rawItem.startsWith('bp:')) {
      const parts = rawItem.split(':');
      const prim = parts[1];
      if (prim && PRIMITIVE_FAMILY_SIGNATURE_ASSET[prim]) {
        return PRIMITIVE_FAMILY_SIGNATURE_ASSET[prim]!;
      }
      const bp = blueprint(rawItem);
      const firstKind = bp?.kinds[0];
      if (firstKind && KIND_THUMB_ASSETS[firstKind]) {
        return KIND_THUMB_ASSETS[firstKind]!;
      }
      return 'foundation';
    }

    // Check if the item ID itself is a structure kind, machine kind, or registry asset ID
    const fallback = KIND_THUMB_ASSETS[rawItem] ?? MACHINE_THUMB_ASSETS[rawItem] ?? rawItem;
    const valid = validRegistryId(fallback);
    if (valid) return valid;
  }

  return null;
}

/**
 * Look colour palettes for texture maps and terrain cartridges so swatchFor()
 * renders rich, recognizable 64x64 procedural swatches.
 */
export interface SwatchPalette {
  readonly base: string;
  readonly hi: string;
  readonly lo: string;
  readonly accent: string;
  readonly pattern: 'grain' | 'facets' | 'strata' | 'moss' | 'pxd' | 'vtx' | 'ore' | 'data';
}

export const CARTRIDGE_PALETTES: Readonly<Record<string, SwatchPalette>> = {
  regolith: { base: '#8c7a64', hi: '#b5a188', lo: '#574a3b', accent: '#d6c4ab', pattern: 'grain' },
  basalt: { base: '#5a6069', hi: '#828a96', lo: '#363a40', accent: '#a7b1c2', pattern: 'strata' },
  'map-basalt': { base: '#5a6069', hi: '#828a96', lo: '#363a40', accent: '#a7b1c2', pattern: 'strata' },
  obsidian: { base: '#2b2440', hi: '#56477e', lo: '#151121', accent: '#b46bff', pattern: 'facets' },
  'map-obsidian': { base: '#2b2440', hi: '#56477e', lo: '#151121', accent: '#b46bff', pattern: 'facets' },
  quartz: { base: '#cfd8e6', hi: '#f4f8ff', lo: '#8c9bb0', accent: '#3dc8ff', pattern: 'facets' },
  'map-quartz': { base: '#cfd8e6', hi: '#f4f8ff', lo: '#8c9bb0', accent: '#3dc8ff', pattern: 'facets' },
  moss: { base: '#2f8f5b', hi: '#52d68a', lo: '#195233', accent: '#7cff4d', pattern: 'moss' },
  'map-moss': { base: '#2f8f5b', hi: '#52d68a', lo: '#195233', accent: '#7cff4d', pattern: 'moss' },
  emerald_canopy: { base: '#2d8a4e', hi: '#5ce080', lo: '#184d2a', accent: '#7cff4d', pattern: 'moss' },
  arid_badlands: { base: '#b86b35', hi: '#e09258', lo: '#733d18', accent: '#ffc13d', pattern: 'strata' },
  polar_tundra: { base: '#b8d4e8', hi: '#eef7ff', lo: '#6b8fa8', accent: '#3dc8ff', pattern: 'facets' },
  volcanic_slag: { base: '#3d2622', hi: '#783528', lo: '#1f110f', accent: '#ff7b3d', pattern: 'grain' },
  'pxd-mono': { base: '#525866', hi: '#d9d9d9', lo: '#232730', accent: '#ffffff', pattern: 'pxd' },
  'pxd-chroma': { base: '#701a4a', hi: '#ff3d8a', lo: '#360922', accent: '#ffc13d', pattern: 'pxd' },
  pixelRaw: { base: '#525866', hi: '#d9d9d9', lo: '#232730', accent: '#ffffff', pattern: 'pxd' },
  rawPixels: { base: '#525866', hi: '#d9d9d9', lo: '#232730', accent: '#ffffff', pattern: 'pxd' },
  'vtx-rough': { base: '#1e4e68', hi: '#7dd3fc', lo: '#0f2938', accent: '#3dc8ff', pattern: 'vtx' },
  'vtx-fine': { base: '#0f525e', hi: '#22d3ee', lo: '#072a30', accent: '#7cff4d', pattern: 'vtx' },
  ore: { base: '#7a654b', hi: '#a08a6a', lo: '#473929', accent: '#c9b28f', pattern: 'ore' },
  'anomaly-core': { base: '#1a4f66', hi: '#7cf3ff', lo: '#0b2530', accent: '#b46bff', pattern: 'facets' },
  blank: { base: '#1e293b', hi: '#475569', lo: '#0f172a', accent: '#00f0ff', pattern: 'data' },
  'blank-cart': { base: '#1e293b', hi: '#475569', lo: '#0f172a', accent: '#00f0ff', pattern: 'data' },
  blankCart: { base: '#1e293b', hi: '#475569', lo: '#0f172a', accent: '#00f0ff', pattern: 'data' },
  blankCartridge: { base: '#1e293b', hi: '#475569', lo: '#0f172a', accent: '#00f0ff', pattern: 'data' },
  texCart: { base: '#8c7a64', hi: '#b5a188', lo: '#574a3b', accent: '#d6c4ab', pattern: 'grain' },
  textureCartridge: { base: '#8c7a64', hi: '#b5a188', lo: '#574a3b', accent: '#d6c4ab', pattern: 'grain' },
};

export function resolveSwatchPalette(ref: ThumbRef): SwatchPalette | null {
  const key = (ref.item ?? ref.kind ?? ref.machine ?? ref.id ?? '').trim();
  if (!key && !ref.tint) return null;

  const cleanKey = key.replace(/^(cartridge:|preset:)/, '');
  if (CARTRIDGE_PALETTES[cleanKey]) {
    return CARTRIDGE_PALETTES[cleanKey]!;
  }
  if (CARTRIDGE_PALETTES[key]) {
    return CARTRIDGE_PALETTES[key]!;
  }
  const mapKey = `map-${cleanKey}` as MapId;
  if (CARTRIDGE_PALETTES[mapKey]) {
    return CARTRIDGE_PALETTES[mapKey]!;
  }

  // Vault preset dynamic lookup
  const vHit = VAULT_BY_ID.get(cleanKey) ?? VAULT_BY_ID.get(key);
  if (vHit && vHit.palette && vHit.palette.length > 0) {
    const pal = vHit.palette;
    const base = pal[0] ?? '#8c7a64';
    const hi = pal[1] ?? '#b5a188';
    const lo = pal[pal.length - 1] ?? '#574a3b';
    const accent = pal[2] ?? hi;
    const pattern =
      vHit.category === 'FLORA'
        ? 'moss'
        : vHit.category === 'CRYSTAL'
          ? 'facets'
          : vHit.category === 'ROAD' || vHit.category === 'STRUCTURE'
            ? 'strata'
            : 'grain';
    return { base, hi, lo, accent, pattern };
  }

  const itemSpec = ITEMS[key];
  const tint = ref.tint ?? itemSpec?.tint;
  if (!tint) return null;

  const pattern: SwatchPalette['pattern'] =
    itemSpec?.kind === 'raw-pxd'
      ? 'pxd'
      : itemSpec?.kind === 'raw-vtx'
        ? 'vtx'
        : itemSpec?.kind === 'map'
          ? 'strata'
          : 'grain';

  return {
    base: tint,
    hi: '#ffffff',
    lo: '#111827',
    accent: tint,
    pattern,
  };
}
