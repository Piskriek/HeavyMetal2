import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PROCEDURAL_RECIPES,
  PROCEDURAL_RECIPE_MAP,
  SYNTH_APPLY_CHORD,
  SYNTH_SCULPT_CHORD,
  SYNTH_SEAL_CHORD,
  SYNTH_CARTRIDGE_SNAP,
  SYNTH_CARTRIDGE_PING,
  SYNTH_SKIN_DEGAUSS,
  SYNTH_GATE_CHARGE,
} from '../src/index';

test('procedural gap recipes: 7 designed recipes with Argo 3-layer transient/body/tail architecture', () => {
  assert.equal(PROCEDURAL_RECIPES.length, 7);
  for (const r of PROCEDURAL_RECIPES) {
    assert.ok(r.id.startsWith('synth-'), r.id);
    assert.ok(r.layers.length >= 2, `${r.id} layers`);
    assert.ok(r.durationMs > 0, `${r.id} duration`);
    assert.equal(PROCEDURAL_RECIPE_MAP[r.id], r);
  }
});

test('POL-42 skin degauss tick is exactly 40 ms duration on combatUi', () => {
  assert.equal(SYNTH_SKIN_DEGAUSS.durationMs, 40);
  assert.equal(SYNTH_SKIN_DEGAUSS.category, 'ui');
  // Layers total under 40ms
  for (const l of SYNTH_SKIN_DEGAUSS.layers) {
    const total = (l.delayMs ?? 0) + l.attackMs + l.decayMs;
    assert.ok(total <= 40, `layer total ${total}ms`);
  }
});

test('the three mode chords have their musical structures', () => {
  // Apply: C4 and E4 major third
  const applySine = SYNTH_APPLY_CHORD.layers.find((l) => l.wave === 'sine');
  const applyTri = SYNTH_APPLY_CHORD.layers.find((l) => l.wave === 'triangle');
  assert.ok(applySine && Math.abs(applySine.freq[0] - 261.63) < 0.1);
  assert.ok(applyTri && Math.abs(applyTri.freq[0] - 329.63) < 0.1);

  // Sculpt: 180 Hz -> 85 Hz sweep
  const sculptSaw = SYNTH_SCULPT_CHORD.layers.find((l) => l.wave === 'sawtooth');
  assert.ok(sculptSaw);
  assert.equal(sculptSaw.freq[0], 180);
  assert.equal(sculptSaw.freq[1], 85);

  // Seal: ~1760 Hz high phase-locked tone
  const sealSine = SYNTH_SEAL_CHORD.layers.find((l) => l.wave === 'sine');
  assert.ok(sealSine);
  assert.equal(sealSine.freq[0], 1760);
});

test('cartridge snap and ping fill the socket verbs', () => {
  assert.ok(SYNTH_CARTRIDGE_SNAP.durationMs <= 150);
  assert.ok(SYNTH_CARTRIDGE_PING.durationMs >= 200);
});

test('POL-67 gate charge features exponential rising pitch ramp', () => {
  assert.equal(SYNTH_GATE_CHARGE.category, 'world');
  const lead = SYNTH_GATE_CHARGE.layers[0]!;
  assert.equal(lead.freq[0], 120);
  assert.equal(lead.freq[1], 960);
  assert.ok(SYNTH_GATE_CHARGE.durationMs >= 3000);
});
