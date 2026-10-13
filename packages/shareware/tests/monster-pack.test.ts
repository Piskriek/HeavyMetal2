import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

// Reads the manifest written by scripts/pack-monsters.mjs and checks every packed monster.
const ROOT = path.resolve(import.meta.dirname ?? '.', '../../..');
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'docs/monsters/packed.json'), 'utf8')) as {
  monsters: Record<string, { id: string; where: string; dir: string; files: Record<string, number>; frames: number; bytes: number }>;
  totals: { coreBytes: number; coreBudgetBytes: number };
};

describe('monster pack (manifest)', () => {
  const entries = Object.values(manifest.monsters);

  it('has packed monsters', () => {
    assert.ok(entries.length >= 18, `only ${entries.length} monsters packed`);
  });

  for (const m of entries) {
    it(`${m.id}: files exist, sizes match, frames above zero`, () => {
      assert.ok(m.frames > 0, 'frame count');
      for (const [name, size] of Object.entries(m.files)) {
        const file = path.join(ROOT, m.dir, name);
        assert.ok(fs.existsSync(file), `${file} missing`);
        assert.equal(fs.statSync(file).size, size, `${name} size`);
      }
    });
  }

  it('keeps the inline core at or under 1.2 MB', () => {
    assert.ok(manifest.totals.coreBytes <= 1.2 * 1024 * 1024, `core is ${manifest.totals.coreBytes} bytes`);
    const core = entries.filter((m) => m.where === 'core');
    assert.equal(core.length, 6, 'one core monster per archetype');
  });
});
