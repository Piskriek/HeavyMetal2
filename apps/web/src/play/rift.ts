// ============================================================================
// File: apps/web/src/play/rift.ts
// TICKET-07 (OPUS_NOTE_14 Item A — MC-01 / P1-MON-04 / DEC-02):
// Vertical glitch-sliced S-Space tear replacing the cylinder/ring leak marker:
//  - Grounded square-section containment collar (buried base, zero round tubes)
//  - Stacked horizontal offset glitch slabs with dark void core & chromatic edges
//  - Cut-up horizontal scanline bars & deterministic high-frequency flicker
//  - States: 'open' (violent chromatic tear), 'sealing' (turns amber & narrows),
//    'sealed' (collapses tear and leaves a grounded vitrified scar decal)
// ============================================================================

import * as THREE from 'three';

export type RiftState = 'open' | 'sealing' | 'sealed';

export interface RiftOptions {
  readonly seed: number;
  readonly height?: number;
}

export interface RiftInstance {
  readonly group: THREE.Group;
  setState(s: RiftState, t: number): void;
  getState(): RiftState;
  dispose(): void;
}

const SLAB_COUNT = 14;
const SCANLINE_COUNT = 10;

function seededUnit(seed: number, index: number): number {
  let h = (Math.imul(seed | 0, 374761393) ^ Math.imul(index | 0, 668265263) ^ 0x5bf03635) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  h = (h ^ (h >>> 16)) >>> 0;
  return h / 4294967296;
}

interface SlabEntry {
  readonly row: THREE.Group;
  readonly coreMat: THREE.MeshBasicMaterial;
  readonly leftEdgeMat: THREE.MeshBasicMaterial;
  readonly rightEdgeMat: THREE.MeshBasicMaterial;
  readonly baseOffsetX: number;
  readonly baseOffsetZ: number;
  readonly baseWidth: number;
  readonly phase: number;
  readonly freq: number;
}

interface ScanlineEntry {
  readonly mesh: THREE.Mesh;
  readonly mat: THREE.MeshBasicMaterial;
  readonly baseY: number;
  readonly phase: number;
}

/**
 * Deterministic glitch displacement for slice `i` at time `t` seconds under state `s`.
 * Pure helper exported for unit testing.
 */
export function riftSliceOffset(
  seed: number,
  sliceIndex: number,
  state: RiftState,
  t: number
): { readonly dx: number; readonly dz: number; readonly widthScale: number; readonly amberMix: number } {
  if (state === 'sealed') {
    return { dx: 0, dz: 0, widthScale: 0, amberMix: 1 };
  }
  const time = Number.isFinite(t) ? t : 0;
  const phase = seededUnit(seed, sliceIndex * 17 + 3) * Math.PI * 2;
  const freq = 14 + seededUnit(seed, sliceIndex * 31 + 7) * 18;
  const quantStep = Math.floor(time * 16 + sliceIndex * 1.7);
  const stepJump = ((Math.imul(quantStep, 1103515245) + 12345) >>> 16) % 7 === 0 ? 1.65 : 1.0;

  if (state === 'sealing') {
    const dx = Math.sin(time * freq * 1.2 + phase) * 0.09 * stepJump;
    const dz = Math.cos(time * (freq * 0.7) + phase) * 0.04;
    const widthScale = 0.42 + 0.14 * Math.abs(Math.sin(time * 12 + phase));
    return { dx, dz, widthScale, amberMix: 1 };
  }

  // 'open': violent lateral glitch-slicing
  const dx = Math.sin(time * freq + phase) * 0.24 * stepJump;
  const dz = Math.cos(time * (freq * 0.65) + phase) * 0.08;
  const widthScale = 0.85 + 0.35 * Math.abs(Math.sin(time * 9.5 + phase));
  return { dx, dz, widthScale, amberMix: 0 };
}

/**
 * Builds a vertical glitch-sliced S-Space rift tear with a grounded square-section frame
 * and a vitrified scar decal when sealed.
 */
export function createRift(o: RiftOptions): RiftInstance {
  const seed = Number.isFinite(o.seed) ? Math.floor(o.seed) : 1;
  const height = o.height && o.height > 0.5 ? o.height : 3.2;

  const group = new THREE.Group();
  group.name = 's-space-rift';

  const geometries: THREE.BufferGeometry[] = [];
  const materials: THREE.Material[] = [];
  const trackGeo = <T extends THREE.BufferGeometry>(g: T): T => {
    geometries.push(g);
    return g;
  };
  const trackMat = <T extends THREE.Material>(m: T): T => {
    materials.push(m);
    return m;
  };

  // 1. Grounded square-section containment collar (partly buried to -0.35 m so it never floats)
  const collarGroup = new THREE.Group();
  collarGroup.name = 'rift-collar';
  const collarMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x1e2530,
      roughness: 0.68,
      metalness: 0.42,
    })
  );
  const collarPositions: readonly (readonly [number, number, number, number, number])[] = [
    [-0.68, 0, 0.22, 0.62, 1.15],
    [0.68, 0, 0.22, 0.62, 1.15],
    [0, -0.68, 0.92, 0.56, 0.22],
    [0, 0.68, 0.92, 0.56, 0.22],
  ];
  for (const [cx, cz, sx, sy, sz] of collarPositions) {
    const g = trackGeo(new THREE.BoxGeometry(sx, sy, sz));
    g.translate(cx, sy * 0.5 - 0.35, cz);
    const mesh = new THREE.Mesh(g, collarMat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    collarGroup.add(mesh);
  }
  group.add(collarGroup);

  // 2. Grounded vitrified scar decal (visible in all states; remains as the sealed scar)
  const scarGroup = new THREE.Group();
  scarGroup.name = 'rift-scar';
  const scarOuterMat = trackMat(
    new THREE.MeshBasicMaterial({
      color: 0x0b0f19,
      transparent: true,
      opacity: 0.88,
      depthWrite: false,
    })
  );
  const scarSeamMat = trackMat(
    new THREE.MeshBasicMaterial({
      color: 0xff3d8a,
      transparent: true,
      opacity: 0.75,
      depthWrite: false,
    })
  );
  const scarOuterGeo = trackGeo(new THREE.BoxGeometry(0.52, 0.025, 1.35));
  scarOuterGeo.translate(0, 0.012, 0);
  const scarSeamGeo = trackGeo(new THREE.BoxGeometry(0.14, 0.032, 1.15));
  scarSeamGeo.translate(0, 0.016, 0);
  scarGroup.add(
    new THREE.Mesh(scarOuterGeo, scarOuterMat),
    new THREE.Mesh(scarSeamGeo, scarSeamMat)
  );
  group.add(scarGroup);

  // 3. Vertical glitch-sliced tear slabs
  const tearGroup = new THREE.Group();
  tearGroup.name = 'rift-tear';
  const slabs: SlabEntry[] = [];
  const sliceH = (height - 0.12) / SLAB_COUNT;

  for (let i = 0; i < SLAB_COUNT; i++) {
    const u = (i + 0.5) / SLAB_COUNT;
    // Diamond/fusiform vertical profile: widest in the middle, narrower at ground & apex
    const envelope = Math.sin(u * Math.PI);
    const baseWidth = 0.22 + 0.62 * envelope * (0.8 + 0.4 * seededUnit(seed, i * 11 + 1));
    const slabH = sliceH * (0.78 + 0.18 * seededUnit(seed, i * 13 + 2));
    const slabD = 0.08 + 0.06 * envelope;

    const row = new THREE.Group();
    row.position.y = 0.1 + i * sliceH;

    const coreMat = trackMat(
      new THREE.MeshBasicMaterial({
        color: 0x05070e,
      })
    );
    const leftEdgeMat = trackMat(
      new THREE.MeshBasicMaterial({
        color: 0xff3d8a,
        transparent: true,
        opacity: 0.92,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    const rightEdgeMat = trackMat(
      new THREE.MeshBasicMaterial({
        color: 0x3dc8ff,
        transparent: true,
        opacity: 0.92,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );

    const coreGeo = trackGeo(new THREE.BoxGeometry(baseWidth, slabH, slabD));
    const edgeW = Math.max(0.04, baseWidth * 0.18);
    const leftGeo = trackGeo(new THREE.BoxGeometry(edgeW, slabH * 1.04, slabD * 1.12));
    leftGeo.translate(-baseWidth * 0.5 - edgeW * 0.35, 0, 0);
    const rightGeo = trackGeo(new THREE.BoxGeometry(edgeW, slabH * 1.04, slabD * 1.12));
    rightGeo.translate(baseWidth * 0.5 + edgeW * 0.35, 0, 0);

    row.add(
      new THREE.Mesh(coreGeo, coreMat),
      new THREE.Mesh(leftGeo, leftEdgeMat),
      new THREE.Mesh(rightGeo, rightEdgeMat)
    );
    tearGroup.add(row);

    const baseOffsetX = (seededUnit(seed, i * 19 + 5) - 0.5) * 0.16;
    const baseOffsetZ = (seededUnit(seed, i * 23 + 9) - 0.5) * 0.08;
    row.position.x = baseOffsetX;
    row.position.z = baseOffsetZ;

    slabs.push({
      row,
      coreMat,
      leftEdgeMat,
      rightEdgeMat,
      baseOffsetX,
      baseOffsetZ,
      baseWidth,
      phase: seededUnit(seed, i * 29 + 4) * Math.PI * 2,
      freq: 14 + seededUnit(seed, i * 37 + 8) * 16,
    });
  }

  // 4. Cut-up horizontal scanlines across the tear
  const scanlines: ScanlineEntry[] = [];
  for (let j = 0; j < SCANLINE_COUNT; j++) {
    const frac = (j + 0.5) / SCANLINE_COUNT;
    const baseY = 0.18 + frac * (height - 0.3);
    const barW = 0.55 + 0.65 * seededUnit(seed, 200 + j * 7);
    const barGeo = trackGeo(new THREE.BoxGeometry(barW, 0.018, 0.14));
    const isMagenta = j % 2 === 0;
    const mat = trackMat(
      new THREE.MeshBasicMaterial({
        color: isMagenta ? 0xff3d8a : 0x3dc8ff,
        transparent: true,
        opacity: 0.85,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    const mesh = new THREE.Mesh(barGeo, mat);
    mesh.position.set(0, baseY, 0);
    tearGroup.add(mesh);
    scanlines.push({
      mesh,
      mat,
      baseY,
      phase: seededUnit(seed, 300 + j * 13) * Math.PI * 2,
    });
  }

  group.add(tearGroup);

  let currentState: RiftState = 'open';

  const setState = (s: RiftState, t: number): void => {
    currentState = s;
    const time = Number.isFinite(t) ? t : 0;

    if (s === 'sealed') {
      tearGroup.visible = false;
      scarSeamMat.color.set(0x334155);
      scarSeamMat.opacity = 0.55;
      return;
    }

    tearGroup.visible = true;
    const isSealing = s === 'sealing';
    scarSeamMat.color.set(isSealing ? 0xffc13d : 0xff3d8a);
    scarSeamMat.opacity = isSealing ? 0.9 : 0.75;

    for (let i = 0; i < slabs.length; i++) {
      const sl = slabs[i]!;
      const step = riftSliceOffset(seed, i, s, time);
      sl.row.position.x = sl.baseOffsetX + step.dx;
      sl.row.position.z = sl.baseOffsetZ + step.dz;
      sl.row.scale.set(step.widthScale, 1, 1);

      if (isSealing) {
        sl.coreMat.color.set(0x2a1804);
        sl.leftEdgeMat.color.set(0xffc13d);
        sl.rightEdgeMat.color.set(0xffe082);
        sl.leftEdgeMat.opacity = 0.95;
        sl.rightEdgeMat.opacity = 0.95;
      } else {
        sl.coreMat.color.set(0x05070e);
        sl.leftEdgeMat.color.set(0xff3d8a);
        sl.rightEdgeMat.color.set(0x3dc8ff);
        const flicker = 0.7 + 0.3 * Math.abs(Math.sin(time * sl.freq + sl.phase));
        sl.leftEdgeMat.opacity = flicker;
        sl.rightEdgeMat.opacity = flicker;
      }
    }

    for (let j = 0; j < scanlines.length; j++) {
      const sc = scanlines[j]!;
      sc.mesh.position.x = Math.sin(time * 27 + sc.phase) * (isSealing ? 0.12 : 0.32);
      sc.mesh.position.y = sc.baseY + Math.cos(time * 19 + sc.phase) * 0.03;
      sc.mesh.scale.x = isSealing ? 0.45 : 1.0;
      sc.mat.color.set(isSealing ? 0xffc13d : j % 2 === 0 ? 0xff3d8a : 0x3dc8ff);
      sc.mat.opacity = Math.sin(time * 31 + sc.phase) > -0.35 ? 0.88 : 0.18;
    }
  };

  setState('open', 0);

  return {
    group,
    setState,
    getState: () => currentState,
    dispose() {
      group.removeFromParent();
      for (const g of geometries) g.dispose();
      for (const m of materials) m.dispose();
    },
  };
}
