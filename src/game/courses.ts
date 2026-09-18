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
  biome: 'forest' | 'canyon' | 'meadow';
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
 * Build the 36 km odyssey elevation in world units. The middle shape deliberately
 * alternates steep shelves and short recovery terraces: the camera reads as a
 * natural waterfall zig-zag instead of one long, featureless ramp.
 */
function odysseyProfile(stageOneEnd: number, cliffScale: number): readonly (readonly [number, number])[] {
  const points: [number, number][] = [
    [0, 0], [1400, 0],
    [5400, stageOneEnd * 0.13], [10000, stageOneEnd * 0.42],
    [13600, stageOneEnd * 0.46], [18600, stageOneEnd * 0.83],
    [23000, stageOneEnd * 0.95], [24000, stageOneEnd],
  ];
  const cascade = [
    [24000, 0], [25200, 1200], [26400, 2700], [27600, 3200],
    [28800, 4800], [30000, 5850], [31200, 7600], [32400, 8100],
    [33600, 9750], [34800, 10850], [36000, 12050], [37200, 12550],
    [38400, 14050], [39600, 14550], [40800, 16200], [42000, 17200],
    [43200, 17700], [44400, 19200], [45600, 19700], [46800, 21300],
    [48000, 22300],
  ];
  for (const [x, offset] of cascade.slice(1)) points.push([x, stageOneEnd + offset * cliffScale]);
  const sectionTwoEnd = points[points.length - 1][1];
  for (const [x, rise] of [[49200, 400], [51600, 1600], [54000, 2600], [56400, 4100], [58800, 5000], [61200, 5900], [63600, 6400], [66000, 6800], [68400, 7000], [69000, 7000], [72000, 7000]]) {
    points.push([x, sectionTwoEnd + rise]);
  }
  return points;
}

const ODYSSEY_SECTORS = [
  'THE LAUNCH RIDGE', 'COPPERWOOD DESCENT', 'THE SCREAMING SLOPE', "SHEPHERD'S REST",
  'DEADWEIGHT DROP', 'THE LOWER SWITCHBACK', 'SCRAP FALL CREST', 'WATERFALL LAUNCH',
  'UPPER SWITCHBACKS', 'PINBALL ROCKFIELD', 'FOAM RUN', 'ROPE BRIDGE CASCADE',
  'WHIRLPOOL DESCENT', 'CAVERN MAW', 'THE UNDERGROUND RUN', 'STADIUM APPROACH', 'THE SCRAPDOME',
] as const;

export const TRACKS: Record<CourseId, CourseDefinition> = {
  ridge: {
    id: 'ridge', biome: 'forest', region: 'Copperwood Valley', character: 'Flow & momentum',
    description: 'Ochre dirt, pine shadows, and sweeping grades. A flowing route with room to line up the next jump before the waterfall cliff.',
    stadium: 'THE SCRAPDOME',
    profile: odysseyProfile(4630, 1),
    sectors: ODYSSEY_SECTORS,
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
    description: 'Rust-colored canyon walls, long drops, and dynamite shortcuts. Commit to your lane before the quarry opens up over the waterfall gorge.',
    stadium: 'THE BLAST FURNACE',
    profile: odysseyProfile(5350, 1.08),
    sectors: ODYSSEY_SECTORS,
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
    description: 'Open grasslands and pale packed earth. Gentle shelves turn into a misty waterfall cascade and very unimpressed locals.',
    stadium: 'THE WOOLLY COLISEUM',
    profile: odysseyProfile(2950, 0.72),
    sectors: ODYSSEY_SECTORS,
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
};

export const trackById = (id: CourseId) => TRACKS[id];