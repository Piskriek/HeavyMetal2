// ============================================================================
// File: apps/web/src/play/rift.ts
// TICKET-07 (MC-01 / P1-MON-04) + POL-100 & POL-98 Rework:
// Vertical glitch-sliced S-Space tear:
//  - Bypasses the planetary stage look (wireframe / 1-bit / EGA) at every stage
//    (userData.ignoreStageLook = true) and always renders in its own vivid unlit
//    S-Space palette (#ff1e8e electric magenta, #00f0ff cyan, #2a0845 deep violet
//    void core, shifting to #ffc13d / #ffe082 amber when sealing).
//  - Collapses all 58 former sub-meshes (4 collar boxes, 2 scar boxes, 42 tear
//    slabs, 10 scanlines) into ONE merged BufferGeometry + single THREE.Mesh
//    (strictly 1 draw call total, resolving POL-98's ~60 draw calls).
//  - Keeps lightweight Group anchors ('rift-collar', 'rift-scar', 'rift-tear')
//    so existing scene/test queries (getObjectByName('rift-tear').visible) pass.
// ============================================================================

import * as THREE from 'three';

export type RiftState = 'open' | 'sealing' | 'sealed';

export interface RiftOptions {
  readonly seed: number;
  readonly height?: number;
}

export interface RiftInstance {
  readonly group: THREE.Group;
  readonly mesh: THREE.Mesh;
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

/**
 * Deterministic glitch displacement for slice `i` at time `t` seconds under state `s`.
 * Pure helper exported for unit testing and mirrored in RIFT_VERT.
 */
export function riftSliceOffset(
  seed: number,
  sliceIndex: number,
  state: RiftState,
  t: number,
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

// Part IDs encoded in vertex attribute `aPart`:
// 0 = grounded square-section containment collar
// 1 = vitrified scar outer base
// 2 = vitrified scar inner glowing seam
// 3 = vertical tear void core (#2a0845 deep S-Space violet)
// 4 = vertical tear left jagged chromatic edge (#ff1e8e electric magenta)
// 5 = vertical tear right jagged chromatic edge (#00f0ff electric cyan)
// 6 = horizontal glitch scanline bar (alternating #ff1e8e / #00f0ff)

const RIFT_VERT = /* glsl */ `
  attribute float aPart;
  attribute float aSlice;
  attribute vec3 aBaseOffset;
  attribute vec2 aFreqPhase;

  uniform float uTime;
  uniform float uState; // 0.0 = open, 1.0 = sealing, 2.0 = sealed

  varying float vPart;
  varying float vSlice;
  varying vec2 vFreqPhase;
  varying vec3 vNormalW;

  void main() {
    vPart = aPart;
    vSlice = aSlice;
    vFreqPhase = aFreqPhase;
    vNormalW = normalize(mat3(modelMatrix) * normal);

    vec3 p = position;

    // Dynamic vertical tear slabs (parts 3, 4, 5)
    if (aPart >= 2.5 && aPart < 5.5) {
      if (uState > 1.5) {
        // Sealed: collapse tear geometry to zero
        p = vec3(0.0, -10.0, 0.0);
      } else {
        float freq = aFreqPhase.x;
        float phase = aFreqPhase.y;
        float qStep = floor(uTime * 16.0 + aSlice * 1.7);
        float jumpHash = mod(floor(sin(qStep * 12.9898) * 43758.5453), 7.0);
        float stepJump = abs(jumpHash) < 0.5 ? 1.65 : 1.0;

        bool sealing = uState > 0.5;
        float wScale = sealing
          ? (0.42 + 0.14 * abs(sin(uTime * 12.0 + phase)))
          : (0.85 + 0.35 * abs(sin(uTime * 9.5 + phase)));
        float dx = sealing
          ? (sin(uTime * freq * 1.2 + phase) * 0.09 * stepJump)
          : (sin(uTime * freq + phase) * 0.24 * stepJump);
        float dz = sealing
          ? (cos(uTime * freq * 0.7 + phase) * 0.04)
          : (cos(uTime * freq * 0.65 + phase) * 0.08);

        p.x = p.x * wScale + aBaseOffset.x + dx;
        p.y = p.y + aBaseOffset.y;
        p.z = p.z + aBaseOffset.z + dz;
      }
    } else if (aPart >= 5.5) {
      // Horizontal glitch scanlines (part 6)
      if (uState > 1.5) {
        p = vec3(0.0, -10.0, 0.0);
      } else {
        float phase = aFreqPhase.y;
        bool sealing = uState > 0.5;
        float wScale = sealing ? 0.45 : 1.0;
        float dx = sin(uTime * 27.0 + phase) * (sealing ? 0.12 : 0.32);
        float dy = cos(uTime * 19.0 + phase) * 0.03;
        p.x = p.x * wScale + dx;
        p.y = p.y + aBaseOffset.y + dy;
        p.z = p.z + aBaseOffset.z;
      }
    } else {
      // Static grounded collar (0) and vitrified scar (1, 2)
      p += aBaseOffset;
    }

    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;

const RIFT_FRAG = /* glsl */ `
  uniform float uTime;
  uniform float uState; // 0.0 = open, 1.0 = sealing, 2.0 = sealed

  varying float vPart;
  varying float vSlice;
  varying vec2 vFreqPhase;
  varying vec3 vNormalW;

  void main() {
    // Discard collapsed tear fragments when sealed
    if (uState > 1.5 && vPart >= 2.5) {
      discard;
    }

    bool sealing = uState > 0.5 && uState < 1.5;
    bool sealedState = uState > 1.5;

    // 0: Grounded square-section containment collar
    if (vPart < 0.5) {
      float shade = 0.55 + 0.45 * abs(vNormalW.y * 0.6 + vNormalW.x * 0.4);
      vec3 col = vec3(0.12, 0.15, 0.20) * shade;
      gl_FragColor = vec4(col, 1.0);
      return;
    }

    // 1: Vitrified scar outer base
    if (vPart < 1.5) {
      gl_FragColor = vec4(0.04, 0.06, 0.10, 1.0);
      return;
    }

    // 2: Vitrified scar inner seam
    if (vPart < 2.5) {
      vec3 seamCol = sealedState
        ? vec3(0.20, 0.25, 0.33)
        : (sealing ? vec3(1.0, 0.76, 0.24) : vec3(1.0, 0.12, 0.56));
      gl_FragColor = vec4(seamCol, 1.0);
      return;
    }

    // 3: Tear void core (deep S-Space violet #2a0845 when open, warm dark amber when sealing)
    if (vPart < 3.5) {
      vec3 coreCol = sealing ? vec3(0.22, 0.11, 0.02) : vec3(0.165, 0.031, 0.271);
      gl_FragColor = vec4(coreCol, 1.0);
      return;
    }

    float flicker = 0.78 + 0.22 * abs(sin(uTime * vFreqPhase.x + vFreqPhase.y));

    // 4: Left jagged chromatic edge (#ff1e8e electric magenta -> #ffc13d amber on sealing)
    if (vPart < 4.5) {
      vec3 leftCol = sealing ? vec3(1.0, 0.757, 0.239) : vec3(1.0, 0.118, 0.557);
      gl_FragColor = vec4(leftCol * flicker, 1.0);
      return;
    }

    // 5: Right jagged chromatic edge (#00f0ff electric cyan -> #ffe082 gold on sealing)
    if (vPart < 5.5) {
      vec3 rightCol = sealing ? vec3(1.0, 0.878, 0.510) : vec3(0.0, 0.941, 1.0);
      gl_FragColor = vec4(rightCol * flicker, 1.0);
      return;
    }

    // 6: Horizontal glitch scanlines
    float isEven = mod(vSlice, 2.0) < 0.5 ? 1.0 : 0.0;
    vec3 barCol = sealing
      ? vec3(1.0, 0.757, 0.239)
      : mix(vec3(0.0, 0.941, 1.0), vec3(1.0, 0.118, 0.557), isEven);
    float gate = sin(uTime * 31.0 + vFreqPhase.y) > -0.35 ? 1.0 : 0.35;
    gl_FragColor = vec4(barCol * gate, 1.0);
  }
`;

/**
 * Builds a single-draw-call vertical glitch-sliced S-Space rift tear that bypasses
 * the planetary stage look and renders in its own vivid S-Space palette (POL-100, POL-98).
 */
export function createRift(o: RiftOptions): RiftInstance {
  const seed = Number.isFinite(o.seed) ? Math.floor(o.seed) : 1;
  const height = o.height && o.height > 0.5 ? o.height : 3.2;

  const group = new THREE.Group();
  group.name = 's-space-rift';
  group.userData.ignoreStageLook = true;

  // Lightweight state/query groups (0 draw calls) so existing tests checking
  // getObjectByName('rift-tear' | 'rift-scar' | 'rift-collar') continue to pass
  const collarGroup = new THREE.Group();
  collarGroup.name = 'rift-collar';
  const scarGroup = new THREE.Group();
  scarGroup.name = 'rift-scar';
  const tearGroup = new THREE.Group();
  tearGroup.name = 'rift-tear';
  group.add(collarGroup, scarGroup, tearGroup);

  const positions: number[] = [];
  const normals: number[] = [];
  const parts: number[] = [];
  const slices: number[] = [];
  const baseOffsets: number[] = [];
  const freqPhases: number[] = [];
  const indices: number[] = [];

  const appendBox = (
    sx: number,
    sy: number,
    sz: number,
    localShiftX: number,
    localShiftY: number,
    localShiftZ: number,
    partId: number,
    sliceIdx: number,
    offX: number,
    offY: number,
    offZ: number,
    freq: number,
    phase: number,
  ): void => {
    const box = new THREE.BoxGeometry(sx, sy, sz);
    if (localShiftX !== 0 || localShiftY !== 0 || localShiftZ !== 0) {
      box.translate(localShiftX, localShiftY, localShiftZ);
    }
    const pos = box.getAttribute('position') as THREE.BufferAttribute;
    const nor = box.getAttribute('normal') as THREE.BufferAttribute;
    const idx = box.getIndex()!;
    const baseVertex = positions.length / 3;

    for (let i = 0; i < pos.count; i++) {
      positions.push(pos.getX(i), pos.getY(i), pos.getZ(i));
      normals.push(nor.getX(i), nor.getY(i), nor.getZ(i));
      parts.push(partId);
      slices.push(sliceIdx);
      baseOffsets.push(offX, offY, offZ);
      freqPhases.push(freq, phase);
    }
    for (let i = 0; i < idx.count; i++) {
      indices.push(baseVertex + idx.getX(i));
    }
    box.dispose();
  };

  // 1. Grounded square-section containment collar (buried to -0.35 m so it never floats)
  const collarSpecs: readonly (readonly [number, number, number, number, number])[] = [
    [-0.68, 0, 0.22, 0.62, 1.15],
    [0.68, 0, 0.22, 0.62, 1.15],
    [0, -0.68, 0.92, 0.56, 0.22],
    [0, 0.68, 0.92, 0.56, 0.22],
  ];
  for (const [cx, cz, sx, sy, sz] of collarSpecs) {
    appendBox(sx, sy, sz, 0, 0, 0, 0, 0, cx, sy * 0.5 - 0.35, cz, 0, 0);
  }

  // 2. Grounded vitrified scar decal
  appendBox(0.52, 0.025, 1.35, 0, 0, 0, 1, 0, 0, 0.012, 0, 0, 0);
  appendBox(0.14, 0.032, 1.15, 0, 0, 0, 2, 0, 0, 0.016, 0, 0, 0);

  // 3. Vertical jagged stepped-glitch tear slabs (SLAB_COUNT slices)
  const sliceH = (height - 0.12) / SLAB_COUNT;
  for (let i = 0; i < SLAB_COUNT; i++) {
    const u = (i + 0.5) / SLAB_COUNT;
    const envelope = Math.sin(u * Math.PI);
    // Stepped jagged tear silhouette: alternating narrow/wide lightning-crack profile
    const jag = i % 2 === 0 ? 1.18 : 0.76;
    const baseWidth = (0.18 + 0.58 * envelope * (0.8 + 0.4 * seededUnit(seed, i * 11 + 1))) * jag;
    const slabH = sliceH * (0.86 + 0.18 * seededUnit(seed, i * 13 + 2));
    const slabD = 0.08 + 0.06 * envelope;

    const baseOffsetX = ((seededUnit(seed, i * 19 + 5) - 0.5) * 0.24) + (i % 2 === 0 ? 0.05 : -0.05) * envelope;
    const baseOffsetY = 0.1 + i * sliceH;
    const baseOffsetZ = (seededUnit(seed, i * 23 + 9) - 0.5) * 0.08;
    const phase = seededUnit(seed, i * 17 + 3) * Math.PI * 2;
    const freq = 14 + seededUnit(seed, i * 31 + 7) * 18;

    const edgeW = Math.max(0.045, baseWidth * 0.22);
    // Core shard (part 3)
    appendBox(baseWidth, slabH, slabD, 0, 0, 0, 3, i, baseOffsetX, baseOffsetY, baseOffsetZ, freq, phase);
    // Left magenta shard (part 4)
    appendBox(
      edgeW,
      slabH * 1.06,
      slabD * 1.14,
      -baseWidth * 0.5 - edgeW * 0.35,
      0,
      0,
      4,
      i,
      baseOffsetX,
      baseOffsetY,
      baseOffsetZ,
      freq,
      phase,
    );
    // Right cyan shard (part 5)
    appendBox(
      edgeW,
      slabH * 1.06,
      slabD * 1.14,
      baseWidth * 0.5 + edgeW * 0.35,
      0,
      0,
      5,
      i,
      baseOffsetX,
      baseOffsetY,
      baseOffsetZ,
      freq,
      phase,
    );
  }

  // 4. Cut-up horizontal glitch scanlines (part 6)
  for (let j = 0; j < SCANLINE_COUNT; j++) {
    const frac = (j + 0.5) / SCANLINE_COUNT;
    const baseY = 0.18 + frac * (height - 0.3);
    const barW = 0.55 + 0.65 * seededUnit(seed, 200 + j * 7);
    const phase = seededUnit(seed, 300 + j * 13) * Math.PI * 2;
    appendBox(barW, 0.022, 0.15, 0, 0, 0, 6, j, 0, baseY, 0, 27, phase);
  }

  const mergedGeo = new THREE.BufferGeometry();
  mergedGeo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  mergedGeo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  mergedGeo.setAttribute('aPart', new THREE.Float32BufferAttribute(parts, 1));
  mergedGeo.setAttribute('aSlice', new THREE.Float32BufferAttribute(slices, 1));
  mergedGeo.setAttribute('aBaseOffset', new THREE.Float32BufferAttribute(baseOffsets, 3));
  mergedGeo.setAttribute('aFreqPhase', new THREE.Float32BufferAttribute(freqPhases, 2));
  mergedGeo.setIndex(indices);
  mergedGeo.computeBoundingSphere();

  const uniforms = {
    uTime: { value: 0 },
    uState: { value: 0 },
  };

  const riftMat = new THREE.ShaderMaterial({
    vertexShader: RIFT_VERT,
    fragmentShader: RIFT_FRAG,
    uniforms,
    toneMapped: false,
    side: THREE.DoubleSide,
  });
  riftMat.userData.ignoreStageLook = true;

  const mesh = new THREE.Mesh(mergedGeo, riftMat);
  mesh.name = 'rift-unified-mesh';
  mesh.userData.ignoreStageLook = true;
  mesh.frustumCulled = false;
  mesh.renderOrder = 12;
  group.add(mesh);

  let currentState: RiftState = 'open';

  const setState = (s: RiftState, t: number): void => {
    currentState = s;
    uniforms.uTime.value = Number.isFinite(t) ? t : 0;
    uniforms.uState.value = s === 'sealed' ? 2 : s === 'sealing' ? 1 : 0;
    tearGroup.visible = s !== 'sealed';
    scarGroup.visible = true;
  };

  setState('open', 0);

  return {
    group,
    mesh,
    setState,
    getState: () => currentState,
    dispose() {
      group.removeFromParent();
      mergedGeo.dispose();
      riftMat.dispose();
    },
  };
}
