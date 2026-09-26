import type { CourseId } from './types';

export interface CourseLighting {
  /** Path to the high-resolution painted panoramic skybox (2048x1024). */
  skyboxUrl: string;
  /** Volumetric fog tint applied to distant terrain. */
  fogColor: string;
  /** Ambient light fill color — tints shadows and unlit surfaces. */
  ambientLight: string;
  /** Intensity of god-rays / sunbeams piercing clouds and canopy (0-1). */
  sunbeamIntensity: number;
  /** Color of sun light source (for rim lights and glow). */
  sunColor: string;
  /** Optional CSS color overlay for the track surface to reinforce theme. */
  trackTint?: string;
}

export interface CourseDefinition {
  id: CourseId;
  biome: 'forest' | 'canyon' | 'meadow' | 'island';
  region: string;
  character: string;
  description: string;
  stadium: string;
  profile: readonly (readonly [number, number])[];
  sectors: readonly string[];
  palette: {
    sky: string; horizon: string; distant: string; middle: string; foreground: string;
    dirt: string; dirtLight: string; bank: string; soil: string; shoulder: string;
    chalk: string; grass: string; accent: string; haze: string;
  };
  /** TICKET-06: thematic lighting profile for Blizzard-style mood. */
  lighting: CourseLighting;
}

/**
 * Rustbucket Ridge's profile. Basalt Isle rides it too for now (ISLAND-ROUTE): the sorting pool, the
 * start and the loops are tuned and tested on it, so the island's first version changes the world, not
 * the physics.
 */
const RIDGE_PROFILE: readonly (readonly [number, number])[] = [
  [0, 0], [1400, 0], [5400, 600], [10000, 1960], [13600, 2130], [18600, 3830], [23000, 4380], [24000, 4500],
  [24800, 4800], [26000, 7200], [30000, 11000], [36000, 14500], [42000, 17200], [46000, 18500], [48000, 19000],
  [50000, 19800], [54000, 20800], [58000, 21200], [62000, 20500], [66000, 21400], [68000, 21000],
  [70000, 18500], [71000, 18000], [72000, 18000], [76000, 18000]
];

export const TRACKS: Record<CourseId, CourseDefinition> = {
  ridge: {
    id: 'ridge', biome: 'forest', region: 'Copperwood Valley', character: 'Flow & momentum',
    description: 'Ochre dirt, pine shadows, and sweeping grades. A flowing route with room to line up the next jump.',
    stadium: 'THE SCRAPDOME',
    profile: RIDGE_PROFILE,
    sectors: [
      'THE LAUNCH RIDGE', 'COPPERWOOD DESCENT', 'THE SCREAMING SLOPE',
      'THE CANYON LIP', 'THE WALL OF WATER', 'PINBALL CHASM',
      'WHIRLPOOL SPLASHDOWN', 'THE DROWNED MAW', 'SPAGHETTI TRESTLE',
      'THE LAVA CHAMBER', 'WATERFALL BREAKTHROUGH', 'THE SCRAPDOME'
    ],
    palette: { sky: '#234b49', horizon: '#9cbd9e', distant: '#658c76', middle: '#3e6651', foreground: '#203e31', dirt: '#8b7651', dirtLight: '#a28b61', bank: '#544732', soil: '#2f4432', shoulder: '#526343', chalk: '#d9cc9e', grass: '#657449', accent: '#d8a15e', haze: '#789878' },
    lighting: {
      skyboxUrl: '/art/tracks/sky_copperwood_ridge.png',
      fogColor: '#b8a77a',
      ambientLight: '#6b5f3f',
      sunbeamIntensity: 0.45,
      sunColor: '#f0c070',
      trackTint: '#8b7651',
    },
  },
  boomtown: {
    id: 'boomtown', biome: 'canyon', region: 'The Brass Quarries', character: 'Bursts & commitment',
    description: 'Rust-colored canyon walls, long drops, and dynamite shortcuts. Commit to your lane before the quarry opens up.',
    stadium: 'THE BLAST FURNACE',
    profile: [
      [0, 0], [1400, 0], [5400, 1040], [10000, 1790], [13600, 3190], [18600, 3490], [23000, 5040], [24000, 5200],
      [24800, 5600], [26000, 8200], [30000, 12200], [36000, 15800], [42000, 18600], [46000, 19900], [48000, 20400],
      [50000, 21200], [54000, 22200], [58000, 22800], [62000, 22100], [66000, 23000], [68000, 22600],
      [70000, 19800], [71000, 19400], [72000, 19400], [76000, 19400]
    ],
    sectors: [
      'THE QUARRY GATE', 'COPPER CANYON', 'POWDERKEG STRAIGHT',
      'THE CANYON LIP', 'THE WALL OF WATER', 'PINBALL CHASM',
      'WHIRLPOOL SPLASHDOWN', 'THE BLAST CORE', 'SPAGHETTI TRESTLE',
      'MOLTEN FURNACE', 'WATERFALL BREAKTHROUGH', 'THE BLAST FURNACE'
    ],
    palette: { sky: '#655142', horizon: '#d8b884', distant: '#aa8661', middle: '#805c41', foreground: '#4a382b', dirt: '#a57c57', dirtLight: '#b99065', bank: '#72503c', soil: '#624a36', shoulder: '#84704b', chalk: '#e2cda0', grass: '#837b49', accent: '#e7aa56', haze: '#ad8861' },
    lighting: {
      skyboxUrl: '/art/tracks/sky_boomtown_quarry.png',
      fogColor: '#c98855',
      ambientLight: '#4a2e1e',
      sunbeamIntensity: 0.55,
      sunColor: '#ff8833',
      trackTint: '#a57c57',
    },
  },
  sheep: {
    id: 'sheep', biome: 'meadow', region: 'The Woolwind Downs', character: 'Hops & lane choices',
    description: 'Open grasslands and pale packed earth. Gentle shelves alternate with springy descents and very unimpressed locals.',
    stadium: 'THE WOOLLY COLISEUM',
    profile: [
      [0, 0], [1400, 0], [5400, 310], [10000, 1200], [13600, 1510], [18600, 2690], [23000, 2890], [24000, 3050],
      [24800, 3400], [26000, 5800], [30000, 9200], [36000, 12600], [42000, 15200], [46000, 16400], [48000, 16900],
      [50000, 17600], [54000, 18500], [58000, 18900], [62000, 18200], [66000, 19100], [68000, 18700],
      [70000, 16200], [71000, 15800], [72000, 15800], [76000, 15800]
    ],
    sectors: [
      'THE HILLTOP PADDOCK', 'WOOLWIND MEADOW', 'RAMBLER\'S RUN',
      'THE CANYON LIP', 'THE WALL OF WATER', 'PINBALL CHASM',
      'WHIRLPOOL SPLASHDOWN', 'CRYSTAL GROTTO', 'SPAGHETTI TRESTLE',
      'UNDERGROUND MINE', 'WATERFALL BREAKTHROUGH', 'THE WOOLLY COLISEUM'
    ],
    palette: { sky: '#42656b', horizon: '#c3d6ad', distant: '#87a993', middle: '#5c8661', foreground: '#355237', dirt: '#a79b70', dirtLight: '#b9ac80', bank: '#71674b', soil: '#4a6940', shoulder: '#6c8249', chalk: '#eee0ba', grass: '#91a359', accent: '#b9ca78', haze: '#a5be99' },
    lighting: {
      skyboxUrl: '/art/tracks/sky_woolly_wasteland.png',
      fogColor: '#9eb0a8',
      ambientLight: '#5b7282',
      sunbeamIntensity: 0.35,
      sunColor: '#d8e8c8',
      trackTint: '#a79b70',
    },
  },
  basalt: {
    id: 'basalt', biome: 'island', region: 'Basalt Isle', character: 'Forks & crossings',
    description: 'Late for the race: out of the shack on the summit, into the Maw, then down a braid of roads that split, cross and rejoin, all the way to the lagoon.',
    stadium: 'THE LAGOON ARENA',
    profile: RIDGE_PROFILE,
    sectors: [
      'THE SUMMIT SHACK', 'THE MAW', 'THE CALDERA',
      'OBSIDIAN SPIRAL', 'THE LAVA TUBE', 'THE CHAMBERS',
      'WATERFALL BREAKTHROUGH', 'CLIFF ROAD', 'THE CROSSING',
      'THE SEA ARCH', 'SEA STACK SLALOM', 'THE DRAIN'
    ],
    palette: { sky: '#6f8b94', horizon: '#b9c7c4', distant: '#7d9290', middle: '#5b5249', foreground: '#2f2a27', dirt: '#a07a4a', dirtLight: '#b68d58', bank: '#4a3f36', soil: '#3b332d', shoulder: '#6e5a42', chalk: '#e6d3a8', grass: '#8c7a4a', accent: '#e3a24f', haze: '#a9bcbd' },
    lighting: {
      skyboxUrl: '/art/tracks/sky_copperwood_misty_dawn.png',
      fogColor: '#aebfbf',
      ambientLight: '#5d6566',
      sunbeamIntensity: 0.4,
      sunColor: '#fff0cf',
      trackTint: '#a07a4a',
    },
  },
};

export const trackById = (id: CourseId) => TRACKS[id];