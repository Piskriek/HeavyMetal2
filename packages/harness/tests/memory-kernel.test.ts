/**
 * Wave 3 verification: C_compress / I_wake bit-exact recall (M_recall ≡ 1.0), VSA-4096
 * integrity detection, determinism, and the end-to-end session handoff through the
 * SovereignInceptionLoop settled state.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ExternalInputIdx,
  RecursiveMemoryKernel,
  SovereignInceptionLoop,
  VSA_WORDS,
  computeVsaSignature4096,
  createEscortRoverPreset,
  createSquadOverseerPreset,
  decodeStateHexLE,
  encodeStateHexLE,
} from '../src/index';

/** A hostile state vector: signed zeros, denormals, infinities, and a quiet NaN payload. */
function trickyState(): Float32Array {
  const s = new Float32Array(24);
  s[0] = 0.0;
  s[1] = -0.0;
  s[2] = 1e-45; // smallest f32 denormal
  s[3] = 3.4028234663852886e38; // f32 max
  s[4] = Number.POSITIVE_INFINITY;
  s[5] = Number.NEGATIVE_INFINITY;
  new Uint32Array(s.buffer)[6] = 0x7fc00abc; // NaN with a specific payload
  for (let i = 7; i < 24; i++) s[i] = Math.sin(i) * 10 ** ((i % 7) - 3);
  return s;
}

function assertBytesEqual(a: Float32Array, b: Float32Array): void {
  assert.equal(a.length, b.length);
  const ba = new Uint8Array(a.buffer, a.byteOffset, a.byteLength);
  const bb = new Uint8Array(b.buffer, b.byteOffset, b.byteLength);
  for (let i = 0; i < ba.length; i++) {
    assert.equal(ba[i]!, bb[i]!, `byte ${i} differs`);
  }
}

test('C_compress / I_wake round trip is bit-exact (M_recall === 1.0), NaN payloads included', () => {
  const kernel = new RecursiveMemoryKernel('preset:persona-precise-masculine', 20261027);
  const state = trickyState();
  const payload = kernel.compress(state);

  const parsed = JSON.parse(payload) as Record<string, unknown>;
  assert.equal(parsed['$schema'], 'hm2:memory-kernel:v1');
  assert.equal(parsed['recallFidelityMetric'], 1.0);
  assert.equal(parsed['activePersona'], 'preset:persona-precise-masculine');
  assert.equal(parsed['epoch'], 20261027);

  const nextSession = new RecursiveMemoryKernel('preset:persona-neutral-observer', 20261028);
  const woken = nextSession.wake(payload);
  assertBytesEqual(state, woken);
  assert.equal(nextSession.stateVectorHex, kernel.stateVectorHex);
});

test('I_wake accepts a bare hex snapshot and the LE codec validates its input', () => {
  const kernel = new RecursiveMemoryKernel('preset:persona-creative-anima', 1);
  const state = trickyState();
  kernel.compress(state);
  const woken = kernel.wake(kernel.stateVectorHex);
  assertBytesEqual(state, woken);

  assert.throws(() => decodeStateHexLE('abc'), /malformed/);
  assert.throws(() => decodeStateHexLE('zz00zz00'), /malformed/);
  assert.equal(decodeStateHexLE(encodeStateHexLE(new Float32Array(0))).length, 0);
});

test('a corrupted payload is refused by the VSA-4096 signature check', () => {
  const kernel = new RecursiveMemoryKernel('preset:persona-precise-masculine', 7);
  const payload = kernel.compress(trickyState());
  const hexField = (JSON.parse(payload) as { stateSnapshotFloat32Hex: string }).stateSnapshotFloat32Hex;
  const flipped = hexField[0] === '0' ? '1' + hexField.slice(1) : '0' + hexField.slice(1);
  const corrupt = payload.replace(hexField, flipped);
  assert.throws(() => kernel.wake(corrupt), /signature mismatch/);
  assert.throws(() => kernel.wake('{"version":1}'), /missing stateSnapshotFloat32Hex/);
});

test('the kernel is deterministic and the signature avalanches on single-bit changes', () => {
  const a = new RecursiveMemoryKernel('preset:persona-precise-masculine', 42);
  const b = new RecursiveMemoryKernel('preset:persona-precise-masculine', 42);
  const state = trickyState();
  assert.equal(a.compress(state), b.compress(state), 'identical payloads for identical inputs');

  const bytes = new Uint8Array(new Float32Array(state).buffer);
  const sigA = new Uint32Array(VSA_WORDS);
  const sigB = new Uint32Array(VSA_WORDS);
  computeVsaSignature4096(bytes, sigA);
  bytes[11] = bytes[11]! ^ 0x01; // flip one bit
  computeVsaSignature4096(bytes, sigB);
  let flippedBits = 0;
  for (let w = 0; w < VSA_WORDS; w++) {
    let x = (sigA[w]! ^ sigB[w]!) >>> 0;
    while (x !== 0) { flippedBits += x & 1; x >>>= 1; }
  }
  assert.ok(flippedBits > 1024 && flippedBits < 3072,
    `single-bit change flips ~half the 4096 signature bits (flipped ${flippedBits})`);
});

test('session handoff: the settled inception-loop state survives compress/wake byte-for-byte', () => {
  const loop = new SovereignInceptionLoop(createEscortRoverPreset(), createSquadOverseerPreset());
  const input = new Float32Array([0.0, 130.0, 0.0, 0.0]);
  for (let i = 0; i < 80; i++) loop.step(0.02, input);
  input[ExternalInputIdx.AWARENESS_GATE] = 1.0;
  input[ExternalInputIdx.INCEPTION_GATE] = 1.0;
  for (let i = 0; i < 240; i++) loop.step(0.02, input);

  const kernel = new RecursiveMemoryKernel('preset:persona-neutral-observer', 20261027);
  const payload = kernel.compress(loop.lowerNode.stateVector);
  const woken = new RecursiveMemoryKernel('preset:persona-precise-masculine', 20261028).wake(payload);
  assertBytesEqual(loop.lowerNode.stateVector, woken);
});
