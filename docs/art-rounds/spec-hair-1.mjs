/** Round 3b: four new hair pieces on all three head shapes. */
import { generateRandomGoblin } from '../../src/game/meta/goblin-dna.ts';
const bare = { eyewear: 0, hair: 0, headgear: 0, neck: 0, warpaint: 0, ears: 2 };
const on = (layers) => ({ ...generateRandomGoblin(11, 2), layers: { ...generateRandomGoblin(11, 2).layers, ...layers } });
export const entries = [
  { label: 'pigtails-a', config: on({ ...bare, head: 0, hair: 12 }) },
  { label: 'pigtails-b', config: on({ ...bare, head: 1, hair: 12 }) },
  { label: 'pigtails-s', config: on({ ...bare, head: 2, hair: 12 }) },
  { label: 'ponytail-a', config: on({ ...bare, head: 0, hair: 13 }) },
  { label: 'ponytail-b', config: on({ ...bare, head: 1, hair: 13 }) },
  { label: 'ponytail-s', config: on({ ...bare, head: 2, hair: 13 }) },
  { label: 'fringe-a', config: on({ ...bare, head: 0, hair: 14 }) },
  { label: 'fringe-b', config: on({ ...bare, head: 1, hair: 14 }) },
  { label: 'fringe-s', config: on({ ...bare, head: 2, hair: 14 }) },
  { label: 'buzz-a', config: on({ ...bare, head: 0, hair: 15 }) },
  { label: 'buzz-b', config: on({ ...bare, head: 1, hair: 15 }) },
  { label: 'buzz-s', config: on({ ...bare, head: 2, hair: 15 }) },
];
