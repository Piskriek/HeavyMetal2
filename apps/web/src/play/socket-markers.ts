// ============================================================================
// File: apps/web/src/play/socket-markers.ts
// TICKET-05 (OPUS_NOTE_12 Item A — BB-05):
// Square corner-bracket build-socket markers (square sections, flat on XZ,
// low alpha at rest, pulsing only on the slot the build ghost is about to use).
// ============================================================================

import * as THREE from 'three';

/** Low rest opacity so unselected snap slots never read as bright objects on the floor. */
export const SOCKET_REST_OPACITY = 0.24;

/** Active pulse opacity range when a slot is targeted by the build ghost. */
export const SOCKET_PULSE_MIN = 0.55;
export const SOCKET_PULSE_MAX = 0.92;

export interface SocketBracketOptions {
  /** Half-width of the outer square footprint in metres (default 0.56 m -> 1.12 m square). */
  readonly halfExtent?: number;
  /** Length of each corner bracket arm in metres (default 0.30 m). */
  readonly armLength?: number;
  /** Square cross-section width/thickness of each bracket bar in metres (default 0.055 m). */
  readonly barWidth?: number;
  /** Vertical height of the square-section bar in metres (default 0.028 m). */
  readonly barHeight?: number;
}

function appendBox(
  positions: number[],
  normals: number[],
  indices: number[],
  x0: number,
  y0: number,
  z0: number,
  x1: number,
  y1: number,
  z1: number
): void {
  const faces: readonly {
    readonly n: readonly [number, number, number];
    readonly v: readonly (readonly [number, number, number])[];
  }[] = [
    // +Y top
    {
      n: [0, 1, 0],
      v: [
        [x0, y1, z1],
        [x1, y1, z1],
        [x1, y1, z0],
        [x0, y1, z0],
      ],
    },
    // -Y bottom
    {
      n: [0, -1, 0],
      v: [
        [x0, y0, z0],
        [x1, y0, z0],
        [x1, y0, z1],
        [x0, y0, z1],
      ],
    },
    // +Z front
    {
      n: [0, 0, 1],
      v: [
        [x0, y0, z1],
        [x1, y0, z1],
        [x1, y1, z1],
        [x0, y1, z1],
      ],
    },
    // -Z back
    {
      n: [0, 0, -1],
      v: [
        [x1, y0, z0],
        [x0, y0, z0],
        [x0, y1, z0],
        [x1, y1, z0],
      ],
    },
    // +X right
    {
      n: [1, 0, 0],
      v: [
        [x1, y0, z1],
        [x1, y0, z0],
        [x1, y1, z0],
        [x1, y1, z1],
      ],
    },
    // -X left
    {
      n: [-1, 0, 0],
      v: [
        [x0, y0, z0],
        [x0, y0, z1],
        [x0, y1, z1],
        [x0, y1, z0],
      ],
    },
  ];

  for (const f of faces) {
    const base = positions.length / 3;
    for (const pt of f.v) {
      positions.push(pt[0], pt[1], pt[2]);
      normals.push(f.n[0], f.n[1], f.n[2]);
    }
    indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
}

/**
 * Builds four flat L-shaped square-section corner brackets lying in the XZ plane (`y in [0, barHeight]`).
 * Deterministic, pure geometry with 8 square-section bars (96 triangles) and zero curved rings.
 */
export function socketMarkerGeometry(opts: SocketBracketOptions = {}): THREE.BufferGeometry {
  const E = opts.halfExtent ?? 0.56;
  const L = opts.armLength ?? 0.30;
  const W = opts.barWidth ?? 0.055;
  const H = opts.barHeight ?? 0.028;

  const positions: number[] = [];
  const normals: number[] = [];
  const indices: number[] = [];

  const corners: readonly (readonly [number, number])[] = [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ];

  for (const [sx, sz] of corners) {
    // Arm along X (spanning full corner to L inward along X)
    const ax0 = sx < 0 ? -E : E - L;
    const ax1 = sx < 0 ? -E + L : E;
    const az0 = sz < 0 ? -E : E - W;
    const az1 = sz < 0 ? -E + W : E;
    appendBox(positions, normals, indices, ax0, 0, az0, ax1, H, az1);

    // Arm along Z (inward of the X arm so corner square isn't double-drawn)
    const bx0 = sx < 0 ? -E : E - W;
    const bx1 = sx < 0 ? -E + W : E;
    const bz0 = sz < 0 ? -E + W : E - L;
    const bz1 = sz < 0 ? -E + L : E - W;
    appendBox(positions, normals, indices, bx0, 0, bz0, bx1, H, bz1);
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geom.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geom.setIndex(indices);
  geom.computeBoundingBox();
  geom.computeBoundingSphere();
  return geom;
}

/**
 * Low-alpha telemetry bracket material that stays subtle at rest and supports per-instance
 * colour modulation so only the active snap slot pulses.
 */
export function socketMarkerMaterial(): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({
    color: 0x38bdf8,
    transparent: true,
    opacity: SOCKET_REST_OPACITY,
    side: THREE.DoubleSide,
    depthWrite: false,
    depthTest: false,
  });
}

/**
 * Returns the opacity for a socket marker at `t` seconds:
 * - Inactive slots remain steady at `SOCKET_REST_OPACITY` (0.24).
 * - Only the active slot (the one the ghost is about to snap to) pulses between 0.55 and 0.92.
 */
export function socketMarkerOpacity(active: boolean, t: number): number {
  if (!active) return SOCKET_REST_OPACITY;
  const wave = 0.5 + 0.5 * Math.sin(t * 5.0);
  return SOCKET_PULSE_MIN + (SOCKET_PULSE_MAX - SOCKET_PULSE_MIN) * wave;
}

/**
 * Computes per-instance colour for an InstancedMesh of socket markers so inactive markers
 * sit at a dim muted slate-cyan while only the active target slot pulses bright cyan.
 */
export function socketMarkerInstanceColor(
  active: boolean,
  t: number,
  out: THREE.Color = new THREE.Color()
): THREE.Color {
  if (!active) {
    return out.setRGB(0.14, 0.36, 0.48);
  }
  const wave = 0.5 + 0.5 * Math.sin(t * 5.0);
  const b = 0.65 + 0.35 * wave;
  return out.setRGB(0.22 * b, 0.78 * b, 1.0 * b);
}
