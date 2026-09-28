/** Round 8: three noses (boxer, pug, bandage) on all three heads + six new wardrobe bodies. */
import { generateRandomGoblin } from '../../src/game/meta/goblin-dna.ts';
const bare = { eyewear: 0, hair: 0, headgear: 0, neck: 0, warpaint: 0, background: 1 };
const on = (layers) => { const g = generateRandomGoblin(11, 2); return { ...g, layers: { ...g.layers, ...layers } }; };
const nz = (label, head, nose) => ({ label, config: on({ ...bare, head, nose }) });
const bd = (label, body) => ({ label, config: on({ ...bare, head: 0, body }) });
export const entries = [
  nz('boxer-a', 0, 9), nz('boxer-b', 1, 9), nz('boxer-s', 2, 9),
  nz('pug-a', 0, 10), nz('pug-b', 1, 10), nz('pug-s', 2, 10),
  nz('band-a', 0, 11), nz('band-b', 1, 11), nz('band-s', 2, 11),
  bd('welder', 10), bd('roadie', 11), bd('flagwrap', 12),
  bd('pinstripe', 13), bd('furcoat', 14), bd('oilskin', 15),
];
