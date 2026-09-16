import type { MarbleInfo } from './types';

export type Mood = 'angry' | 'happy' | 'surprised';

export interface Rival {
  name: string;
  /** One-line bio shown on the grid card. */
  tag: string;
  /** Signature lines, used now and then instead of the shared pools. */
  taunt: string;
  gloat: string;
  sulk: string;
}

/** Order matches the 4x4 opponent sprite sheets (row by row). */
export const RIVALS: Rival[] = [
  { name: 'Ace Spadegrin', tag: 'Card cheat. Race cheat.', taunt: 'I dealt you a bad hand, runt.', gloat: 'House always wins.', sulk: 'Somebody marked the deck!' },
  { name: 'Duchess Vex', tag: 'Old money, new dents.', taunt: 'Do try to keep up, peasant.', gloat: 'Curtsy when I lap you.', sulk: 'This is beneath me. Literally.' },
  { name: 'Big Grubba', tag: 'Weighs more than his ball.', taunt: 'I sit on runts like you.', gloat: 'Gravity loves Grubba.', sulk: 'Grubba is HUNGRY now.' },
  { name: 'Knuckles Blau', tag: 'Punches first. Steers never.', taunt: 'Get in my way. I dare ya.', gloat: 'Heard your ball crunch.', sulk: 'Rematch. Fists this time.' },
  { name: 'Scorch', tag: 'Set fire to the pit lane. Twice.', taunt: 'Gonna torch your line.', gloat: 'Smell that? Your dreams.', sulk: 'Hot. So hot. Angry hot.' },
  { name: 'Rivet Rex', tag: 'Welded to his helmet.', taunt: 'Rex don\'t brake. Rex crush.', gloat: 'CRUSHED. Like a can.', sulk: 'Rex needs more rivets.' },
  { name: 'Lucky Thirteen', tag: 'Has never once been lucky.', taunt: 'Thirteen is MY number, pal.', gloat: 'Luck finally showed up!', sulk: 'Of course. OF COURSE.' },
  { name: 'Red Morrigan', tag: 'Braids tougher than rope.', taunt: 'You\'ll be eating my braid.', gloat: 'Pretty and fast. Sorry.', sulk: 'Next time I bite.' },
  { name: 'Violetta Voltz', tag: 'Hot-wires anything that rolls.', taunt: 'I rewired my ball. Did you?', gloat: 'Shocking, isn\'t it?', sulk: 'My circuits got crossed.' },
  { name: 'Old Smokey', tag: 'Raced the first GP. Lost it.', taunt: 'Kid, I\'ve crashed better than you.', gloat: 'Still got it. Cough.', sulk: 'Back in my day...' },
  { name: 'Barrelbeard', tag: 'Beard full of spare bolts.', taunt: 'Me beard is faster than you.', gloat: 'Pour me a victory ale!', sulk: 'Lost a bolt in me beard.' },
  { name: 'Zapp Gutwrench', tag: 'Mechanic. Arsonist. Mechanic.', taunt: 'I loosened your bolts. Maybe.', gloat: 'Tuned to perfection, baby!', sulk: 'Who touched my wrench?!' },
  { name: 'The Hood', tag: 'Nobody has seen the face.', taunt: '...you will not finish.', gloat: '...as foretold.', sulk: '...this changes nothing.' },
  { name: 'Jinx', tag: 'Bad luck follows her. On purpose.', taunt: 'I already jinxed your ball.', gloat: 'Told you. Jinxed.', sulk: 'Who jinxed ME?!' },
  { name: 'Skullcap Morg', tag: 'Collects helmets. And heads.', taunt: 'Nice helmet. I want it.', gloat: 'Another skull for the shelf.', sulk: 'I\'ll remember your face.' },
  { name: 'Grimbolt', tag: 'Troll. Pays no tolls.', taunt: 'This track is troll country.', gloat: 'Troll toll: your points.', sulk: 'Grimbolt smash scoreboard.' },
];

export const PLAYER_PORTRAIT_COUNT = 15;
export const DRIVER_NAMES = ['Sprocket', 'Cackles', 'Scarface', 'Gizmo', 'Deadeye', 'Grandpa Gritz', 'Mohawk Mick', 'Numero Uno', 'Loony', 'Slick', 'Shade', 'Spike', 'Cigar Sal', 'Grinner', 'King Gob'];

const rivalModules = import.meta.glob<string>('../assets/portraits/r*.webp', { eager: true, import: 'default' });
const playerModules = import.meta.glob<string>('../assets/portraits/p*.webp', { eager: true, import: 'default' });
const pad = (n: number) => String(n).padStart(2, '0');

export function rivalPortrait(character: number, mood: Mood): string {
  return rivalModules[`../assets/portraits/r${pad(character)}_${mood}.webp`];
}
export function playerPortrait(index: number): string {
  return playerModules[`../assets/portraits/p${pad(index)}.webp`];
}

/** Rival character for an AI marble; falls back to id order for saves made before characters existed. */
export function characterOf(m: MarbleInfo): number {
  return (m.character ?? m.id - 1) % RIVALS.length;
}
export function portraitOf(m: MarbleInfo, mood: Mood = 'angry'): string {
  return m.isPlayer ? playerPortrait(m.character ?? 0) : rivalPortrait(characterOf(m), mood);
}
export function displayName(m: MarbleInfo): string {
  return m.isPlayer ? 'You' : m.name;
}

// ---------------- banter ----------------

export interface Line { speaker: MarbleInfo; mood: Mood; text: string }

const PRE_TAUNTS = ['Nice ball. Shame about the driver.', 'Save me a spot at the back.', 'I\'ll send you a postcard from P1.', 'Your ball looks... dented.', 'Hope you said goodbye to your paint job.'];
const PRE_SMUG = ['Pole position of my heart, baby.', 'Warm up the trophy. I\'m coming.', 'I only lose on purpose.', 'Gravity and I have an understanding.'];
const PRE_SCARED = ['Wait, who greased my ball?!', 'Is it meant to wobble like that?', 'Nobody told me about the pegs!'];
const PLAYER_REPLIES = ['Talk is cheap. Rolling is free.', 'See you at the finish. Behind me.', 'Less yapping, more rolling.', 'Big words from a small goblin.', 'I\'ll be the dust in your goggles.'];
const WIN_ANGRY = ['That runt cheated! Check the ball!', 'Beginner\'s luck. Enjoy it.', 'I let you have that one.', 'I want a steward. NOW.'];
const WIN_SURPRISED = ['Who IS that goblin?!', 'That was... actually fast.', 'Where did THAT come from?!'];
const LOSE_GLOAT = ['Did you enjoy the view of my exhaust?', 'Maybe try a smaller ball.', 'Aww. Need a push next time?', 'Another trophy for the pile.'];
const PLAYER_WIN = ['Cry about it.', 'Read it and weep.', 'Keep that trophy shelf empty.'];
const PLAYER_LOSE = ['Enjoy it. Won\'t last.', 'Next heat, you\'re mine.', 'I was just warming up.'];

function pick<T>(list: T[], rng: () => number): T {
  return list[Math.floor(rng() * list.length)];
}

/** Two or three short lines before the lights: a taunt, your reply, and one more jab. */
export function preRaceBanter(roster: MarbleInfo[], rng: () => number): Line[] {
  const me = roster.find((m) => m.isPlayer)!;
  const rivals = roster.filter((m) => !m.isPlayer);
  const a = pick(rivals, rng);
  const b = pick(rivals.filter((m) => m !== a), rng);
  const lines: Line[] = [
    { speaker: a, mood: 'angry', text: rng() < 0.35 ? RIVALS[characterOf(a)].taunt : pick(PRE_TAUNTS, rng) },
    { speaker: me, mood: 'happy', text: pick(PLAYER_REPLIES, rng) },
  ];
  const scared = rng() < 0.35;
  lines.push({ speaker: b, mood: scared ? 'surprised' : 'happy', text: scared ? pick(PRE_SCARED, rng) : pick(PRE_SMUG, rng) });
  return lines;
}

/** Winner gloats or losers sulk depending on how you did. `order` is marble ids by finishing position. */
export function postRaceBanter(roster: MarbleInfo[], order: number[], playerFinished: boolean, rng: () => number): Line[] {
  const byId = (id: number) => roster.find((m) => m.id === id)!;
  const me = roster.find((m) => m.isPlayer)!;
  const rank = order.indexOf(me.id) + 1;
  if (playerFinished && rank === 1) {
    const second = byId(order[1]);
    const other = byId(order[2 + Math.floor(rng() * Math.max(1, order.length - 2))] ?? order[2]);
    return [
      { speaker: second, mood: 'angry', text: rng() < 0.4 ? RIVALS[characterOf(second)].sulk : pick(WIN_ANGRY, rng) },
      { speaker: other, mood: 'surprised', text: pick(WIN_SURPRISED, rng) },
      { speaker: me, mood: 'happy', text: pick(PLAYER_WIN, rng) },
    ];
  }
  const winner = byId(order[0]);
  const lines: Line[] = [{ speaker: winner, mood: 'happy', text: rng() < 0.4 ? RIVALS[characterOf(winner)].gloat : pick(LOSE_GLOAT, rng) }];
  if (playerFinished && rank <= 3) {
    const behind = byId(order[rank]);
    lines.push({ speaker: behind, mood: 'surprised', text: pick(WIN_SURPRISED, rng) });
  } else {
    lines.push({ speaker: me, mood: 'angry', text: pick(PLAYER_LOSE, rng) });
  }
  return lines;
}
