import test from 'node:test';
import assert from 'node:assert/strict';
import { START, advance, check, current, targets, validate, type PlayerState, type Questline } from '../src/index';
const line: Questline = { id: 'main', title: 'Main', quests: [
  { id: 'wake', title: 'Wake up', steps: [{ id: 'walk', text: 'Walk', until: { count: 'moved', atLeast: 3 } }], reward: { credits: 10 } },
  { id: 'base', title: 'A base', steps: [
    { id: 'block', text: 'Place a block', target: 'island.slot.toy-brick', until: { count: 'placed', atLeast: 1 } },
    { id: 'paint', text: 'Paint it', target: 'island.tab.F2', until: { count: 'painted', atLeast: 1 } }], reward: { credits: 20, unlock: ['portal'] } },
] };
const st = (counts: Record<string, number>): PlayerState => ({ counts, owns: [], done: [] });
test('conditions', () => {
  assert.equal(check({ all: [{ count: 'a', atLeast: 1 }, { not: { owns: 'x' } }] }, st({ a: 1 })), true);
  assert.equal(check({ any: [{ count: 'a', atLeast: 2 }, { done: 'q' }] }, st({ a: 1 })), false);
});
test('advances through steps and quests, paying once', () => {
  assert.deepEqual(validate(line), []);
  let r = advance(line, st({ moved: 3 }), START);
  assert.equal(r.progress.quest, 'base'); assert.equal(r.progress.step, 0);
  assert.deepEqual(r.rewards, [{ credits: 10 }]);
  r = advance(line, st({ moved: 3, placed: 1 }), r.progress);
  assert.equal(r.progress.step, 1); assert.deepEqual(r.rewards, []);
  r = advance(line, st({ moved: 3, placed: 1, painted: 1 }), r.progress);
  assert.equal(r.progress.quest, null); assert.deepEqual(r.progress.finished, ['wake', 'base']);
  assert.deepEqual(r.rewards, [{ credits: 20, unlock: ['portal'] }]);
  assert.equal(current(line, st({}), r.progress), null);
  assert.deepEqual(targets(line), ['island.slot.toy-brick', 'island.tab.F2']);
});

import { skip, type Cond } from '../src/index';

test('nested all/any/not conditions', () => {
  const player: PlayerState = {
    counts: { iron: 15, power: 50 },
    owns: ['wrench', 'circuit'],
    done: ['intro'],
  };

  assert.equal(
    check(
      {
        all: [
          { count: 'iron', atLeast: 10 },
          { any: [{ owns: 'hammer' }, { owns: 'wrench' }] },
          { not: { done: 'forbidden_quest' } },
          {
            not: {
              any: [{ count: 'power', atLeast: 100 }, { owns: 'plasma_cutter' }],
            },
          },
        ],
      },
      player
    ),
    true
  );

  assert.equal(check({ all: [] }, player), true);
  assert.equal(check({ any: [] }, player), false);
  assert.equal(check({ not: { all: [] } }, player), false);
  assert.equal(check({ count: 'nonexistent', atLeast: 1 }, player), false);
  assert.equal(check({ count: 'nonexistent', atLeast: 0 }, player), true);
});

test('requires gates a quest', () => {
  const gatedLine: Questline = {
    id: 'gated',
    title: 'Gated Line',
    quests: [
      {
        id: 'q1',
        title: 'Q1',
        steps: [{ id: 's1', text: 'Do 1', until: { count: 'step1', atLeast: 1 } }],
        reward: { credits: 5 },
      },
      {
        id: 'q2',
        title: 'Q2',
        requires: { owns: 'special_key' },
        steps: [{ id: 's2', text: 'Do 2', until: { count: 'step2', atLeast: 1 } }],
        reward: { credits: 15 },
      },
    ],
  };

  const s1: PlayerState = { counts: {}, owns: [], done: [] };
  assert.equal(current(gatedLine, s1, START), 'q1');

  const r1 = advance(gatedLine, { counts: { step1: 1 }, owns: [], done: [] }, START);
  assert.deepEqual(r1.progress.finished, ['q1']);
  assert.deepEqual(r1.rewards, [{ credits: 5 }]);
  assert.equal(r1.progress.quest, null);
  assert.equal(current(gatedLine, s1, r1.progress), null);

  const s2: PlayerState = { counts: {}, owns: ['special_key'], done: ['q1'] };
  assert.equal(current(gatedLine, s2, r1.progress), 'q2');

  const r2 = advance(gatedLine, s2, r1.progress);
  assert.equal(r2.progress.quest, 'q2');
  assert.equal(r2.progress.step, 0);
  assert.deepEqual(r2.rewards, []);
});

test('skip advances steps and completes quests without rewards', () => {
  const skipLine: Questline = {
    id: 'skip_demo',
    title: 'Skip Demo',
    quests: [
      {
        id: 'build_tent',
        title: 'Build Tent',
        steps: [
          { id: 'gather_sticks', text: 'Gather sticks', until: { count: 'sticks', atLeast: 5 } },
          { id: 'pitch_tent', text: 'Pitch tent', until: { count: 'pitched', atLeast: 1 } },
        ],
        reward: { credits: 50 },
      },
      {
        id: 'build_fire',
        title: 'Build Fire',
        steps: [
          { id: 'light_match', text: 'Light match', until: { count: 'matches', atLeast: 1 } },
        ],
        reward: { credits: 25 },
      },
    ],
  };

  const initial = { quest: 'build_tent', step: 0, finished: [], rewarded: [] };

  const p1 = skip(skipLine, initial);
  assert.equal(p1.quest, 'build_tent');
  assert.equal(p1.step, 1);
  assert.deepEqual(p1.finished, []);
  assert.deepEqual(p1.rewarded, []);

  const p2 = skip(skipLine, p1);
  assert.equal(p2.quest, 'build_fire');
  assert.equal(p2.step, 0);
  assert.deepEqual(p2.finished, ['build_tent']);
  assert.deepEqual(p2.rewarded, []);

  const p3 = skip(skipLine, p2);
  assert.equal(p3.quest, null);
  assert.equal(p3.step, 0);
  assert.deepEqual(p3.finished, ['build_tent', 'build_fire']);

  const p4 = skip(skipLine, p3);
  assert.deepEqual(p4, p3);
});

test('validate finds duplicates and bad conds', () => {
  assert.deepEqual(validate(line), []);

  const dupQuest: Questline = {
    id: 'dup_quest',
    title: 'Dup',
    quests: [
      { id: 'q1', title: 'Q1', steps: [{ id: 's1', text: 'S1', until: { count: 'a', atLeast: 1 } }], reward: {} },
      { id: 'q1', title: 'Q1 bis', steps: [{ id: 's2', text: 'S2', until: { count: 'a', atLeast: 1 } }], reward: {} },
    ],
  };
  const pDupQuest = validate(dupQuest);
  assert.ok(pDupQuest.some((p) => p.includes('Duplicate quest id')));

  const dupStep: Questline = {
    id: 'dup_step',
    title: 'Dup Step',
    quests: [
      {
        id: 'q1',
        title: 'Q1',
        steps: [
          { id: 's1', text: 'S1', until: { count: 'a', atLeast: 1 } },
          { id: 's1', text: 'S1 again', until: { count: 'a', atLeast: 1 } },
        ],
        reward: {},
      },
    ],
  };
  const pDupStep = validate(dupStep);
  assert.ok(pDupStep.some((p) => p.includes('Duplicate step id')));

  const emptySteps: Questline = {
    id: 'empty_steps',
    title: 'Empty Steps',
    quests: [{ id: 'q1', title: 'Q1', steps: [], reward: {} }],
  };
  const pEmpty = validate(emptySteps);
  assert.ok(pEmpty.some((p) => p.includes('at least one step')));

  const unknownDone: Questline = {
    id: 'unknown_done',
    title: 'Unknown Done',
    quests: [
      {
        id: 'q1',
        title: 'Q1',
        steps: [{ id: 's1', text: 'S1', until: { done: 'ghost_quest' } }],
        reward: {},
      },
    ],
  };
  const pUnknownDone = validate(unknownDone);
  assert.ok(pUnknownDone.some((p) => p.includes('ghost_quest')));

  const negReward: Questline = {
    id: 'neg_reward',
    title: 'Negative Reward',
    quests: [
      {
        id: 'q1',
        title: 'Q1',
        steps: [{ id: 's1', text: 'S1', until: { count: 'x', atLeast: 1 } }],
        reward: { credits: -100 },
      },
    ],
  };
  const pNegReward = validate(negReward);
  assert.ok(pNegReward.some((p) => p.includes('credits')));

  let deepCond: Cond = { count: 'x', atLeast: 1 };
  for (let i = 0; i < 17; i++) {
    deepCond = { not: deepCond };
  }
  const deepLine: Questline = {
    id: 'deep',
    title: 'Deep',
    quests: [
      {
        id: 'q1',
        title: 'Q1',
        steps: [{ id: 's1', text: 'S1', until: deepCond }],
        reward: {},
      },
    ],
  };
  const pDeep = validate(deepLine);
  assert.ok(pDeep.some((p) => p.includes('depth')));

  const badCondLine: Questline = {
    id: 'bad_cond',
    title: 'Bad Cond',
    quests: [
      {
        id: 'q1',
        title: 'Q1',
        steps: [{ id: 's1', text: 'S1', until: {} as unknown as Cond }],
        reward: {},
      },
    ],
  };
  const pBadCond = validate(badCondLine);
  assert.ok(pBadCond.length > 0);
});

test('rewards pay once', () => {
  const lineOnce: Questline = {
    id: 'pay_once',
    title: 'Pay Once',
    quests: [
      {
        id: 'task',
        title: 'Task',
        steps: [{ id: 'step', text: 'Step', until: { count: 'done_step', atLeast: 1 } }],
        reward: { credits: 100, presets: ['schematic_a'], unlock: ['machine_fabricator'] },
      },
    ],
  };

  const state1: PlayerState = { counts: { done_step: 1 }, owns: [], done: [] };
  const first = advance(lineOnce, state1, START);

  assert.deepEqual(first.rewards, [
    { credits: 100, presets: ['schematic_a'], unlock: ['machine_fabricator'] },
  ]);
  assert.deepEqual(first.progress.rewarded, ['task']);

  const second = advance(lineOnce, state1, first.progress);
  assert.deepEqual(second.rewards, []);
  assert.deepEqual(second.progress.rewarded, ['task']);
});

test('toy-world game: build a base, machines, a portal, a rocket', () => {
  const toyWorld: Questline = {
    id: 'toy_world_builder',
    title: 'From Base to Stars',
    quests: [
      {
        id: 'build_base',
        title: 'Build a Base',
        steps: [
          { id: 'gather_timber', text: 'Collect timber', target: 'forest.tree.oak', until: { count: 'timber', atLeast: 10 } },
          { id: 'lay_foundation', text: 'Lay base foundation', target: 'island.blueprint.base', until: { count: 'base_placed', atLeast: 1 } },
        ],
        reward: { credits: 100, presets: ['workbench'], unlock: ['crafting:tier1'] },
      },
      {
        id: 'build_machines',
        title: 'Assemble Machines',
        requires: { owns: 'workbench' },
        steps: [
          { id: 'forge_gears', text: 'Craft copper gears', target: 'workbench.craft.gear', until: { count: 'gears', atLeast: 4 } },
          { id: 'build_generator', text: 'Build power generator', target: 'island.blueprint.generator', until: { count: 'generators', atLeast: 1 } },
        ],
        reward: { credits: 250, presets: ['plasma_core'], unlock: ['crafting:tier2', 'power_grid'] },
      },
      {
        id: 'build_portal',
        title: 'Construct the Ancient Portal',
        requires: { done: 'build_machines' },
        steps: [
          { id: 'obsidian_frame', text: 'Erect obsidian portal arch', target: 'island.blueprint.portal_arch', until: { count: 'portal_blocks', atLeast: 12 } },
          { id: 'energize_core', text: 'Insert charged plasma core', target: 'portal.socket.core', until: { count: 'portal_charged', atLeast: 1 } },
        ],
        reward: { credits: 500, unlock: ['portal', 'exotic_materials'] },
      },
      {
        id: 'build_rocket',
        title: 'Reach the Orbit: Build a Rocket',
        requires: { all: [{ done: 'build_portal' }, { owns: 'plasma_core' }] },
        steps: [
          { id: 'launchpad', text: 'Pave launch pad', target: 'island.blueprint.launchpad', until: { count: 'launchpad_paved', atLeast: 1 } },
          { id: 'rocket_hull', text: 'Assemble titanium fuselage', target: 'launchpad.gantry.hull', until: { count: 'rocket_hull', atLeast: 1 } },
          { id: 'blast_off', text: 'Launch to orbit!', target: 'cockpit.button.ignite', until: { count: 'launch_countdown', atLeast: 1 } },
        ],
        reward: { credits: 2000, unlock: ['orbital_station', 'deep_space'] },
      },
    ],
  };

  assert.deepEqual(validate(toyWorld), []);
  assert.deepEqual(targets(toyWorld), [
    'forest.tree.oak',
    'island.blueprint.base',
    'workbench.craft.gear',
    'island.blueprint.generator',
    'island.blueprint.portal_arch',
    'portal.socket.core',
    'island.blueprint.launchpad',
    'launchpad.gantry.hull',
    'cockpit.button.ignite',
  ]);

  let player: PlayerState = { counts: {}, owns: [], done: [] };

  assert.equal(current(toyWorld, player, START), 'build_base');

  player = { ...player, counts: { timber: 10 } };
  let r = advance(toyWorld, player, START);
  assert.equal(r.progress.quest, 'build_base');
  assert.equal(r.progress.step, 1);

  player = { ...player, counts: { timber: 10, base_placed: 1 }, owns: ['workbench'], done: ['build_base'] };
  r = advance(toyWorld, player, r.progress);
  assert.deepEqual(r.rewards, [{ credits: 100, presets: ['workbench'], unlock: ['crafting:tier1'] }]);
  assert.equal(r.progress.quest, 'build_machines');
  assert.equal(r.progress.step, 0);

  player = { ...player, counts: { ...player.counts, gears: 4, generators: 1 }, owns: ['workbench', 'plasma_core'], done: ['build_base', 'build_machines'] };
  r = advance(toyWorld, player, r.progress);
  assert.deepEqual(r.rewards, [{ credits: 250, presets: ['plasma_core'], unlock: ['crafting:tier2', 'power_grid'] }]);
  assert.equal(r.progress.quest, 'build_portal');

  player = { ...player, counts: { ...player.counts, portal_blocks: 12, portal_charged: 1 }, done: ['build_base', 'build_machines', 'build_portal'] };
  r = advance(toyWorld, player, r.progress);
  assert.deepEqual(r.rewards, [{ credits: 500, unlock: ['portal', 'exotic_materials'] }]);
  assert.equal(r.progress.quest, 'build_rocket');

  player = { ...player, counts: { ...player.counts, launchpad_paved: 1, rocket_hull: 1, launch_countdown: 1 }, done: ['build_base', 'build_machines', 'build_portal', 'build_rocket'] };
  r = advance(toyWorld, player, r.progress);
  assert.deepEqual(r.rewards, [{ credits: 2000, unlock: ['orbital_station', 'deep_space'] }]);
  assert.equal(r.progress.quest, null);
  assert.deepEqual(r.progress.finished, ['build_base', 'build_machines', 'build_portal', 'build_rocket']);
});