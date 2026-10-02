import type { BurstDef } from '@hm/render';
import { normalizeSprite, type SpritePreset } from '@hm/buildkit';
import { player } from './player';

/** The little bursts a tool plays (its sprite plugs). Each is a preset (`@hm/buildkit` SPRITE_PRESETS) with the player's own changes on top. */
export type SpriteDef = Omit<BurstDef, 'position' | 'normal'>;
export const toBurst = (s: SpritePreset): SpriteDef => ({ count: s.count, colors: [s.colorA, s.colorB, s.colorC], size: s.size, lifeMs: s.lifeMs, speed: s.speed, spread: s.spread, gravity: s.gravity, additive: s.glow });
export const spriteOf = (id: string): SpritePreset => normalizeSprite(id, player().sprites[id]);
export const spriteDef = (id: string): SpriteDef => toBurst(spriteOf(id));
