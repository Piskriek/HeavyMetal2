import type { EarKind, GoblinLook, HatKind, Mood } from './types.js';

export const HATS: readonly HatKind[] = [
  'none',
  'cap',
  'helmet',
  'crown',
  'bandana',
  'horns',
  'leaf',
  'pot',
];

export const EARS: readonly EarKind[] = ['small', 'big', 'floppy', 'pointy'];

export const MOODS: readonly Mood[] = ['happy', 'angry', 'surprised'];

const HEX_RE = /^#[0-9a-f]{6}$/i;

function normaliseColor(c: unknown, fallback: string): string {
  if (typeof c !== 'string') return fallback;
  if (!HEX_RE.test(c)) return fallback;
  return c.toLowerCase();
}

function pickHat(c: unknown): HatKind {
  return (HATS as readonly string[]).includes(typeof c === 'string' ? c : '')
    ? (c as HatKind)
    : 'none';
}

function pickEars(c: unknown): EarKind {
  return (EARS as readonly string[]).includes(typeof c === 'string' ? c : '')
    ? (c as EarKind)
    : 'big';
}

function pickMood(c: unknown): Mood {
  return (MOODS as readonly string[]).includes(typeof c === 'string' ? c : '')
    ? (c as Mood)
    : 'happy';
}

export function allLooks(color: string, accent: string): GoblinLook[] {
  const c = normaliseColor(color, '#6aa84f');
  const a = normaliseColor(accent, '#ffd24a');
  const out: GoblinLook[] = [];
  for (const hat of HATS) {
    for (const ears of EARS) {
      for (const mood of MOODS) {
        out.push({ color: c, accent: a, hat, ears, mood });
      }
    }
  }
  return out;
}

export function lookFromParams(p: Record<string, unknown>): GoblinLook {
  const color = normaliseColor(p['color'], '#6aa84f');
  const accent = normaliseColor(p['accent'], '#ffd24a');
  const hat = pickHat(p['hat']);
  const ears = pickEars(p['ears']);
  const mood = pickMood(p['mood']);
  const look: GoblinLook = { color, accent, hat, ears, mood };
  return look;
}