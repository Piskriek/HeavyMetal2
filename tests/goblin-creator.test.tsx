/** MP-T06: the goblin creator and the crew saved on this device. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { PROFILES_KEY, legacyProfiles, listProfiles, saveProfile, validDna } from '../src/game/meta/goblin-profiles';
import { encodeGoblinDna, generateRandomGoblin } from '../src/game/meta/goblin-dna';
import CharacterCreatorStudio from '../src/components/creator/CharacterCreatorStudio';

const memory = () => { const map = new Map<string, string>(); return { getItem: (k: string) => map.get(k) ?? null, setItem: (k: string, v: string) => { map.set(k, v); }, map }; };

test('MP-T06: a goblin is saved to the crew and read back; bad DNA and empty names are refused', () => {
  const store = memory();
  const dna = encodeGoblinDna(generateRandomGoblin(42));
  const saved = saveProfile({ name: 'Rivet-8', title: 'The Mechanic', dna }, store, 1000);
  assert.equal(saved.ok, true);
  assert.deepEqual(listProfiles(store).map((p) => [p.name, p.dna]), [['Rivet-8', dna]]);
  const tampered = dna.slice(0, 5) + (dna[5] === 'A' ? 'B' : 'A') + dna.slice(6);
  const refused = saveProfile({ name: 'Cheat', title: '', dna: tampered }, store);
  assert.equal(refused.ok, false);
  assert.match((refused as { reason: string }).reason, /checksum/);
  assert.equal(saveProfile({ name: '   ', title: '', dna }, store).ok, false);
  store.setItem(PROFILES_KEY, JSON.stringify([{ name: 'X', dna: 'GOB-0000-0000-0000' }, { name: 'Ok', dna }]));
  assert.deepEqual(listProfiles(store).map((p) => p.name), ['Ok'], 'a stored profile with bad DNA is dropped on read');
});

test('MP-T06: the built-in riders get stable profiles, so old saves keep their identities', () => {
  const riders = [{ id: 'grub', name: 'GRUB' }, { id: 'nix', name: 'NIX' }];
  const a = legacyProfiles(riders); const b = legacyProfiles(riders);
  assert.deepEqual(a, b);
  assert.ok(a.every((p) => validDna(p.dna)));
  assert.notEqual(a[0].dna, a[1].dna);
});

test('MP-T06: the creator studio renders the goblin, its name plate and the parts tray', () => {
  const html = renderToStaticMarkup(createElement(CharacterCreatorStudio));
  assert.match(html, /<svg/);
  assert.match(html, /aria-label="Goblin name"[^>]*value="Rivet-8"|value="Rivet-8"[^>]*aria-label="Goblin name"/);
  assert.match(html, /role="radiogroup" aria-label="Eyewear options"/);
  assert.match(html, /Save to crew/);
});
