/** Round 2b: valve cap + oil beret on all three head shapes. */
import { generateRandomGoblin } from '../../src/game/meta/goblin-dna.ts';
const bare = { eyewear: 0, hair: 0, headgear: 0, neck: 0, warpaint: 0, ears: 2 };
const on = (layers) => ({ ...generateRandomGoblin(11, 2), layers: { ...generateRandomGoblin(11, 2).layers, ...layers } });
export const entries = [
  { label: 'valvecap-angular', config: on({ ...bare, head: 0, headgear: 17 }) },
  { label: 'valvecap-bloated', config: on({ ...bare, head: 1, headgear: 17 }) },
  { label: 'valvecap-scrawny', config: on({ ...bare, head: 2, headgear: 17 }) },
  { label: 'oilberet-angular', config: on({ ...bare, head: 0, headgear: 18 }) },
  { label: 'oilberet-bloated', config: on({ ...bare, head: 1, headgear: 18 }) },
  { label: 'oilberet-scrawny', config: on({ ...bare, head: 2, headgear: 18 }) },
];
