/** Round 4b: fur mantle + plug cables on all three head shapes. */
import { generateRandomGoblin } from '../../src/game/meta/goblin-dna.ts';
const bare = { eyewear: 0, hair: 0, headgear: 0, neck: 0, warpaint: 0, ears: 2 };
const on = (layers) => ({ ...generateRandomGoblin(11, 2), layers: { ...generateRandomGoblin(11, 2).layers, ...layers } });
export const entries = [
  { label: 'mantle-a', config: on({ ...bare, head: 0, neck: 18 }) },
  { label: 'mantle-b', config: on({ ...bare, head: 1, neck: 18 }) },
  { label: 'mantle-s', config: on({ ...bare, head: 2, neck: 18 }) },
  { label: 'cables-a', config: on({ ...bare, head: 0, neck: 19 }) },
  { label: 'cables-b', config: on({ ...bare, head: 1, neck: 19 }) },
  { label: 'cables-s', config: on({ ...bare, head: 2, neck: 19 }) },
];
