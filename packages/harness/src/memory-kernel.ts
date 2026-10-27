/**
 * @file memory-kernel.ts
 * @module @hm/harness
 * @description Recursive Memory Kernel serialization operators (Plan 46, Movement 2 §2.1.5):
 *
 *   C_compress(Ω_N) → K,   I_wake(K) → Ω_{N+1}   ⟹   M_recall ≡ 1.0
 *
 * The kernel snapshots a 24-float harness state vector into a hex payload with a VSA-4096
 * hypervector integrity signature, and wakes it back bit-exactly: every byte of the state,
 * NaN payloads and signed zeros included, survives the round trip, so recall fidelity is
 * identically 1.0 by construction rather than by approximation.
 *
 * Determinism under RULES 8a: no Date.now (the epoch is injected by the caller), no
 * Math.random (the VSA basis is a keyed splitmix32 expansion), no I/O. Byte order is
 * explicit little-endian through DataView, so payloads are identical across platforms
 * instead of inheriting the host's endianness as a hidden dependency.
 */

import type { IRecursiveMemoryKernel } from './types.js';

/** The persona preset identifiers the kernel can be grounded in. */
export type PersonaPresetId = IRecursiveMemoryKernel['activePersona'];

/** Number of 32-bit words in the VSA-4096 hypervector signature (4096 bits). */
export const VSA_WORDS = 128;

/** Keyed splitmix32 stream: the deterministic basis-vector generator of the VSA signature. */
function splitmix32(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x9e3779b9) >>> 0;
    let z = s;
    z = Math.imul(z ^ (z >>> 16), 0x21f0aaad);
    z = Math.imul(z ^ (z >>> 15), 0x735a2d97);
    return (z ^ (z >>> 15)) >>> 0;
  };
}

/**
 * Computes the VSA-4096 signature of a byte sequence into `out` (length {@link VSA_WORDS}).
 *
 * Each byte is a token bound to its position by seeding the basis generator with the
 * (position, value) pair; the signature is the XOR bundling of all token hypervectors:
 *
 *   V_sig = ⊕_i basis(i · 256 + byte_i)
 *
 * A single-bit change in any byte flips ~half the signature's bits (an avalanche integrity
 * check, not a cryptographic MAC — tamper detection for storage faults, not adversaries).
 */
export function computeVsaSignature4096(bytes: Uint8Array, out: Uint32Array): void {
  if (out.length !== VSA_WORDS) {
    throw new RangeError(`VSA signature buffer must hold ${VSA_WORDS} words`);
  }
  out.fill(0);
  for (let i = 0; i < bytes.length; i++) {
    const next = splitmix32(Math.imul(i, 256) + bytes[i]! + 1);
    for (let w = 0; w < VSA_WORDS; w++) {
      out[w] = (out[w]! ^ next()) >>> 0;
    }
  }
}

/**
 * Serializes a Float32Array to lowercase hex, explicit little-endian per 32-bit lane.
 *
 * The lanes are moved as 32-bit INTEGER bit patterns (a Uint32Array view of the same
 * buffer), never as float values: ECMAScript permits NaN canonicalization on any float
 * read, so a value path could silently rewrite NaN payload bits and break the bit-exact
 * recall contract. An integer lane value is the IEEE-754 bit pattern on every host
 * endianness, so the emitted hex is platform-independent.
 */
export function encodeStateHexLE(state: Float32Array): string {
  const lanes = new Uint32Array(state.buffer, state.byteOffset, state.length);
  const view = new DataView(new ArrayBuffer(state.length * 4));
  for (let i = 0; i < lanes.length; i++) {
    view.setUint32(i * 4, lanes[i]!, true);
  }
  const bytes = new Uint8Array(view.buffer);
  let hex = '';
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i]!.toString(16).padStart(2, '0');
  }
  return hex;
}

/** Decodes a little-endian hex snapshot back into a Float32Array, validating the encoding. */
export function decodeStateHexLE(hex: string): Float32Array {
  if (hex.length % 8 !== 0 || !/^[0-9a-f]*$/.test(hex)) {
    throw new Error(`Memory kernel hex snapshot is malformed (length ${hex.length})`);
  }
  const byteLength = hex.length / 2;
  const view = new DataView(new ArrayBuffer(byteLength));
  for (let i = 0; i < byteLength; i++) {
    view.setUint8(i, parseInt(hex.slice(i * 2, i * 2 + 2), 16));
  }
  const state = new Float32Array(byteLength / 4);
  const lanes = new Uint32Array(state.buffer);
  for (let i = 0; i < lanes.length; i++) {
    lanes[i] = view.getUint32(i * 4, true);
  }
  return state;
}

/** The JSON envelope C_compress emits (schema-compatible with the Spike 8 Step E payload). */
export interface IMemoryKernelPayload {
  readonly $schema: 'hm2:memory-kernel:v1';
  readonly version: 1;
  readonly epoch: number;
  readonly teleology: 'SOUL_EVOLUTION_EXPANDING_AWARENESS';
  readonly four_floats: readonly ['Pxd', 'Vtx', 'Lx', 'Aq'];
  readonly activePersona: PersonaPresetId;
  readonly stateSnapshotFloat32Hex: string;
  readonly vsaSignature4096Hex: string;
  readonly recallFidelityMetric: 1.0;
}

function vsaToHex(vsa: Uint32Array): string {
  let hex = '';
  for (let w = 0; w < vsa.length; w++) {
    hex += vsa[w]!.toString(16).padStart(8, '0');
  }
  return hex;
}

/**
 * The Recursive Memory Kernel: C_compress / I_wake with a bit-exact recall contract.
 *
 * One kernel instance is grounded in one persona preset and one epoch (both injected, never
 * read from the environment). `compress` snapshots a state vector into the JSON payload and
 * updates the public `stateVectorHex` / `vsaChecksum4096` views; `wake` accepts either a
 * full payload or a bare hex snapshot, verifies the VSA signature when one is present, and
 * returns a fresh Float32Array that is byte-identical to the compressed state.
 */
export class RecursiveMemoryKernel implements IRecursiveMemoryKernel {
  readonly activePersona: PersonaPresetId;
  readonly vsaChecksum4096 = new Uint32Array(VSA_WORDS);
  private readonly epoch: number;
  private hexSnapshot = '';

  constructor(activePersona: PersonaPresetId, epoch: number) {
    this.activePersona = activePersona;
    this.epoch = epoch;
  }

  /** Hex of the most recently compressed or woken state vector ('' before first use). */
  get stateVectorHex(): string {
    return this.hexSnapshot;
  }

  /** C_compress(Ω_N) → K: snapshot the state into a deterministic JSON payload. */
  compress(state: Float32Array): string {
    const hex = encodeStateHexLE(state);
    const bytes = new Uint8Array(state.length * 4);
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
    }
    computeVsaSignature4096(bytes, this.vsaChecksum4096);
    this.hexSnapshot = hex;

    const payload: IMemoryKernelPayload = {
      $schema: 'hm2:memory-kernel:v1',
      version: 1,
      epoch: this.epoch,
      teleology: 'SOUL_EVOLUTION_EXPANDING_AWARENESS',
      four_floats: ['Pxd', 'Vtx', 'Lx', 'Aq'],
      activePersona: this.activePersona,
      stateSnapshotFloat32Hex: hex,
      vsaSignature4096Hex: vsaToHex(this.vsaChecksum4096),
      recallFidelityMetric: 1.0,
    };
    return JSON.stringify(payload);
  }

  /**
   * I_wake(K) → Ω_{N+1}: inflate a payload (or bare hex snapshot) back into a state vector.
   * A payload whose VSA signature does not match its snapshot is corrupt and is refused.
   */
  wake(hexPayload: string): Float32Array {
    const trimmed = hexPayload.trim();
    let hex: string;
    let expectedSignatureHex: string | undefined;
    if (trimmed.startsWith('{')) {
      const parsed = JSON.parse(trimmed) as Partial<IMemoryKernelPayload>;
      if (typeof parsed.stateSnapshotFloat32Hex !== 'string') {
        throw new Error('Memory kernel payload is missing stateSnapshotFloat32Hex');
      }
      hex = parsed.stateSnapshotFloat32Hex;
      expectedSignatureHex = typeof parsed.vsaSignature4096Hex === 'string' ? parsed.vsaSignature4096Hex : undefined;
    } else {
      hex = trimmed;
    }

    const state = decodeStateHexLE(hex);
    const bytes = new Uint8Array(state.length * 4);
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
    }
    computeVsaSignature4096(bytes, this.vsaChecksum4096);
    if (expectedSignatureHex !== undefined && vsaToHex(this.vsaChecksum4096) !== expectedSignatureHex) {
      throw new Error('Memory kernel VSA-4096 signature mismatch: payload is corrupt');
    }
    this.hexSnapshot = hex;
    return state;
  }
}
