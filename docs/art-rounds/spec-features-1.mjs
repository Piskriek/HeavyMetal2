/** Round 6: two ears (moth, shredded) + two eyes (dizzy swirls, rivet sockets) on all three heads. */
import { generateRandomGoblin } from '../../src/game/meta/goblin-dna.ts';
const bare = { eyewear: 0, hair: 0, headgear: 0, neck: 0, warpaint: 0 };
const on = (layers) => ({ ...generateRandomGoblin(11, 2), layers: { ...generateRandomGoblin(11, 2).layers, ...layers } });
export const entries = [
  { label: 'moth-a', config: on({ ...bare, head: 0, ears: 10 }) },
  { label: 'moth-b', config: on({ ...bare, head: 1, ears: 10 }) },
  { label: 'moth-s', config: on({ ...bare, head: 2, ears: 10 }) },
  { label: 'shred-a', config: on({ ...bare, head: 0, ears: 11 }) },
  { label: 'shred-b', config: on({ ...bare, head: 1, ears: 11 }) },
  { label: 'shred-s', config: on({ ...bare, head: 2, ears: 11 }) },
  { label: 'dizzy-a', config: on({ ...bare, head: 0, ears: 2, eyes: 10 }) },
  { label: 'dizzy-b', config: on({ ...bare, head: 1, ears: 2, eyes: 10 }) },
  { label: 'dizzy-s', config: on({ ...bare, head: 2, ears: 2, eyes: 10 }) },
  { label: 'socket-a', config: on({ ...bare, head: 0, ears: 2, eyes: 11 }) },
  { label: 'socket-b', config: on({ ...bare, head: 1, ears: 2, eyes: 11 }) },
  { label: 'socket-s', config: on({ ...bare, head: 2, ears: 2, eyes: 11 }) },
];
