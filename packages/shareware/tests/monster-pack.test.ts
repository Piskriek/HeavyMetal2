import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { rosterGenomeById } from '@hm/creature';
import { resolveMatPreset } from '@hm/matstack';
import { resolveStem } from '@hm/soundlab';

// Verifies that every monster in docs/monsters/packed.json has been migrated to a procedural @hm/creature genome (plan 44, part B).
const ROOT = path.resolve(import.meta.dirname ?? '.', '../../..');
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'docs/monsters/packed.json'), 'utf8')) as {
  monsters: Record<string, { id: string; where: string; dir: string; files: Record<string, number>; frames: number; bytes: number }>;
  totals: { coreBytes: number; coreBudgetBytes: number };
};

describe('monster pack (procedural @hm/creature migration)', () => {
  const entries = Object.values(manifest.monsters);

  it('has all roster monsters', () => {
    assert.ok(entries.length >= 37, `only ${entries.length} monsters in manifest`);
  });

  for (const m of entries) {
    it(`${m.id}: resolves a procedural @hm/creature genome with matstack palette and soundlab voice stem`, () => {
      const genome = rosterGenomeById(m.id);
      assert.ok(genome, `${m.id} missing from ROSTER_MONSTER_GENOMES`);
      assert.equal(genome.id, m.id);
      assert.ok(resolveMatPreset(genome.skinPaletteId), `${m.id}: invalid skinPaletteId ${genome.skinPaletteId}`);
      assert.ok(resolveStem(genome.voiceStemId), `${m.id}: invalid voiceStemId ${genome.voiceStemId}`);
      for (const name of Object.keys(m.files)) {
        const file = path.join(ROOT, m.dir, name);
        assert.equal(fs.existsSync(file), false, `legacy static file ${file} must be purged`);
      }
    });
  }

  it('retains the 6 core fallback designations', () => {
    const core = entries.filter((m) => m.where === 'core');
    assert.equal(core.length, 6, 'one core monster per archetype');
  });
});
