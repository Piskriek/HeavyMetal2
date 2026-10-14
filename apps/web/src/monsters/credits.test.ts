// The in-game credits list is the manifest's sources (credits.json), each with its licence and link.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { MONSTER_CREDITS } from './credits';

const root = fileURLToPath(new URL('../../../../', import.meta.url));

test('the credits list names every source of the monster art, with its licence and link', () => {
  const manifest = JSON.parse(readFileSync(`${root}apps/web/public/monsters/credits.json`, 'utf8')) as {
    sources: { id: string; licence: string; url: string }[];
  };
  assert.deepEqual(MONSTER_CREDITS.map((c) => c.id).sort(), manifest.sources.map((s) => s.id).sort());
  for (const c of MONSTER_CREDITS) {
    const s = manifest.sources.find((x) => x.id === c.id)!;
    assert.ok(c.licence.startsWith(s.licence.split(' ')[0]!), `${c.id}: licence ${c.licence} vs ${s.licence}`);
    assert.equal(c.url, s.url, `${c.id}: link`);
  }
});
