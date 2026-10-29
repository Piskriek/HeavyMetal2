// Every material a kit on the Studio shelf names reaches a real finish there: a shelf preset (by id or alias), a lamp code, a glow
// name, or a generated asset's own material. None falls back silently to the shelf's default, as the lab's names did until the
// alias map (Argon's yes, 29 Oct).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveMatPreset } from '@hm/matstack';
import { STUDIO_KIT_LIST } from './studio-kit-registry';
import { KIT_GLOW_NAMES } from '../viewport/build-studio-machine-model';
import { slotMaterialId } from '../state/studio-store';

const reaches = (name: string): boolean =>
  name === 'gen' || name.startsWith('lx:') || KIT_GLOW_NAMES[name] !== undefined || resolveMatPreset(name) !== undefined;

test('every material a shelf kit names reaches a real finish in the Studio', () => {
  const missing: string[] = [];
  for (const entry of STUDIO_KIT_LIST) {
    for (const [partId, part] of Object.entries(entry.kit.parts)) {
      const names = [part.material, ...Object.values(part.slotMaterials ?? {})];
      for (const name of names) if (!reaches(name)) missing.push(`${entry.id} ${partId}: ${name}`);
    }
  }
  assert.deepEqual([...new Set(missing)], []);
});

test('the material editor opens on a slot\'s shelf finish, a plain kit name included', () => {
  assert.equal(slotMaterialId('darkSteel'), 'mat:workshop-steel');
  assert.equal(slotMaterialId('mat:copper-bus-bar'), 'mat:old-copper', 'an old alias opens on its canonical preset');
  assert.equal(slotMaterialId('mat:lab-fresh'), 'mat:lab-fresh');
  assert.equal(slotMaterialId('lab-fresh'), 'mat:lab-fresh');
  assert.equal(slotMaterialId('lx:6500:1.5:steady:22cc44'), null, 'a lamp has no shelf finish to edit');
  assert.equal(slotMaterialId('violet'), null);
});
