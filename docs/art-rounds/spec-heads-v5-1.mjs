/** Round 9: five new heads (bare identical features) + the six vault parts back from DNA v5. */
import { generateRandomGoblin } from '../../src/game/meta/goblin-dna.ts';
const bare = { eyewear: 0, hair: 0, headgear: 0, neck: 0, warpaint: 0, background: 1 };
const hd = (label, head) => {
  const g = generateRandomGoblin(5, 2);
  return { label, config: { ...g, layers: { ...g.layers, ...bare, ears: 4, eyes: 4, nose: 3, mouth: 4, head } } };
};
const fr = (label, layers) => {
  const g = generateRandomGoblin(7, 4);
  return { label, config: { ...g, layers: { ...g.layers, ...bare, head: 0, ...layers } } };
};
export const entries = [
  hd('HEAD-lantern', 3), hd('HEAD-wedge', 4), hd('HEAD-peanut', 5), hd('HEAD-jowls', 6), hd('HEAD-bigchin', 7),
  fr('VAULT-gauge', { ears: 12 }),
  fr('VAULT-bolted', { ears: 13 }),
  fr('VAULT-spear', { ears: 14 }),
  fr('VAULT-patch', { ears: 15 }),
  fr('VAULT-button-eyes', { eyes: 12 }),
  fr('VAULT-puppy-eyes', { eyes: 13 }),
];
