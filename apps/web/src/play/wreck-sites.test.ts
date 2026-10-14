import test from 'node:test';
import assert from 'node:assert/strict';
import { MIN_GATE_DISTANCE, LEAK_SITE_COUNT, leakSites } from '../monsters/policy';
import { readFileSync } from 'node:fs';

const GEN: Record<string, unknown> = JSON.parse(readFileSync(new URL('../assets/gen/registry.json', import.meta.url), 'utf8'));
import { NEIGHBOUR_MODELS, SCENERY_SITE_COUNT, TRANSPONDERS, isBroken, rungLevel, stageRung, wreckModels, wreckRung, wreckSites } from './wreck-sites';

const GATE = { x: 0, z: 0 };
const SEED = 7;
const sites = wreckSites(SEED, GATE);

test('the plot has a wreck site for every leak and four scenery-only sites, deterministic in the seed', () => {
  assert.equal(sites.filter((s) => s.leak).length, LEAK_SITE_COUNT);
  assert.equal(sites.filter((s) => !s.leak).length, SCENERY_SITE_COUNT);
  assert.deepEqual(wreckSites(SEED, GATE), sites, 'the same plot gives the same wrecks');
  // every leak site is the monsters' leak site (same centre, same index)
  for (const l of leakSites(SEED, GATE)) {
    const s = sites.find((w) => w.index === l.index);
    assert.ok(s && s.x === l.x && s.z === l.z, `leak ${l.index} sits at its wreck site`);
  }
});

test('a cluster is two to four props, and its junk centre is the leak junk model', () => {
  for (const s of sites) {
    assert.ok(s.members.length >= 2 && s.members.length <= 4, `site ${s.index} has ${s.members.length} props`);
    if (s.leak) assert.equal(s.members.filter((m) => m.junk).length, 1, `leak ${s.index} has one junk centre`);
    else assert.equal(s.members.filter((m) => m.junk).length, 0, `scenery ${s.index} has no junk`);
  }
});

test('nothing is placed within thirty metres of the gate pad, and no leak wreck sits on another', () => {
  for (const s of sites) {
    for (const m of s.members) {
      const d = Math.hypot(m.x - GATE.x, m.z - GATE.z);
      assert.ok(d >= MIN_GATE_DISTANCE, `site ${s.index} prop ${m.model} is ${d.toFixed(1)} m from the gate`);
    }
  }
  for (let i = 0; i < sites.length; i++) for (let j = i + 1; j < sites.length; j++) {
    const d = Math.hypot(sites[i]!.x - sites[j]!.x, sites[i]!.z - sites[j]!.z);
    assert.ok(d >= 20, `sites ${sites[i]!.index} and ${sites[j]!.index} are ${d.toFixed(1)} m apart`);
  }
});

test('the four transponders sit at leak sites 1 to 4, tipped and half buried, and every model is packed', () => {
  for (const t of TRANSPONDERS) {
    const s = sites.find((w) => w.index === t.site);
    assert.ok(s?.leak, `${t.id} is at a leak site`);
    const m = s!.members.find((x) => x.transponder === t.id);
    assert.ok(m, `${t.id} is on its wreck`);
    assert.equal(m!.model, t.model);
    assert.ok(m!.tilt > 0 && m!.sink > 0, `${t.id} is tipped and sunk`);
  }
  for (const id of [...wreckModels(sites), ...NEIGHBOUR_MODELS]) assert.ok(GEN[id], `${id} is a packed model`);
});

test('the ladder: a leak is broken one rung below its stage until sealed; a seal lifts it exactly one rung; scenery stands at the stage', () => {
  assert.equal(stageRung(0), 0);
  assert.equal(stageRung(1), 1);
  assert.equal(stageRung(4), 2);
  assert.equal(stageRung(6), 3);
  for (let stage = 1; stage <= 6; stage++) {
    const broken = wreckRung(stage, true, false);
    const sealed = wreckRung(stage, true, true);
    assert.equal(sealed - broken, 1, `stage ${stage}: a seal restores one rung`);
    assert.equal(sealed, stageRung(stage));
    assert.equal(wreckRung(stage, false, false), stageRung(stage), `stage ${stage}: scenery at its stage`);
    assert.equal(isBroken(true, false), true);
    assert.equal(isBroken(true, true), false);
  }
  // stage 1 before the seal is broken junk on the low model, after it our pack (also the low model); the RUN.world tier is the mid model
  assert.equal(wreckRung(1, true, false), 0);
  assert.equal(rungLevel(wreckRung(4, true, true)), 'mid');
  assert.equal(rungLevel(wreckRung(6, true, true)), 'high');
  assert.equal(rungLevel(0), 'low');
});
