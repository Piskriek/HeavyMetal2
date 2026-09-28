export type RiderId = 'rivet' | 'nix' | 'grub' | 'sprocket';
export type CapsuleId = 'iron' | 'springsteel' | 'siege';
export type StatId = 'launch' | 'handling' | 'boost' | 'stability';
export type Ratings = Record<StatId, number>;
export interface Loadout { rider: RiderId; capsule: CapsuleId }

export interface RiderDefinition {
  id: RiderId;
  name: string;
  title: string;
  quote: string;
  description: string;
  strength: string;
  weakness: string;
  color: string;
  offsets: Ratings;
}

export const RIDERS: readonly RiderDefinition[] = [
  { id: 'rivet', name: 'Rivet', title: 'The Mechanic', quote: '"It only needs to hold together once."',
    description: 'Steady hands. A suspiciously dependable set of tools. The easiest goblin to trust with a terrible idea.',
    strength: 'Versatile on every course', weakness: 'No specialist advantage', color: '#d8b479',
    offsets: { launch: 0, handling: 0, boost: 0, stability: 0 } },
  { id: 'nix', name: 'Nix', title: 'The Daredevil', quote: '"That gap looks smaller from up here."',
    description: 'Quick lane changes and a gift for finding daylight. Prefers going over a problem to going through it.',
    strength: 'Sharp handling and lively boosts', weakness: 'Easier to shove off the racing line', color: '#b6a3e0',
    offsets: { launch: -1, handling: 2, boost: 1, stability: -2 } },
  { id: 'grub', name: 'Grub', title: 'The Bruiser', quote: '"Your lane? Funny. Looks like mine."',
    description: 'A heavy-handed racer who treats a crowded lane as a polite invitation. Momentum is the whole plan.',
    strength: 'Strong launch and collision weight', weakness: 'Slower steering and softer boosts', color: '#a9c18a',
    offsets: { launch: 1, handling: -2, boost: -1, stability: 2 } },
  { id: 'sprocket', name: 'Sprocket', title: 'The Rocket Jockey', quote: '"The red button is always the right one."',
    description: 'Lives for a well-timed burst of speed. Has never met a straight that needed fewer explosions.',
    strength: 'Explosive boost response', weakness: 'Less composed in close racing', color: '#db9374',
    offsets: { launch: 1, handling: -1, boost: 2, stability: -2 } },
];

export const CAPSULES = [
  { id: 'iron', name: 'Rustbucket', title: 'Riveted Iron', description: 'The original bad idea. Predictable weight, reliable steering, and no unexpected surprises. Probably.',
    strength: 'An even, dependable foundation', weakness: 'No extreme strengths', color: '#c5a06b',
    offsets: { launch: 0, handling: 0, boost: 0, stability: 0 } },
  { id: 'springsteel', name: 'Springsteel', title: 'Lightweight Alloy', description: 'A flexible little capsule that makes every hop and boost count. Try not to become somebody else\'s bumper.',
    strength: 'Agile steering and bigger impulses', weakness: 'Lower launch and collision stability', color: '#86cfc7',
    offsets: { launch: -1, handling: 1, boost: 2, stability: -2 } },
  { id: 'siege', name: 'Siegebreaker', title: 'Armored Steel', description: 'More metal. More momentum. A rolling argument that usually wins, provided the argument is in a straight line.',
    strength: 'Strong launch and resilient mass', weakness: 'Heavier handling and weaker boosts', color: '#a5a9b6',
    offsets: { launch: 2, handling: -1, boost: -2, stability: 1 } },
] as const;

export const STAT_LABELS: { id: StatId; label: string; explanation: string }[] = [
  { id: 'launch', label: 'Launch', explanation: 'Full-tension launch speed and maximum racing speed.' },
  { id: 'handling', label: 'Handling', explanation: 'Lane-change response and a small hop-control bonus.' },
  { id: 'boost', label: 'Boost', explanation: 'How strongly a boost charge or speed pad accelerates you.' },
  { id: 'stability', label: 'Stability', explanation: 'Collision mass, momentum retention, and bump recovery.' },
];

export const DEFAULT_LOADOUT: Loadout = { rider: 'rivet', capsule: 'iron' };
export const riderById = (id: RiderId) => RIDERS.find((rider) => rider.id === id) ?? RIDERS[0];
export const capsuleById = (id: CapsuleId) => CAPSULES.find((capsule) => capsule.id === id) ?? CAPSULES[0];
export const isRider = (value: unknown): value is RiderId => RIDERS.some((rider) => rider.id === value);
export const isCapsule = (value: unknown): value is CapsuleId => CAPSULES.some((capsule) => capsule.id === value);

export function loadoutStats(loadout: Loadout) {
  const rider = riderById(loadout.rider);
  const capsule = capsuleById(loadout.capsule);
  const ratings = {} as Ratings;
  for (const { id } of STAT_LABELS) ratings[id] = 6 + rider.offsets[id] + capsule.offsets[id];
  const weight = 120 + (ratings.stability - 6) * 14;
  const impulse = Math.max(0.68, Math.min(1.45, Math.sqrt(120 / weight)));
  const boostFactor = 1 + (ratings.boost - 6) * 0.065;
  const hopFactor = 1 + (ratings.handling - 6) * 0.025;
  return {
    ratings, weight,
    launchSpeed: (160 + (ratings.launch - 6) * 4),
    handling: 1 + (ratings.handling - 6) * 0.08,
    boostFactor, hopFactor,
    bumpRecovery: 1 - (ratings.stability - 6) * 0.045,
    maximumSpeed: (2100 + (ratings.launch - 6) * 35),
    boostKmh: Math.round(430 * impulse * boostFactor * 0.16),
    hopMeters: Math.round(Math.pow(290 * impulse * hopFactor, 2) / (2 * 860) / 2),
    budget: Object.values(ratings).reduce((sum, value) => sum + value, 0),
  };
}

export function opponentLoadouts(player: Loadout): Loadout[] {
  return [player, ...RIDERS.filter((rider) => rider.id !== player.rider).map((rider) => ({
    rider: rider.id,
    capsule: (rider.id === 'grub' ? 'siege' : rider.id === 'nix' ? 'springsteel' : 'iron') as CapsuleId,
  }))];
}