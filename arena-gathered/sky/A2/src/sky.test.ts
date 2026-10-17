import test from "node:test";
import assert from "node:assert/strict";

import {
  SKY_ROWS,
  bakeSkyLut,
  density,
  skyAt,
  skyGradient,
  skyUniforms,
  sunColour,
  type Vec3,
} from "./sky.ts";

const radians = (degrees: number): number => degrees * Math.PI / 180;

function direction(elevation: number, azimuth = 0): Vec3 {
  const e = radians(elevation);
  const a = radians(azimuth);
  return [Math.cos(e) * Math.sin(a), Math.sin(e), Math.cos(e) * Math.cos(a)];
}

function luminance(colour: readonly number[]): number {
  return 0.2126 * (colour[0] ?? 0) + 0.7152 * (colour[1] ?? 0) + 0.0722 * (colour[2] ?? 0);
}

test("density is the specified smoothstep", () => {
  assert.equal(density(-20), 0);
  assert.equal(density(2), 0);
  assert.equal(density(4.5), 1);
  assert.equal(density(20), 1);
  assert.ok(Math.abs(density(3.25) - 0.5) < 1e-12);
});

test("an airless stage has a black sky and gradient", () => {
  assert.deepEqual(skyAt([0, 1, 0], direction(60), 2), [0, 0, 0]);
  const gradient = new Float32Array(SKY_ROWS * 3);
  skyGradient(direction(60), 1.5, gradient);
  assert.ok(gradient.every((value) => value < 1e-6));
});

test("full atmosphere has a blue zenith and paler horizon", () => {
  const sun = direction(60);
  const zenith = skyAt([0, 1, 0], sun, 6);
  const horizon = skyAt(direction(0, 90), sun, 6);
  assert.ok(zenith[2] > zenith[1] && zenith[1] > zenith[0]);
  assert.ok(horizon[2] / horizon[0] < zenith[2] / zenith[0]);
});

test("a low sun warms both its nearby sky and disc", () => {
  const sun = direction(3);
  const nearSun = skyAt(direction(2), sun, 6);
  const disc = sunColour(sun, 6);
  assert.ok(nearSun[0] > nearSun[2]);
  assert.ok(disc[0] >= disc[1] && disc[1] >= disc[2]);
  assert.ok(disc[2] < 0.6);
});

test("a high sun disc remains nearly white", () => {
  assert.ok(sunColour(direction(60), 6)[2] > 0.8);
});

test("zenith luminance does not fall as atmosphere develops", () => {
  const sun = direction(60);
  let previous = -1;
  for (let stage = 2; stage <= 4.5001; stage += 0.05) {
    const current = luminance(skyAt([0, 1, 0], sun, stage));
    assert.ok(current + 1e-10 >= previous, `luminance fell at stage ${stage}`);
    previous = current;
  }
});

test("the sky is brighter toward the sun", () => {
  const sun = direction(20);
  const toward = luminance(skyAt(direction(20, 0), sun, 6));
  const away = luminance(skyAt(direction(20, 180), sun, 6));
  assert.ok(toward > away);
});

test("a sun ten degrees below the horizon leaves finite twilight", () => {
  const twilight = skyAt([0, 1, 0], direction(-10), 6);
  assert.ok(luminance(twilight) > 0);
  assert.ok(luminance(twilight) < 0.05);
});

test("every gradient row remains dim with the sun ten degrees below the horizon", () => {
  const gradient = new Float32Array(SKY_ROWS * 3);
  skyGradient(direction(-10), 6, gradient);
  for (let row = 0; row < SKY_ROWS; row += 1) {
    const offset = row * 3;
    const colour = [gradient[offset] ?? 0, gradient[offset + 1] ?? 0, gradient[offset + 2] ?? 0];
    assert.ok(luminance(colour) < 0.05, `row ${row} was not dim`);
  }
});

test("skyUniforms returns the documented finite shader colours", () => {
  const sun = direction(25, 70);
  const uniforms = skyUniforms(sun, 6);
  const gradient = new Float32Array(SKY_ROWS * 3);
  skyGradient(sun, 6, gradient);

  assert.deepEqual(uniforms.zenith, [gradient[0], gradient[1], gradient[2]]);
  const last = (SKY_ROWS - 1) * 3;
  assert.deepEqual(uniforms.horizon, [gradient[last], gradient[last + 1], gradient[last + 2]]);
  assert.deepEqual(uniforms.sunColour, sunColour(sun, 6));
  for (const colour of Object.values(uniforms)) {
    for (const value of colour) assert.ok(Number.isFinite(value) && value >= 0 && value <= 10);
  }
});

test("skyUniforms scattering colours are black at zero density", () => {
  const uniforms = skyUniforms([0, 0, 0], 2);
  assert.deepEqual(uniforms.zenith, [0, 0, 0]);
  assert.deepEqual(uniforms.horizon, [0, 0, 0]);
  assert.deepEqual(uniforms.sunGlow, [0, 0, 0]);
  assert.deepEqual(uniforms.sunColour, [1, 1, 1]);
});

test("all public computations stay finite and bounded for degenerate input", () => {
  const inputs: Vec3[] = [[0, 0, 0], [0, 1, 0], [0, -1, 0], [Infinity, NaN, -Infinity]];
  for (const view of inputs) {
    for (const sun of inputs) {
      for (const value of skyAt(view, sun, 6)) assert.ok(Number.isFinite(value) && value >= 0 && value <= 10);
      for (const value of sunColour(sun, 6)) assert.ok(Number.isFinite(value) && value >= 0 && value <= 10);
    }
  }
});

test("identical calls return identical floats", () => {
  const first = new Float32Array(32 * 16 * 3);
  const second = new Float32Array(first.length);
  bakeSkyLut(direction(17, 42), 3.7, 32, 16, first);
  bakeSkyLut(direction(17, 42), 3.7, 32, 16, second);
  assert.deepEqual(first, second);
});

test("gradient rows and LUT axes obey their documented mapping", () => {
  const sun = direction(35, 25);
  const gradient = new Float32Array(SKY_ROWS * 3);
  skyGradient(sun, 6, gradient);
  const zenith = skyAt([0, 1, 0], sun, 6);
  assert.ok(Math.abs((gradient[0] ?? 0) - zenith[0]) < 1e-5);

  const lut = new Float32Array(8 * 4 * 3);
  bakeSkyLut(sun, 6, 8, 4, lut);
  assert.ok(lut.every(Number.isFinite));
});

test("gradient and small LUT meet the performance budget", () => {
  const sun = direction(60);
  const gradient = new Float32Array(SKY_ROWS * 3);
  const lut = new Float32Array(32 * 16 * 3);

  skyGradient(sun, 6, gradient);
  bakeSkyLut(sun, 6, 32, 16, lut);

  const gradientStart = performance.now();
  skyGradient(sun, 6, gradient);
  const gradientMs = performance.now() - gradientStart;
  const lutStart = performance.now();
  bakeSkyLut(sun, 6, 32, 16, lut);
  const lutMs = performance.now() - lutStart;

  assert.ok(gradientMs < 3, `gradient took ${gradientMs.toFixed(2)} ms`);
  assert.ok(lutMs < 15, `LUT took ${lutMs.toFixed(2)} ms`);
});