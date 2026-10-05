import test from 'node:test';
import assert from 'node:assert/strict';
import type { PresetBundle } from '@hm/contracts';
import { checkIslandFile, decodeIslandFile, encodeIslandFile, islandFileName, islandFileText } from './island-file';

const bundle = {
  format: 'hm-bundle', version: 1, root: 'scene-1', schemaVersions: { scene: 1 },
  presets: [{ id: 'scene-1', kind: 'scene', name: 'Isle', revision: 1, params: {}, children: {} }],
} as unknown as PresetBundle;

test('an island goes out and comes back the same', async () => {
  const bytes = await encodeIslandFile('Basalt Isle', 'volcano', bundle);
  assert.equal(bytes[0], 0x1f, 'gzipped');
  const { file, error } = await decodeIslandFile(bytes);
  assert.equal(error, null);
  assert.equal(file?.name, 'Basalt Isle');
  assert.equal(file?.template, 'volcano');
  assert.deepEqual(file?.bundle, bundle);
});

test('a template island that was never edited has no map', async () => {
  const { file, error } = await decodeIslandFile(await encodeIslandFile('Fresh', 'blank-island', null));
  assert.equal(error, null);
  assert.equal(file?.bundle, null);
});

test('plain JSON (a hand-made file) reads too', async () => {
  const { file } = await decodeIslandFile(new TextEncoder().encode(islandFileText('Plain', 'volcano', bundle)));
  assert.equal(file?.name, 'Plain');
});

test('garbage, truncated and empty files are refused in plain words, never thrown', async () => {
  const good = await encodeIslandFile('Isle', 'volcano', bundle);
  for (const bytes of [new Uint8Array(0), good.subarray(0, good.length / 2), new Uint8Array([0x1f, 0x8b, 1, 2, 3]), new TextEncoder().encode('{"format":'), crypto.getRandomValues(new Uint8Array(500))]) {
    const r = await decodeIslandFile(bytes);
    assert.equal(r.file, null);
    assert.ok(r.error && r.error.length > 10, r.error ?? 'no error');
  }
});

test('a file from a newer game asks for an update', () => {
  const r = checkIslandFile({ format: 'setmix-island', version: 99, name: 'x', template: 'volcano', bundle: null });
  assert.match(r.error ?? '', /newer SetMix/);
});

test('other files and broken maps are named', () => {
  assert.match(checkIslandFile({ format: 'hm-bundle' }).error ?? '', /some other kind of file/);
  assert.match(checkIslandFile({ format: 'setmix-island', version: 1, name: 'x', template: 'volcano', bundle: { ...bundle, presets: [] } }).error ?? '', /no island/);
  assert.match(checkIslandFile({ format: 'setmix-island', version: 1, name: 'x', template: 'volcano', bundle: { ...bundle, presets: [42] } }).error ?? '', /damaged/);
  assert.match(checkIslandFile({ format: 'setmix-island', version: 1, name: 'x', bundle: null }).error ?? '', /what kind of island/);
});

test('names: long ones are cut, a missing one gets a default; file names are safe', () => {
  assert.equal(checkIslandFile({ format: 'setmix-island', version: 1, name: 'x'.repeat(200), template: 'volcano', bundle: null }).file?.name.length, 60);
  assert.equal(checkIslandFile({ format: 'setmix-island', version: 1, template: 'volcano', bundle: null }).file?.name, 'Imported island');
  assert.equal(islandFileName('Basalt Isle!/..\\'), 'Basalt Isle.setmix');
  assert.equal(islandFileName('???'), 'island.setmix');
});
