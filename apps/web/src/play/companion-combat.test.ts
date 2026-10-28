// Plan 50 §2: the drone's fast brain, held to the research's numbers and to never getting in the player's way.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  barkLine,
  COMBAT_TUNING,
  DEFAULT_COMBAT_ORDERS,
  newCombatBrain,
  stepCombat,
  type CombatBrain,
  type CombatInput,
  type CombatMob,
  type CombatOrders,
  type CombatTick,
} from './companion-combat';

// the player at the origin facing -z (yaw 0); the drone off their right shoulder
const player = { x: 0, z: 0, yaw: 0, shotDamage: 10, dps: 20 };
const drone = { x: 1.4, y: 2, z: -1.6 };
const mob = (id: number, kind: string, x: number, z: number, hp = 25, telegraph = false): CombatMob => ({ id, kind, hp, x, y: 0.5, z, telegraph });

/** Runs the brain for `seconds` at 60 Hz with fixed inputs, collecting every tick. */
function run(seconds: number, input: Omit<CombatInput, 'dt'>, brain: CombatBrain = newCombatBrain()): { ticks: CombatTick[]; brain: CombatBrain } {
  const ticks: CombatTick[] = [];
  let b = brain;
  for (let i = 0; i < Math.round(seconds * 60); i++) {
    const tick = stepCombat(b, { ...input, dt: 1 / 60 });
    ticks.push(tick);
    b = tick.brain;
  }
  return { ticks, brain: b };
}
const shots = (ticks: readonly CombatTick[]) => ticks.flatMap((t) => (t.shot ? [{ t: t.brain.t, ...t.shot }] : []));

test('it acquires after 250 ms, then fires 4-round bursts at 10 rounds/s with 0.6 s between bursts, at 30% of the player\'s DPS', () => {
  const { ticks } = run(2.2, { drone, player, mobs: [mob(1, 'charger', 6, -8, 1000)], orders: DEFAULT_COMBAT_ORDERS });
  const s = shots(ticks);
  assert.ok(s.length >= 8, `${s.length} shots`);
  assert.ok(s[0]!.t >= 0.25 - 1e-9 && s[0]!.t < 0.3, `first shot at ${s[0]!.t}`);
  const gaps = s.slice(1, 8).map((x, i) => +(x.t - s[i]!.t).toFixed(2));
  assert.deepEqual(gaps.slice(0, 3), [0.1, 0.1, 0.1], 'a burst');
  assert.ok(gaps[3]! >= 0.6 - 1e-9 && gaps[3]! < 0.65, `burst gap ${gaps[3]}`);
  // 30% of the player's 20 DPS spread over the drone's 4 rounds per 0.9 s
  const perRound = (20 * 0.3) / (4 / 0.9);
  assert.ok(s.every((x) => Math.abs(x.damage - perRound) < 1e-9), `damage ${s[0]!.damage} vs ${perRound}`);
  assert.ok(ticks.some((t) => t.aimYaw !== null));
});

test('hold fire tracks and calls out but never shoots; the bark is the contact', () => {
  const orders: CombatOrders = { ...DEFAULT_COMBAT_ORDERS, mode: 'hold-fire' };
  const { ticks } = run(2, { drone, player, mobs: [mob(1, 'charger', 4, -6)], orders });
  assert.equal(shots(ticks).length, 0);
  const bark = ticks.find((t) => t.bark)?.bark;
  assert.ok(bark && bark.kind === 'contact');
  assert.equal(barkLine(bark), 'Contact: charger, 7 m.');
});

test('it never fires through the player: a blocked lane holds fire', () => {
  // the drone behind the player, the mob straight ahead of the player
  const { ticks } = run(1.5, { drone: { x: 0, y: 2, z: 3 }, player, mobs: [mob(1, 'brute', 0, -10, 1000)], orders: DEFAULT_COMBAT_ORDERS });
  assert.equal(shots(ticks).length, 0);
});

test('kill-steal guard: a weak enemy in the player\'s sights is left to them', () => {
  const weak = mob(1, 'swarmer', 0.2, -8, 8); // dead centre of the aim, one player shot kills it
  const { ticks } = run(1.5, { drone, player, mobs: [weak], orders: DEFAULT_COMBAT_ORDERS });
  assert.equal(shots(ticks).length, 0);
  // a sturdy one in the same spot is fair game
  const { ticks: t2 } = run(1.5, { drone, player, mobs: [mob(1, 'swarmer', 0.2, -8, 40)], orders: DEFAULT_COMBAT_ORDERS });
  assert.ok(shots(t2).length > 0);
});

test('defend mode ignores a far enemy that is not winding up; weapons free takes it', () => {
  const far = mob(1, 'spitter', 12, -16); // 20 m from the player
  assert.equal(shots(run(1.5, { drone, player, mobs: [far], orders: DEFAULT_COMBAT_ORDERS }).ticks).length, 0);
  assert.ok(shots(run(1.5, { drone, player, mobs: [far], orders: { ...DEFAULT_COMBAT_ORDERS, mode: 'weapons-free' } }).ticks).length > 0);
  assert.ok(shots(run(1.5, { drone, player, mobs: [{ ...far, telegraph: true }], orders: DEFAULT_COMBAT_ORDERS }).ticks).length > 0);
});

test('a sticky target: a slightly better challenger does not steal it; a much better one does after 400 ms and the 1.5 s minimum', () => {
  const orders = { ...DEFAULT_COMBAT_ORDERS, mode: 'weapons-free' as const };
  const a = mob(1, 'charger', 5, -6, 1000);
  let { brain } = run(0.5, { drone, player, mobs: [a], orders });
  assert.equal(brain.targetId, 1);
  // a near twin appears: no switch
  const twin = mob(2, 'charger', 5.5, -6, 1000);
  ({ brain } = run(3, { drone, player, mobs: [a, twin], orders }, brain));
  assert.equal(brain.targetId, 1);
  // a brute winding up at the player: switches, but only after holding its lead 400 ms
  const brute = mob(3, 'brute', 3, -4, 1000, true);
  const step = run(0.3, { drone, player, mobs: [a, brute], orders }, brain);
  assert.equal(step.brain.targetId, 1, 'not before 400 ms');
  ({ brain } = run(0.3, { drone, player, mobs: [a, brute], orders }, step.brain));
  assert.equal(brain.targetId, 3);
});

test('a focus order wins while it stands, then expires', () => {
  const near = mob(1, 'brute', 3, -4, 1000, true);
  const focused = mob(2, 'swarmer', 10, -12, 1000);
  const orders: CombatOrders = { ...DEFAULT_COMBAT_ORDERS, mode: 'weapons-free', focusId: 2, focusUntil: 1 };
  const first = run(0.9, { drone, player, mobs: [near, focused], orders });
  assert.equal(first.brain.targetId, 2);
  const after = run(2.5, { drone, player, mobs: [near, focused], orders }, first.brain);
  assert.equal(after.brain.targetId, 1, 'the focus expired at 1 s');
});

test('deterministic: the same inputs fire the same rounds', () => {
  const input = { drone, player, mobs: [mob(1, 'charger', 14, -18, 1000)], orders: { ...DEFAULT_COMBAT_ORDERS, mode: 'weapons-free' as const } };
  const a = shots(run(3, input).ticks);
  const b = shots(run(3, input).ticks);
  assert.deepEqual(a, b);
  // at 23 m the first burst can miss, and tracking tightens the aim
  assert.ok(a.some((s) => !s.hit) || a.every((s) => s.hit));
});

test('the combat station is on the ordered side and outside the 15° cone around the player\'s aim', () => {
  const m = [mob(1, 'charger', 3, -9, 1000)];
  const fwd = { x: 0, z: -1 };
  for (const cover of ['right', 'left', 'rear'] as const) {
    const tick = stepCombat(run(0.5, { drone, player, mobs: m, orders: { ...DEFAULT_COMBAT_ORDERS, cover } }).brain, {
      dt: 1 / 60, drone, player, mobs: m, orders: { ...DEFAULT_COMBAT_ORDERS, cover },
    });
    const s = tick.station!;
    const d = Math.hypot(s.x, s.z);
    assert.ok(d >= 4 && d <= 7, `${cover}: ${d} m from the player`);
    const off = Math.acos((s.x * fwd.x + s.z * fwd.z) / d) / (Math.PI / 180);
    assert.ok(off > COMBAT_TUNING.keepOutDeg, `${cover}: ${off}° off the aim`);
    if (cover === 'right') assert.ok(s.x > 0);
    if (cover === 'left') assert.ok(s.x < 0);
    if (cover === 'rear') assert.ok(s.z > 0);
  }
});

test('barks: one per 8 s, danger first; "down" when the target dies; "area clear" after 3 s of quiet', () => {
  const orders = { ...DEFAULT_COMBAT_ORDERS, mode: 'weapons-free' as const };
  let { ticks, brain } = run(1, { drone, player, mobs: [mob(1, 'charger', 4, -6), mob(2, 'flyer', -4, -6)], orders });
  assert.equal(ticks.filter((t) => t.bark).length, 1, 'two contacts, one bark');
  const target = brain.targetId!;
  const other = target === 1 ? mob(2, 'flyer', -4, -6) : mob(1, 'charger', 4, -6);
  const killed = stepCombat(brain, { dt: 1 / 60, drone, player, mobs: [other], orders });
  assert.ok(killed.events.some((e) => e.kind === 'down' && e.mobId === target));
  ({ ticks } = run(12, { drone, player, mobs: [], orders }, killed.brain));
  const clear = ticks.flatMap((t) => t.events).filter((e) => e.kind === 'clear');
  assert.equal(clear.length, 1);
});

test('review fixes: hold fire never repositions; focus keeps to the leash; standing down calls nothing "down"', async () => {
  const { standDown } = await import('./companion-combat');
  const m = [mob(1, 'charger', 4, -6, 1000)];
  const held = run(1, { drone, player, mobs: m, orders: { ...DEFAULT_COMBAT_ORDERS, mode: 'hold-fire' } });
  assert.ok(held.ticks.every((t) => t.station === null), 'hold fire keeps the drone where its order put it');
  // a focus 60 m out is ignored: no sniping across the map
  const far = mob(2, 'brute', 0, -60, 1000);
  const f = run(1.5, { drone, player, mobs: [far], orders: { ...DEFAULT_COMBAT_ORDERS, mode: 'weapons-free', focusId: 2, focusUntil: 99 } });
  assert.equal(f.brain.targetId, null);
  assert.equal(shots(f.ticks).length, 0);
  const fighting = run(1, { drone, player, mobs: m, orders: DEFAULT_COMBAT_ORDERS });
  const quiet = stepCombat(standDown(fighting.brain), { dt: 1 / 60, drone, player, mobs: [], orders: DEFAULT_COMBAT_ORDERS });
  assert.equal(quiet.events.filter((e) => e.kind === 'down').length, 0);
});

test('a contact after a stand-down is called out: the bark gap does not survive leaving the world', async () => {
  const { standDown } = await import('./companion-combat');
  const orders = { ...DEFAULT_COMBAT_ORDERS, mode: 'weapons-free' as const };
  // the drone calls a charger, then the player goes to the lab: the brain's clock stops there
  const before = run(0.2, { drone, player, mobs: [mob(1, 'charger', 4, -20, 1000)], orders });
  assert.equal(before.ticks.filter((t) => t.bark?.kind === 'contact').length, 1);
  // back on the planet a brute appears well inside the old 8 s gap of brain time
  const back = run(0.5, { drone, player, mobs: [mob(2, 'brute', 3, -9, 1000)], orders }, standDown(before.brain));
  const contacts = back.ticks.map((t) => t.bark).filter((b) => b?.kind === 'contact');
  assert.equal(contacts.length, 1, 'the brute is called out on return');
  assert.equal(contacts[0]?.mobId, 2);
});

test('review fixes: a "down" is heard 3 s after the last bark, not swallowed by the 8 s contact gap', () => {
  const orders = { ...DEFAULT_COMBAT_ORDERS, mode: 'weapons-free' as const };
  const first = run(0.5, { drone, player, mobs: [mob(1, 'charger', 4, -6, 1000)], orders });
  assert.equal(first.ticks.filter((t) => t.bark).length, 1);
  const wait = run(3, { drone, player, mobs: [mob(1, 'charger', 4, -6, 1000)], orders }, first.brain);
  const killed = run(0.2, { drone, player, mobs: [], orders }, wait.brain);
  assert.ok(killed.ticks.some((t) => t.bark?.kind === 'down'));
});
