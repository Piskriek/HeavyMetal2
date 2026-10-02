// @ts-nocheck (agent-generated: strict cleanup pending; behaviour is covered by the tests)
// pbrgrass.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  GRASS_VARS,
  defaults,
  normalizeParams,
  validateParams,
  PRESETS,
  renderGrass,
  macroMap,
  GRASS_GLSL,
  repetitionScore,
  seamScore,
  computeNormals,
} from '../src';
import type { Params } from '../src';

function heightToU8(h: Float32Array): Uint8ClampedArray {
  const out = new Uint8ClampedArray(h.length);
  for (let i = 0; i < h.length; i++) {
    out[i] = Math.round(Math.max(0, Math.min(1, h[i]!)) * 255);
  }
  return out;
}

function pearson(xs: number[], ys: number[]): number {
  const n = xs.length;
  let sx = 0, sy = 0;
  for (let i = 0; i < n; i++) { sx += xs[i]!; sy += ys[i]!; }
  const mx = sx / n, my = sy / n;
  let num = 0, dx2 = 0, dy2 = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i]! - mx, dy = ys[i]! - my;
    num += dx * dy; dx2 += dx * dx; dy2 += dy * dy;
  }
  const den = Math.sqrt(dx2 * dy2);
  return den < 1e-9 ? 0 : num / den;
}

function meanColor(albedo: Uint8ClampedArray): [number, number, number] {
  let r = 0, g = 0, b = 0;
  const px = albedo.length / 4;
  for (let i = 0; i < albedo.length; i += 4) {
    r += albedo[i]!; g += albedo[i + 1]!; b += albedo[i + 2]!;
  }
  return [r / px, g / px, b / px];
}

function arraysEqual(a: ArrayLike<number>, b: ArrayLike<number>): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

test('GRASS_VARS structure has required groups and keys', () => {
  assert.ok(GRASS_VARS.length >= 28);
  const groups = new Set(GRASS_VARS.map((v) => v.group));
  for (const g of ['Blades', 'Clumps', 'Colour', 'Soil', 'Wear', 'Relief', 'Macro', 'Detail']) {
    assert.ok(groups.has(g), `missing group ${g}`);
  }
  const keys = new Set(GRASS_VARS.map((v) => v.key));
  const required = [
    'bladeDensity', 'bladeLength', 'bladeWidth', 'bladeTaper', 'bladeBend', 'bendRandom',
    'windDirection', 'windStrength', 'clumpScale', 'clumpTightness', 'clumpGaps', 'soilAmount',
    'soilColour', 'soilMoisture', 'tipColour', 'baseColour', 'midColour', 'colourVariation',
    'deadFraction', 'deadColour', 'cloverAmount', 'cloverColour', 'flowerAmount', 'flowerColour',
    'reliefStrength', 'aoStrength', 'roughnessBase', 'roughnessWet', 'macroScale', 'macroStrength',
    'macroHue', 'detailScale', 'detailStrength',
  ];
  for (const k of required) assert.ok(keys.has(k), `missing var ${k}`);
});

test('all PRESETS validate', () => {
  for (const pr of PRESETS) {
    const res = validateParams(pr.params);
    assert.equal(res.ok, true, `${pr.id}: ${res.errors.join(', ')}`);
  }
  assert.equal(PRESETS.length, 10);
});

test('normalizeParams clamps junk and never throws', () => {
  assert.doesNotThrow(() => normalizeParams(null));
  assert.doesNotThrow(() => normalizeParams(undefined));
  assert.doesNotThrow(() => normalizeParams(42));
  assert.doesNotThrow(() => normalizeParams('garbage'));
  const bad: unknown = {
    bladeDensity: 999,
    bladeWidth: 'nope',
    soilColour: 'notacolor',
    windDirection: -500,
    unknownField: 'ignored',
  };
  const norm = normalizeParams(bad) as Params;
  const densityVar = GRASS_VARS.find((v) => v.key === 'bladeDensity')!;
  assert.ok((norm.bladeDensity as number) <= (densityVar.max as number));
  assert.ok((norm.bladeDensity as number) >= (densityVar.min as number));
  assert.equal(typeof norm.soilColour, 'string');
  assert.match(norm.soilColour as string, /^#[0-9a-fA-F]{6}$/);
  const dirVar = GRASS_VARS.find((v) => v.key === 'windDirection')!;
  assert.ok((norm.windDirection as number) >= (dirVar.min as number));
  const res = validateParams(norm);
  assert.equal(res.ok, true);
});

test('determinism: same seed identical, different seed differs', () => {
  const p = defaults();
  const a = renderGrass(p, 64, 42);
  const b = renderGrass(p, 64, 42);
  assert.ok(arraysEqual(a.albedo, b.albedo));
  assert.ok(arraysEqual(a.normal, b.normal));
  assert.ok(arraysEqual(a.height, b.height));

  const c = renderGrass(p, 64, 43);
  let diff = false;
  for (let i = 0; i < a.albedo.length; i++) {
    if (a.albedo[i] !== c.albedo[i]) { diff = true; break; }
  }
  assert.ok(diff);
});

test('renderGrass works at size 64 and 128', () => {
  for (const s of [64, 128]) {
    const r = renderGrass(defaults(), s, 7);
    assert.equal(r.size, s);
    assert.equal(r.albedo.length, s * s * 4);
    assert.equal(r.normal.length, s * s * 4);
    assert.equal(r.roughness.length, s * s);
    assert.equal(r.ao.length, s * s);
    assert.equal(r.height.length, s * s);
    for (let i = 0; i < r.height.length; i++) {
      const h = r.height[i]!;
      assert.ok(Number.isFinite(h) && h >= 0 && h <= 1);
    }
  }
});

test('macroMap is periodic and stays in range', () => {
  const size = 64;
  const m = macroMap(defaults(), size, 5);
  assert.equal(m.length, size * size);
  for (let i = 0; i < m.length; i++) {
    const v = m[i]!;
    assert.ok(v >= 0 && v <= 1);
  }
  const u8 = heightToU8(m);
  const s = seamScore(u8, size);
  assert.ok(s < 1.6, `macro seam score ${s}`);
  const rep = repetitionScore(m, size);
  assert.ok(rep >= 0 && rep <= 1);
});

test('GRASS_GLSL exposes sampleGrass and grassMacro', () => {
  assert.ok(GRASS_GLSL.includes('sampleGrass'));
  assert.ok(GRASS_GLSL.includes('grassMacro'));
});

test('per-preset quality: seams, normals, correlation, roughness, ao', () => {
  const size = 128;
  const seed = 123;
  for (const pr of PRESETS) {
    const r = renderGrass(pr.params, size, seed);

    assert.ok(seamScore(r.albedo, size) < 1.35, `${pr.id} albedo seam`);
    assert.ok(seamScore(r.normal, size) < 1.35, `${pr.id} normal seam`);
    assert.ok(seamScore(heightToU8(r.height), size) < 1.35, `${pr.id} height seam`);

    const reliefStrength = pr.params.reliefStrength as number;
    const strength = 8 + reliefStrength * 34;
    const recomputed = computeNormals(r.height, size, strength);
    let err = 0;
    for (let i = 0; i < recomputed.length; i++) err += Math.abs(recomputed[i]! - r.normal[i]!);
    err /= recomputed.length;
    assert.ok(err < 1, `${pr.id} normal consistency error ${err}`);

    const n2 = size * size;
    const heights: number[] = new Array(n2);
    const lums: number[] = new Array(n2);
    for (let i = 0; i < n2; i++) {
      heights[i] = r.height[i]!;
      const o = i * 4;
      lums[i] = (0.299 * r.albedo[o]! + 0.587 * r.albedo[o + 1]! + 0.114 * r.albedo[o + 2]!) / 255;
    }
    const corr = pearson(heights, lums);
    assert.ok(corr > 0.3, `${pr.id} luminance/height correlation ${corr}`);

    for (let i = 0; i < r.roughness.length; i++) {
      const rv = r.roughness[i]! / 255;
      assert.ok(rv >= 0.2 - 1e-6 && rv <= 1.0 + 1e-6, `${pr.id} roughness out of range`);
    }

    let aoSum = 0;
    for (let i = 0; i < r.ao.length; i++) aoSum += r.ao[i]!;
    const aoMean = aoSum / r.ao.length / 255;
    assert.ok(aoMean >= 0.25 && aoMean <= 0.95, `${pr.id} ao mean ${aoMean}`);
  }
});

test('presets are visibly different from each other', () => {
  const size = 96;
  const seed = 321;
  const means: [number, number, number][] = [];
  for (const pr of PRESETS) {
    const r = renderGrass(pr.params, size, seed);
    means.push(meanColor(r.albedo));
  }
  let minDist = Infinity;
  for (let i = 0; i < means.length; i++) {
    for (let j = i + 1; j < means.length; j++) {
      const mi = means[i]!, mj = means[j]!;
      const dr = mi[0] - mj[0], dg = mi[1] - mj[1], db = mi[2] - mj[2];
      const dist = Math.sqrt(dr * dr + dg * dg + db * db);
      if (dist < minDist) minDist = dist;
      assert.ok(dist > 5, `${PRESETS[i]!.id} vs ${PRESETS[j]!.id} too similar (${dist})`);
    }
  }
  assert.ok(minDist > 5);
});