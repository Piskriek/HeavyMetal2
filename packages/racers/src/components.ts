import type { ComponentDef, RacerWorld, VariableDef } from './types';

const stat = (key: string, label: string, doc: string): VariableDef =>
  ({ key, type: 'int', label, doc, tier: 'build', default: 5, min: 1, max: 10, step: 1 });

export const RACER_COMPONENT: ComponentDef = {
  name: 'racer',
  defaults: { name: '', controller: 'player', actor: 'p1', weight: 5, speed: 5, bounce: 5, hx: 1, hz: 0, boostMs: 0, item: '', skill: 0.6, freezeMs: 0, slowMs: 0, shieldMs: 0, draftMs: 0, ghostMs: 0 },
  fields: [
    { key: 'name', type: 'string', label: 'Name', doc: 'Display name of the goblin driver.', tier: 'build', default: '' },
    { key: 'controller', type: 'enum', label: 'Controller', doc: 'Who drives: a player or the AI.', tier: 'build', default: 'player', options: ['player', 'ai'] },
    { key: 'actor', type: 'string', label: 'Actor', doc: 'Input actor id read for player control.', tier: 'pro', default: 'p1' },
    stat('weight', 'Weight', 'Heavier balls push harder but accelerate slower.'),
    stat('speed', 'Speed', 'Top speed stat of the ball.'),
    stat('bounce', 'Bounce', 'How bouncy the ball is on impact.'),
    { key: 'hx', type: 'number', label: 'Heading X', doc: 'X component of the unit heading.', tier: 'pro', default: 1, min: -1, max: 1 },
    { key: 'hz', type: 'number', label: 'Heading Z', doc: 'Z component of the unit heading.', tier: 'pro', default: 0, min: -1, max: 1 },
    { key: 'boostMs', type: 'number', label: 'Boost time', doc: 'Remaining boost time in milliseconds.', tier: 'pro', default: 0, min: 0 },
    { key: 'item', type: 'string', label: 'Item', doc: 'Held item id, empty when none.', tier: 'build', default: '' },
    { key: 'freezeMs', type: 'number', label: 'Frozen time', doc: 'Time left frozen in place (milliseconds).', tier: 'pro', default: 0, min: 0 },
    { key: 'slowMs', type: 'number', label: 'Slippery time', doc: 'Time left sliding on oil (milliseconds).', tier: 'pro', default: 0, min: 0 },
    { key: 'shieldMs', type: 'number', label: 'Anchor time', doc: 'Time left unshakeable: heavy, grippy and immune to hazards.', tier: 'pro', default: 0, min: 0 },
    { key: 'draftMs', type: 'number', label: 'Slipstream time', doc: 'Time left in a slipstream: extra acceleration and top speed.', tier: 'pro', default: 0, min: 0 },
    { key: 'ghostMs', type: 'number', label: 'Ghost time', doc: 'Time left as a ghost: see-through, immune to hazards, a little faster.', tier: 'pro', default: 0, min: 0 },
    { key: 'skill', type: 'number', label: 'AI skill', doc: 'AI driving skill from 0 (sloppy) to 1 (perfect).', tier: 'pro', default: 0.6, min: 0, max: 1, step: 0.05 },
  ],
};

export const RACE_COMPONENT: ComponentDef = {
  name: 'race',
  defaults: { lap: 1, progress: 0, finished: false, place: 0 },
  fields: [
    { key: 'lap', type: 'int', label: 'Lap', doc: 'Current lap number (1-based).', tier: 'pro', default: 1, min: 1 },
    { key: 'progress', type: 'number', label: 'Progress', doc: 'Total race progress in laps.', tier: 'pro', default: 0, min: 0 },
    { key: 'finished', type: 'boolean', label: 'Finished', doc: 'True once the racer crossed the final line.', tier: 'pro', default: false },
    { key: 'place', type: 'int', label: 'Place', doc: 'Race position, 1 is leading (0 = unranked).', tier: 'pro', default: 0, min: 0 },
  ],
};

export function defineRacerComponents(world: RacerWorld): void {
  const have = new Set(world.components().map((c) => c.name));
  for (const def of [RACER_COMPONENT, RACE_COMPONENT]) if (!have.has(def.name)) world.defineComponent(def);
}

export function grantItem(world: RacerWorld, entity: number, itemId: string): void {
  world.set(entity, 'racer', { item: itemId });
}
