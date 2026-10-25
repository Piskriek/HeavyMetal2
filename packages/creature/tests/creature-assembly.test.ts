/**
 * The creature kit's verification gate (plan 44, rung 4): every archetype the roster declares compiles to an audited
 * five-group kit, and the kit passes `studio.kit.audit` at every phase of its own motion.
 *
 * The audit is the only judge here — no test-only shortcuts, no relaxed tolerances. If a genome's proportions stop
 * fitting its own pelvis, this file says so.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { kitAudit, MOTION_PHASES } from '../../../apps/web/src/studio/studio-agent-audit';
import { flatten, validate } from '@hm/kitspec';
import {
  ASTRO_SUIT_GENOME,
  CREATURE_ARCHETYPE_GENOMES,
  CREATURE_ASSEMBLY_ORDER,
  CREATURE_PRESET,
  creatureAssembly,
  creaturePartBones,
  creatureSkeleton,
} from '../src/index';

test('the four archetypes compile to five-group kits that audit clean at every motion phase', () => {
  for (const genome of CREATURE_ARCHETYPE_GENOMES) {
    const assembly = creatureAssembly(genome);
    const kit = assembly.kit;
    const report = kitAudit(kit, { preset: CREATURE_PRESET, phases: MOTION_PHASES });
    assert.equal(report.looseEnds, 0, `${genome.id}: ${report.looseEnds} loose ends`);
    assert.equal(report.solidClearances.length, 0, `${genome.id}: ${report.solidClearances.length} collisions`);
    assert.equal(report.terminals, 0, `${genome.id}: ${report.terminals} terminal issues`);
    assert.equal(report.phases, MOTION_PHASES, `${genome.id}: the sweep covers every phase`);
    assert.ok(report.ok, `${genome.id}: the audit passes`);
    assert.deepEqual(report.loose, [], `${genome.id}: nothing floats`);
    assert.deepEqual(report.solidClearances, [], `${genome.id}: nothing interpenetrates`);
  }
});

test('the five canonical groups are the five assemblies, in order, and every part lands in one', () => {
  for (const genome of CREATURE_ARCHETYPE_GENOMES) {
    const assembly = creatureAssembly(genome);
    assert.deepEqual(Object.keys(assembly.kit.assemblies).slice(0, 5), [...CREATURE_ASSEMBLY_ORDER]);
    const placed = flatten(assembly.kit, CREATURE_PRESET);
    assert.equal(placed.length, assembly.parts.length, `${genome.id}: every built part is placed`);
    const groups = new Set(placed.map((p) => p.path.split('/')[0]));
    for (const group of CREATURE_ASSEMBLY_ORDER) assert.ok(groups.has(group), `${genome.id} carries a ${group} group`);
  }
});

test('every placement in the kit resolves: no broken ref, socket or parent', () => {
  const structural = new Set(['unknown-ref', 'unknown-socket', 'bad-parent', 'bad-repeat', 'cycle']);
  for (const genome of CREATURE_ARCHETYPE_GENOMES) {
    const kit = creatureAssembly(genome).kit;
    const issues = validate(kit, CREATURE_PRESET, { ground: null }).filter((i) => structural.has(i.code));
    assert.deepEqual(issues, [], `${genome.id}: ${JSON.stringify(issues.slice(0, 4))}`);
  }
});

test('every limb joint is coaxial: the knuckle centre is the joint the skeleton resolved', () => {
  for (const genome of CREATURE_ARCHETYPE_GENOMES) {
    const assembly = creatureAssembly(genome);
    const skeleton = creatureSkeleton(genome);
    const placed = flatten(assembly.kit, CREATURE_PRESET);
    const centreOf = (path: string): readonly [number, number, number] => {
      const p = placed.find((q) => q.path === path);
      assert.ok(p, `${genome.id}: ${path} is placed`);
      return [p!.matrix[12] as number, p.matrix[13] as number, p.matrix[14] as number];
    };
    for (const limb of skeleton.limbs) {
      const root = centreOf(`mechanism/${limb.label}-knuckle-root`);
      assert.ok(Math.abs(root[0] - limb.root[0]) < 1e-6, `${genome.id}: ${limb.label} hip centre matches the joint`);
      assert.ok(Math.abs(root[1] - limb.root[1]) < 1e-6);
      assert.ok(Math.abs(root[2] - limb.root[2]) < 1e-6);
      const mid = centreOf(`mechanism/${limb.label}-knuckle-mid`);
      assert.ok(Math.abs(mid[0] - limb.middle[0]) < 1e-6, `${genome.id}: ${limb.label} knee centre matches the solver's joint`);
      assert.ok(Math.abs(mid[1] - limb.middle[1]) < 1e-6);
      assert.ok(Math.abs(mid[2] - limb.middle[2]) < 1e-6);
      const end = centreOf(`mechanism/${limb.label}-knuckle-end`);
      assert.ok(Math.abs(end[1] - limb.end[1]) < 1e-6, `${genome.id}: ${limb.label} ankle centre matches the joint`);
    }
  }
});

test('a kit is a pure function of its genome', () => {
  for (const genome of CREATURE_ARCHETYPE_GENOMES) {
    const a = creatureAssembly(genome);
    const b = creatureAssembly(genome);
    assert.deepEqual(a.kit, b.kit, `${genome.id}: the same genome builds the same kit`);
    assert.deepEqual(a.bones, b.bones);
  }
});

test('the Astro suit binds its organs to the Mixamo rest skeleton by name', () => {
  const bones = creaturePartBones(ASTRO_SUIT_GENOME);
  assert.equal(bones['base/pelvis'], 'mixamorigHips');
  assert.equal(bones['base/spine-0'], 'mixamorigSpine');
  assert.equal(bones['mechanism/left-leg-upper'], 'mixamorigLeftUpLeg');
  assert.equal(bones['mechanism/right-arm-lower'], 'mixamorigRightForeArm');
  assert.equal(bones['mechanism/left-leg-boot'], 'mixamorigLeftFoot');
  assert.equal(bones['subject/subject-0'], 'mixamorigLeftHand');
  assert.equal(bones['controls/control-0'], 'mixamorigHead');
  const placed = flatten(creatureAssembly(ASTRO_SUIT_GENOME).kit, CREATURE_PRESET);
  assert.ok(placed.length >= 38, `the suit is at least 38 parts (got ${placed.length})`);
});
