/** MP-T05: goblin DNA codec, occlusion and the SVG compositor (src/game/meta). */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { decodeGoblinDna, encodeGoblinDna, generateRandomGoblin } from '../src/game/meta/goblin-dna';
import { composeGoblinSvg, occlusionNotes } from '../src/game/meta/goblin-compositor';

test('MP-T05: 10,000 random goblins round-trip through the DNA codec exactly', () => {
  for (let seed = 0; seed < 10_000; seed++) {
    const goblin = generateRandomGoblin(seed);
    const dna = encodeGoblinDna(goblin);
    assert.equal(encodeGoblinDna(decodeGoblinDna(dna)), dna, `seed ${seed}`);
  }
});

test('MP-T05: a one-character mutation fails the checksum at least 99.6 % of the time', () => {
  const HEX = '0123456789ABCDEF';
  let tried = 0; let caught = 0;
  for (let seed = 0; seed < 300; seed++) {
    const dna = encodeGoblinDna(generateRandomGoblin(seed));
    const head = dna.slice(0, 18); // GOB-XXXX-XXXX-XXXX: the checksummed part
    for (let i = 4; i < head.length; i++) {
      if (head[i] === '-') continue;
      const swap = HEX[(HEX.indexOf(head[i].toUpperCase()) + 1 + (seed % 15)) % 16];
      const bad = dna.slice(0, i) + swap + dna.slice(i + 1);
      tried++;
      try { decodeGoblinDna(bad); } catch { caught++; }
    }
  }
  assert.ok(caught / tried >= 0.996, `${caught}/${tried}`);
});

test('MP-T05: occlusion: headgear that hides the hair leaves no hair in the SVG', () => {
  let hidden = 0;
  for (let seed = 0; seed < 10_000; seed += 7) {
    const goblin = generateRandomGoblin(seed);
    const svg = composeGoblinSvg(goblin);
    assert.match(svg, /^<svg[\s\S]*<\/svg>$/);
    if (occlusionNotes(goblin).some((n) => n.includes('hides the'))) {
      hidden++;
      const hairless = composeGoblinSvg({ ...goblin, layers: { ...goblin.layers, hair: 0 } });
      assert.equal(svg, hairless, `seed ${seed}: hidden hair must not change the drawing`);
    }
  }
  assert.ok(hidden > 0, 'the sample includes hidden-hair cases');
});

test('MP-T05: the same seed composes the same SVG (hash-stable)', () => {
  const hash = (s: string) => createHash('sha256').update(s).digest('hex');
  assert.equal(hash(composeGoblinSvg(generateRandomGoblin('grub'))), hash(composeGoblinSvg(generateRandomGoblin('grub'))));
  assert.notEqual(composeGoblinSvg(generateRandomGoblin(1)), composeGoblinSvg(generateRandomGoblin(2)));
});
