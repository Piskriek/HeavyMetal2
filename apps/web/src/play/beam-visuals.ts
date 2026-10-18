/**
 * The beam's ground visuals (TASK-21d, P0-VFX-01): a ring decal where the beam lands, showing the stroke's radius, coloured by mode
 * (Seal's amber while sealing); and in Extract, a stream of 16 dark chunks that spiral from the hit point into the muzzle. The ring
 * samples the ground under it, so it lies on a slope instead of cutting into it. The stream is one instanced draw call.
 *
 * The placement math is pure (streamChunk, streamPosition) and tested; the meshes are three.js objects owned by the scene.
 */
import * as THREE from 'three';
import { BEAM_COLOURS, type BeamMode } from '@hm/beamkit';

/** The ring's segments round, and the chunks in the stream. */
export const RING_SEGMENTS = 72;
export const STREAM_COUNT = 16;
/** The ring band's width (m), its lift above the ground (m) so it never flickers, and the stream's loops a second. */
const RING_WIDTH = 0.14;
export const RING_LIFT = 0.06;
const STREAM_LOOPS_PER_SECOND = 0.55;

/**
 * POL-30: Computes the slope-compensated vertical lift at `(x, z)` so the brush ring
 * stays proud of sloped and creased terrain triangles instead of reading dashed on slopes.
 */
export function slopeLiftAt(
  heightAt: (x: number, z: number) => number,
  x: number,
  z: number,
  baseLift = RING_LIFT,
): number {
  const eps = 0.35;
  const hc = heightAt(x, z);
  const hx0 = heightAt(x - eps, z);
  const hx1 = heightAt(x + eps, z);
  const hz0 = heightAt(x, z - eps);
  const hz1 = heightAt(x, z + eps);
  const dhdx = (hx1 - hx0) / (2 * eps);
  const dhdz = (hz1 - hz0) / (2 * eps);
  const slope = Math.hypot(dhdx, dhdz);
  const chord = Math.max(0, 0.5 * (hx0 + hx1) - hc, 0.5 * (hz0 + hz1) - hc);
  return baseLift * Math.sqrt(1 + slope * slope) + slope * 0.09 + chord + 0.02;
}

/** The ring's colour: the mode's, or Seal's amber while sealing. */
export function ringColourOf(mode: BeamMode, sealing: boolean): string {
  return sealing ? BEAM_COLOURS.seal : BEAM_COLOURS[mode];
}

/** A stream chunk at a time: u from the hit (0) to the muzzle (1), its radius and angle about the beam, and its size (0 hides it). */
export interface StreamChunk {
  readonly u: number;
  readonly radius: number;
  readonly angle: number;
  readonly scale: number;
}

/** Where chunk `i` of `count` is at `t` seconds. The spiral narrows as it nears the muzzle, and each chunk fades in and out at the ends. */
export function streamChunk(i: number, count: number, t: number): StreamChunk {
  const phase = i / Math.max(1, count);
  const raw = t * STREAM_LOOPS_PER_SECOND + phase;
  const u = raw - Math.floor(raw);
  const radius = 0.05 + 0.26 * (1 - u);
  const angle = 2 * Math.PI * (2.2 * u + phase);
  const fade = Math.max(0, Math.min(1, Math.min(u, 1 - u) / 0.08));
  // about 12 cm at the hit and 8 cm at the muzzle: small enough to be chunks, big enough to read at 7 m on the dithered stage
  const size = (0.12 - 0.04 * u) * fade;
  return { u, radius, angle, scale: size };
}

/** Scratch vectors for the placement, so a frame of sixteen chunks makes no garbage. */
export interface StreamScratch {
  readonly axis: THREE.Vector3;
  readonly helper: THREE.Vector3;
  readonly right: THREE.Vector3;
  readonly up: THREE.Vector3;
}
export const newStreamScratch = (): StreamScratch => ({ axis: new THREE.Vector3(), helper: new THREE.Vector3(), right: new THREE.Vector3(), up: new THREE.Vector3() });

/**
 * Where a stream chunk sits: along the line from the hit point (u = 0) to the muzzle (u = 1), round it on the spiral. Writes into
 * `out` and returns it. A degenerate line (hit and muzzle on one point) puts the chunk on the hit point.
 */
export function streamPosition(hit: THREE.Vector3, muzzle: THREE.Vector3, c: StreamChunk, out: THREE.Vector3, scratch: StreamScratch = newStreamScratch()): THREE.Vector3 {
  const { axis, helper, right, up } = scratch;
  axis.copy(muzzle).sub(hit);
  const len = axis.length();
  if (!(len > 1e-6)) return out.copy(hit);
  axis.multiplyScalar(1 / len);
  helper.set(Math.abs(axis.y) > 0.9 ? 1 : 0, Math.abs(axis.y) > 0.9 ? 0 : 1, 0);
  right.crossVectors(axis, helper).normalize();
  up.crossVectors(right, axis);
  out.copy(hit).addScaledVector(axis, len * c.u);
  out.addScaledVector(right, Math.cos(c.angle) * c.radius);
  out.addScaledVector(up, Math.sin(c.angle) * c.radius);
  return out;
}

export interface BeamVisuals {
  /** Shows the ring at a ground point with its radius, in `colour`, lying on `heightAt`; null hides it. */
  setRing(centre: { readonly x: number; readonly z: number } | null, radius: number, colour: string, heightAt: (x: number, z: number) => number): void;
  /** Shows the stream from the hit point to the muzzle at `time` seconds; null hides it. */
  setStream(hit: THREE.Vector3 | null, muzzle: THREE.Vector3 | null, time: number): void;
  /** The ring's colour now, or null while it is hidden. */
  ringColour(): string | null;
  /** Whether the stream is drawn now. */
  streamShown(): boolean;
  dispose(): void;
}

/** The scene's disposal list: anything made here is registered with it. */
type Keep = <T extends { dispose(): void }>(x: T) => T;

export function createBeamVisuals(scene: THREE.Scene, keep: Keep): BeamVisuals {
  // ---- the ring: a band of segments, its vertices re-seated on the ground each time it is shown
  const ringPositions = new Float32Array((RING_SEGMENTS + 1) * 2 * 3);
  const ringGeometry = keep(new THREE.BufferGeometry());
  ringGeometry.setAttribute('position', new THREE.BufferAttribute(ringPositions, 3));
  const ringIndex: number[] = [];
  for (let s = 0; s < RING_SEGMENTS; s++) {
    const a = 2 * s, b = 2 * s + 1, c = 2 * s + 2, d = 2 * s + 3;
    ringIndex.push(a, c, b, b, c, d);
  }
  ringGeometry.setIndex(ringIndex);
  const ringMaterial = keep(new THREE.MeshBasicMaterial({
    color: BEAM_COLOURS.extract,
    transparent: true,
    opacity: 0.9,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    polygonOffset: true,
    polygonOffsetFactor: -4,
    polygonOffsetUnits: -4,
  }));
  const ring = new THREE.Mesh(ringGeometry, ringMaterial);
  ring.name = 'beam-ring';
  ring.frustumCulled = false;
  ring.visible = false;
  ring.renderOrder = 4;
  scene.add(ring);
  let ringShown: string | null = null;

  // ---- the stream: one instanced draw call for the 16 chunks
  const streamGeometry = keep(new THREE.BoxGeometry(1, 1, 1));
  const streamMaterial = keep(new THREE.MeshStandardMaterial({ color: '#2b313a', roughness: 0.9, metalness: 0.1, emissive: '#16303a', emissiveIntensity: 0.5 }));
  const stream = new THREE.InstancedMesh(streamGeometry, streamMaterial, STREAM_COUNT);
  stream.name = 'beam-stream';
  stream.frustumCulled = false;
  stream.visible = false;
  scene.add(stream);
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const sc = new THREE.Vector3();
  const pos = new THREE.Vector3();
  const euler = new THREE.Euler();
  const hitScratch = new THREE.Vector3();
  const muzzleScratch = new THREE.Vector3();
  const placing = newStreamScratch();

  return {
    setRing(centre, radius, colour, heightAt) {
      if (centre === null || !(radius > 0)) {
        ring.visible = false;
        ringShown = null;
        return;
      }
      const inner = Math.max(0.01, radius - RING_WIDTH);
      for (let s = 0; s <= RING_SEGMENTS; s++) {
        const a = (2 * Math.PI * s) / RING_SEGMENTS;
        const co = Math.cos(a), si = Math.sin(a);
        for (let k = 0; k < 2; k++) {
          const r = k === 0 ? inner : radius;
          const x = centre.x + co * r, z = centre.z + si * r;
          const o = (2 * s + k) * 3;
          ringPositions[o] = x;
          ringPositions[o + 1] = heightAt(x, z) + slopeLiftAt(heightAt, x, z, RING_LIFT);
          ringPositions[o + 2] = z;
        }
      }
      (ringGeometry.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
      ringGeometry.computeBoundingSphere();
      if (ringShown !== colour) {
        ringMaterial.color.set(colour);
        ringShown = colour;
      }
      ring.visible = true;
    },
    setStream(hit, muzzle, time) {
      if (hit === null || muzzle === null) {
        stream.visible = false;
        return;
      }
      hitScratch.copy(hit);
      muzzleScratch.copy(muzzle);
      for (let i = 0; i < STREAM_COUNT; i++) {
        const c = streamChunk(i, STREAM_COUNT, time);
        streamPosition(hitScratch, muzzleScratch, c, pos, placing);
        euler.set(time * 6 + i, time * 4 + i * 0.7, 0);
        q.setFromEuler(euler);
        sc.set(c.scale, c.scale, c.scale);
        m4.compose(pos, q, sc);
        stream.setMatrixAt(i, m4);
      }
      stream.instanceMatrix.needsUpdate = true;
      stream.visible = true;
    },
    ringColour: () => (ring.visible ? ringShown : null),
    streamShown: () => stream.visible,
    dispose() {
      scene.remove(ring);
      scene.remove(stream);
    },
  };
}
