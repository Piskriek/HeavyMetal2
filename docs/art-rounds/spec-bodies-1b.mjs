/** Round 1b: cape / poncho / captain coat on all three head shapes. */
import { generateRandomGoblin } from '../../src/game/meta/goblin-dna.ts';
const bare = { eyewear: 0, hair: 0, headgear: 0, neck: 0, warpaint: 0, ears: 2 };
const on = (seed, layers) => ({ ...generateRandomGoblin(seed, 2), layers: { ...generateRandomGoblin(seed, 2).layers, ...layers } });
export const entries = [
  { label: 'cape-angular', config: on(11, { ...bare, head: 0, body: 7 }) },
  { label: 'cape-bloated', config: on(11, { ...bare, head: 1, body: 7 }) },
  { label: 'cape-scrawny', config: on(11, { ...bare, head: 2, body: 7 }) },
  { label: 'poncho-angular', config: on(11, { ...bare, head: 0, body: 8 }) },
  { label: 'poncho-bloated', config: on(11, { ...bare, head: 1, body: 8 }) },
  { label: 'poncho-scrawny', config: on(11, { ...bare, head: 2, body: 8 }) },
  { label: 'captain-angular', config: on(11, { ...bare, head: 0, body: 9 }) },
  { label: 'captain-bloated', config: on(11, { ...bare, head: 1, body: 9 }) },
  { label: 'captain-scrawny', config: on(11, { ...bare, head: 2, body: 9 }) },
];
