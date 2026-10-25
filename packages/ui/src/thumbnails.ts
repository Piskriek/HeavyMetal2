// ============================================================================
// File: packages/ui/src/thumbnails.ts
// Spec B (THUMB-01 / BEAM-01 / DEC-11):
// Two-source thumbnail atlas & human-readable item descriptions.
// 1. 3D Model thumbnails for meshes (machines, structures, vehicles, weapons)
// 2. 64x64 procedural relief texture swatches for cartridges, materials & raw voxels
// 3. Plain-English title translation & 2-line origin/purpose tooltips
// ============================================================================

export interface SwatchOptions {
  readonly size?: number;
  readonly baseColor?: string;
  readonly hiColor?: string;
  readonly loColor?: string;
  readonly accentColor?: string;
  readonly pattern?: 'grain' | 'facets' | 'strata' | 'moss' | 'pxd' | 'vtx' | 'ore' | 'data';
}

export interface ItemDescription {
  readonly title: string;
  readonly hint: string;
}

/**
 * Standard plain-English translations for developer keys, camelCase IDs, and debug strings.
 */
export const ITEM_TITLES: Readonly<Record<string, string>> = {
  // Raw substrates (INV-01)
  pixelRaw: 'Raw Pixels',
  rawPixels: 'Raw Pixels',
  'pxd-mono': 'Raw Pixels (Mono)',
  'pxd-chroma': 'Raw Pixels (Chroma)',
  'vtx-rough': 'Raw Vertices (Rough)',
  'vtx-fine': 'Raw Vertices (Fine)',
  ore: 'Regolith Ore',
  'anomaly-core': 'Anomaly Core',

  // Cartridges & data media
  blank: 'Blank Cartridge',
  'blank-cart': 'Blank Cartridge',
  blankCart: 'Blank Cartridge',
  blankCartridge: 'Blank Cartridge',
  texCart: 'Texture Cartridge',
  textureCartridge: 'Texture Cartridge',
  cartridge: 'Preset Cartridge',

  // Blueprints & tools
  'bp:starter': 'Regolith Slab Blueprint',
  'tool-beam': 'Extraction Beam Rifle',
  'wpn-frame': 'Weapon Frame',
  'wpn-shotgun': 'Combat Shotgun',
  'eq-visor': 'Hazmat Visor',
  'eq-shield': 'Sync Shield Generator',
  'eq-rebreather': 'Oxygen Rebreather',

  // Field & heavy machines (BB-01)
  drill: 'Rock Drill',
  rockDrill: 'Rock Drill',
  'rock-drill': 'Rock Drill',
  mill: 'Texture Mill',
  textureMill: 'Texture Mill',
  'texture-mill': 'Texture Mill',
  pylon: 'Relay Pylon',
  relayPylon: 'Relay Pylon',
  'relay-pylon': 'Relay Pylon',
  press: 'Shape Press',
  shapePress: 'Shape Press',
  'shape-press': 'Shape Press',
  power: 'Power Unit',
  powerCell: 'Power Unit',
  'power-cell': 'Power Unit',
  powerUnit: 'Power Unit',
  generator: 'Power Unit',
  projector: 'Light Projector',
  lightTower: 'Light Projector',
  'light-tower': 'Light Projector',
  lightProjector: 'Light Projector',
  water: 'Water Maker',
  waterGen: 'Water Maker',
  'water-gen': 'Water Maker',
  watermaker: 'Water Maker',
  fabricator: 'Vehicle Fabricator',
  vehicleFabricator: 'Vehicle Fabricator',
  'heavy-mill': 'Heavy Texture Mill',
  'heavy-press': 'Heavy Shape Press',
  'heavy-projector': 'Heavy Light Projector',
  'heavy-water': 'Heavy Water Maker',

  // Structures (BB-01)
  foundation: 'Foundation',
  floor: 'Floor',
  ramp: 'Ramp',
  wall: 'Wall',
  halfWall: 'Half Wall',
  windowWall: 'Window Wall',
  doorframe: 'Doorframe',
  door: 'Reinforced Door',
  airlock: 'Airlock',
  pillar: 'Support Pillar',
  roof: 'Pitched Roof',
  lowRoof: 'Low Roof',
  roofOuter: 'Outer Corner Roof',
  roofInner: 'Inner Corner Roof',
  gable: 'Gable Wall',
  ridgeCap: 'Ridge Cap',
  stairs: 'Industrial Stairs',
  bench: 'Drafting Table',
  workbench: 'Drafting Table',
  weaponBench: 'Weapon Modding Bench',
  bin: 'Lattice Storage Bin',
  hardpoint: 'Heavy Hardpoint Socket',
  lifeSupport: 'Life Support Station',
  turret: 'Perimeter Defense Turret',

  // Vehicles
  scout: 'Scout Rover',
  hauler: 'Heavy Hauler',
  crawler: 'Expedition Crawler',
  'vehicle:scout': 'Scout Rover',
  'vehicle:hauler': 'Heavy Hauler',
  'vehicle:crawler': 'Expedition Crawler',
};

/**
 * 2-line informative explanation tooltips explaining origin and usage for items.
 */
export const ITEM_DESCRIPTIONS: Readonly<Record<string, ItemDescription>> = {
  'pxd-mono': {
    title: 'Raw Pixels (Mono)',
    hint: 'Harvested from monochromatic anomaly nodes with Beam Rifle.\nUsed in Texture Mill to synthesize structural texture maps.',
  },
  'pxd-chroma': {
    title: 'Raw Pixels (Chroma)',
    hint: 'Harvested from chromatic anomaly nodes with Beam Rifle.\nUsed in Texture Mill to craft advanced high-stage textures.',
  },
  'vtx-rough': {
    title: 'Raw Vertices (Rough)',
    hint: 'Harvested from geometry anomaly clusters with Beam Rifle.\nUsed in Shape Press to stamp modular building primitives.',
  },
  'vtx-fine': {
    title: 'Raw Vertices (Fine)',
    hint: 'Harvested from high-density geometry anomalies with Beam Rifle.\nUsed in Shape Press for precision frames and vehicle chassis.',
  },
  ore: {
    title: 'Regolith Ore',
    hint: 'Mined from ground deposits and rock drills.\nFoundational raw material for base construction and machinery.',
  },
  'anomaly-core': {
    title: 'Anomaly Core',
    hint: 'Stabilized containment anomaly remnant from sealed leaks.\nCatalyst for high-tier dimensional synthesis and research.',
  },
  'blank-cart': {
    title: 'Blank Cartridge',
    hint: 'Programmable quantum optical memory cartridge.\nLoaded into Lab benches or drafting tables to record presets.',
  },
  'tool-beam': {
    title: 'Extraction Beam Rifle',
    hint: 'Multi-mode matter manipulation rifle.\nExtracts anomaly nodes, applies textures, sculpts ground & seals leaks.',
  },
  'wpn-frame': {
    title: 'Weapon Frame',
    hint: 'Standard ballistic chassis receiver.\nSocket modular cores, barrels, sights, and cells at the Weapon Bench.',
  },
  'wpn-shotgun': {
    title: 'Combat Shotgun',
    hint: 'Pump-action scatter defense firearm.\nEffective against anomalous hostiles and containment breaches.',
  },
  'eq-visor': {
    title: 'Hazmat Visor',
    hint: 'Telemetry HUD optical helmet plate.\nProjects stage fidelity overlays, targeting arcs, and scan vectors.',
  },
  'eq-shield': {
    title: 'Sync Shield Generator',
    hint: 'Dimensional coherence bubble barrier.\nPrevents hazard discharge while within powered base grids.',
  },
  'eq-rebreather': {
    title: 'Oxygen Rebreather',
    hint: 'Closed-loop atmospheric scrubber unit.\nMaintains life support while operating beyond the safe dome.',
  },
};

/**
 * Resolves a clean, human-readable display title for any inventory key or machine ID.
 */
export function resolveItemTitle(key: string, fallback?: string): string {
  if (!key) return fallback ?? 'Unknown';
  const clean = key.trim();
  if (ITEM_TITLES[clean]) return ITEM_TITLES[clean]!;

  const unprefix = clean.replace(/^(item:|vehicle:|bp:|map:|preset:|cartridge:)/, '');
  if (ITEM_TITLES[unprefix]) return ITEM_TITLES[unprefix]!;

  // Fallback: title-case camelCase or kebab-case
  if (fallback) return fallback;
  return unprefix
    .replace(/[-_]/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Resolves the title and 2-line origin/purpose tooltip for any item.
 */
export function resolveItemDescription(key: string, fallbackName?: string): ItemDescription {
  const clean = (key || '').trim();
  if (ITEM_DESCRIPTIONS[clean]) return ITEM_DESCRIPTIONS[clean]!;

  const unprefix = clean.replace(/^(item:|vehicle:|bp:|map:|preset:|cartridge:)/, '');
  if (ITEM_DESCRIPTIONS[unprefix]) return ITEM_DESCRIPTIONS[unprefix]!;

  const title = resolveItemTitle(clean, fallbackName);

  if (clean.startsWith('map-') || clean.includes('map')) {
    return {
      title,
      hint: 'Refined surface material texture map.\nDrafted into structural blueprints or loaded into terrain guns.',
    };
  }

  if (clean.startsWith('bp:') || clean.includes('blueprint')) {
    return {
      title,
      hint: 'Pre-engineered modular construction blueprint.\nHold in hand to place foundations, walls, ramps, and roofs.',
    };
  }

  if (clean.startsWith('core-') || clean.startsWith('barrel-') || clean.startsWith('sight-') || clean.startsWith('cell-')) {
    return {
      title,
      hint: 'Modular weapon component.\nInstall into a Weapon Frame at the Weapon Modding Bench.',
    };
  }

  if (clean.startsWith('prim-')) {
    return {
      title,
      hint: 'Stamped geometric building primitive.\nEssential structural component for heavy machinery and hardpoints.',
    };
  }

  return {
    title,
    hint: 'Research expedition equipment or material.\nStored in personal inventory or quantum lattice bins.',
  };
}

/**
 * Procedural SVG swatch generator for non-browser / headless test environments.
 * Features normal-relief directional lighting and surface texturing.
 */
export function generateProceduralSvgSwatch(options: SwatchOptions = {}): string {
  const size = options.size ?? 64;
  const base = options.baseColor ?? '#475569';
  const hi = options.hiColor ?? '#94a3b8';
  const lo = options.loColor ?? '#1e293b';
  const accent = options.accentColor ?? '#38bdf8';
  const pattern = options.pattern ?? 'grain';

  let patternElements = '';

  if (pattern === 'pxd') {
    // Pixel clusters
    patternElements = `
      <rect x="8" y="10" width="8" height="8" fill="${hi}" opacity="0.8" rx="1"/>
      <rect x="22" y="6" width="10" height="10" fill="${accent}" opacity="0.9" rx="1"/>
      <rect x="18" y="22" width="12" height="12" fill="${lo}" opacity="0.7" rx="1"/>
      <rect x="36" y="16" width="8" height="8" fill="${hi}" opacity="0.85" rx="1"/>
      <rect x="12" y="38" width="14" height="14" fill="${accent}" opacity="0.75" rx="1"/>
      <rect x="32" y="34" width="16" height="16" fill="${hi}" opacity="0.6" rx="1"/>
    `;
  } else if (pattern === 'vtx') {
    // Wireframe vertices with directional relief
    patternElements = `
      <polygon points="32,10 12,50 52,50" fill="none" stroke="${hi}" stroke-width="2" opacity="0.85"/>
      <line x1="32" y1="10" x2="32" y2="50" stroke="${lo}" stroke-width="1.5" stroke-dasharray="3 3"/>
      <circle cx="32" cy="10" r="3.5" fill="${accent}"/>
      <circle cx="12" cy="50" r="3.5" fill="${accent}"/>
      <circle cx="52" cy="50" r="3.5" fill="${accent}"/>
    `;
  } else if (pattern === 'strata') {
    // Geological layers with light rim
    patternElements = `
      <path d="M 0,20 Q 32,12 64,24 L 64,36 Q 32,28 0,38 Z" fill="${hi}" opacity="0.45"/>
      <path d="M 0,34 Q 32,26 64,38 L 64,50 Q 32,42 0,48 Z" fill="${lo}" opacity="0.65"/>
      <circle cx="48" cy="18" r="4" fill="${accent}" opacity="0.8"/>
    `;
  } else if (pattern === 'moss') {
    // Organic cellular dither
    patternElements = `
      <circle cx="20" cy="22" r="10" fill="${hi}" opacity="0.55"/>
      <circle cx="44" cy="26" r="12" fill="${accent}" opacity="0.6"/>
      <circle cx="28" cy="42" r="14" fill="${lo}" opacity="0.7"/>
      <circle cx="48" cy="46" r="8" fill="${hi}" opacity="0.5"/>
    `;
  } else if (pattern === 'facets') {
    // Angled faceted crystalline surface
    patternElements = `
      <polygon points="10,10 36,6 48,28 20,32" fill="${hi}" opacity="0.4"/>
      <polygon points="20,32 48,28 42,54 14,50" fill="${lo}" opacity="0.6"/>
      <polygon points="48,28 58,18 56,44 42,54" fill="${accent}" opacity="0.5"/>
    `;
  } else if (pattern === 'data') {
    // Quantum data bus lines (cartridges)
    patternElements = `
      <line x1="8" y1="16" x2="56" y2="16" stroke="${accent}" stroke-width="2" opacity="0.9"/>
      <line x1="8" y1="24" x2="44" y2="24" stroke="${hi}" stroke-width="1.5" opacity="0.7"/>
      <line x1="8" y1="32" x2="52" y2="32" stroke="${hi}" stroke-width="1.5" opacity="0.7"/>
      <line x1="8" y1="40" x2="36" y2="40" stroke="${accent}" stroke-width="2" opacity="0.85"/>
      <rect x="42" y="38" width="14" height="12" rx="2" fill="${lo}" stroke="${hi}" stroke-width="1"/>
    `;
  } else {
    // Natural regolith grain
    patternElements = `
      <circle cx="16" cy="18" r="3" fill="${hi}" opacity="0.7"/>
      <circle cx="36" cy="14" r="2.5" fill="${lo}" opacity="0.6"/>
      <circle cx="48" cy="24" r="3.5" fill="${hi}" opacity="0.5"/>
      <circle cx="22" cy="38" r="4" fill="${lo}" opacity="0.7"/>
      <circle cx="42" cy="42" r="3" fill="${accent}" opacity="0.6"/>
    `;
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 64 64">
    <defs>
      <linearGradient id="rel" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="${hi}" stop-opacity="0.35"/>
        <stop offset="45%" stop-color="${base}"/>
        <stop offset="100%" stop-color="${lo}"/>
      </linearGradient>
    </defs>
    <rect width="64" height="64" rx="6" fill="url(#rel)"/>
    ${patternElements}
    <!-- Bevel normal relief highlight frame -->
    <rect x="1" y="1" width="62" height="62" rx="5" fill="none" stroke="rgba(255,255,255,0.32)" stroke-width="1.5"/>
    <path d="M 2,62 L 62,62 L 62,2" fill="none" stroke="rgba(0,0,0,0.45)" stroke-width="1.5"/>
  </svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
