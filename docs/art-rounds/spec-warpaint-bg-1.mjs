/** Round 7: five warpaint marks (carbon, star, tears, ash, bolt) on all three heads + four new backdrops. */
import { generateRandomGoblin } from '../../src/game/meta/goblin-dna.ts';
const bare = { eyewear: 0, hair: 0, headgear: 0, neck: 0, warpaint: 0, background: 1 };
const on = (layers) => { const g = generateRandomGoblin(11, 2); return { ...g, layers: { ...g.layers, ...layers } }; };
const wp = (label, head, warpaint) => ({ label, config: on({ ...bare, head, warpaint }) });
const bg = (label, background) => ({ label, config: on({ ...bare, head: 0, background }) });
export const entries = [
  wp('scorch-a', 0, 7), wp('scorch-b', 1, 7), wp('scorch-s', 2, 7),
  wp('star-a', 0, 8), wp('star-b', 1, 8), wp('star-s', 2, 8),
  wp('tears-a', 0, 9), wp('tears-b', 1, 9), wp('tears-s', 2, 9),
  wp('ash-a', 0, 10), wp('ash-b', 1, 10), wp('ash-s', 2, 10),
  wp('bolt-a', 0, 11), wp('bolt-b', 1, 11), wp('bolt-s', 2, 11),
  bg('bg-scrap', 8), bg('bg-canyon', 9), bg('bg-garage', 10), bg('bg-podium', 11),
];
