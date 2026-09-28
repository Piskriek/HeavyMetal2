/** Round 2: five neck pieces + two crown hats, angular first pass plus cross-head tiles. */
import { generateRandomGoblin } from '../../src/game/meta/goblin-dna.ts';
const bare = { eyewear: 0, hair: 0, headgear: 0, neck: 0, warpaint: 0, ears: 2 };
const on = (layers) => ({ ...generateRandomGoblin(11, 2), layers: { ...generateRandomGoblin(11, 2).layers, ...layers } });
export const entries = [
  { label: 'aviatorscarf-angular', config: on({ ...bare, head: 0, neck: 13 }) },
  { label: 'sergeant-angular', config: on({ ...bare, head: 0, neck: 14 }) },
  { label: 'torc-angular', config: on({ ...bare, head: 0, neck: 15 }) },
  { label: 'checkbandana-angular', config: on({ ...bare, head: 0, neck: 16 }) },
  { label: 'wrench-angular', config: on({ ...bare, head: 0, neck: 17 }) },
  { label: 'smokestack-angular', config: on({ ...bare, head: 0, headgear: 15 }) },
  { label: 'jewelcrown-angular', config: on({ ...bare, head: 0, headgear: 16 }) },
  { label: 'smokestack-bloated', config: on({ ...bare, head: 1, headgear: 15 }) },
  { label: 'jewelcrown-bloated', config: on({ ...bare, head: 1, headgear: 16 }) },
  { label: 'torc-bloated', config: on({ ...bare, head: 1, neck: 15 }) },
  { label: 'smokestack-scrawny', config: on({ ...bare, head: 2, headgear: 15 }) },
  { label: 'sergeant-scrawny', config: on({ ...bare, head: 2, neck: 14 }) },
  { label: 'checkbandana-bloated', config: on({ ...bare, head: 1, neck: 16 }) },
];
