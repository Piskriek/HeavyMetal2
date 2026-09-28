/** Round 5b: five final headgear (catalog 24/24) on all three head shapes. */
import { generateRandomGoblin } from '../../src/game/meta/goblin-dna.ts';
const bare = { eyewear: 0, hair: 0, headgear: 0, neck: 0, warpaint: 0, ears: 2 };
const on = (layers) => ({ ...generateRandomGoblin(11, 2), layers: { ...generateRandomGoblin(11, 2).layers, ...layers } });
export const entries = [
  { label: 'eardef-a', config: on({ ...bare, head: 0, headgear: 19 }) },
  { label: 'eardef-b', config: on({ ...bare, head: 1, headgear: 19 }) },
  { label: 'eardef-s', config: on({ ...bare, head: 2, headgear: 19 }) },
  { label: 'flatcap-a', config: on({ ...bare, head: 0, headgear: 20 }) },
  { label: 'flatcap-b', config: on({ ...bare, head: 1, headgear: 20 }) },
  { label: 'flatcap-s', config: on({ ...bare, head: 2, headgear: 20 }) },
  { label: 'turbo-a', config: on({ ...bare, head: 0, headgear: 21 }) },
  { label: 'turbo-b', config: on({ ...bare, head: 1, headgear: 21 }) },
  { label: 'turbo-s', config: on({ ...bare, head: 2, headgear: 21 }) },
  { label: 'checkcap-a', config: on({ ...bare, head: 0, headgear: 22 }) },
  { label: 'checkcap-b', config: on({ ...bare, head: 1, headgear: 22 }) },
  { label: 'checkcap-s', config: on({ ...bare, head: 2, headgear: 22 }) },
  { label: 'magnet-a', config: on({ ...bare, head: 0, headgear: 23 }) },
  { label: 'magnet-b', config: on({ ...bare, head: 1, headgear: 23 }) },
  { label: 'magnet-s', config: on({ ...bare, head: 2, headgear: 23 }) },
];
