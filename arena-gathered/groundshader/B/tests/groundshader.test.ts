import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
  MATERIALS,
  makeGroundTextures,
  stageLook,
  createGroundMaterial,
  setStage,
  meanAlbedo,
  getStage,
  materialIndex,
} from '../src/index';

const tex = makeGroundTextures({ size: 64, seed: 3 });

/* ------------------------------------------------------------------ */
/* the given acceptance tests                                          */
/* ------------------------------------------------------------------ */

test('six seamless layers of the right size', () => {
  assert.deepEqual([...MATERIALS], ['rock', 'scree', 'gravel', 'dust', 'cracked', 'redsoil']);
  assert.equal(tex.albedoHeight.image.depth, 6);
  assert.equal(tex.albedoHeight.image.width, 64);
  assert.equal(tex.metres.length, 6);
  const d = tex.albedoHeight.image.data as Uint8Array,
    n = 64;
  // seamless: the jump across the tile's edge is no bigger than a typical step inside it
  for (let layer = 0; layer < 6; layer++) {
    let edge = 0,
      inner = 0;
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
  const lum = (i: number) => {
    const [r, g, b] = meanAlbedo(tex, i);
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  for (const i of [0, 1, 2, 4, 5]) assert.ok(lum(3) > lum(i), `dust is the lightest (vs ${MATERIALS[i]})`);
  const [kr, kg, kb] = meanAlbedo(tex, 0);
  assert.ok(Math.max(kr, kg, kb) - Math.min(kr, kg, kb) < 0.12, 'rock is near grey');
});

test('stages climb, stage 1 is low resolution', () => {
  const s1 = stageLook(1),
    s6 = stageLook(6);
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

/* ------------------------------------------------------------------ */
/* seamlessness, both axes, both maps                                  */
/* ------------------------------------------------------------------ */

test('tiles wrap in both directions, in every channel', () => {
  const n = tex.size;
  for (const map of [tex.albedoHeight, tex.normalRough]) {
    const d = map.image.data as Uint8Array;
    for (let layer = 0; layer < 6; layer++) {
      const o = layer * n * n * 4;
      for (let c = 0; c < 4; c++) {
        let edgeX = 0,
          innerX = 0,
          edgeY = 0,
          innerY = 0;
        for (let i = 0; i < n; i++) {
          edgeX += Math.abs(d[o + (i * n + n - 1) * 4 + c]! - d[o + (i * n + 0) * 4 + c]!);
          innerX += Math.abs(d[o + (i * n + n / 2) * 4 + c]! - d[o + (i * n + n / 2 - 1) * 4 + c]!);
          edgeY += Math.abs(d[o + ((n - 1) * n + i) * 4 + c]! - d[o + (0 * n + i) * 4 + c]!);
          innerY += Math.abs(d[o + ((n / 2) * n + i) * 4 + c]! - d[o + ((n / 2 - 1) * n + i) * 4 + c]!);
        }
        assert.ok(edgeX <= innerX * 2.5 + n * 6, `layer ${layer} channel ${c}: x edge ${edgeX} vs ${innerX}`);
        assert.ok(edgeY <= innerY * 2.5 + n * 6, `layer ${layer} channel ${c}: y edge ${edgeY} vs ${innerY}`);
      }
    }
  }
});

/* ------------------------------------------------------------------ */
/* determinism                                                         */
/* ------------------------------------------------------------------ */

test('same seed, same bytes; another seed, other bytes', () => {
  const a = makeGroundTextures({ size: 64, seed: 3 });
  const b = makeGroundTextures({ size: 64, seed: 3 });
  const c = makeGroundTextures({ size: 64, seed: 4 });
  const da = a.albedoHeight.image.data as Uint8Array;
  const db = b.albedoHeight.image.data as Uint8Array;
  const dc = c.albedoHeight.image.data as Uint8Array;
  assert.equal(da.length, db.length);
  assert.deepEqual(Array.from(da.subarray(0, 4096)), Array.from(db.subarray(0, 4096)));
  const na = a.normalRough.image.data as Uint8Array;
  const nb = b.normalRough.image.data as Uint8Array;
  assert.deepEqual(Array.from(na.subarray(0, 4096)), Array.from(nb.subarray(0, 4096)));
  let differs = 0;
  for (let i = 0; i < da.length; i++) if (da[i] !== dc[i]) differs++;
  assert.ok(differs > da.length * 0.2, `a different seed must give different ground (${differs})`);
});

test('sizes are checked and honoured', () => {
  assert.throws(() => makeGroundTextures({ size: 100, seed: 1 }), RangeError);
  const t = makeGroundTextures({ size: 128, seed: 1 });
  assert.equal(t.size, 128);
  assert.equal(t.albedoHeight.image.height, 128);
  assert.equal((t.normalRough.image.data as Uint8Array).length, 128 * 128 * 6 * 4);
  for (const m of t.metres) assert.ok(m > 0.5 && m < 20, `tile covers a sane number of metres (${m})`);
});

/* ------------------------------------------------------------------ */
/* channel contents                                                    */
/* ------------------------------------------------------------------ */

test('height and roughness carry real signal, normals are unit-ish and face out', () => {
  const n = tex.size;
  const ah = tex.albedoHeight.image.data as Uint8Array;
  const nr = tex.normalRough.image.data as Uint8Array;
  for (let layer = 0; layer < 6; layer++) {
    const o = layer * n * n * 4;
    let hMin = 255,
      hMax = 0,
      rMin = 255,
      rMax = 0,
      zMin = 255,
      len = 0;
    for (let i = 0; i < n * n; i++) {
      const h = ah[o + i * 4 + 3]!;
      hMin = Math.min(hMin, h);
      hMax = Math.max(hMax, h);
      const r = nr[o + i * 4 + 3]!;
      rMin = Math.min(rMin, r);
      rMax = Math.max(rMax, r);
      const x = (nr[o + i * 4]! / 255) * 2 - 1;
      const y = (nr[o + i * 4 + 1]! / 255) * 2 - 1;
      const z = (nr[o + i * 4 + 2]! / 255) * 2 - 1;
      zMin = Math.min(zMin, nr[o + i * 4 + 2]!);
      len += Math.sqrt(x * x + y * y + z * z);
    }
    assert.ok(hMax - hMin > 60, `layer ${layer} has a height range (${hMin}..${hMax})`);
    assert.ok(rMin > 5 && rMax < 256 && rMax - rMin > 2, `layer ${layer} has roughness (${rMin}..${rMax})`);
    assert.ok(zMin > 127, `layer ${layer} normals point out of the surface`);
    assert.ok(Math.abs(len / (n * n) - 1) < 0.02, `layer ${layer} normals are unit length`);
  }
});

test('dust is the smoothest relief and the roughest surface', () => {
  const n = tex.size;
  const nr = tex.normalRough.image.data as Uint8Array;
  const meanRough = (layer: number) => {
    let s = 0;
    for (let i = 0; i < n * n; i++) s += nr[layer * n * n * 4 + i * 4 + 3]!;
    return s / (n * n) / 255;
  };
  const tilt = (layer: number) => {
    let s = 0;
    for (let i = 0; i < n * n; i++) s += 1 - nr[layer * n * n * 4 + i * 4 + 2]! / 255;
    return s / (n * n);
  };
  assert.ok(meanRough(3) > 0.85, 'powder scatters');
  assert.ok(tilt(3) < tilt(1), 'dust is flatter than scree');
  assert.ok(materialIndex('dust') === 3 && materialIndex('nope') === -1);
});

/* ------------------------------------------------------------------ */
/* the ladder                                                          */
/* ------------------------------------------------------------------ */

test('every stage number climbs, fractional stages sit in between', () => {
  for (let s = 1; s < 6; s++) {
    const a = stageLook(s),
      b = stageLook(s + 1);
    assert.ok(b.texelsPerMetre >= a.texelsPerMetre);
    assert.ok(b.normalStrength >= a.normalStrength);
    assert.ok(b.specular >= a.specular);
  }
  assert.equal(stageLook(1).normalStrength, 0.25);
  assert.equal(stageLook(6).normalStrength, 1);
  assert.equal(stageLook(2).levels, 24);
  assert.equal(stageLook(3).levels, 0);
  assert.ok(stageLook(1).triplanar === false && stageLook(3).triplanar === true);
  const mid = stageLook(3.5);
  assert.ok(mid.texelsPerMetre > stageLook(3).texelsPerMetre && mid.texelsPerMetre < stageLook(4).texelsPerMetre);
  assert.ok(mid.specular > stageLook(3).specular && mid.specular < stageLook(4).specular);
  assert.deepEqual(stageLook(0), stageLook(1), 'stage 0 behaves as 1');
  assert.deepEqual(stageLook(42), stageLook(6), 'above 6 clamps');
  assert.deepEqual(stageLook(Number.NaN), stageLook(1));
});

/* ------------------------------------------------------------------ */
/* the material                                                        */
/* ------------------------------------------------------------------ */

const sun = new THREE.Vector3(0.4, 0.22, -0.8);

test('attributes, chunks and fog are wired up', () => {
  const m = createGroundMaterial(tex, { stage: 4, sunDir: sun });
  assert.match(m.vertexShader, /attribute\s+vec3\s+matA/);
  assert.match(m.vertexShader, /attribute\s+vec3\s+matB/);
  assert.match(m.vertexShader, /attribute\s+float\s+aShade/);
  assert.match(m.vertexShader, /#include <fog_pars_vertex>/);
  assert.match(m.vertexShader, /#include <fog_vertex>/);
  assert.match(m.fragmentShader, /#include <fog_pars_fragment>/);
  assert.match(m.fragmentShader, /#include <fog_fragment>/);
  assert.match(m.fragmentShader, /#include <colorspace_fragment>/);
  assert.equal(m.fog, true);
  assert.equal(m.lights, false);
  assert.ok(m.uniforms['fogColor'] !== undefined && m.uniforms['fogNear'] !== undefined);
  // the textures travel as array textures, never as DOM images
  assert.equal(m.uniforms['uAlbedoHeight']?.value, tex.albedoHeight);
  assert.equal(m.uniforms['uNormalRough']?.value, tex.normalRough);
  assert.ok(tex.albedoHeight instanceof THREE.DataArrayTexture);
  assert.equal(tex.albedoHeight.colorSpace, THREE.SRGBColorSpace);
  assert.equal(tex.normalRough.colorSpace, THREE.NoColorSpace);
  assert.equal(tex.albedoHeight.wrapS, THREE.RepeatWrapping);
  // missing attributes fall back to "plain rock, fully lit"
  const defs = m.defaultAttributeValues as unknown as Record<string, readonly number[]>;
  assert.deepEqual(defs['aShade'], [1]);
  assert.deepEqual(defs['matA'], [1, 0, 0]);
});

test('setStage only moves uniforms, never the program', () => {
  const m = createGroundMaterial(tex, { stage: 1, sunDir: sun });
  const before = {
    vs: m.vertexShader,
    fs: m.fragmentShader,
    defines: JSON.stringify(m.defines ?? {}),
    version: m.version,
  };
  const tpm1 = m.uniforms['uTexelsPerMetre']?.value as number;
  const spec1 = m.uniforms['uSpecular']?.value as number;
  assert.equal(m.uniforms['uLevels']?.value, 12);
  assert.equal(m.uniforms['uDetile']?.value, 0, 'no second sample at stage 1');
  assert.equal(m.uniforms['uTriplanar']?.value, 0, 'planar top-down at stage 1');
  assert.equal(m.uniforms['uNearest']?.value, 1, 'hard texels at stage 1');

  setStage(m, 6);
  assert.equal(m.vertexShader, before.vs);
  assert.equal(m.fragmentShader, before.fs);
  assert.equal(JSON.stringify(m.defines ?? {}), before.defines);
  assert.equal(m.version, before.version, 'no recompile');
  assert.ok((m.uniforms['uTexelsPerMetre']?.value as number) > tpm1);
  assert.ok((m.uniforms['uSpecular']?.value as number) > spec1);
  assert.equal(m.uniforms['uLevels']?.value, 0);
  assert.equal(m.uniforms['uNearest']?.value, 0);
  assert.equal(m.uniforms['uTriplanar']?.value, 1);
  assert.ok((m.uniforms['uDetile']?.value as number) > 0);
  assert.equal(getStage(m), 6);

  setStage(m, 2.5);
  assert.equal(getStage(m), 2.5);
  assert.equal(m.version, before.version);
});

test('the sun and the tile table reach the shader', () => {
  const m = createGroundMaterial(tex, {
    stage: 6,
    sunDir: new THREE.Vector3(0, 10, 0),
    sunColour: new THREE.Color(1, 0.8, 0.6),
    skyColour: new THREE.Color(0.2, 0.3, 0.4),
    groundColour: new THREE.Color(0.1, 0.05, 0.02),
  });
  const dir = m.uniforms['uSunDir']?.value as THREE.Vector3;
  assert.ok(Math.abs(dir.length() - 1) < 1e-6, 'sun direction is normalised');
  const metres = m.uniforms['uMetres']?.value as Float32Array;
  assert.equal(metres.length, 6);
  for (let i = 0; i < 6; i++) assert.equal(metres[i], tex.metres[i]);
  assert.equal(m.uniforms['uTileSize']?.value, tex.size);
  const sky = m.uniforms['uSkyColour']?.value as THREE.Color;
  assert.ok(Math.abs(sky.b - 0.4) < 1e-6);
});

test('the fragment shader stays inside its texture budget', () => {
  const m = createGroundMaterial(tex, { stage: 6, sunDir: sun });
  const count = (re: RegExp) => m.fragmentShader.match(re)?.length ?? 0;
  const fetchesPerPlane = count(/textureGrad\s*\(/g); // albedo+height and normal+roughness
  const planesPerMaterial = count(/gFetch\s*\(/g) - 1; // minus the definition
  const materialsPerPixel = count(/gSampleMaterial\s*\(/g) - 1; // top two weights only
  assert.equal(fetchesPerPlane, 2);
  assert.ok(materialsPerPixel <= 2, 'at most two materials are read per pixel');
  assert.ok(fetchesPerPlane * planesPerMaterial * materialsPerPixel <= 12, 'stage 6 budget');
  // weak weights are dropped, and the side plane is only read on slopes
  assert.match(m.fragmentShader, /w\[ i \] > w1/);
  assert.match(m.fragmentShader, /wSide > 0\.02/);
  // no DOM, no randomness in the shader either
  assert.ok(!/texture2D\s*\(/.test(m.fragmentShader));
});

/* ------------------------------------------------------------------ */
/* budgets                                                             */
/* ------------------------------------------------------------------ */

test('tiles build inside the time budget', () => {
  const t0 = performance.now();
  makeGroundTextures({ size: 256, seed: 11 });
  const big = performance.now() - t0;
  const t1 = performance.now();
  makeGroundTextures({ size: 64, seed: 12 });
  const small = performance.now() - t1;
  assert.ok(big < 400, `256 px took ${big.toFixed(1)} ms`);
  assert.ok(small < 40, `64 px took ${small.toFixed(1)} ms`);
});
