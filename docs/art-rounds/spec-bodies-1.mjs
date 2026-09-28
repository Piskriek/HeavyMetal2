/** Round 1: the six new bodies, each on angular, plus two cross-head sanity tiles. */
import { generateRandomGoblin } from '../../src/game/meta/goblin-dna.ts';
const bare = { eyewear: 0, hair: 0, headgear: 0, neck: 0, warpaint: 0, ears: 2 };
const on = (seed, layers) => ({ ...generateRandomGoblin(seed, 2), layers: { ...generateRandomGoblin(seed, 2).layers, ...layers } });
export const entries = [
  { label: 'overalls-angular', config: on(11, { ...bare, head: 0, body: 1 }) },
  { label: 'bomber-angular', config: on(11, { ...bare, head: 0, body: 2 }) },
  { label: 'junkknight-angular', config: on(11, { ...bare, head: 0, body: 3 }) },
  { label: 'warlord-angular', config: on(11, { ...bare, head: 0, body: 4 }) },
  { label: 'pitcrew-angular', config: on(11, { ...bare, head: 0, body: 5 }) },
  { label: 'apron-angular', config: on(11, { ...bare, head: 0, body: 6 }) },
  { label: 'warlord-bloated', config: on(11, { ...bare, head: 1, body: 4 }) },
  { label: 'apron-scrawny', config: on(11, { ...bare, head: 2, body: 6 }) },
  { label: 'bomber-bloated', config: on(11, { ...bare, head: 1, body: 2 }) },
];
