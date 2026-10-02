import type { BurstDef } from '@hm/render';

/** The little bursts a tool plays when you use it (a tool preset names one of these as its sprite). */
export type SpriteDef = Omit<BurstDef, 'position' | 'normal'>;
export const SPRITES: Readonly<Record<string, SpriteDef>> = {
  dust: { count: 26, colors: ['#e3d3ad', '#cdbb93', '#f3e8cc'], size: 1.1, lifeMs: 650, speed: 3.2, spread: 0.9, gravity: -0.6 },
  sparkle: { count: 22, colors: ['#ffe7a1', '#ffb86b', '#ffffff'], size: 0.7, lifeMs: 800, speed: 4.2, spread: 1, gravity: 3, additive: true },
  debris: { count: 18, colors: ['#8a6a46', '#6e5a3e', '#a58760'], size: 0.55, lifeMs: 900, speed: 5.2, spread: 0.7, gravity: 14 },
  pop: { count: 30, colors: ['#ff2e88', '#ffd24a', '#7bd88f', '#6ab7ff'], size: 0.8, lifeMs: 700, speed: 6, spread: 1, gravity: 6 },
  leaf: { count: 20, colors: ['#5fa05a', '#7fc06a', '#3f7a42'], size: 0.7, lifeMs: 1100, speed: 3.6, spread: 1, gravity: 2.5 },
  splash: { count: 24, colors: ['#bfe7f2', '#8fd0e4', '#ffffff'], size: 0.8, lifeMs: 700, speed: 4.6, spread: 0.85, gravity: 12 },
};
