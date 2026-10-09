import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { parseMd2, createMd2Mesh } from '../src/md2';

describe('@hm/shareware - Quake MD2 Model Parser', () => {
  const assetPath = path.resolve('packages/shareware/assets/ogro.md2');
  const buffer = fs.readFileSync(assetPath).buffer;

  it('parses ogro.md2 BufferGeometry and morph animations', () => {
    const model = parseMd2(buffer);
    assert.ok(model.geometry);
    const pos = model.geometry.attributes.position;
    assert.ok(pos && pos.count > 1000);
    assert.equal(model.totalFrames, 199);
    assert.ok(model.animationNames.length >= 15);
    assert.ok(model.animationNames.includes('stand'));
    assert.ok(model.animationNames.includes('run'));
    assert.ok(model.animationNames.includes('attack'));
  });

  it('creates animated Three.js mesh with AnimationMixer and actions', () => {
    const model = parseMd2(buffer);
    const { mesh, mixer, actions } = createMd2Mesh(model);

    assert.ok(mesh);
    assert.ok(mixer);
    assert.ok(actions.has('stand'));
    assert.ok(actions.has('run'));

    const runAction = actions.get('run')!;
    assert.equal(typeof runAction.play, 'function');
  });
});
