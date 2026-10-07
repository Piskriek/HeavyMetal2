import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { MATERIALS, makeGroundTextures, stageLook, createGroundMaterial, setStage, meanAlbedo } from '../src/index';

const tex = makeGroundTextures({ size: 64, seed: 3 });

test('six seamless layers of the right size', () => {
  assert.deepEqual([...MATERIALS], ['rock', 'scree', 'gravel', 'dust', 'cracked', 'redsoil']);
  assert.equal(tex.albedoHeight.image.depth, 6);
  assert.equal(tex.albedoHeight.image.width, 64);
  assert.equal(tex.metres.length, 6);
  const d = tex.albedoHeight.image.data as Uint8Array, n = 64;
  // seamless: the jump across the tile's edge is no bigger than a typical step inside it
  for (let layer = 0; layer < 6; layer++) {
    let edge = 0, inner = 0;
    for (let y = 0; y < n; y++) {
      const at = (x: number) => d[(layer * n * n + y * n + x) * 4]!;
      edge += Math.abs(at(n - 1) - at(0));
      inner += Math.abs(at(n / 2) - at(n / 2 - 1));
    }
    assert.ok(edge <= inner * 2.5 + n * 6, `layer ${layer}: edge ${edge} vs inner ${inner}`);
  }
});

test('materials look like themselves', () => {
  const [rr, rg, rb] = meanAlbedo(tex, 5);
  assert.ok(rr > rg * 1.25 && rg >= rb, 'red soil is red');
  const lum = (i: number) => { const [r, g, b] = meanAlbedo(tex, i); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
  for (const i of [0, 1, 2, 4, 5]) assert.ok(lum(3) > lum(i), `dust is the lightest (vs ${MATERIALS[i]})`);
  const [kr, kg, kb] = meanAlbedo(tex, 0);
  assert.ok(Math.max(kr, kg, kb) - Math.min(kr, kg, kb) < 0.12, 'rock is near grey');
});

test('stages climb, stage 1 is low resolution', () => {
  const s1 = stageLook(1), s6 = stageLook(6);
  assert.ok(s1.nearest && !s6.nearest);
  assert.ok(s1.texelsPerMetre < s6.texelsPerMetre && s1.texelsPerMetre <= 8);
  assert.ok(s1.specular === 0 && s6.specular > 0.5 && s1.levels > 0 && s6.levels === 0);
  for (let s = 1; s < 6; s++) assert.ok(stageLook(s + 1).texelsPerMetre >= stageLook(s).texelsPerMetre);
});

test('one program for every stage', () => {
  const m = createGroundMaterial(tex, { stage: 1, sunDir: new THREE.Vector3(0.4, 0.4, -0.8).normalize() });
  const program = m.fragmentShader + JSON.stringify(m.defines ?? {});
  setStage(m, 6);
  assert.equal(m.fragmentShader + JSON.stringify(m.defines ?? {}), program);
  assert.match(m.vertexShader, /matA/);
  assert.match(m.vertexShader, /matB/);
});

test('procedural arrays repeat exactly for a seed and change for another seed', () => {
  const repeat = makeGroundTextures({ size: 64, seed: 3 });
  const other = makeGroundTextures({ size: 64, seed: 4 });
  assert.deepEqual(repeat.albedoHeight.image.data, tex.albedoHeight.image.data);
  assert.deepEqual(repeat.normalRough.image.data, tex.normalRough.image.data);
  assert.notDeepEqual(other.albedoHeight.image.data, tex.albedoHeight.image.data);
});

test('fractional and zero stages interpolate safely', () => {
  assert.deepEqual(stageLook(0), stageLook(1));
  const halfway = stageLook(2.5);
  assert.equal(halfway.texelsPerMetre, (stageLook(2).texelsPerMetre + stageLook(3).texelsPerMetre) / 2);
  assert.ok(halfway.levels > 0 && halfway.levels < stageLook(2).levels);
  assert.equal(stageLook(2.5).triplanar, false);
  assert.equal(stageLook(3).triplanar, true);
});

test('shader uses roughness, normals, and fog without a stage-specific define', () => {
  const material = createGroundMaterial(tex, { stage: 3, sunDir: new THREE.Vector3(0.5, 0.25, -0.8) });
  assert.match(material.fragmentShader, /uNormalRough/);
  assert.match(material.fragmentShader, /uSpecular/);
  assert.match(material.fragmentShader, /#include <fog_pars_fragment>/);
  assert.match(material.fragmentShader, /#include <fog_fragment>/);
  assert.match(material.fragmentShader, /#include <colorspace_fragment>/);
  setStage(material, 1);
  assert.equal(material.uniforms['uNearest']!.value, true);
  setStage(material, 6);
  assert.equal(material.uniforms['uTriplanar']!.value, true);
  material.dispose();
});
