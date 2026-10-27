/**
 * What Overwatch can find and mark (plan 50 §3): the whole category, not one example. The owner said "look for guns"; a
 * companion finds everything a player looks for (docs/COMBAT_DRONE_COMPANION_RESEARCH.md's category table). Pure: the
 * parser that turns "find me some ore" into a category, the nearest pick, and the radio line. The scene supplies the
 * points of interest it has in each world (play-scene.ts `pointsOfInterest`).
 *
 * Categories with no source in FIDELITY yet (ammo, health, armour, keys, currency) are still recognised, so the drone says
 * plainly that the world has none, and an external game's adapter can supply them (plan 50 §6).
 */

export type ScoutCategory =
  | 'enemies'
  | 'hazards'
  | 'objectives'
  | 'exits'
  | 'weapons'
  | 'ammo'
  | 'health'
  | 'armor'
  | 'keys'
  | 'currency'
  | 'resources'
  | 'salvage'
  | 'secrets'
  | 'vehicles';

export const SCOUT_CATEGORIES: readonly ScoutCategory[] = [
  'enemies', 'hazards', 'objectives', 'exits', 'weapons', 'ammo', 'health', 'armor', 'keys', 'currency', 'resources', 'salvage', 'secrets', 'vehicles',
];

/** The words that name each category, longest phrases first where they overlap. */
const WORDS: Readonly<Record<ScoutCategory, readonly string[]>> = {
  enemies: ['enemies', 'enemy', 'monsters', 'monster', 'hostiles', 'hostile', 'threats', 'targets', 'mobs', 'demons', 'bad guys'],
  hazards: ['hazards', 'hazard', 'leaks', 'leak', 'traps', 'trap', 'danger', 'dangers', 'rifts', 'rift'],
  objectives: ['objectives', 'objective', 'mission', 'quest', 'goal', 'what to do', 'what next'],
  exits: ['exit', 'exits', 'gate', 'stargate', 'portal', 'way out', 'way home', 'door out'],
  weapons: ['guns', 'gun', 'weapons', 'weapon', 'rifles', 'rifle', 'sidearm', 'pistol', 'shotgun', 'armory', 'armoury', 'arms'],
  ammo: ['ammo', 'ammunition', 'bullets', 'magazines', 'shells', 'rounds'],
  health: ['health', 'medkit', 'medkits', 'healing', 'med', 'medicine', 'first aid', 'heal'],
  armor: ['armor', 'armour', 'shields', 'shield'],
  keys: ['keys', 'key', 'keycard', 'keycards', 'locked doors', 'locks'],
  currency: ['money', 'coins', 'credits', 'currency', 'gold', 'cash'],
  resources: ['ore', 'ores', 'resources', 'resource', 'minerals', 'mineral', 'rocks', 'boulders', 'materials', 'crystal', 'crystals'],
  salvage: ['salvage', 'loot', 'chests', 'chest', 'wrecks', 'wreck', 'scrap', 'crates', 'crate', 'stuff', 'items'],
  secrets: ['secrets', 'secret', 'tapes', 'tape', 'logs', 'cassettes', 'lore', 'transponders'],
  vehicles: ['vehicles', 'vehicle', 'rover', 'rovers', 'car', 'truck', 'ride'],
};

const FIND = ['find', 'look for', 'search for', 'search', 'scout', 'locate', 'where is', "where's", 'where are', 'any', 'show me', 'mark', 'spot', 'get me', 'fetch', 'bring me', 'need'];

const norm = (s: string): string => s.toLowerCase().replace(/[^a-z0-9\s']/g, ' ').replace(/\s+/g, ' ').trim();
const has = (text: string, tokens: readonly string[], w: string): boolean => (w.includes(' ') ? text.includes(w) : tokens.includes(w));

/** The category a spoken "find ..." order asks for, or null when it is not a find order. */
export function parseScoutOrder(raw: string): ScoutCategory | null {
  const text = norm(raw);
  const tokens = text.split(' ');
  if (!FIND.some((w) => has(text, tokens, w))) return null;
  for (const c of SCOUT_CATEGORIES) if (WORDS[c].some((w) => has(text, tokens, w))) return c;
  return null;
}

export interface PointOfInterest {
  readonly category: ScoutCategory;
  readonly x: number;
  readonly y: number;
  readonly z: number;
  /** What it is, for the radio: "the armory sidearm", "an ore boulder". */
  readonly label: string;
}

/** The nearest point of interest to (x, z), or null. */
export function nearestPoi(pois: readonly PointOfInterest[], x: number, z: number): PointOfInterest | null {
  let best: PointOfInterest | null = null;
  let bestD = Infinity;
  for (const p of pois) {
    const d = Math.hypot(p.x - x, p.z - z);
    if (d < bestD) { best = p; bestD = d; }
  }
  return best;
}

/** A compass bearing from (x, z) to (tx, tz), by the game's compass (north is -z, east is +x). */
export function compass(x: number, z: number, tx: number, tz: number): string {
  const a = Math.atan2(tx - x, -(tz - z)); // 0 north, clockwise
  const names = ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'];
  return names[(Math.round(a / (Math.PI / 4)) + 8) % 8] ?? 'north';
}

const NONE_YET: Readonly<Partial<Record<ScoutCategory, string>>> = {
  ammo: 'This world has no ammo lying around: your rifle reloads from the cell, and the bench prints blanks.',
  health: 'Nothing heals out here yet. Stay out of the wind-ups and I will cover you.',
  armor: 'No armour pickups exist in this world yet.',
  keys: 'Nothing is locked here: no keys to find.',
  currency: 'This world trades in ore and salvage, not coins.',
};

/** The radio line for a scout result: where the nearest one is, or why there is none. */
export function scoutLine(category: ScoutCategory, poi: PointOfInterest | null, from: { readonly x: number; readonly z: number }, count: number): string {
  if (!poi) return NONE_YET[category] ?? `No ${category} in range of this world right now.`;
  const d = Math.round(Math.hypot(poi.x - from.x, poi.z - from.z));
  const more = count > 1 ? ` ${count - 1} more nearby.` : '';
  return `Marked: ${poi.label}, ${d} m ${compass(from.x, from.z, poi.x, poi.z)}.${more}`;
}
