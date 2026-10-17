import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  SKY_ROWS,
  density,
  skyAt,
  skyGradient,
  sunColour,
  bakeSkyLut,
  skyUniforms,
  type Vec3,
} from "./sky";

const DEG = Math.PI / 180;

// Helper to make a direction from elevation (degrees, + up) and azimuth (degrees).
function dirElAz(elDeg: number, azDeg: number): Vec3 {
  const el = elDeg * DEG;
  const az = azDeg * DEG;
  const cE = Math.cos(el);
  const sE = Math.sin(el);
  const cA = Math.cos(az);
  const sA = Math.sin(az);
  return [cE * cA, sE, cE * sA];
}

function luminance(rgb: [number, number, number]): number {
  return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
}

describe("density", () => {
  it("returns 0 for stage <= 2", () => {
    assert.equal(density(0), 0);
    assert.equal(density(1), 0);
    assert.equal(density(2), 0);
  });
  it("returns 1 for stage >= 4.5", () => {
    assert.equal(density(4.5), 1);
    assert.equal(density(6), 1);
    assert.equal(density(10), 1);
  });
  it("is smooth between 2 and 4.5", () => {
    const a = density(2);
    const b = density(3);
    const c = density(4);
    const d = density(4.5);
    assert.ok(a < b && b < c && c < d);
  });
});

// Invariant 1: density=0 => skyAt=0 everywhere and skyGradient all below 1e-6.
describe("Invariant 1: density=0", () => {
  it("skyAt returns all zero for stage 0, 1, 2", () => {
    const sun = dirElAz(45, 0);
    for (const stage of [0, 1, 2]) {
      for (let el = 0; el <= 90; el += 10) {
        for (let az = 0; az < 360; az += 45) {
          const v = dirElAz(el, az);
          const rgb = skyAt(v, sun, stage);
          assert.ok(
            rgb[0] === 0 && rgb[1] === 0 && rgb[2] === 0,
            `stage=${stage} el=${el} az=${az} got ${rgb}`
          );
        }
      }
    }
  });
  it("skyGradient is all zero for stage <= 2", () => {
    const sun = dirElAz(45, 0);
    const out = new Float32Array(SKY_ROWS * 3);
    for (const stage of [0, 1, 2]) {
      skyGradient(sun, stage, out);
      let maxV = 0;
      for (let i = 0; i < out.length; i++) {
        const v = out[i]!;
        if (v > maxV) maxV = v;
        assert.ok(isFinite(v));
      }
      assert.ok(
        maxV < 1e-6,
        `stage=${stage} max gradient value ${maxV} should be < 1e-6`
      );
    }
  });
});

// Invariant 2: stage 6, sun elevation 60deg: zenith B>G>R,
// horizon B/R lower than zenith B/R (paler near horizon).
describe("Invariant 2: sun at 60, zenith blue, horizon paler", () => {
  const stage = 6;
  const sun = dirElAz(60, 0);
  it("zenith has B > G > R", () => {
    const zenith: Vec3 = [0, 1, 0];
    const [r, g, b] = skyAt(zenith, sun, stage);
    assert.ok(b > g && g > r, `zenith RGB ${r}, ${g}, ${b} expected B>G>R`);
  });
  it("horizon B/R ratio lower than zenith B/R", () => {
    const zenith: Vec3 = [0, 1, 0];
    const [zr, , zb] = skyAt(zenith, sun, stage);
    const zenithBR = zb / Math.max(zr, 1e-6);

    // Sample horizon at multiple azimuths, average.
    let sumR = 0, sumB = 0;
    for (let az = 0; az < 360; az += 10) {
      const v = dirElAz(0, az);
      const [r, , b] = skyAt(v, sun, stage);
      sumR += r;
      sumB += b;
    }
    const n = 36;
    const horizonBR = (sumB / n) / Math.max(sumR / n, 1e-6);
    assert.ok(
      horizonBR < zenithBR,
      `zenith B/R=${zenithBR} horizon B/R=${horizonBR} expected horizon paler`
    );
  });
});

// Invariant 3: stage 6, sun at 3deg elevation, skyAt towards sun at 2deg el has R>B; sunColour R>=G>=B, B<0.6.
describe("Invariant 3: low sun warm sky", () => {
  const stage = 6;
  const sun = dirElAz(3, 0);
  it("sky at 2deg el, 0az (toward sun) has R > B", () => {
    const v = dirElAz(2, 0);
    const [r, , b] = skyAt(v, sun, stage);
    assert.ok(r > b, `R=${r} B=${b} expected R>B`);
  });
  it("sunColour has R>=G>=B and B < 0.6", () => {
    const [r, g, b] = sunColour(sun, stage);
    assert.ok(r >= g - 1e-9 && g >= b - 1e-9, `R=${r} G=${g} B=${b} expected R>=G>=B`);
    assert.ok(b < 0.6, `B=${b} expected < 0.6`);
  });
});

// Invariant 4: stage 6, sun at 60 degrees, sunColour B > 0.8.
describe("Invariant 4: high sun white-ish", () => {
  it("sunColour B > 0.8 when sun at 60deg", () => {
    const sun = dirElAz(60, 0);
    const [, , b] = sunColour(sun, 6);
    assert.ok(b > 0.8, `B=${b} expected > 0.8`);
  });
});

// Invariant 5: zenith luminance never decreases from stage 2 to 4.5.
describe("Invariant 5: monotonic with stage", () => {
  it("zenith luminance is non-decreasing from stage 2 to 4.5", () => {
    const sun = dirElAz(45, 0);
    const zenith: Vec3 = [0, 1, 0];
    let prev = -1;
    for (let s = 2; s <= 4.5 + 1e-9; s += 0.25) {
      const rgb = skyAt(zenith, sun, s);
      const lum = luminance(rgb);
      assert.ok(
        lum >= prev - 1e-9,
        `luminance decreased at stage ${s}: prev=${prev} cur=${lum}`
      );
      prev = lum;
    }
  });
});

// Invariant 6: at fixed elevation 20deg, azimuth 0 (toward sun) brighter than azimuth 180.
describe("Invariant 6: brighter toward sun", () => {
  it("az 0 is brighter than az 180 at el 20", () => {
    const sun = dirElAz(20, 0);
    const v0 = dirElAz(20, 0);
    const v180 = dirElAz(20, 180);
    const l0 = luminance(skyAt(v0, sun, 6));
    const l180 = luminance(skyAt(v180, sun, 6));
    assert.ok(l0 > l180, `toward sun lum=${l0} away lum=${l180}`);
  });
});

// Invariant 7: sun at -10deg gives dim but finite sky, all skyGradient rows <0.05.
describe("Invariant 7: sun below horizon (-10) is dim but finite", () => {
  it("zenith luminance is finite, positive, and < 0.05", () => {
    const sun = dirElAz(-10, 0);
    const zenith: Vec3 = [0, 1, 0];
    const rgb = skyAt(zenith, sun, 6);
    const lum = luminance(rgb);
    assert.ok(
      isFinite(lum) && lum > 0 && lum < 0.05,
      `lum=${lum} expected 0 < lum < 0.05`
    );
  });
  it("other elevations are finite and non-negative", () => {
    const sun = dirElAz(-10, 0);
    for (let el = 15; el <= 85; el += 10) {
      const v = dirElAz(el, 45);
      const rgb = skyAt(v, sun, 6);
      for (const c of rgb) {
        assert.ok(isFinite(c) && c >= 0);
      }
    }
  });
  it("every skyGradient row has luminance < 0.05", () => {
    const sun = dirElAz(-10, 0);
    const out = new Float32Array(SKY_ROWS * 3);
    skyGradient(sun, 6, out);
    for (let i = 0; i < SKY_ROWS; i++) {
      const r = out[i * 3]!;
      const g = out[i * 3 + 1]!;
      const b = out[i * 3 + 2]!;
      const lum = luminance([r, g, b]);
      assert.ok(
        lum < 0.05,
        `row ${i} (el=${(90 * (1 - i / (SKY_ROWS - 1))).toFixed(1)}°) lum=${lum} expected < 0.05`
      );
    }
  });
});

// Invariant 8: no NaN/Infinity, all values in [0,10], for any input including zero vectors.
describe("Invariant 8: robust to all inputs", () => {
  const inputs: Array<{ name: string; dir: Vec3; sun: Vec3; stage: number }> = [
    { name: "zero dir", dir: [0, 0, 0], sun: dirElAz(45, 0), stage: 6 },
    { name: "zero sun", dir: dirElAz(45, 0), sun: [0, 0, 0], stage: 6 },
    { name: "both zero", dir: [0, 0, 0], sun: [0, 0, 0], stage: 6 },
    { name: "sun straight up", dir: dirElAz(45, 45), sun: [0, 1, 0], stage: 6 },
    { name: "sun straight down", dir: dirElAz(45, 45), sun: [0, -1, 0], stage: 6 },
    { name: "view straight down", dir: [0, -1, 0], sun: dirElAz(45, 0), stage: 6 },
    { name: "unnormalised large", dir: [1000, 2000, 3000], sun: [-5, 2, 1], stage: 6 },
    { name: "unnormalised tiny", dir: [1e-9, 2e-9, 3e-9], sun: [4e-9, -1e-9, 2e-9], stage: 6 },
    { name: "stage 0", dir: dirElAz(45, 0), sun: dirElAz(45, 0), stage: 0 },
    { name: "stage 4.5", dir: dirElAz(45, 0), sun: dirElAz(45, 0), stage: 4.5 },
    { name: "stage 10", dir: dirElAz(45, 0), sun: dirElAz(45, 0), stage: 10 },
    { name: "negative stage", dir: dirElAz(45, 0), sun: dirElAz(45, 0), stage: -3 },
    { name: "sun at horizon", dir: dirElAz(45, 0), sun: dirElAz(0, 0), stage: 6 },
    { name: "view at horizon", dir: dirElAz(0, 0), sun: dirElAz(45, 0), stage: 6 },
  ];
  for (const { name, dir, sun, stage } of inputs) {
    it(`skyAt doesn't blow up for ${name}`, () => {
      const rgb = skyAt(dir, sun, stage);
      for (const c of rgb) {
        assert.ok(Number.isFinite(c), `non-finite: ${c}`);
        assert.ok(c >= 0 && c <= 10, `out of range: ${c}`);
      }
    });
    it(`sunColour doesn't blow up for ${name}`, () => {
      const rgb = sunColour(sun, stage);
      for (const c of rgb) {
        assert.ok(Number.isFinite(c), `non-finite: ${c}`);
        assert.ok(c >= 0 && c <= 1, `out of range: ${c}`);
      }
    });
  }
});

// Invariant 9: determinism.
describe("Invariant 9: deterministic", () => {
  it("identical calls give identical floats", () => {
    const dir = dirElAz(30, 60);
    const sun = dirElAz(45, 20);
    const a = skyAt(dir, sun, 6);
    const b = skyAt(dir, sun, 6);
    assert.deepEqual(a, b);
    const sa = sunColour(sun, 6);
    const sb = sunColour(sun, 6);
    assert.deepEqual(sa, sb);
  });
});

// Invariant 10 is about speed; we don't measure here, but ensure functions exist and run quickly.
describe("skyGradient and bakeSkyLut run", () => {
  it("skyGradient fills correct length", () => {
    const sun = dirElAz(45, 0);
    const out = new Float32Array(SKY_ROWS * 3);
    skyGradient(sun, 6, out);
    assert.equal(out.length, SKY_ROWS * 3);
    for (let i = 0; i < out.length; i++) {
      const v = out[i]!;
      assert.ok(Number.isFinite(v));
      assert.ok(v >= 0 && v <= 10);
    }
  });
  it("bakeSkyLut(32,16) produces valid output", () => {
    const sun = dirElAz(45, 0);
    const w = 32, h = 16;
    const out = new Float32Array(w * h * 3);
    bakeSkyLut(sun, 6, w, h, out);
    for (let i = 0; i < out.length; i++) {
      const v = out[i]!;
      assert.ok(Number.isFinite(v));
      assert.ok(v >= 0 && v <= 10);
    }
  });
});

describe("skyUniforms", () => {
  it("returns zero zenith/horizon/sunGlow and white sunColour at density 0", () => {
    const sun = dirElAz(45, 0);
    for (const stage of [0, 1, 2]) {
      const u = skyUniforms(sun, stage);
      assert.deepEqual(u.zenith, [0, 0, 0]);
      assert.deepEqual(u.horizon, [0, 0, 0]);
      assert.deepEqual(u.sunGlow, [0, 0, 0]);
      assert.deepEqual(u.sunColour, [1, 1, 1]);
    }
  });

  it("zenith matches skyAt at straight-up, horizon matches last gradient row", () => {
    const sun = dirElAz(60, 30);
    const stage = 6;
    const u = skyUniforms(sun, stage);

    const zAt = skyAt([0, 1, 0], sun, stage);
    const tol = 1e-6;
    assert.ok(Math.abs(u.zenith[0] - zAt[0]) < tol);
    assert.ok(Math.abs(u.zenith[1] - zAt[1]) < tol);
    assert.ok(Math.abs(u.zenith[2] - zAt[2]) < tol);

    const grad = new Float32Array(SKY_ROWS * 3);
    skyGradient(sun, stage, grad);
    const hBase = (SKY_ROWS - 1) * 3;
    assert.ok(Math.abs(u.horizon[0] - (grad[hBase] ?? 0)) < tol);
    assert.ok(Math.abs(u.horizon[1] - (grad[hBase + 1] ?? 0)) < tol);
    assert.ok(Math.abs(u.horizon[2] - (grad[hBase + 2] ?? 0)) < tol);
  });

  it("sunGlow matches skyAt at 5° elevation toward the sun", () => {
    const sun = dirElAz(40, 75);
    const u = skyUniforms(sun, 6);
    // Normalise the sun direction exactly as skyUniforms does internally.
    const s0 = sun[0], s1 = sun[1], s2 = sun[2];
    const sLen2 = s0 * s0 + s1 * s1 + s2 * s2;
    let sx: number, sz: number;
    if (sLen2 <= 1e-20) {
      sx = 0; sz = 0;
    } else {
      const inv = 1 / Math.sqrt(sLen2);
      sx = s0 * inv; sz = s2 * inv;
    }
    const hLen2 = sx * sx + sz * sz;
    let hx: number, hz: number;
    if (hLen2 <= 1e-20) {
      hx = 1;
      hz = 0;
    } else {
      const inv = 1 / Math.sqrt(hLen2);
      hx = sx * inv;
      hz = sz * inv;
    }
    const cos5 = Math.cos(5 * DEG);
    const sin5 = Math.sin(5 * DEG);
    const glow: Vec3 = [hx * cos5, sin5, hz * cos5];
    const expected = skyAt(glow, sun, 6);
    const tol = 1e-9;
    assert.ok(Math.abs(u.sunGlow[0] - expected[0]) < tol);
    assert.ok(Math.abs(u.sunGlow[1] - expected[1]) < tol);
    assert.ok(Math.abs(u.sunGlow[2] - expected[2]) < tol);
  });

  it("sunColour matches standalone sunColour()", () => {
    for (const el of [3, 20, 60, 90]) {
      for (const az of [0, 45, 180]) {
        const sun = dirElAz(el, az);
        const u = skyUniforms(sun, 6);
        const ref = sunColour(sun, 6);
        assert.deepEqual(u.sunColour, ref, `el=${el} az=${az}`);
      }
    }
  });

  it("all channels are finite and in [0,10] for typical inputs", () => {
    for (const { el, az, stage } of [
      { el: 60, az: 0, stage: 6 },
      { el: 3, az: 20, stage: 6 },
      { el: -10, az: 0, stage: 6 },
      { el: 90, az: 0, stage: 6 },
      { el: 0, az: 0, stage: 3 },
    ]) {
      const sun = dirElAz(el, az);
      const u = skyUniforms(sun, stage);
      for (const key of ["zenith", "horizon", "sunGlow", "sunColour"] as const) {
        const [r, g, b] = u[key];
        for (const c of [r, g, b]) {
          assert.ok(Number.isFinite(c), `${key} has non-finite value`);
          assert.ok(c >= 0 && c <= 10, `${key} out of range: ${c}`);
        }
      }
    }
  });

  it("handles zero/degenerate sun directions gracefully", () => {
    const u = skyUniforms([0, 0, 0], 6);
    for (const key of ["zenith", "horizon", "sunGlow"] as const) {
      assert.deepEqual(u[key], [0, 0, 0]);
    }
    assert.ok(Number.isFinite(u.sunColour[0]));
  });
});
