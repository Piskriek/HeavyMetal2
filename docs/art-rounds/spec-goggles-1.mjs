/** Round 4a: seven new eyewear pieces (angular), strap pieces cross-checked on all heads. */
import { generateRandomGoblin } from '../../src/game/meta/goblin-dna.ts';
const bare = { eyewear: 0, hair: 0, headgear: 0, neck: 0, warpaint: 0, ears: 2 };
const on = (layers) => ({ ...generateRandomGoblin(11, 2), layers: { ...generateRandomGoblin(11, 2).layers, ...layers } });
export const entries = [
  { label: 'steam-a', config: on({ ...bare, head: 0, eyewear: 14 }) },
  { label: 'steam-b', config: on({ ...bare, head: 1, eyewear: 14 }) },
  { label: 'steam-s', config: on({ ...bare, head: 2, eyewear: 14 }) },
  { label: 'furpilot-a', config: on({ ...bare, head: 0, eyewear: 15 }) },
  { label: 'gauge-a', config: on({ ...bare, head: 0, eyewear: 16 }) },
  { label: 'safety-a', config: on({ ...bare, head: 0, eyewear: 17 }) },
  { label: 'retro-a', config: on({ ...bare, head: 0, eyewear: 19 }) },
  { label: 'visor-a', config: on({ ...bare, head: 0, eyewear: 18 }) },
  { label: 'visor-b', config: on({ ...bare, head: 1, eyewear: 18 }) },
  { label: 'visor-s', config: on({ ...bare, head: 2, eyewear: 18 }) },
  { label: 'welder-a', config: on({ ...bare, head: 0, eyewear: 13 }) },
  { label: 'welder-b', config: on({ ...bare, head: 1, eyewear: 13 }) },
  { label: 'welder-s', config: on({ ...bare, head: 2, eyewear: 13 }) },
];
