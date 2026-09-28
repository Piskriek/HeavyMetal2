/** Round 3a: five new mouths on all three head shapes. */
import { generateRandomGoblin } from '../../src/game/meta/goblin-dna.ts';
const bare = { eyewear: 0, hair: 0, headgear: 0, neck: 0, warpaint: 0, ears: 2 };
const on = (layers) => ({ ...generateRandomGoblin(11, 2), layers: { ...generateRandomGoblin(11, 2).layers, ...layers } });
export const entries = [
  { label: 'gnashers-a', config: on({ ...bare, head: 0, mouth: 12 }) },
  { label: 'gnashers-b', config: on({ ...bare, head: 1, mouth: 12 }) },
  { label: 'gnashers-s', config: on({ ...bare, head: 2, mouth: 12 }) },
  { label: 'beartrap-a', config: on({ ...bare, head: 0, mouth: 13 }) },
  { label: 'beartrap-b', config: on({ ...bare, head: 1, mouth: 13 }) },
  { label: 'beartrap-s', config: on({ ...bare, head: 2, mouth: 13 }) },
  { label: 'blowtorch-a', config: on({ ...bare, head: 0, mouth: 14 }) },
  { label: 'blowtorch-b', config: on({ ...bare, head: 1, mouth: 14 }) },
  { label: 'zipper-a', config: on({ ...bare, head: 0, mouth: 15 }) },
  { label: 'zipper-s', config: on({ ...bare, head: 2, mouth: 15 }) },
  { label: 'spanner-a', config: on({ ...bare, head: 0, mouth: 16 }) },
  { label: 'spanner-s', config: on({ ...bare, head: 2, mouth: 16 }) },
];
