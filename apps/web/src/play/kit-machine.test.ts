import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import type { Kit } from '@hm/kitspec';
import { kitMachineProp, tierOfLevel } from './kit-machine';

/** A small machine: a skid, a housing with a vent and a feed, a lamp, and bolts. */
const kit: Kit = {
  parts: {
    skid: { source: { kind: 'box', size: [2, 0.2, 2] }, material: 'hull-steel', rank: 0 },
    housing: { source: { kind: 'param', gen: 'can', params: { width: 1.2, depth: 1.2, height: 1.6 } }, material: 'hull-steel', rank: 0 },
    lamp: { source: { kind: 'box', size: [0.2, 0.08, 0.04] }, material: 'lamp', rank: 1 },
    bolt: { source: { kind: 'param', gen: 'bolt', params: {} }, material: 'accent-hardware', rank: 2 },
  },
  assemblies: {
    machine: {
      children: [
        { ref: 'skid' },
        { ref: 'housing', at: [0, 0.2, 0] },
        { ref: 'lamp', at: [0, 1.0, 0.62] },
        { ref: 'bolt', at: [-0.9, 0.2, 0.9], repeat: { count: 2, step: [1.8, 0, 0] } },
      ],
      sockets: { power: { at: [0.8, 0.2, 0] }, vent: { at: [0, 1.85, -0.3] }, feed: { at: [0, 1.85, 0.3] } },
    },
  },
};
const materials = {
  'hull-steel': new THREE.MeshStandardMaterial(),
  'accent-hardware': new THREE.MeshStandardMaterial(),
  lamp: new THREE.MeshStandardMaterial({ emissive: '#3eff8b' }),
};

test('a kit machine takes its points from the kit sockets', () => {
  const m = kitMachineProp(kit, 'machine', { materials, gen: () => null, stage: 6, genLevel: 'high' })!;
  assert.deepEqual(m.vent?.toArray(), [0, 1.85, -0.3]);
  assert.deepEqual(m.feed?.toArray(), [0, 1.85, 0.3]);
  assert.deepEqual(m.power.toArray(), [0.8, 0.2, 0]);
  assert.equal(m.top, null);
});

test('the stage and the tier pick the rank: bolts only at stage 3+ on Medium or High, lamps from stage 2', () => {
  const calls = (stage: number, level: 'low' | 'mid' | 'high') => kitMachineProp(kit, 'machine', { materials, gen: () => null, stage, genLevel: level })!.build;
  const early = calls(1, 'high'), mid = calls(2, 'high'), late = calls(6, 'high'), low = calls(6, 'low');
  const visible = (b: typeof early) => b.group.children.filter((c) => c.visible).map((c) => c.name).sort();
  assert.ok(!visible(early).some((n) => n.startsWith('kit:lamp')), 'no lamp at stage 1');
  assert.ok(visible(mid).some((n) => n.startsWith('kit:lamp')), 'the lamp from stage 2');
  assert.ok(visible(late).some((n) => n.startsWith('kit:accent-hardware')), 'bolts at stage 6 on High');
  assert.ok(!visible(low).some((n) => n.startsWith('kit:accent-hardware')), 'no bolts on Low');
  assert.equal(tierOfLevel('mid'), 'medium');
});

test('the lamps glow with the machine', () => {
  const m = kitMachineProp(kit, 'machine', { materials, gen: () => null, stage: 6, genLevel: 'high' })!;
  assert.equal(m.lamps.length, 1);
  m.light(0.5);
  assert.ok(Math.abs((m.lamps[0]!.material as THREE.MeshStandardMaterial).emissiveIntensity - 0.8) < 1e-9);
});

test('two machines glow on their own (their lamps do not share a material)', () => {
  const a = kitMachineProp(kit, 'machine', { materials, gen: () => null, stage: 6, genLevel: 'high' })!;
  const b = kitMachineProp(kit, 'machine', { materials, gen: () => null, stage: 6, genLevel: 'high' })!;
  a.light(1);
  b.light(0);
  assert.notEqual(a.lamps[0]!.material, b.lamps[0]!.material);
  assert.ok((a.lamps[0]!.material as THREE.MeshStandardMaterial).emissiveIntensity > (b.lamps[0]!.material as THREE.MeshStandardMaterial).emissiveIntensity);
});
