import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { flatten, validate } from '@hm/kitspec';
import { resolveMatPreset } from '@hm/matstack';
import { resolveStem } from '@hm/soundlab';
import { kitAudit } from '../../../apps/web/src/studio/studio-agent-audit';
import { SKINS } from '../../../apps/web/src/monsters/roster';
import {
  CREATURE_ARCHETYPE_GENOMES,
  CREATURE_ASSEMBLY_ORDER,
  CREATURE_PRESET,
  ROSTER_MONSTER_GENOMES,
  creatureAssembly,
  evaluateCreatureGait,
  rosterGenomeById,
} from '../src/index';

const MOTION_PHASES = 8;

function structuralIssues(kit: ReturnType<typeof creatureAssembly>['kit']) {
  const structural = new Set(['unknown-ref', 'unknown-socket', 'bad-parent', 'bad-repeat', 'cycle']);
  return validate(kit, CREATURE_PRESET, { ground: null }).filter((i) => structural.has(i.code));
}

describe('@hm/creature — roster monster genomes (plan 44, part B)', () => {
  it('defines all 38 roster monster species across all 7 biological archetypes', () => {
    assert.ok(ROSTER_MONSTER_GENOMES.length >= 37, `expected at least 37 roster genomes, got ${ROSTER_MONSTER_GENOMES.length}`);
    assert.equal(ROSTER_MONSTER_GENOMES.length, SKINS.length, 'matches apps/web/src/monsters/roster.ts SKINS count');

    const archetypes = new Set(ROSTER_MONSTER_GENOMES.map((g) => g.archetype));
    for (const archetype of ['biped-astro', 'theropod', 'quadruped', 'hexapod', 'arachnid', 'serpentine', 'avian-drone'] as const) {
      assert.ok(archetypes.has(archetype), `missing archetype ${archetype} in ROSTER_MONSTER_GENOMES`);
      assert.ok(
        CREATURE_ARCHETYPE_GENOMES.some((g) => g.archetype === archetype),
        `missing archetype ${archetype} in CREATURE_ARCHETYPE_GENOMES`,
      );
    }

    for (const skin of SKINS) {
      const genome = rosterGenomeById(skin.id);
      assert.ok(genome, `missing genome for skin ${skin.id}`);
      assert.deepEqual(skin.genome, genome, `${skin.id}: roster skin genome matches @hm/creature`);
    }
  });

  for (const genome of ROSTER_MONSTER_GENOMES) {
    it(`${genome.id} (${genome.archetype}) passes kitAudit at ${MOTION_PHASES} phases, ground placement, palette & voice stem`, () => {
      // 1. Material & SoundLab vocal-tract bindings
      const matPreset = resolveMatPreset(genome.skinPaletteId);
      assert.ok(matPreset, `${genome.id}: unknown skinPaletteId ${genome.skinPaletteId}`);
      const voiceStem = resolveStem(genome.voiceStemId);
      assert.ok(voiceStem, `${genome.id}: unknown voiceStemId ${genome.voiceStemId}`);

      // 2. Assembly & 5-rung functional anatomy groups
      const assembly = creatureAssembly(genome);
      const flat = flatten(assembly.kit, CREATURE_PRESET);
      const groups = new Set(flat.map((p) => p.path.split('/')[0]));
      for (const group of CREATURE_ASSEMBLY_ORDER) {
        assert.ok(groups.has(group), `${genome.id}: empty group ${group}`);
      }
      assert.deepEqual(structuralIssues(assembly.kit), [], `${genome.id}: structural validation issues`);

      // 3. Valid ground placement (y >= 0)
      assert.ok(
        assembly.skeleton.groundY >= 0,
        `${genome.id}: groundY=${assembly.skeleton.groundY} clips below floor (y < 0)`,
      );

      // 4. Coaxial joint constraint on every knuckle
      const centreOf = (path: string): readonly [number, number, number] => {
        const p = flat.find((q) => q.path === path);
        assert.ok(p, `${genome.id}: ${path} is placed`);
        return [p!.matrix[12] as number, p!.matrix[13] as number, p!.matrix[14] as number];
      };
      for (const limb of assembly.skeleton.limbs) {
        const root = centreOf(`mechanism/${limb.label}-knuckle-root`);
        assert.ok(Math.abs(root[0] - limb.root[0]) < 1e-6, `${genome.id}: ${limb.label} hip centre matches the joint`);
        assert.ok(Math.abs(root[1] - limb.root[1]) < 1e-6);
        assert.ok(Math.abs(root[2] - limb.root[2]) < 1e-6);
        const mid = centreOf(`mechanism/${limb.label}-knuckle-mid`);
        assert.ok(Math.abs(mid[0] - limb.middle[0]) < 1e-6, `${genome.id}: ${limb.label} knee centre matches the joint`);
        assert.ok(Math.abs(mid[1] - limb.middle[1]) < 1e-6);
        assert.ok(Math.abs(mid[2] - limb.middle[2]) < 1e-6);
        const end = centreOf(`mechanism/${limb.label}-knuckle-end`);
        assert.ok(Math.abs(end[1] - limb.end[1]) < 1e-6, `${genome.id}: ${limb.label} ankle centre matches the joint`);
      }

      // 5. Full kitAudit gate across 8 motion phases
      const report = kitAudit(assembly.kit, { preset: CREATURE_PRESET, phases: MOTION_PHASES });
      assert.equal(report.looseEnds, 0, `${genome.id}: looseEnds=${report.looseEnds}`);
      assert.equal(
        report.solidClearances.length,
        0,
        `${genome.id}: solidClearances=${JSON.stringify(report.solidClearances)}`,
      );
      assert.equal(report.terminals, 0, `${genome.id}: terminals=${report.terminals}`);
      assert.equal(report.ok, true, `${genome.id}: kitAudit failed`);

      // 6. Analytical 2-bone IK gait evaluation
      const gait = evaluateCreatureGait(genome, 0.25, 1.3);
      assert.equal(gait.limbs.length, assembly.skeleton.limbs.length, `${genome.id}: limb count`);
      for (const limb of gait.limbs) {
        assert.equal(limb.withinReach, true, `${genome.id}/${limb.label}: IK target unreachable`);
      }
    });
  }
});
