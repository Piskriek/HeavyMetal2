// Plan 49 Mission 2: "remove the black and yellow chevrons on the base piece", planned over the real lab kits.
import test from 'node:test';
import assert from 'node:assert/strict';
import { flatten, type PlacedPart } from '@hm/kitspec';
import { GATE_KIT } from './kit-gate';
import { GATE_DAIS_KIT } from './kit-gate-dais';
import { applyKitPlan, contactVolume, hazardScope, isHazardPart, planKitMutation } from './kit-mutation';
import { checkKitDefaults, checkPartOverride, withKitDefaults } from './kit-defaults';

const dais = (): PlacedPart[] => flatten(GATE_DAIS_KIT, 'gate-dais');
const gate = (): PlacedPart[] => flatten(GATE_KIT, 'gate');
const paths = (ps: readonly { path: string }[]): string[] => ps.map((p) => p.path).sort();

test('the dais is two paint steps and eight hazard bands, the bands resting on their steps', () => {
  const placed = dais();
  assert.equal(placed.length, 10);
  assert.equal(placed.filter((p) => isHazardPart(p, GATE_DAIS_KIT)).length, 8);
  assert.deepEqual(paths(placed.filter((p) => p.material === 'paint')), ['step-lower', 'step-upper']);
});

test('pinging a step takes the bands on that step out of the build (RULES 8a: hidden, not painted over)', () => {
  const placed = dais();
  const plan = planKitMutation(placed, { kind: 'strip-hazard', path: 'step-lower' }, GATE_DAIS_KIT);
  assert.equal(plan.scope, 'touching');
  assert.deepEqual(paths(plan.changes), ['band-lower-east', 'band-lower-north', 'band-lower-south', 'band-lower-west']);
  for (const c of plan.changes) assert.deepEqual(c.override, { hidden: true });
  assert.ok(plan.changes.every((c) => c.from === 'hazard' && c.to === 'hidden'));
});

test('pinging a band strips every band on its step; nothing pinged strips the whole kit', () => {
  const placed = dais();
  const one = planKitMutation(placed, { kind: 'strip-hazard', path: 'band-upper-north' }, GATE_DAIS_KIT);
  assert.equal(one.scope, 'same-base');
  assert.deepEqual(paths(one.changes), ['band-upper-east', 'band-upper-north', 'band-upper-south', 'band-upper-west']);
  // the gate's rim pinged: both rims on its plinth
  const rim = planKitMutation(gate(), { kind: 'strip-hazard', path: 'rim-front' }, GATE_KIT);
  assert.equal(rim.scope, 'same-base');
  assert.deepEqual(paths(rim.changes), ['rim-back', 'rim-front']);
  const all = planKitMutation(placed, { kind: 'strip-hazard' }, GATE_DAIS_KIT);
  assert.equal(all.scope, 'whole-kit');
  assert.equal(all.changes.length, 8);
});

test('the gate\'s plinth rims are hidden, the plinth and its lamps untouched', () => {
  const placed = gate();
  const plan = planKitMutation(placed, { kind: 'strip-hazard', path: 'plinth' }, GATE_KIT);
  assert.equal(plan.scope, 'touching');
  assert.deepEqual(paths(plan.changes), ['rim-back', 'rim-front']);
  assert.ok(plan.changes.every((c) => c.to === 'hidden'));
});

test('a stripped kit applies, reads as stripped, and restores to its own hazard paint', () => {
  const placed = dais();
  const strip = planKitMutation(placed, { kind: 'strip-hazard' }, GATE_DAIS_KIT);
  const stripped = applyKitPlan({ 'step-upper': { material: 'green' } }, strip);
  assert.equal(stripped['step-upper']?.material, 'green', 'an unrelated override is kept');
  const after = flatten(GATE_DAIS_KIT, 'gate-dais', stripped);
  // all eight bands are hidden (still listed, so they can come back); nothing was repainted
  assert.equal(after.filter((p) => p.hidden).length, 8);
  assert.equal(after.filter((p) => p.material === 'hazard').length, 8);
  assert.equal(planKitMutation(after, { kind: 'strip-hazard' }, GATE_DAIS_KIT).scope, 'none', 'nothing left to strip');
  const restore = planKitMutation(after, { kind: 'restore-hazard' }, GATE_DAIS_KIT);
  assert.equal(restore.changes.length, 8);
  const back = flatten(GATE_DAIS_KIT, 'gate-dais', applyKitPlan(stripped, restore));
  assert.equal(back.filter((p) => p.material === 'hazard' && !p.hidden).length, 8);
});

test('set-material and reset touch only the named parts', () => {
  const placed = dais();
  const set = planKitMutation(placed, { kind: 'set-material', paths: ['step-lower', 'no-such-part'], material: 'mat:workshop-steel' }, GATE_DAIS_KIT);
  assert.deepEqual(paths(set.changes), ['step-lower']);
  const ov = applyKitPlan({}, set);
  assert.deepEqual(ov, { 'step-lower': { material: 'mat:workshop-steel' } });
  const reset = planKitMutation(flatten(GATE_DAIS_KIT, 'gate-dais', ov), { kind: 'reset', paths: ['step-lower'] }, GATE_DAIS_KIT);
  assert.deepEqual(applyKitPlan(ov, reset), {});
});

test('hazard scope falls back to the whole kit when the pinged body touches no trim', () => {
  const placed = gate();
  const { scope, parts } = hazardScope(placed, 'lintel', GATE_KIT);
  assert.equal(scope, 'whole-kit');
  assert.deepEqual(paths(parts), ['rim-back', 'rim-front']);
});

test('contact needs touching boxes', () => {
  const a = { min: [0, 0, 0] as const, max: [1, 1, 1] as const };
  assert.ok(contactVolume(a, { min: [1, 0, 0], max: [2, 1, 1] }) > 0, 'touching faces share a slab');
  assert.equal(contactVolume(a, { min: [1.1, 0, 0], max: [2, 1, 1] }), 0);
});

test('shipped defaults are shape-checked and sit under the player\'s overrides field by field', () => {
  assert.deepEqual(checkPartOverride({ material: 'paint' }), { material: 'paint' });
  assert.equal(checkPartOverride({ material: 'paint', evil: 1 }), null);
  assert.equal(checkPartOverride({ material: '<script>' }), null);
  assert.equal(checkPartOverride({ params: { headWidth: Number.NaN } }), null);
  const checked = checkKitDefaults({
    'gate-dais': { 'band-lower-north': { material: 'paint' }, '../etc': { material: 'paint' } },
    'bad kit id': { x: { material: 'paint' } },
  });
  assert.deepEqual(checked, { 'gate-dais': { 'band-lower-north': { material: 'paint' } } });
  // no defaults for a key: the overrides come back as given, undefined included
  assert.equal(withKitDefaults('no-such-kit', undefined), undefined);
});

test('RULES 8a: a hidden part is genuinely out of the build: no triangles, so no ray can hit it', async () => {
  const THREE = await import('three');
  const { buildKitPreset } = await import('./kit-build');
  const mat = new THREE.MeshBasicMaterial();
  const materials = { paint: mat, hazard: mat };
  const full = buildKitPreset(GATE_DAIS_KIT, 'gate-dais', { materials, gen: () => null, maxRank: 2 })!;
  const strip = planKitMutation(dais(), { kind: 'strip-hazard' }, GATE_DAIS_KIT);
  const hiddenBuild = buildKitPreset(GATE_DAIS_KIT, 'gate-dais', { materials, gen: () => null, maxRank: 2, overrides: applyKitPlan({}, strip) })!;
  const tris = (b: { group: import('three').Group }) => {
    let n = 0;
    b.group.traverse((o) => { const m = o as import('three').Mesh; if (m.isMesh) n += (m.geometry.index?.count ?? m.geometry.attributes.position!.count) / 3; });
    return n;
  };
  assert.ok(tris(hiddenBuild) < tris(full), `${tris(hiddenBuild)} vs ${tris(full)} triangles`);
  assert.equal(tris(full) - tris(hiddenBuild), 8 * 12, 'eight 12-triangle boxes removed');
  // a ray straight down onto a lower band now meets the step under it, not the band
  hiddenBuild.group.updateMatrixWorld(true);
  const ray = new THREE.Raycaster(new THREE.Vector3(0, 2, 2.39), new THREE.Vector3(0, -1, 0));
  const hit = ray.intersectObject(hiddenBuild.group, true)[0]!;
  assert.equal(hiddenBuild.partAt(hit.object, hit.faceIndex!)?.path, 'step-lower');
  // the explicit option takes parts out too
  const byOption = buildKitPreset(GATE_DAIS_KIT, 'gate-dais', { materials, gen: () => null, maxRank: 2, hiddenParts: ['band-lower-south'] })!;
  assert.equal(tris(full) - tris(byOption), 12);
  assert.deepEqual(checkPartOverride({ hidden: true }), { hidden: true });
  assert.equal(checkPartOverride({ hidden: 'yes' }), null);
});
