// ============================================================================
// File: apps/web/src/play/vehicle-juice.ts
// TICKET-07 (OPUS_NOTE_14 Item E — VEH-01 / DEC-09):
//  1. boostedInput(input, boost, energy): pure Shift-boost throttle scaler & energy meter
//  2. tireTracks(o): capped ring buffer of ground tread decals built on @hm/decals
//  3. wheelRoost(o): wheel-slip & speed regolith dust plumes built on @hm/particles
//  4. printGantry(at): overhead laser gantry sweep at the fabricator pad on vehicle print
// ============================================================================

import * as THREE from 'three';
import type { Input } from '@hm/rover';
import {
  alphaAt,
  corners,
  onGround,
  type Decal,
  type DecalDef,
  type Heights,
  type Vec3 as DecalVec3,
} from '@hm/decals';
import {
  ParticleSystem as HmParticleSystem,
  STRIDE,
  type EmitterSpec,
} from '@hm/particles';

/** Boost throttle multiplier and meter drain/recharge rates (per second). */
export const BOOST_THROTTLE_SCALE = 1.65;
export const BOOST_DRAIN_RATE = 0.45;
export const BOOST_RECHARGE_RATE = 0.25;

export interface BoostedInput extends Input {
  readonly energy: number;
  readonly boosting: boolean;
  readonly boostScale: number;
}

/**
 * Pure vehicle Shift-boost helper (TICKET-07 Item E.1):
 * Scales `input.throttle` when `boost` is held and `energy > 0`, draining the
 * boost energy meter (`0..1`), and recharging it when `boost` is released.
 */
export function boostedInput(
  input: Input,
  boost: boolean,
  energy: number,
  dt: number = 1 / 60
): BoostedInput {
  const curEnergy = Number.isFinite(energy) ? Math.max(0, Math.min(1, energy)) : 0;
  const stepDt = Number.isFinite(dt) && dt > 0 ? dt : 1 / 60;
  const rawThrottle = Number.isFinite(input.throttle)
    ? Math.max(-1, Math.min(1, input.throttle))
    : 0;
  const rawSteer = Number.isFinite(input.steer)
    ? Math.max(-1, Math.min(1, input.steer))
    : 0;
  const brake = Boolean(input.brake);

  const canBoost = Boolean(boost) && curEnergy > 1e-4 && Math.abs(rawThrottle) > 0.01 && !brake;
  if (canBoost) {
    const nextEnergy = Math.max(0, curEnergy - BOOST_DRAIN_RATE * stepDt);
    return {
      throttle: rawThrottle * BOOST_THROTTLE_SCALE,
      steer: rawSteer,
      brake: false,
      energy: nextEnergy,
      boosting: true,
      boostScale: BOOST_THROTTLE_SCALE,
    };
  }

  const nextEnergy = boost
    ? curEnergy
    : Math.min(1, curEnergy + BOOST_RECHARGE_RATE * stepDt);
  return {
    throttle: rawThrottle,
    steer: rawSteer,
    brake,
    energy: nextEnergy,
    boosting: false,
    boostScale: 1,
  };
}

// ----------------------------------------------------------------------------
// 2. Tire Tracks (built on @hm/decals)
// ----------------------------------------------------------------------------

const TREAD_DECAL_DEF: DecalDef = {
  id: 'rover-tread',
  cell: 0,
  frames: 1,
  fps: 0,
  size: 0.42,
  fade: 0.25,
};

export interface TireTrackMark {
  readonly decal: Decal;
  readonly width: number;
  readonly yaw: number;
  age: number;
  opacity: number;
}

export interface TireTracksOptions {
  readonly scene?: THREE.Scene;
  readonly heightAt?: (x: number, z: number) => number;
  readonly heights?: Heights;
  readonly maxMarks?: number;
  readonly maxAge?: number;
}

export interface TireTracks {
  add(
    wheelPos: { readonly x: number; readonly y?: number; readonly z: number },
    normal:
      | { readonly x: number; readonly y: number; readonly z: number }
      | readonly [number, number, number],
    width: number,
    yaw: number
  ): void;
  update(dt: number): void;
  count(): number;
  marks(): readonly TireTrackMark[];
  dispose(): void;
}

function makeLocalHeights(
  x: number,
  z: number,
  fallbackY: number,
  heightAt?: (x: number, z: number) => number
): Heights {
  const cell = 0.5;
  const originX = x - cell;
  const originZ = z - cell;
  const heights = new Float32Array(9);
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      const wx = originX + c * cell;
      const wz = originZ + r * cell;
      heights[r * 3 + c] = heightAt ? heightAt(wx, wz) : fallbackY;
    }
  }
  return { cols: 3, rows: 3, cell, originX, originZ, heights };
}

export function tireTracks(o: TireTracksOptions = {}): TireTracks {
  const maxMarks = Math.max(8, Math.floor(o.maxMarks ?? 128));
  const maxAge = o.maxAge && o.maxAge > 0.5 ? o.maxAge : 12;
  const ring: TireTrackMark[] = [];
  let seedSeq = 1;

  const positions = new Float32Array(maxMarks * 4 * 3);
  const colors = new Float32Array(maxMarks * 4 * 3);
  const indices = new Uint32Array(maxMarks * 6);
  for (let i = 0; i < maxMarks; i++) {
    const v = i * 4;
    const k = i * 6;
    indices[k] = v;
    indices[k + 1] = v + 1;
    indices[k + 2] = v + 2;
    indices[k + 3] = v;
    indices[k + 4] = v + 2;
    indices[k + 5] = v + 3;
  }

  const geom = new THREE.BufferGeometry();
  const posAttr = new THREE.BufferAttribute(positions, 3);
  const colAttr = new THREE.BufferAttribute(colors, 3);
  geom.setAttribute('position', posAttr);
  geom.setAttribute('color', colAttr);
  geom.setIndex(new THREE.BufferAttribute(indices, 1));

  const mat = new THREE.MeshBasicMaterial({
    color: 0x1e242b,
    vertexColors: true,
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
    side: THREE.DoubleSide,
  });

  const mesh = new THREE.Mesh(geom, mat);
  mesh.name = 'rover-tire-tracks';
  mesh.frustumCulled = false;
  if (o.scene) o.scene.add(mesh);

  const syncBuffer = (): void => {
    for (let i = 0; i < maxMarks; i++) {
      const m = ring[i];
      const base = i * 12;
      if (!m) {
        for (let j = 0; j < 12; j++) {
          positions[base + j] = 0;
          colors[base + j] = 0;
        }
        continue;
      }
      const quad = corners(m.decal);
      const shade = m.opacity;
      for (let c = 0; c < 4; c++) {
        const pt = quad[c]!;
        positions[base + c * 3] = pt[0];
        positions[base + c * 3 + 1] = pt[1];
        positions[base + c * 3 + 2] = pt[2];
        colors[base + c * 3] = shade;
        colors[base + c * 3 + 1] = shade;
        colors[base + c * 3 + 2] = shade;
      }
    }
    posAttr.needsUpdate = true;
    colAttr.needsUpdate = true;
  };

  return {
    add(wheelPos, normal, width, yaw) {
      const hGrid =
        o.heights ?? makeLocalHeights(wheelPos.x, wheelPos.z, wheelPos.y ?? 0, o.heightAt);
      const def: DecalDef = {
        ...TREAD_DECAL_DEF,
        size: Math.max(0.18, width),
      };
      const rotDeg = ((Number.isFinite(yaw) ? yaw : 0) * 180) / Math.PI;
      const placed = onGround(hGrid, wheelPos.x, wheelPos.z, def, rotDeg, seedSeq++);

      const nVec: DecalVec3 = Array.isArray(normal)
        ? [normal[0], normal[1], normal[2]]
        : [
            (normal as { readonly x: number }).x,
            (normal as { readonly y: number }).y,
            (normal as { readonly z: number }).z,
          ];
      const len = Math.hypot(nVec[0], nVec[1], nVec[2]) || 1;
      const decal: Decal = {
        ...placed,
        normal: [nVec[0] / len, nVec[1] / len, nVec[2] / len],
      };

      if (ring.length >= maxMarks) {
        ring.shift();
      }
      const edgeAlpha = alphaAt(def, 0.5, 0.5);
      ring.push({
        decal,
        width: def.size,
        yaw,
        age: 0,
        opacity: edgeAlpha,
      });
      syncBuffer();
    },
    update(dt) {
      if (!(dt > 0)) return;
      for (let i = ring.length - 1; i >= 0; i--) {
        const m = ring[i]!;
        m.age += dt;
        if (m.age >= maxAge) {
          ring.splice(i, 1);
        } else {
          const u = 0.5 * (1 - m.age / maxAge);
          m.opacity = Math.max(0, 1 - m.age / maxAge) * alphaAt(TREAD_DECAL_DEF, Math.max(0.05, u), 0.5);
        }
      }
      syncBuffer();
    },
    count: () => ring.length,
    marks: () => ring,
    dispose() {
      mesh.removeFromParent();
      geom.dispose();
      mat.dispose();
      ring.length = 0;
    },
  };
}

// ----------------------------------------------------------------------------
// 3. Wheel Roost Dust (built on @hm/particles)
// ----------------------------------------------------------------------------

const WHEEL_ROOST_SPEC: EmitterSpec = {
  id: 'wheel-roost',
  name: 'Wheel Roost Dust',
  rate: 0,
  burst: 6,
  duration: 0.05,
  life: [0.35, 0.85],
  speed: [1.2, 3.4],
  dir: [0, 1, 0],
  spread: 65,
  gravity: -3.2,
  drag: 0.65,
  size: [0.14, 0.42],
  colors: ['#a08a6a', '#7a6852', '#594c3c'],
  alpha: [0.65, 0],
  area: [0.16, 0.05, 0.16],
  additive: false,
};

export interface WheelRoostOptions {
  readonly scene?: THREE.Scene;
  readonly maxParticles?: number;
  readonly seed?: number;
}

export interface WheelRoost {
  emit(
    wheelPos: { readonly x: number; readonly y: number; readonly z: number },
    speed: number,
    slip: number,
    dt?: number
  ): void;
  update(dt: number): void;
  count(): number;
  dispose(): void;
}

export function wheelRoost(o: WheelRoostOptions = {}): WheelRoost {
  const maxP = Math.max(16, Math.floor(o.maxParticles ?? 160));
  const sys = new HmParticleSystem(maxP);
  let seedSeq = (o.seed ?? 701) | 0;

  const posArr = new Float32Array(maxP * 3);
  const colArr = new Float32Array(maxP * 3);
  const geom = new THREE.BufferGeometry();
  const posAttr = new THREE.BufferAttribute(posArr, 3);
  const colAttr = new THREE.BufferAttribute(colArr, 3);
  geom.setAttribute('position', posAttr);
  geom.setAttribute('color', colAttr);

  const mat = new THREE.PointsMaterial({
    size: 0.24,
    vertexColors: true,
    transparent: true,
    opacity: 0.72,
    depthWrite: false,
  });
  const points = new THREE.Points(geom, mat);
  points.name = 'wheel-roost-dust';
  points.frustumCulled = false;
  if (o.scene) o.scene.add(points);

  const syncPoints = (): void => {
    const live = sys.count;
    const buf = sys.buffer;
    for (let i = 0; i < maxP; i++) {
      if (i < live) {
        const off = i * STRIDE;
        const a = buf[off + 7] ?? 1;
        posArr[i * 3] = buf[off] ?? 0;
        posArr[i * 3 + 1] = buf[off + 1] ?? 0;
        posArr[i * 3 + 2] = buf[off + 2] ?? 0;
        colArr[i * 3] = (buf[off + 4] ?? 0.6) * a;
        colArr[i * 3 + 1] = (buf[off + 5] ?? 0.5) * a;
        colArr[i * 3 + 2] = (buf[off + 6] ?? 0.4) * a;
      } else {
        posArr[i * 3] = 0;
        posArr[i * 3 + 1] = -9999;
        posArr[i * 3 + 2] = 0;
      }
    }
    posAttr.needsUpdate = true;
    colAttr.needsUpdate = true;
  };

  return {
    emit(wheelPos, speed, slip) {
      const spd = Math.abs(Number.isFinite(speed) ? speed : 0);
      const slp = Math.abs(Number.isFinite(slip) ? slip : 0);
      if (spd < 1.2 && slp < 0.15) return;
      const intensity = Math.min(2.5, spd / 8 + slp * 1.5);
      const burstCount = Math.max(1, Math.min(12, Math.round(4 * intensity)));
      const spec: EmitterSpec = {
        ...WHEEL_ROOST_SPEC,
        burst: burstCount,
        speed: [0.8 * intensity, 2.2 * intensity],
      };
      sys.spawn(spec, [wheelPos.x, wheelPos.y + 0.08, wheelPos.z], seedSeq++);
      syncPoints();
    },
    update(dt) {
      if (!(dt > 0)) return;
      sys.step(dt);
      syncPoints();
    },
    count: () => sys.count,
    dispose() {
      points.removeFromParent();
      geom.dispose();
      mat.dispose();
    },
  };
}

// ----------------------------------------------------------------------------
// 4. Fabricator Print Gantry (printGantry)
// ----------------------------------------------------------------------------

export interface PrintGantry {
  readonly group: THREE.Group;
  play(onDone?: () => void): void;
  update(dt: number): void;
  isPlaying(): boolean;
  progress(): number;
  dispose(): void;
}

export function printGantry(at: {
  readonly x: number;
  readonly y?: number;
  readonly z: number;
  readonly scene?: THREE.Scene;
  readonly duration?: number;
}): PrintGantry {
  const duration = at.duration && at.duration > 0.1 ? at.duration : 1.6;
  const group = new THREE.Group();
  group.name = 'fabricator-print-gantry';
  group.position.set(at.x, at.y ?? 0, at.z);

  const frameMat = new THREE.MeshStandardMaterial({
    color: 0x242a34,
    roughness: 0.55,
    metalness: 0.48,
  });
  const laserMat = new THREE.MeshBasicMaterial({
    color: 0x3dc8ff,
    transparent: true,
    opacity: 0.68,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });

  // Moving square-section gantry bridge (two vertical uprights + top crossbar + scan curtain)
  const bridge = new THREE.Group();
  bridge.name = 'gantry-bridge';

  const leftPost = new THREE.Mesh(new THREE.BoxGeometry(0.16, 3.4, 0.16), frameMat);
  leftPost.position.set(-2.3, 1.7, 0);
  const rightPost = new THREE.Mesh(new THREE.BoxGeometry(0.16, 3.4, 0.16), frameMat);
  rightPost.position.set(2.3, 1.7, 0);
  const topBeam = new THREE.Mesh(new THREE.BoxGeometry(4.76, 0.18, 0.22), frameMat);
  topBeam.position.set(0, 3.4, 0);
  const scanSheet = new THREE.Mesh(new THREE.BoxGeometry(4.4, 3.2, 0.04), laserMat);
  scanSheet.position.set(0, 1.65, 0);

  bridge.add(leftPost, rightPost, topBeam, scanSheet);
  group.add(bridge);
  group.visible = false;

  if (at.scene) at.scene.add(group);

  let playing = false;
  let elapsed = 0;
  let doneCb: (() => void) | undefined;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const stepGantry = (dt: number): void => {
    if (!playing) return;
    elapsed += dt;
    const u = Math.min(1, elapsed / duration);
    bridge.position.z = -2.6 + 5.2 * u;
    laserMat.opacity = 0.45 + 0.35 * Math.sin(u * Math.PI);

    if (u >= 1) {
      playing = false;
      group.visible = false;
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      const cb = doneCb;
      doneCb = undefined;
      cb?.();
    }
  };

  return {
    group,
    play(onDone) {
      if (timer) clearTimeout(timer);
      playing = true;
      elapsed = 0;
      doneCb = onDone;
      bridge.position.z = -2.6;
      group.visible = true;
      // Fallback completion timer if caller does not step update(dt) each frame
      timer = setTimeout(() => {
        if (playing) stepGantry(duration);
      }, Math.round(duration * 1000));
    },
    update(dt) {
      if (dt > 0) stepGantry(dt);
    },
    isPlaying: () => playing,
    progress: () => (playing ? Math.min(1, elapsed / duration) : elapsed >= duration ? 1 : 0),
    dispose() {
      if (timer) clearTimeout(timer);
      playing = false;
      group.removeFromParent();
      group.traverse((obj) => {
        const m = obj as THREE.Mesh;
        if (m.isMesh) m.geometry?.dispose();
      });
      frameMat.dispose();
      laserMat.dispose();
    },
  };
}
