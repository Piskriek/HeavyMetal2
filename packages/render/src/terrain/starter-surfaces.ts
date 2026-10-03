import { recipe, type SurfaceDef, type VoxelSet } from './surface-set';

/** The surfaces every ground set shares: ids, names, roughness, height blending and the colour shown until a tile loads. Each set gives the tiles. */
const S = (id: number, name: string, repeat: number, roughness: number, fallback: string, h = recipe(1)): SurfaceDef =>
  ({ id, name, url: '', repeat, roughness, fallback, height: h });

export const SURF = { seabed: 1, sand: 2, wetSand: 3, grass: 4, rock: 5, cliff: 6, basalt: 7, dunes: 8, mud: 9, strata: 10, moss: 11, coral: 12, lava: 13, scree: 14, pumice: 15, soil: 16,
  /* racing surfaces (texture agent M668-M677) */
  tarmac: 17, tarmacWet: 18, startLine: 19, boostPad: 20, rumble: 21, dirtRoad: 22, boardwalk: 23, cobble: 24, dustyRoad: 25, cliffColumns: 26 } as const;

const BASE_SURFACES: readonly SurfaceDef[] = [
  S(SURF.seabed, 'Shallows', 7, 0.25, '#2a7f8a', recipe(0.3, 0, 0, 0.5)),
  S(SURF.sand, 'Beach sand', 5, 0.9, '#d8c79a'),
  S(SURF.wetSand, 'Wet sand', 5, 0.5, '#9a8a66', recipe(1, 0.4)),
  S(SURF.grass, 'Tropical grass', 1.6, 0.85, '#4f8a3a', recipe(0.2, 0, 1, 1.5)),
  S(SURF.rock, 'Coastal rock', 6, 0.8, '#8a8378', recipe(1, 0, 0, 1.3)),
  S(SURF.cliff, 'Basalt cliff', 9, 0.85, '#4b4f55', recipe(1, 0, 0, 1.3)),
  S(SURF.basalt, 'Wet basalt', 6, 0.55, '#3b3f45', recipe(1, 0, 0, 1.4)),
  S(SURF.dunes, 'Rippled sand', 8, 0.9, '#cdb98a', recipe(1, 0, 0, 0.8)),
  S(SURF.mud, 'Tidal mud', 5, 0.45, '#5b4a3a', recipe(1, 0, 0, 1.3)),
  S(SURF.strata, 'Ochre strata', 9, 0.85, '#a8794a', recipe(1, 0, 0, 1.2)),
  S(SURF.moss, 'Moss', 2, 0.9, '#5d7a34', recipe(0.7, 0, 0.5, 1.2)),
  S(SURF.coral, 'Coral rock', 4, 0.75, '#c9b9a0', recipe(0.3, 1, 0, 1.2)),
  S(SURF.lava, 'Lava crust', 6, 0.7, '#2f2c2c', recipe(1, 0, 0, 1.4)),
  S(SURF.scree, 'Scree', 4, 0.85, '#76716a', recipe(1, 0, 0, 1.3)),
  S(SURF.pumice, 'Pumice gravel', 4, 0.9, '#9a948a'),
  S(SURF.soil, 'Jungle soil', 4, 0.8, '#4a3d2a', recipe(1, 0, 0.3, 1.2)),
  S(SURF.tarmac, 'Tarmac', 4, 0.8, '#3a3b3e', recipe(1, 0, 0, 0.9)),
  S(SURF.tarmacWet, 'Wet tarmac', 4, 0.35, '#2b2d31', recipe(1, 0, 0, 0.9)),
  S(SURF.startLine, 'Start line', 4, 0.7, '#c9c9c9', recipe(1, 0, 0, 0.6)),
  S(SURF.boostPad, 'Boost pad', 4, 0.45, '#1b4a50', recipe(1, 0, 0, 0.6)),
  S(SURF.rumble, 'Rumble strip', 4, 0.7, '#c4473d', recipe(1, 0, 0, 0.8)),
  S(SURF.dirtRoad, 'Jungle dirt road', 5, 0.9, '#7a5a3a', recipe(1, 0, 0, 1.2)),
  S(SURF.boardwalk, 'Bamboo boardwalk', 4, 0.75, '#b39a5e', recipe(1, 0, 0, 0.8)),
  S(SURF.cobble, 'Wet cobblestone', 4, 0.4, '#6b6a66', recipe(1, 0, 0, 1.2)),
  S(SURF.dustyRoad, 'Dusty road', 5, 0.9, '#b99a6a', recipe(1, 0, 0, 1.0)),
  S(SURF.cliffColumns, 'Columnar basalt', 9, 0.8, '#4a4d52', recipe(1, 0, 0, 1.3)),
];

/**
 * The flat (voxel) skin of every surface: hand-picked tones, warm and a little sun-bleached so they sit well under every lighting setup. Each block of
 * ground takes one tone, so a meadow reads as a meadow in bricks and not as noise. Lava has one glowing tone in five.
 */
export const FLAT_PALETTES: Readonly<Record<number, readonly string[]>> = {
  [SURF.seabed]: ['#2f8f9d', '#3a9aa6', '#2a8591', '#47a6ae'],
  [SURF.sand]: ['#dcc58a', '#d4bc7f', '#e3cf96', '#cdb474'],
  [SURF.wetSand]: ['#b9a67a', '#b09d71', '#c2af84', '#a89568'],
  [SURF.grass]: ['#5f9a46', '#69a64d', '#559040', '#74ad52', '#4d8539'],
  [SURF.rock]: ['#9a9387', '#8d867b', '#a39d91', '#837c72'],
  [SURF.cliff]: ['#5b5f66', '#52565d', '#646870', '#4b4f56'],
  [SURF.basalt]: ['#45494f', '#3d4147', '#4f545a', '#363a40'],
  [SURF.dunes]: ['#d9c590', '#d1bd86', '#e0cd99', '#c9b57b'],
  [SURF.mud]: ['#6a5744', '#614f3d', '#725f4b', '#594936'],
  [SURF.strata]: ['#b68455', '#ac7a4b', '#bf8f60', '#a37144'],
  [SURF.moss]: ['#65853a', '#6d8e40', '#5b7a33', '#77963f'],
  [SURF.coral]: ['#d9c9ae', '#d0c0a4', '#e1d2b8', '#c7b79b'],
  [SURF.lava]: ['#ff7a2e', '#e8501f', '#ffb347', '#d9411a', '#3a2a28'],
  [SURF.scree]: ['#7d776f', '#726c64', '#88827a', '#69635c'],
  [SURF.pumice]: ['#a8a296', '#9d978b', '#b2ac9f', '#928c80'],
  [SURF.soil]: ['#8a7747', '#7e6d41', '#95824f', '#74643c'],
  [SURF.tarmac]: ['#47484c', '#404144', '#4e4f53', '#3a3b3f'],
  [SURF.tarmacWet]: ['#33353a', '#2e3035', '#393b41', '#2a2c31'],
  [SURF.startLine]: ['#e8e8e4', '#26272a'],
  [SURF.boostPad]: ['#1f6a72', '#2a8c96', '#19575e'],
  [SURF.rumble]: ['#c9473d', '#e8e6e0'],
  [SURF.dirtRoad]: ['#8a6844', '#7f5f3d', '#93714b', '#765737'],
  [SURF.boardwalk]: ['#c2a766', '#b79d5d', '#cdb372', '#ac9354'],
  [SURF.cobble]: ['#77766f', '#6d6c66', '#82817a', '#64635d'],
  [SURF.dustyRoad]: ['#c4a574', '#bb9c6c', '#cdae7d', '#b3946a'],
  [SURF.cliffColumns]: ['#555960', '#4c5057', '#5e626a', '#44484f'],
};

/**
 * Goblin Racing's 512-pixel tiles, imported from the material library's PBR sheets by scripts/import-material-sheets.mjs (colour, normal +
 * roughness, and the sheet's own height).
 */
const RACING_FILE: Readonly<Record<number, string>> = {
  [SURF.seabed]: 'shallows-m051', [SURF.sand]: 'sand-m006', [SURF.wetSand]: 'wetsand-m516', [SURF.grass]: 'grass-m513', [SURF.rock]: 'rock-m017',
  [SURF.cliff]: 'cliff-m001', [SURF.basalt]: 'basalt-m005', [SURF.dunes]: 'dunes-m282', [SURF.mud]: 'mud-m283', [SURF.strata]: 'strata-m002',
  [SURF.moss]: 'moss-m029', [SURF.coral]: 'coral-m284', [SURF.lava]: 'lava-m509', [SURF.scree]: 'scree-m014', [SURF.pumice]: 'pumice-m289',
  [SURF.soil]: 'soil-m007', [SURF.tarmac]: 'tarmac-m668', [SURF.tarmacWet]: 'tarmac-wet-m669', [SURF.startLine]: 'start-m670',
  [SURF.boostPad]: 'boost-m671', [SURF.rumble]: 'kerb-m672', [SURF.dirtRoad]: 'dirt-road-m673', [SURF.boardwalk]: 'boardwalk-m674',
  [SURF.cobble]: 'cobble-m675', [SURF.dustyRoad]: 'dusty-road-m676', [SURF.cliffColumns]: 'columns-m677',
};
/** Metres per repeat where the new sheets differ from the old tiles: the short grass shows real blades, so it is drawn smaller. */
const RACING_REPEAT: Readonly<Record<number, number>> = { [SURF.grass]: 0.8, [SURF.moss]: 1.5, [SURF.lava]: 4 };

/** Tiles with a direction: never turned to hide their repeats. */
const DIRECTIONAL: ReadonlySet<number> = new Set([SURF.startLine, SURF.boostPad, SURF.rumble, SURF.boardwalk, SURF.dunes, SURF.strata, SURF.cliffColumns, SURF.cobble]);

const finish = (d: SurfaceDef): SurfaceDef => ({ ...d, flat: FLAT_PALETTES[d.id] ?? [d.fallback], ...(d.id === SURF.lava ? { glow: 1.6 } : {}), ...(DIRECTIONAL.has(d.id) ? { directional: true } : {}) });

/** Goblin Racing's ground: the image tiles, the high end (the owner, 2026-10-03: "stunning PBR" there, to show what images can do). */
export const RACING_SURFACES: readonly SurfaceDef[] = BASE_SURFACES.map((d) => {
  const file = RACING_FILE[d.id]!;
  return finish({
    ...d, url: `textures/racing/${file}.webp`, pbrUrl: `textures/racing-pbr/${file}.webp`, heightUrl: `textures/racing-height/${file}.webp`,
    repeat: RACING_REPEAT[d.id] ?? d.repeat,
  });
});

/**
 * The graph set's file name for each surface (packages/texgraph/sets/setmix-ground.json and setmix-voxel.json, baked by
 * scripts/bake-setmix.mjs into public/textures/setmix).
 */
export const SETMIX_FILE: Readonly<Record<number, string>> = {
  [SURF.seabed]: 'shallows', [SURF.sand]: 'sand', [SURF.wetSand]: 'wet-sand', [SURF.grass]: 'grass', [SURF.rock]: 'rock', [SURF.cliff]: 'cliff',
  [SURF.basalt]: 'basalt', [SURF.dunes]: 'dunes', [SURF.mud]: 'mud', [SURF.strata]: 'ochre-strata', [SURF.moss]: 'moss', [SURF.coral]: 'coral',
  [SURF.lava]: 'lava', [SURF.scree]: 'scree', [SURF.pumice]: 'pumice', [SURF.soil]: 'soil', [SURF.tarmac]: 'tarmac', [SURF.tarmacWet]: 'wet-tarmac',
  [SURF.startLine]: 'start-line', [SURF.boostPad]: 'boost-pad', [SURF.rumble]: 'kerb', [SURF.dirtRoad]: 'dirt-road', [SURF.boardwalk]: 'boardwalk',
  [SURF.cobble]: 'cobbles', [SURF.dustyRoad]: 'dusty-road', [SURF.cliffColumns]: 'basalt-columns',
};

/** Metres one SetMix ground tile covers before the look's scale (1.8): about 2 m on the ground, so a grass tuft is a hand across. */
export const SETMIX_TILE_METRES = 1.1;

/**
 * SetMix's own ground, the default everywhere but Goblin Racing: every tile is made from a texture graph (math, no photos), so it is small,
 * seamless and can be changed in the game. Same surfaces, names and palettes as the image set.
 */
export const SETMIX_SURFACES: readonly SurfaceDef[] = BASE_SURFACES.map((d) => {
  const file = SETMIX_FILE[d.id]!;
  const { pbrUrl: _image, ...rest } = d;
  return finish({ ...rest, url: `textures/setmix/${file}.webp`, mapsUrl: `textures/setmix/maps/${file}.webp`, repeat: SETMIX_TILE_METRES });
});

/** The voxel blocks' faces from the graph set: every style's voxel look (rows in the order of setmix-voxel.json). */
export const SETMIX_VOXEL: VoxelSet = {
  url: 'textures/setmix/voxel.webp',
  mapsUrl: 'textures/setmix/voxel-maps.webp',
  variants: 3,
  rows: [SURF.grass, SURF.sand, SURF.wetSand, SURF.rock, SURF.moss, SURF.soil, SURF.lava, SURF.basalt, SURF.dunes, SURF.mud, SURF.scree, SURF.pumice,
    SURF.coral, SURF.strata, SURF.cliff, SURF.seabed, SURF.tarmac, SURF.tarmacWet, SURF.startLine, SURF.boostPad, SURF.rumble, SURF.dirtRoad,
    SURF.boardwalk, SURF.cobble, SURF.dustyRoad, SURF.cliffColumns],
};

/** The default: SetMix's graph-made ground. */
export const STARTER_SURFACES: readonly SurfaceDef[] = SETMIX_SURFACES;
