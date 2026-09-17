import type { CourseId } from './types';

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
}

export const TRACKS: Record<CourseId, CourseDefinition> = {
  ridge: {
    id: 'ridge', biome: 'forest', region: 'Copperwood Valley', character: 'Flow & momentum',
    description: 'Ochre dirt, pine shadows, and sweeping grades. A flowing route with room to line up the next jump.',
    stadium: 'THE SCRAPDOME',
    profile: [[0, 0], [1400, 0], [5400, 600], [10000, 1960], [13600, 2130], [18600, 3830], [23000, 4380], [26400, 4970], [27000, 5060], [31000, 5060]],
    sectors: ['THE LAUNCH RIDGE', 'COPPERWOOD DESCENT', 'THE SCREAMING SLOPE', 'SHEPHERD\'S REST', 'DEADWEIGHT DROP', 'THE LOWER SWITCHBACK', 'STADIUM APPROACH', 'THE SCRAPDOME'],
    palette: { sky: '#234b49', horizon: '#9cbd9e', distant: '#658c76', middle: '#3e6651', foreground: '#203e31', dirt: '#8b7651', dirtLight: '#a28b61', bank: '#544732', soil: '#2f4432', shoulder: '#526343', chalk: '#d9cc9e', grass: '#657449', accent: '#d8a15e', haze: '#789878' },
  },
  boomtown: {
    id: 'boomtown', biome: 'canyon', region: 'The Brass Quarries', character: 'Bursts & commitment',
    description: 'Rust-colored canyon walls, long drops, and dynamite shortcuts. Commit to your lane before the quarry opens up.',
    stadium: 'THE BLAST FURNACE',
    profile: [[0, 0], [1400, 0], [5400, 1040], [10000, 1790], [13600, 3190], [18600, 3490], [23000, 5040], [26400, 5670], [27000, 5780], [31000, 5780]],
    sectors: ['THE QUARRY GATE', 'COPPER CANYON', 'POWDERKEG STRAIGHT', 'THE BIG DROP', 'SMOKESTACK SHELF', 'DYNAMITE DESCENT', 'FURNACE APPROACH', 'THE BLAST FURNACE'],
    palette: { sky: '#655142', horizon: '#d8b884', distant: '#aa8661', middle: '#805c41', foreground: '#4a382b', dirt: '#a57c57', dirtLight: '#b99065', bank: '#72503c', soil: '#624a36', shoulder: '#84704b', chalk: '#e2cda0', grass: '#837b49', accent: '#e7aa56', haze: '#ad8861' },
  },
  sheep: {
    id: 'sheep', biome: 'meadow', region: 'The Woolwind Downs', character: 'Hops & lane choices',
    description: 'Open grasslands and pale packed earth. Gentle shelves alternate with springy descents and very unimpressed locals.',
    stadium: 'THE WOOLLY COLISEUM',
    profile: [[0, 0], [1400, 0], [5400, 310], [10000, 1200], [13600, 1510], [18600, 2690], [23000, 2890], [26400, 3540], [27000, 3600], [31000, 3600]],
    sectors: ['THE HILLTOP PADDOCK', 'WOOLWIND MEADOW', 'RAMBLER\'S RUN', 'THE GRAZING SHELF', 'SHEEP LEAP', 'LOWER PASTURES', 'COLISEUM APPROACH', 'THE WOOLLY COLISEUM'],
    palette: { sky: '#42656b', horizon: '#c3d6ad', distant: '#87a993', middle: '#5c8661', foreground: '#355237', dirt: '#a79b70', dirtLight: '#b9ac80', bank: '#71674b', soil: '#4a6940', shoulder: '#6c8249', chalk: '#eee0ba', grass: '#91a359', accent: '#b9ca78', haze: '#a5be99' },
  },
};

export const trackById = (id: CourseId) => TRACKS[id];