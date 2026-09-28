/** Eyeball spec for the rig fix: the structural bust on all three heads + rig-sensitive parts. */
import { generateRandomGoblin } from '../../src/game/meta/goblin-dna.ts';

const bare = { eyewear: 0, hair: 0, headgear: 0, neck: 0, warpaint: 0 };
const on = (seed, layers) => ({ ...generateRandomGoblin(seed, 2), layers: { ...generateRandomGoblin(seed, 2).layers, ...layers } });

export const entries = [
  { label: 'bust-angular', config: on(11, { ...bare, head: 0 }) },
  { label: 'bust-bloated', config: on(11, { ...bare, head: 1 }) },
  { label: 'bust-scrawny', config: on(11, { ...bare, head: 2 }) },
  { label: 'bust-scarf-bloated', config: on(11, { ...bare, head: 1, neck: 11 }) },
  { label: 'tophat-bloated', config: on(11, { ...bare, head: 1, headgear: 6 }) },
  { label: 'bat-ears-bloated', config: on(11, { ...bare, head: 1, ears: 4 }) },
  { label: 'warpaint-scrawny', config: on(11, { ...bare, head: 2, warpaint: 5 }) },
  { label: 'full-kit-angular', config: on(4, {}) },
];
