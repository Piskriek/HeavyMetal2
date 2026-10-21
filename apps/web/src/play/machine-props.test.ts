// ============================================================================
// File: apps/web/src/play/machine-props.test.ts
// TICKET-03 (BB-09): every machine prop stands its machineSize height, on its base
// (the ground, or the 0.78 m ring for the heavies), and its sockets stay on the prop.
// ============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import * as lab from '@hm/labkit';
import { HEAVY_KINDS, MACHINE_KINDS, type MachineKind } from '@hm/plotsim';
import {
  feedCubeCount,
  feedCubeProgress,
  FEED_CUBES_FULL,
  machinePlumeCount,
  machinePlumeLook,
  machinePlumeSpec,
  machineProp,
  MACHINE_PLUME_SPECS,
  plumeCadenceMultiplier,
  RING_TOP_Y,
  type PlumeCadence,
} from './machine-props';
import { machinePlumeColour, machineSize } from '../base/machine-inspect';

const ALL_KINDS: readonly MachineKind[] = [...MACHINE_KINDS, ...HEAVY_KINDS];

test('every machine prop stands its machineSize height, on its base', () => {
  const m = lab.createMaterials();
  for (const stage of [1, 6]) {
    for (const kind of ALL_KINDS) {
      const p = machineProp(m, kind, stage);
      p.group.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(p.group);
      const h = box.max.y - box.min.y;
      const want = machineSize(kind).h;
      assert.ok(Math.abs(h - want) < 0.01, `${kind} at stage ${stage}: height ${h.toFixed(3)} m, want ${want} m`);
      const base = HEAVY_KINDS.includes(kind as (typeof HEAVY_KINDS)[number]) ? RING_TOP_Y : 0;
      assert.ok(Math.abs(box.min.y - base) < 0.01, `${kind} at stage ${stage}: base ${box.min.y.toFixed(3)} m, want ${base} m`);
    }
  }
});

test('sockets (power, vent, top) stay on the scaled prop, within its box', () => {
  const m = lab.createMaterials();
  for (const kind of ALL_KINDS) {
    const p = machineProp(m, kind, 6);
    p.group.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(p.group).expandByScalar(0.5);
    const points = [p.power, p.vent, p.top].filter((v): v is THREE.Vector3 => v !== null);
    for (const v of points) {
      assert.ok(box.containsPoint(v), `${kind}: socket (${v.x.toFixed(2)}, ${v.y.toFixed(2)}, ${v.z.toFixed(2)}) is off the prop`);
    }
  }
});

test('a machine prop stands its height in the group that the scene moves (position and yaw kept)', () => {
  const m = lab.createMaterials();
  const p = machineProp(m, 'drill', 6);
  p.group.position.set(10, 2, -4);
  p.group.rotation.y = 1.2;
  p.group.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(p.group);
  assert.ok(Math.abs(box.min.y - 2) < 0.01, `base moves with the group: ${box.min.y}`);
  assert.ok(Math.abs(box.max.y - 2 - machineSize('drill').h) < 0.01, `top is h above the base: ${box.max.y}`);
});

// ============================================================================
// T03P (ARGO_NOTE_08, brief 29 item 6): each kind's plume spec, its one pour count, its feed and vent sockets.
// ============================================================================


const CADENCES: readonly PlumeCadence[] = ['continuous', 'ram-fast', 'ram-heavy', 'shimmer', 'chatter', 'crackle'];
/** The kinds that take material in: their feed hopper is where the ore cubes drop. */
// the kinds that take ore in (ARGO_NOTE_16 ruling 3: the power unit takes none, its feed hopper is gone)
const FEEDS: readonly MachineKind[] = ['mill', 'heavy-mill', 'press', 'heavy-press', 'water', 'heavy-water'];

test('every kind has a plume spec whose colour is the inspector colour, with the note\'s rates and cadences', () => {
  for (const kind of ALL_KINDS) {
    const s = machinePlumeSpec(kind);
    assert.equal(s.colour, machinePlumeColour(kind), `${kind} colour`);
    assert.ok(s.rate > 0 && s.speed > 0 && s.spread > 0 && s.pixelSize > 0 && s.lifetime > 0, `${kind} spec is positive`);
    assert.ok(CADENCES.includes(s.cadence), `${kind} cadence ${s.cadence}`);
  }
  assert.equal(machinePlumeSpec('press').cadence, 'ram-fast');
  assert.equal(machinePlumeSpec('heavy-press').cadence, 'ram-heavy');
  assert.equal(machinePlumeSpec('pylon').cadence, 'crackle');
  assert.equal(machinePlumeSpec('drill').colour, '#ff7b3d');
  assert.equal(machinePlumeSpec('power').colour, '#b46bff');
  assert.equal(machinePlumeSpec('pylon').colour, '#5ce1e6');
  assert.equal(Object.keys(MACHINE_PLUME_SPECS).length, 11);
});

test('the cadence multipliers stay in their ranges (ARGO_NOTE_08 section 3)', () => {
  for (let i = 0; i < 400; i++) {
    const t = i * 0.037;
    assert.equal(plumeCadenceMultiplier('continuous', t), 1);
    const fast = plumeCadenceMultiplier('ram-fast', t);
    assert.ok(fast >= 0.15 && fast <= 1, `ram-fast ${fast}`);
    const heavy = plumeCadenceMultiplier('ram-heavy', t);
    assert.ok(heavy >= 0.15 && heavy <= 1, `ram-heavy ${heavy}`);
    const shimmer = plumeCadenceMultiplier('shimmer', t);
    assert.ok(shimmer >= 0.7 - 1e-9 && shimmer <= 1 + 1e-9, `shimmer ${shimmer}`);
    const chatter = plumeCadenceMultiplier('chatter', t);
    assert.ok(chatter >= 0.4 - 1e-9 && chatter <= 1 + 1e-9, `chatter ${chatter}`);
    assert.ok([0, 1].includes(plumeCadenceMultiplier('crackle', t)), 'crackle is on or off');
  }
});

test('a machine that does not operate pours nothing: its count is 0 at every time, for every kind', () => {
  for (const kind of ALL_KINDS) {
    for (let i = 0; i < 60; i++) {
      assert.equal(machinePlumeCount(kind, 0, i * 0.11), 0, `${kind} idle at t=${i * 0.11}`);
      assert.equal(machinePlumeCount(kind, 0.04, i * 0.11), 0, `${kind} under 5% at t=${i * 0.11}`);
    }
  }
});

test('an operating machine pours its rate x lifetime at full run, and fewer as its run falls (one number per emitter)', () => {
  for (const kind of ALL_KINDS) {
    const s = machinePlumeSpec(kind);
    const full = s.rate * s.lifetime;
    let peak = 0;
    for (let i = 0; i < 200; i++) peak = Math.max(peak, machinePlumeCount(kind, 1, i * 0.05));
    assert.ok(peak > 0, `${kind} pours at full run`);
    assert.ok(peak <= Math.round(full) + 1, `${kind} peak ${peak} within rate x life ${full.toFixed(1)}`);
    let prev = -1;
    for (const run of [0.1, 0.3, 0.5, 0.8, 1]) {
      const n = machinePlumeCount(kind, run, 0.7);
      assert.ok(n >= prev, `${kind}: count does not fall as run rises (${n} after ${prev})`);
      prev = n;
    }
  }
});

test('the plume look: the height follows the speed and lifetime, the spread is the cone at that height', () => {
  for (const kind of ALL_KINDS) {
    const s = machinePlumeSpec(kind);
    const look = machinePlumeLook(kind);
    assert.ok(look.height > 0 && look.spread > 0, `${kind} look is positive`);
    assert.ok(Math.abs(look.height - s.speed * s.lifetime * 0.6) < 1e-9, `${kind} height`);
    assert.ok(Math.abs(look.spread - 2 * look.height * Math.tan(s.spread)) < 1e-9, `${kind} spread`);
    assert.equal(look.life, s.lifetime);
    assert.equal(look.size, s.pixelSize);
  }
});

test('feed cubes follow the run share: none at 0, the full count at full run, and every drop stays in [0, 1)', () => {
  assert.equal(feedCubeCount(0), 0);
  assert.equal(feedCubeCount(0.04), 0);
  assert.equal(feedCubeCount(1), FEED_CUBES_FULL);
  assert.ok(feedCubeCount(0.5) > 0 && feedCubeCount(0.5) < FEED_CUBES_FULL);
  for (let i = 0; i < 300; i++) {
    const p = feedCubeProgress(i * 0.04, i % FEED_CUBES_FULL, FEED_CUBES_FULL);
    assert.ok(p >= 0 && p < 1, `progress ${p}`);
  }
});

test('the feed and vent sockets: every kind pours from a vent; the material-in kinds have a feed hopper, the others none', () => {
  const m = lab.createMaterials();
  for (const stage of [1, 6]) {
    for (const kind of ALL_KINDS) {
      const p = machineProp(m, kind, stage);
      p.group.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(p.group).expandByScalar(0.5);
      assert.ok(p.vent && box.containsPoint(p.vent), `${kind} at stage ${stage}: vent on the prop`);
      if (FEEDS.includes(kind)) {
        assert.ok(p.feed && box.containsPoint(p.feed), `${kind} at stage ${stage}: feed on the prop`);
      } else {
        assert.equal(p.feed ?? null, null, `${kind} takes no material in`);
      }
    }
  }
});

test('nothing floats: every machine\'s status light sits on its housing, facing out (measured 21 Oct: they hung 0.13 to 1.95 m off)', () => {
  const m = lab.createMaterials();
  for (const stage of [1, 6]) {
    for (const kind of ALL_KINDS) {
      const p = machineProp(m, kind, stage);
      p.group.updateMatrixWorld(true);
      const led = p.group.getObjectByName('housing-status-led')!;
      const others: THREE.Mesh[] = [];
      p.group.traverse((o) => { if ((o as THREE.Mesh).isMesh && o !== led) others.push(o as THREE.Mesh); });
      const at = led.getWorldPosition(new THREE.Vector3());
      const rc = new THREE.Raycaster();
      let gap = Infinity;
      for (let i = 0; i < 24; i++) {
        for (const y of [-0.6, 0, 0.6]) {
          const t = (i / 24) * Math.PI * 2;
          rc.set(at, new THREE.Vector3(Math.cos(t), y, Math.sin(t)).normalize());
          const h = rc.intersectObjects(others, false)[0];
          if (h) gap = Math.min(gap, h.distance);
        }
      }
      assert.ok(gap < 0.04, `${kind} at stage ${stage}: the light is ${gap.toFixed(3)} m from the nearest surface`);
    }
  }
});
