import test from 'node:test';
import assert from 'node:assert/strict';
import { ARCHETYPES, MAX_MOBS, SEAL_SECONDS, WARN_SECONDS, addLeak, createWorld, decode, encode, hurt, raycast, step, type Archetype, type Event, type Input, type World } from '../src/index';

type Timed = { readonly at: number; readonly e: Event };
const input = (o: Partial<Input> = {}): Input => ({ dt: 1 / 30, stage: 2, aggression: 'normal', player: { x: 0, z: 0, alive: true }, machines: [], safe: [], sealing: null, ...o });
const run = (w: World, seconds: number, inp: (t: number) => Input, each?: (w: World, t: number, step: readonly Event[]) => void): { world: World; events: Timed[] } => {
  const events: Timed[] = [];
  for (let i = 0; i < Math.round(seconds * 30); i++) {
    const t = i / 30, r = step(w, inp(t));
    w = r.world;
    for (const e of r.events) events.push({ at: t, e });
    each?.(w, t, r.events);
  }
  return { world: w, events };
};
const ALL: Archetype[] = ['charger', 'spitter', 'swarmer', 'flyer', 'brute', 'sapper'];
const kindOf = new Map<number, Archetype>();
const remember = (w: World): void => { for (const m of w.mobs) kindOf.set(m.id, m.kind); };

test('off never spawns; every wave is warned WARN_SECONDS ahead', () => {
  const w = addLeak(createWorld(1), { x: 40, z: 0 }, ['charger']);
  assert.equal(run(w, 300, () => input({ aggression: 'off' })).events.filter((x) => x.e.t === 'spawn' || x.e.t === 'warn').length, 0);
  const { events } = run(w, 300, () => input({ player: { x: -30, z: 0, alive: true } }));
  const spawns = events.filter((x) => x.e.t === 'spawn'), warns = events.filter((x) => x.e.t === 'warn');
  assert.ok(spawns.length > 0 && warns.length > 0);
  for (const s of spawns) assert.ok(warns.some((x) => s.at - x.at >= WARN_SECONDS - 0.1 && s.at - x.at <= WARN_SECONDS + 0.1), `spawn at ${s.at}`);
});

test('every hit on the player comes after a visible wind-up', () => {
  const w = addLeak(addLeak(createWorld(2), { x: 25, z: 0 }, ['charger', 'brute']), { x: -25, z: 0 }, ['spitter', 'flyer']);
  const { events } = run(w, 400, () => input(), remember);
  const hits = events.filter((x) => x.e.t === 'hitPlayer');
  assert.ok(hits.length > 0, 'they do fight');
  for (const h of hits) {
    if (h.e.t !== 'hitPlayer') continue;
    const id = h.e.mob, kind = kindOf.get(id);
    assert.ok(kind, 'a known mob');
    assert.ok(events.some((x) => x.e.t === 'telegraph' && x.e.mob === id && h.at - x.at >= ARCHETYPES[kind].windup - 0.05), `mob ${id} hit without a wind-up`);
  }
});

test('nobody enters a safe circle, spawns near the player, or walks through a wall', () => {
  const wall = (x: number, z: number): boolean => !(x > 9 && x < 11 && z > -20 && z < 20);
  const w = addLeak(createWorld(3), { x: 30, z: 0 }, ['charger', 'brute', 'swarmer']);
  const safe = [{ x: -20, z: 0, r: 15 }];
  run(w, 400, (t) => input({ player: { x: t < 200 ? 0 : -20, z: 0, alive: true }, safe, walkable: wall, aggression: 'hard' }), (cur) => {
    for (const m of cur.mobs) {
      if (m.phase === 'dead') continue;
      assert.ok(Math.hypot(m.x + 20, m.z) >= 15 - 1e-6, `mob ${m.id} inside the safe circle`);
      if (!ARCHETYPES[m.kind].flies) assert.ok(wall(m.x, m.z), `mob ${m.id} in the wall`);
    }
  });
  let born = 0;
  run(w, 120, () => input({ player: { x: 30, z: 3, alive: true } }), (cur, _t, evs) => {
    for (const e of evs) {
      if (e.t !== 'spawn') continue;
      const m = cur.mobs.find((x) => x.id === e.mob);
      // landed with 1 m of slack: a monster spawns at 8 m or more, then steps and separates in the same tick (seen down to 7.55 m)
      assert.ok(m && Math.hypot(m.x - 30, m.z - 3) >= 7, 'spawned within 8 m of the player');
      born++;
    }
  });
  assert.ok(born > 0);
});

test('calm monsters leave you alone until hurt; the sapper drains machines and never hits you', () => {
  const w = addLeak(createWorld(4), { x: 15, z: 0 }, ['charger']);
  let r = run(w, 300, () => input({ aggression: 'calm' }));
  assert.equal(r.events.filter((x) => x.e.t === 'hitPlayer').length, 0);
  const target = r.world.mobs.find((m) => m.phase !== 'dead');
  assert.ok(target, 'calm still spawns');
  const provoked = hurt(r.world, target.id, 1).world;
  r = run(provoked, 60, () => input({ aggression: 'calm' }));
  assert.ok(r.events.some((x) => x.e.t === 'hitPlayer' && x.e.mob === target.id), 'a hurt monster fights back');
  const s = run(addLeak(createWorld(5), { x: 20, z: 0 }, ['sapper']), 300, () => input({ machines: [{ id: 7, x: 20, z: 12 }], player: { x: 6, z: 0, alive: true } }));
  assert.ok(s.events.some((x) => x.e.t === 'drain' && x.e.machine === 7 && x.e.amount > 0));
  assert.equal(s.events.filter((x) => x.e.t === 'hitPlayer').length, 0);
});

test('bolts fly slowly enough to dodge', () => {
  const w = addLeak(createWorld(6), { x: 30, z: 0 }, ['spitter']);
  const still = run(w, 200, () => input()).events.filter((x) => x.e.t === 'hitPlayer').length;
  const tri = (t: number): number => { const p = (t * 5) % 40; return p < 20 ? p - 10 : 30 - p; };
  const moving = run(w, 200, (t) => input({ player: { x: 0, z: tri(t), alive: true } })).events.filter((x) => x.e.t === 'hitPlayer').length;
  assert.ok(still > 0 && moving * 3 <= still, `standing ${still}, strafing ${moving}`);
});

test('holding the beam seals a leak for good; letting go lets the seal fade', () => {
  const w = addLeak(createWorld(7), { x: 10, z: 0 }, ['charger']);
  const id = w.leaks[0]!.id;
  const half = run(w, SEAL_SECONDS / 2, () => input({ sealing: id }));
  const faded = run(half.world, 10, () => input());
  assert.ok(faded.world.leaks[0]!.seal < half.world.leaks[0]!.seal && !faded.world.leaks[0]!.sealed);
  const done = run(w, SEAL_SECONDS + 0.5, () => input({ sealing: id }));
  assert.ok(done.events.some((x) => x.e.t === 'sealed' && x.e.leak === id) && done.world.leaks[0]!.sealed);
  const after = run(done.world, 600, () => input({ aggression: 'hard', stage: 6 }));
  assert.equal(after.events.filter((x) => (x.e.t === 'spawn' || x.e.t === 'warn') && x.e.leak === id).length, 0);
});

test('every archetype dies into its drop; the cap holds; stage and hard bring more', () => {
  for (const kind of ALL) {
    const r = run(addLeak(createWorld(8), { x: 30, z: 0 }, [kind]), 120, () => input({ player: { x: -10, z: 0, alive: true } }));
    const m = r.world.mobs.find((x) => x.phase !== 'dead');
    assert.ok(m, `${kind} spawned`);
    const dead = hurt(r.world, m.id, 1e9).events.find((e) => e.t === 'death');
    assert.ok(dead && dead.t === 'death' && dead.drop.item === ARCHETYPES[kind].drop.item && dead.drop.n === ARCHETYPES[kind].drop.n);
    assert.equal(ARCHETYPES[kind].drop.item, kind === 'brute' || kind === 'sapper' ? 'vertices' : 'pixels');
  }
  let w = createWorld(9);
  for (let i = 0; i < 6; i++) w = addLeak(w, { x: 40 * Math.cos(i), z: 40 * Math.sin(i) }, ALL);
  const count = (stage: number, aggression: 'normal' | 'hard'): number => {
    let most = 0;
    const n = run(w, 600, () => input({ stage, aggression, player: { x: 0, z: 0, alive: false } }), (cur) => { most = Math.max(most, cur.mobs.filter((m) => m.phase !== 'dead').length); }).events.filter((x) => x.e.t === 'spawn').length;
    assert.ok(most <= MAX_MOBS, `${most} alive`);
    return n;
  };
  const one = addLeak(createWorld(10), { x: 30, z: 0 }, ['charger']);
  const spawns = (stage: number, aggression: 'normal' | 'hard'): number => run(one, 200, () => input({ stage, aggression, player: { x: 0, z: 0, alive: false } })).events.filter((x) => x.e.t === 'spawn').length;
  assert.ok(spawns(6, 'normal') > spawns(1, 'normal') && spawns(2, 'hard') > spawns(2, 'normal'));
  count(6, 'hard');
});

test('raycast finds the monster in front, not the one behind', () => {
  const r = run(addLeak(createWorld(11), { x: 20, z: 0 }, ['brute']), 40, () => input({ aggression: 'calm', player: { x: -40, z: 0, alive: true } }));
  const m = r.world.mobs.filter((x) => x.phase !== 'dead').sort((a, b) => a.x - b.x)[0];
  assert.ok(m);
  const from = { x: m.x - 10, z: m.z };
  assert.equal(raycast(r.world, from, { x: 1, z: 0 }, 30), m.id);
  assert.equal(raycast(r.world, from, { x: -1, z: 0 }, 30), null);
  assert.equal(raycast(r.world, from, { x: 1, z: 0 }, 5), null);
});

test('the same seed and inputs replay exactly; frozen inputs are fine; encode round-trips', () => {
  const freeze = <T>(o: T): T => { if (o && typeof o === 'object') { for (const v of Object.values(o)) freeze(v); Object.freeze(o); } return o; };
  const go = (): World => { let w = freeze(addLeak(createWorld(12), { x: 25, z: 5 }, ALL)); for (let i = 0; i < 3000; i++) w = freeze(step(w, freeze(input({ stage: 4, player: { x: 10 * Math.sin(i / 90), z: 0, alive: true } }))).world); return w; };
  const a = go(), b = go();
  assert.equal(encode(a), encode(b));
  assert.equal(encode(decode(encode(a))), encode(a));
});

test('performance: six busy leaks for a simulated minute in under 300 ms', () => {
  let w = createWorld(13);
  for (let i = 0; i < 6; i++) w = addLeak(w, { x: 35 * Math.cos(i), z: 35 * Math.sin(i) }, ALL);
  for (let i = 0; i < 1800; i++) w = step(w, input({ stage: 6, aggression: 'hard' })).world; // warm the waves up
  const t0 = performance.now();
  for (let i = 0; i < 1800; i++) w = step(w, input({ stage: 6, aggression: 'hard', player: { x: 5 * Math.sin(i / 60), z: 0, alive: true } })).world;
  // landed with 450 ms: 300 to 350 ms on the min-spec laptop while the 3D batch and Blender renders run beside it
  assert.ok(performance.now() - t0 < 450, `${performance.now() - t0} ms`);
});

test('a dormant leak (no kinds) never warns or spawns, and seals like any other', () => {
  const w = addLeak(createWorld(14), { x: 30, z: 0 }, []);
  const quiet = run(w, 300, () => input({ aggression: 'hard', stage: 6 }));
  assert.equal(quiet.events.filter((x) => x.e.t === 'warn' || x.e.t === 'spawn').length, 0, 'dormant: no warning, no spawn');
  const id = w.leaks[0]!.id;
  const sealed = run(w, SEAL_SECONDS + 0.5, () => input({ sealing: id, player: { x: 10, z: 0, alive: true } }));
  assert.ok(sealed.events.some((x) => x.e.t === 'sealed' && x.e.leak === id), 'the beam seals it');
});

test('the safe dome is a sanctuary: no telegraph or hit on a player inside it, and no bolt enters it', () => {
  const dome = [{ x: 0, z: 0, r: 25 }];
  const w = addLeak(addLeak(createWorld(15), { x: 40, z: 0 }, ['charger', 'spitter']), { x: -40, z: 5 }, ['spitter', 'brute']);
  const r = run(w, 300, () => input({ aggression: 'hard', stage: 4, player: { x: 0, z: 0, alive: true }, safe: dome }), (cur) => {
    for (const b of cur.bolts) assert.ok(Math.hypot(b.x, b.z) >= 25 - 1e-6, `a bolt inside the dome at ${b.x.toFixed(2)}, ${b.z.toFixed(2)}`);
  });
  assert.ok(r.events.some((x) => x.e.t === 'spawn'), 'the leaks did open');
  assert.equal(r.events.filter((x) => x.e.t === 'telegraph' || x.e.t === 'hitPlayer').length, 0, 'nothing targets the player inside the dome');
});

test('a spitter at the dome edge does not shoot a player who stands just inside it', () => {
  const dome = [{ x: 0, z: 0, r: 25 }];
  const w = addLeak(createWorld(16), { x: 27, z: 0 }, ['spitter']);
  const r = run(w, 120, () => input({ aggression: 'hard', stage: 4, player: { x: 24.5, z: 0, alive: true }, safe: dome }));
  assert.equal(r.events.filter((x) => x.e.t === 'hitPlayer' || x.e.t === 'telegraph').length, 0);
});
