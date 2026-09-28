/** Round 5a: three final mouths (catalog 20/20) on all three head shapes. */
import { generateRandomGoblin } from '../../src/game/meta/goblin-dna.ts';
const bare = { eyewear: 0, hair: 0, headgear: 0, neck: 0, warpaint: 0, ears: 2 };
const on = (layers) => ({ ...generateRandomGoblin(11, 2), layers: { ...generateRandomGoblin(11, 2).layers, ...layers } });
export const entries = [
  { label: 'whistle-a', config: on({ ...bare, head: 0, mouth: 17 }) },
  { label: 'whistle-b', config: on({ ...bare, head: 1, mouth: 17 }) },
  { label: 'whistle-s', config: on({ ...bare, head: 2, mouth: 17 }) },
  { label: 'bolt-a', config: on({ ...bare, head: 0, mouth: 18 }) },
  { label: 'bolt-b', config: on({ ...bare, head: 1, mouth: 18 }) },
  { label: 'bolt-s', config: on({ ...bare, head: 2, mouth: 18 }) },
  { label: 'oildrip-a', config: on({ ...bare, head: 0, mouth: 19 }) },
  { label: 'oildrip-b', config: on({ ...bare, head: 1, mouth: 19 }) },
  { label: 'oildrip-s', config: on({ ...bare, head: 2, mouth: 19 }) },
];
