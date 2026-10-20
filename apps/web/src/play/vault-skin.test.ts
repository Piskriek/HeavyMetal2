import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { flatten } from '@hm/kitspec';
import { VAULT } from '@hm/vault';
import { CAPACITOR_BANK_KIT } from './kit-capacitor-bank';
import { bodyMaterial, skinName, skinOverride, vaultSkin } from './vault-skin';

const placed = flatten(CAPACITOR_BANK_KIT, 'capacitor-bank');
const preset = VAULT[0]!.id;

test('a skin is a Texture Mill preset: its evaluated tile on Medium and High, its flat look on Low', () => {
  const tex = vaultSkin(skinName(preset), true) as THREE.MeshStandardMaterial;
  const flat = vaultSkin(skinName(preset), false) as THREE.MeshStandardMaterial;
  assert.ok(tex.map instanceof THREE.DataTexture && tex.map.image.width === 64);
  assert.ok(tex.roughnessMap, 'its roughness comes from the tile');
  assert.equal(flat.map, null);
  assert.equal(vaultSkin(skinName(preset), true), tex, 'one material per preset and tier, shared');
  assert.equal(vaultSkin('gunmetal', true), null, 'not a skin');
  assert.equal(vaultSkin(skinName('no-such-preset'), true), null);
});

test('a Shape Press part takes a skin on its body only; a box takes it whole; a generated core takes none', () => {
  const bolt = placed.find((p) => p.source.kind === 'param')!;
  const ov = skinOverride(preset, bolt)!;
  const body = Object.keys(ov.slotMaterials ?? {})[0]!;
  assert.equal(ov.slotMaterials?.[body], skinName(preset));
  assert.equal(ov.material, undefined, 'the part material (and any slot an operator adds) stays');
  const box = placed.find((p) => p.source.kind === 'box')!;
  assert.deepEqual(skinOverride(preset, box), { material: skinName(preset) });
  const core = placed.find((p) => p.source.kind === 'gen')!;
  assert.equal(skinOverride(preset, core), null);
});

test('a skin keeps a printed part\'s shape, and the part then wears it', () => {
  const bolt = placed.find((p) => p.source.kind === 'param')!;
  const printed = { gen: 'bolt', params: { headWidth: 0.12 }, slotMaterials: { metal: 'green' } };
  const ov = skinOverride(preset, bolt, printed)!;
  assert.equal(ov.gen, 'bolt');
  assert.deepEqual(ov.params, { headWidth: 0.12 });
  const after = flatten(CAPACITOR_BANK_KIT, 'capacitor-bank', { [bolt.path]: ov }).find((p) => p.path === bolt.path)!;
  assert.equal(bodyMaterial(after), skinName(preset));
});
