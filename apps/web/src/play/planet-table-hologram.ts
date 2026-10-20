// ============================================================================
// File: apps/web/src/play/planet-table-hologram.ts
// TASK-35 / TICKET-16:
// - POL-70: 11-Enclave Planet Table Hologram in the Lab (round 2.4 m table)
// - Window E #1: 11 distant neighbor enclave domes on the 4.2 km lunar horizon
// - Window E #2 & #3: Planet Table [E] Consensus Commit (85%+) -> 12 s Golden-Hour
//   Lab Window Convergence -> CreditsDirector.start() handoff
// ============================================================================

import * as THREE from 'three';
import {
  CONSENSUS_LOCK_THRESHOLD,
  evaluateContinentalConsensus,
  FINALE_WINDOW_HEAL_DURATION_S,
  HORIZON_DOME_DISTANCE_M,
  NEIGHBOR_ENCLAVE_COUNT,
  type FourFloats,
  type HorizonEnclaveSpec,
} from '../../../../packages/questline/src/act789-chain';

export {
  CONSENSUS_LOCK_THRESHOLD,
  evaluateContinentalConsensus,
  FINALE_WINDOW_HEAL_DURATION_S,
  HORIZON_DOME_DISTANCE_M,
  NEIGHBOR_ENCLAVE_COUNT,
  type FourFloats,
  type HorizonEnclaveSpec,
};

export interface FinaleConvergenceFrame {
  readonly active: boolean;
  readonly elapsedSec: number;
  readonly progress0to1: number;
  /** Target storm progress (0..1) to feed into `labRoom.setStorm(progress)`. */
  readonly windowStormHeal0to1: number;
  /** Emissive pulse intensity (1..2.5) for the Planet Table & Twin Gate coils. */
  readonly violetPulseGain: number;
  /** Fires true once at t >= 3.0 s to trigger `A9-03` narration (`act9:finale-handoff`). */
  readonly shouldTriggerEpilogueVoice: boolean;
  /** Fires true once at t >= 12.0 s to hand off to `CreditsDirector.start()`. */
  readonly shouldStartCredits: boolean;
}

/**
 * Pure 12-second Lab Window Reality Convergence evaluator (`A9-02` -> `A9-03` -> `CreditsDirector.start()`).
 * No Date.now(), no Math.random().
 */
export function evaluateFinaleWindowHeal(
  elapsedSec: number,
  initialStormProgress = 0.5,
): FinaleConvergenceFrame {
  const t = Number.isFinite(elapsedSec) ? Math.max(0, elapsedSec) : 0;
  const raw = Math.min(1, t / FINALE_WINDOW_HEAL_DURATION_S);
  // Smoothstep ease across the 12.0 s window heal
  const progress0to1 = Number((raw * raw * (3 - 2 * raw)).toFixed(4));
  const baseStorm = Math.max(0, Math.min(1, initialStormProgress));
  const windowStormHeal0to1 = Number((baseStorm + (1 - baseStorm) * progress0to1).toFixed(4));
  const violetPulseGain = Number((1.0 + 1.2 * Math.sin(progress0to1 * Math.PI) + 0.3 * Math.sin(t * 6.0)).toFixed(3));

  return {
    active: t < FINALE_WINDOW_HEAL_DURATION_S,
    elapsedSec: t,
    progress0to1,
    windowStormHeal0to1,
    violetPulseGain,
    shouldTriggerEpilogueVoice: t >= 3.0,
    shouldStartCredits: t >= FINALE_WINDOW_HEAL_DURATION_S,
  };
}

// ----------------------------------------------------------------------------
// POL-70: 3D Lab Planet Table Hologram (11 Neighbor Enclaves + Player Sector)
// ----------------------------------------------------------------------------

export interface PlanetTableHologram3D {
  readonly group: THREE.Group;
  update(nowSec: number, localS: FourFloats, committed?: boolean): {
    readonly consensusPct: number;
    readonly isReadyToCommit: boolean;
    readonly promptLabel: string;
  };
  dispose(): void;
}

export function createPlanetTableHologram(parent?: THREE.Object3D): PlanetTableHologram3D {
  const group = new THREE.Group();
  group.name = 'planet-table-hologram';
  group.position.set(0, 1.18, 0);
  if (parent) parent.add(group);

  // Wireframe planetary lattice globe
  const globeGeo = new THREE.IcosahedronGeometry(0.42, 2);
  const globeMat = new THREE.MeshBasicMaterial({
    color: 0x3dc8ff,
    wireframe: true,
    transparent: true,
    opacity: 0.42,
  });
  const globeMesh = new THREE.Mesh(globeGeo, globeMat);
  group.add(globeMesh);

  // Equatorial consensus ring
  const ringGeo = new THREE.RingGeometry(0.48, 0.52, 48);
  ringGeo.rotateX(-Math.PI / 2);
  const ringMat = new THREE.MeshBasicMaterial({
    color: 0xffc13d,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.65,
  });
  const ringMesh = new THREE.Mesh(ringGeo, ringMat);
  group.add(ringMesh);

  // 12 enclave beacon nodes (index 0 = player plot at North crown, 1..11 = neighbor enclaves): one instanced mesh with a colour and a
  // scale per node, so the 12 nodes are one draw call (the lab's draw-call budget, TICKET-06)
  const nodeGeo = new THREE.BoxGeometry(0.036, 0.036, 0.036);
  const nodeMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const nodes = new THREE.InstancedMesh(nodeGeo, nodeMat, NEIGHBOR_ENCLAVE_COUNT + 1);
  nodes.name = 'planet-table-enclave-nodes';
  const nodeAt: THREE.Vector3[] = [];
  const nodeDummy = new THREE.Object3D();
  const nodeColour = new THREE.Color();
  const setNode = (i: number, scale: number, colour: THREE.ColorRepresentation): void => {
    nodeDummy.position.copy(nodeAt[i]!);
    nodeDummy.scale.setScalar(scale);
    nodeDummy.updateMatrix();
    nodes.setMatrixAt(i, nodeDummy.matrix);
    nodes.setColorAt(i, nodeColour.set(colour));
  };

  for (let i = 0; i <= NEIGHBOR_ENCLAVE_COUNT; i++) {
    if (i === 0) {
      nodeAt.push(new THREE.Vector3(0, 0.42, 0));
    } else {
      const lat = ((i % 3) - 1) * 0.45;
      const lon = (i * Math.PI * 2) / NEIGHBOR_ENCLAVE_COUNT;
      const r = 0.42 * Math.cos(lat);
      nodeAt.push(new THREE.Vector3(Math.cos(lon) * r, 0.42 * Math.sin(lat), Math.sin(lon) * r));
    }
    // placed at the largest scale a node takes (a lit one, 1.15) for the culling sphere, then at its rest scale
    setNode(i, 1.15, i === 0 ? 0x7cff4d : 0x3dc8ff);
  }
  nodes.computeBoundingSphere();
  for (let i = 0; i <= NEIGHBOR_ENCLAVE_COUNT; i++) setNode(i, 1, i === 0 ? 0x7cff4d : 0x3dc8ff);
  globeMesh.add(nodes);

  return {
    group,
    update(nowSec: number, localS: FourFloats, committed = false) {
      const state = evaluateContinentalConsensus(localS);
      globeMesh.rotation.y = nowSec * 0.35;
      const pulse = 1 + 0.08 * Math.sin(nowSec * 3.2);
      ringMesh.scale.setScalar(pulse);

      const ready = state.isReadyToCommit || committed;
      ringMat.color.setHex(ready ? 0xb46bff : 0xffc13d);
      globeMat.color.setHex(ready ? 0xb46bff : 0x3dc8ff);

      for (let i = 1; i <= NEIGHBOR_ENCLAVE_COUNT; i++) {
        const dome = state.domes[i - 1]!;
        setNode(i, dome.lit ? 1.15 : 0.75, ready ? '#b46bff' : dome.lit ? dome.accentHex : '#3a4659');
      }
      nodes.instanceMatrix.needsUpdate = true;
      if (nodes.instanceColor) nodes.instanceColor.needsUpdate = true;

      const promptLabel = committed
        ? `CONSENSUS LOCKED (${state.consensusPct.toFixed(0)}%) // BRANCH LIVE`
        : ready
          ? `[E] Commit Consensus Branch (${state.consensusPct.toFixed(0)}%)`
          : `Planet Table // Continental Consensus ${state.consensusPct.toFixed(0)}% (Need 85%)`;

      return {
        consensusPct: state.consensusPct,
        isReadyToCommit: ready,
        promptLabel,
      };
    },
    dispose() {
      globeGeo.dispose();
      globeMat.dispose();
      ringGeo.dispose();
      ringMat.dispose();
      nodeGeo.dispose();
      nodeMat.dispose();
      nodes.dispose();
      if (group.parent) group.parent.remove(group);
    },
  };
}

// ----------------------------------------------------------------------------
// Window E #1: 11 Neighbor Enclave Domes on the 4.2 km Lunar Horizon
// ----------------------------------------------------------------------------

export interface HorizonEnclaveDomes3D {
  readonly group: THREE.Group;
  update(nowSec: number, localS: FourFloats, groundHeightAt?: (x: number, z: number) => number): number;
  dispose(): void;
}

export function createHorizonEnclaveDomes(parent?: THREE.Object3D): HorizonEnclaveDomes3D {
  const group = new THREE.Group();
  group.name = 'horizon-enclave-domes';
  if (parent) parent.add(group);

  const domeGeo = new THREE.IcosahedronGeometry(28, 1);
  const spireGeo = new THREE.BoxGeometry(3.5, 95, 3.5);
  spireGeo.translate(0, 47.5, 0);

  const domeMats: THREE.MeshBasicMaterial[] = [];
  const domeGroups: THREE.Group[] = [];

  const initial = evaluateContinentalConsensus({ Pxd: 0, Vtx: 0, Lx: 0, Aq: 0 });
  for (const spec of initial.domes) {
    const g = new THREE.Group();
    g.name = `enclave-dome-${spec.index}`;
    g.position.set(spec.x, 0, spec.z);

    const mat = new THREE.MeshBasicMaterial({
      color: spec.accentHex,
      wireframe: true,
      transparent: true,
      opacity: 0.75,
      fog: false,
    });
    const domeMesh = new THREE.Mesh(domeGeo, mat);
    const spireMesh = new THREE.Mesh(spireGeo, mat);
    g.add(domeMesh, spireMesh);
    group.add(g);

    domeMats.push(mat);
    domeGroups.push(g);
  }

  return {
    group,
    update(nowSec: number, localS: FourFloats, groundHeightAt?: (x: number, z: number) => number) {
      const state = evaluateContinentalConsensus(localS);
      for (let i = 0; i < state.domes.length; i++) {
        const spec = state.domes[i]!;
        const g = domeGroups[i]!;
        const mat = domeMats[i]!;
        const y = groundHeightAt ? groundHeightAt(spec.x, spec.z) : 0;
        g.position.set(spec.x, y, spec.z);
        g.visible = spec.lit;
        mat.color.set(spec.accentHex);
        mat.opacity = spec.lit ? 0.55 + 0.25 * Math.sin(nowSec * 2.0 + i) : 0.0;
      }
      return state.litDomeCount;
    },
    dispose() {
      domeGeo.dispose();
      spireGeo.dispose();
      for (const m of domeMats) m.dispose();
      if (group.parent) group.parent.remove(group);
    },
  };
}
