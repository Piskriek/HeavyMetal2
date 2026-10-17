// ============================================================================
// File: apps/web/src/studio/four-angle.ts
// TICKET-08b (OPUS_NOTE_15 Item D):
// 4-angle review:
// - fourAngleShots(assetId: string, size = 256): Promise<{ front: string; back: string; left: string; right: string }>
//   Reuses studio-thumbs' offscreen renderer pattern, with the camera on the asset's bounding box
//   at 0, 90, 180 and 270 degrees and three-quarter height.
// - anglePoses(bbox): pure helper returning camera position and target for each of the four views.
// - FourAnglePanel({ assetId, version }): 2-by-2 grid in the Assets workspace's Details that refreshes after a redo.
// ============================================================================

import { createElement, useEffect, useState, type ReactElement } from 'react';
import * as THREE from 'three';
import { loadGenRaw } from '../assets/gen';

export type Vec3Tuple = readonly [number, number, number] & {
  readonly x: number;
  readonly y: number;
  readonly z: number;
};

export interface AnglePose {
  readonly position: Vec3Tuple;
  readonly target: Vec3Tuple;
  readonly deg: number;
}

export interface FourAnglePoses {
  readonly front: AnglePose;
  readonly right: AnglePose;
  readonly back: AnglePose;
  readonly left: AnglePose;
}

export interface FourAngleShots {
  readonly front: string;
  readonly back: string;
  readonly left: string;
  readonly right: string;
}

export type BBoxInput =
  | THREE.Box3
  | {
      readonly min: readonly [number, number, number] | { readonly x: number; readonly y: number; readonly z: number };
      readonly max: readonly [number, number, number] | { readonly x: number; readonly y: number; readonly z: number };
    }
  | readonly [readonly [number, number, number], readonly [number, number, number]];

const STYLE_ID = 'hm-studio-four-angle-styles';
const STYLE_CSS = `
.sx-four-angle { display: flex; flex-direction: column; gap: 8px; margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--sx-line, #1c2734); }
.sx-four-angle-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.sx-four-angle-head h4 { margin: 0 !important; font: 600 11px/1 var(--sx-display, Oxanium, sans-serif); color: var(--sx-dim, #6c8193); letter-spacing: 0.08em; text-transform: uppercase; }
.sx-four-angle-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.sx-four-angle-cell { position: relative; aspect-ratio: 1 / 1; border-radius: 6px; background: #080c12; border: 1px solid var(--sx-line-hi, #2c3d51); overflow: hidden; display: flex; align-items: center; justify-content: center; }
.sx-four-angle-cell img { width: 100%; height: 100%; object-fit: contain; display: block; }
.sx-four-angle-tag { position: absolute; left: 6px; bottom: 5px; padding: 2px 5px; border-radius: 3px; background: rgba(5, 8, 12, 0.82); border: 1px solid rgba(44, 61, 81, 0.65); font: 600 9px/1 var(--sx-display, Oxanium, monospace); color: var(--sx-dim, #6c8193); pointer-events: none; }
`;

function ensureFourAngleStyles(): void {
  if (typeof document !== 'undefined' && !document.getElementById(STYLE_ID)) {
    const el = document.createElement('style');
    el.id = STYLE_ID;
    el.textContent = STYLE_CSS;
    document.head.appendChild(el);
  }
}

function makeVec3(x: number, y: number, z: number): Vec3Tuple {
  const rx = Math.round(x * 1e6) / 1e6;
  const ry = Math.round(y * 1e6) / 1e6;
  const rz = Math.round(z * 1e6) / 1e6;
  const arr = [rx, ry, rz] as unknown as Vec3Tuple;
  Object.defineProperties(arr, {
    x: { get: () => rx, enumerable: false },
    y: { get: () => ry, enumerable: false },
    z: { get: () => rz, enumerable: false },
  });
  return arr;
}

function readPt(v: readonly [number, number, number] | { readonly x: number; readonly y: number; readonly z: number }): [number, number, number] {
  if (Array.isArray(v)) {
    return [Number(v[0]) || 0, Number(v[1]) || 0, Number(v[2]) || 0];
  }
  const obj = v as { readonly x: number; readonly y: number; readonly z: number };
  return [Number(obj.x) || 0, Number(obj.y) || 0, Number(obj.z) || 0];
}

function unpackBBox(bbox: BBoxInput): { min: [number, number, number]; max: [number, number, number] } {
  if (Array.isArray(bbox) && bbox.length === 2 && Array.isArray(bbox[0]) && Array.isArray(bbox[1])) {
    return {
      min: readPt(bbox[0] as readonly [number, number, number]),
      max: readPt(bbox[1] as readonly [number, number, number]),
    };
  }
  const b = bbox as {
    readonly min: readonly [number, number, number] | { readonly x: number; readonly y: number; readonly z: number };
    readonly max: readonly [number, number, number] | { readonly x: number; readonly y: number; readonly z: number };
  };
  return {
    min: readPt(b.min),
    max: readPt(b.max),
  };
}

/**
 * Pure helper (TICKET-08b Item D):
 * Given an asset bounding box (`THREE.Box3`, `{ min, max }`, or `[[minX, minY, minZ], [maxX, maxY, maxZ]]`),
 * returns the camera `position` and `target` for each of the four views (`front` at 0°, `right` at 90°,
 * `back` at 180°, `left` at 270°) from three-quarter height.
 */
export function anglePoses(bbox: BBoxInput, fovDeg = 30): FourAnglePoses {
  const { min, max } = unpackBBox(bbox);
  const cx = (min[0] + max[0]) / 2;
  const cy = (min[1] + max[1]) / 2;
  const cz = (min[2] + max[2]) / 2;

  const sx = Math.max(0, max[0] - min[0]);
  const sy = Math.max(0, max[1] - min[1]);
  const sz = Math.max(0, max[2] - min[2]);

  const radius = Math.max(sx, sy, sz) / 2 || 0.5;
  const halfFovRad = (Math.max(10, fovDeg) * Math.PI) / 360;
  const dist = (radius / Math.sin(halfFovRad)) * 1.05;

  // Three-quarter elevated camera height above the bounding-box centre
  const camY = Math.max(min[1] + sy * 0.75, cy + dist * 0.42);
  const horizDist = dist * 0.9;
  const target = makeVec3(cx, cy, cz);

  const poseAt = (deg: number): AnglePose => {
    const rad = (deg * Math.PI) / 180;
    const px = cx + Math.sin(rad) * horizDist;
    const pz = cz + Math.cos(rad) * horizDist;
    return {
      position: makeVec3(px, camY, pz),
      target,
      deg,
    };
  };

  return {
    front: poseAt(0),
    right: poseAt(90),
    back: poseAt(180),
    left: poseAt(270),
  };
}

const cache = new Map<string, FourAngleShots>();
const pending = new Map<string, Promise<FourAngleShots>>();
let chain: Promise<unknown> = Promise.resolve();
let renderer: THREE.WebGLRenderer | null = null;
let scene: THREE.Scene | null = null;
let camera: THREE.PerspectiveCamera | null = null;
const listeners = new Set<(assetId?: string) => void>();

function ensureOffscreen(size: number): {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
} {
  if (!renderer || !scene || !camera) {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
    renderer.setPixelRatio(1);
    renderer.setClearColor(0x000000, 0);
    scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight(0xd6ecff, 0x18120a, 1.4));
    const sun = new THREE.DirectionalLight(0xffffff, 1.6);
    sun.position.set(3, 6, 4);
    scene.add(sun);
    camera = new THREE.PerspectiveCamera(30, 1, 0.01, 200);
  }
  renderer.setSize(size, size, false);
  return { renderer, scene, camera };
}

/** Clears cached 4-angle shots for one asset (or all assets) after a redo and notifies mounted FourAnglePanels. */
export function forgetFourAngle(assetId?: string): void {
  if (!assetId) {
    cache.clear();
    pending.clear();
  } else {
    for (const k of [...cache.keys()]) {
      if (k === assetId || k.startsWith(`${assetId}:`)) cache.delete(k);
    }
    for (const k of [...pending.keys()]) {
      if (k === assetId || k.startsWith(`${assetId}:`)) pending.delete(k);
    }
  }
  for (const fn of listeners) fn(assetId);
}

async function drawFourAngles(assetId: string, size: number): Promise<FourAngleShots> {
  const empty: FourAngleShots = { front: '', back: '', left: '', right: '' };
  if (typeof document === 'undefined') return empty;
  try {
    const raw = await loadGenRaw(assetId, 'low');
    const { renderer: r, scene: s, camera: c } = ensureOffscreen(size);
    const model = raw.clone(true);
    s.add(model);
    try {
      const box = new THREE.Box3().setFromObject(model);
      if (box.isEmpty()) return empty;
      const poses = anglePoses(box, c.fov);
      const renderPose = (pose: AnglePose): string => {
        c.position.set(pose.position[0], pose.position[1], pose.position[2]);
        c.lookAt(pose.target[0], pose.target[1], pose.target[2]);
        c.aspect = 1;
        c.updateProjectionMatrix();
        r.render(s, c);
        return r.domElement.toDataURL('image/png');
      };
      return {
        front: renderPose(poses.front),
        right: renderPose(poses.right),
        back: renderPose(poses.back),
        left: renderPose(poses.left),
      };
    } finally {
      s.remove(model);
    }
  } catch {
    return empty;
  }
}

/**
 * Renders 4 offscreen review shots (`front` 0°, `right` 90°, `back` 180°, `left` 270°)
 * for `assetId` at `size` px, serialized on a single shared WebGL context.
 */
export function fourAngleShots(assetId: string, size = 256): Promise<FourAngleShots> {
  const key = `${assetId}:${size}`;
  const hit = cache.get(key);
  if (hit) return Promise.resolve(hit);
  const running = pending.get(key);
  if (running) return running;

  const p: Promise<FourAngleShots> = chain.then(() => drawFourAngles(assetId, size));
  chain = p.catch(() => undefined);
  pending.set(key, p);
  void p.then((shots) => {
    if (shots.front) cache.set(key, shots);
    pending.delete(key);
  });
  return p;
}

export interface FourAnglePanelProps {
  readonly assetId: string | null;
  readonly version?: number;
  readonly size?: number;
}

/**
 * 2-by-2 4-angle review grid (`Front 0°`, `Right 90°`, `Back 180°`, `Left 270°`)
 * for the Assets workspace's Details panel. Automatically refreshes after a redo.
 */
export function FourAnglePanel({ assetId, version = 0, size = 256 }: FourAnglePanelProps): ReactElement | null {
  ensureFourAngleStyles();
  const [shots, setShots] = useState<FourAngleShots | null>(null);
  const [rev, setRev] = useState<number>(0);

  useEffect(() => {
    const onInvalidate = (id?: string): void => {
      if (!id || id === assetId) {
        setRev((n) => n + 1);
      }
    };
    listeners.add(onInvalidate);
    return () => {
      listeners.delete(onInvalidate);
    };
  }, [assetId]);

  useEffect(() => {
    if (!assetId) {
      setShots(null);
      return undefined;
    }
    let live = true;
    if (version > 0 || rev > 0) {
      cache.delete(`${assetId}:${size}`);
    }
    void fourAngleShots(assetId, size).then((res) => {
      if (live) setShots(res);
    });
    return () => {
      live = false;
    };
  }, [assetId, version, rev, size]);

  if (!assetId) return null;

  const cells: readonly { readonly key: keyof FourAngleShots; readonly label: string }[] = [
    { key: 'front', label: 'Front 0°' },
    { key: 'right', label: 'Right 90°' },
    { key: 'back', label: 'Back 180°' },
    { key: 'left', label: 'Left 270°' },
  ];

  return createElement(
    'section',
    { className: 'sx-four-angle', 'aria-label': '4-Angle Review' },
    createElement(
      'div',
      { className: 'sx-four-angle-head' },
      createElement('h4', null, '4-Angle Review'),
      createElement(
        'button',
        {
          type: 'button',
          className: 'sx-mini',
          onClick: () => forgetFourAngle(assetId),
          'aria-label': 'Refresh 4-angle views',
        },
        'Refresh',
      ),
    ),
    createElement(
      'div',
      { className: 'sx-four-angle-grid' },
      ...cells.map((c) =>
        createElement(
          'div',
          { key: c.key, className: 'sx-four-angle-cell', 'data-angle': c.key },
          shots && shots[c.key]
            ? createElement('img', { src: shots[c.key], alt: `${assetId} ${c.label}`, draggable: false })
            : createElement('span', { className: 'sx-dim', style: { fontSize: 11 } }, 'Rendering…'),
          createElement('span', { className: 'sx-four-angle-tag' }, c.label),
        ),
      ),
    ),
  );
}
