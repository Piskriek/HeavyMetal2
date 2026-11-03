import * as THREE from 'three';
import type { IRungNode, DensityLevel, SovereignTelemetry } from './RungTypes';

export class Rung4Assembly extends THREE.Group implements IRungNode {
  public readonly rungIndex: number = 4;
  public readonly density: DensityLevel = 'D4';
  public readonly rungName: string = 'Federated Assemblies & Grids';
  public readonly scaleRangeM: readonly [number, number] = [10, 500];

  private readonly energyNodes: THREE.Mesh[] = [];
  private readonly energyConduits: THREE.LineSegments;
  private readonly pulseParticles: THREE.Points;
  private readonly particlePositions: Float32Array;
  private readonly particleProgress: Float32Array;
  private materials: THREE.Material[] = [];

  constructor() {
    super();

    // 1. Grid Nodes (Solar Arrays, Capacitors, Terminals)
    const nodeCoords = [
      { pos: [-25, 0, -20], color: 0xffb84a, label: 'Solar Array Alpha' },
      { pos: [25, 0, -20], color: 0xffb84a, label: 'Solar Array Beta' },
      { pos: [0, 0, -35], color: 0x55c7df, label: 'Capacitor Bank' },
      { pos: [0, 0, 15], color: 0x65d59a, label: 'Fabricator Core' },
    ];

    nodeCoords.forEach((node) => {
      const baseGeo = new THREE.BoxGeometry(6, 1.2, 6);
      const baseMat = new THREE.MeshStandardMaterial({
        color: 0x222a35,
        roughness: 0.4,
        metalness: 0.7,
        transparent: true,
        opacity: 0.95,
      });
      const base = new THREE.Mesh(baseGeo, baseMat);
      base.position.set(node.pos[0], 0.6, node.pos[2]);

      const coreGeo = new THREE.CylinderGeometry(1.8, 1.8, 3.5, 16);
      const coreMat = new THREE.MeshStandardMaterial({
        color: node.color,
        emissive: node.color,
        emissiveIntensity: 0.6,
        roughness: 0.2,
        transparent: true,
        opacity: 0.9,
      });
      const core = new THREE.Mesh(coreGeo, coreMat);
      core.position.y = 2.0;
      base.add(core);

      this.add(base);
      this.energyNodes.push(core);
      this.materials.push(baseMat, coreMat);
    });

    // 2. Wiregraph Inter-Node Conduits
    const linePositions: number[] = [];
    const conduitConnections: [number, number][] = [
      [0, 2], [1, 2], [2, 3]
    ];

    conduitConnections.forEach(([fromIdx, toIdx]) => {
      const from = nodeCoords[fromIdx]!.pos;
      const to = nodeCoords[toIdx]!.pos;
      linePositions.push(from[0], 1.5, from[2]);
      linePositions.push(to[0], 1.5, to[2]);
    });

    const lineGeo = new THREE.BufferGeometry();
    lineGeo.setAttribute('position', new THREE.Float32BufferAttribute(linePositions, 3));
    const lineMat = new THREE.LineBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.75,
    });
    this.energyConduits = new THREE.LineSegments(lineGeo, lineMat);
    this.add(this.energyConduits);
    this.materials.push(lineMat);

    // 3. Pulse Flow Particles along Conduits
    const particleCount = 120;
    this.particlePositions = new Float32Array(particleCount * 3);
    this.particleProgress = new Float32Array(particleCount);

    for (let i = 0; i < particleCount; i++) {
      this.particleProgress[i] = Math.random();
    }

    const pGeo = new THREE.BufferGeometry();
    pGeo.setAttribute('position', new THREE.BufferAttribute(this.particlePositions, 3));
    const pMat = new THREE.PointsMaterial({
      color: 0x38bdf8,
      size: 1.2,
      transparent: true,
      opacity: 0.85,
    });
    this.pulseParticles = new THREE.Points(pGeo, pMat);
    this.add(this.pulseParticles);
    this.materials.push(pMat);
  }

  public update(_time: number, dt: number, telemetry: SovereignTelemetry): void {
    // Animate energy pulses flowing between grid nodes
    const nodeCoords = [
      [-25, 1.5, -20],
      [25, 1.5, -20],
      [0, 1.5, -35],
      [0, 1.5, 15]
    ];
    const connections = [
      [nodeCoords[0]!, nodeCoords[2]!],
      [nodeCoords[1]!, nodeCoords[2]!],
      [nodeCoords[2]!, nodeCoords[3]!]
    ];

    const count = this.particleProgress.length;
    const speed = 0.4 * (0.8 + telemetry.reserveJoules * 0.1);

    for (let i = 0; i < count; i++) {
      this.particleProgress[i] = (this.particleProgress[i]! + speed * dt) % 1.0;
      const connIdx = i % connections.length;
      const [from, to] = connections[connIdx]!;
      const prog = this.particleProgress[i]!;

      this.particlePositions[i * 3 + 0] = from[0] + (to[0] - from[0]) * prog;
      this.particlePositions[i * 3 + 1] = from[1] + (to[1] - from[1]) * prog;
      this.particlePositions[i * 3 + 2] = from[2] + (to[2] - from[2]) * prog;
    }
    this.pulseParticles.geometry.attributes.position!.needsUpdate = true;

    // Node emissive intensities modulated by system coherence
    for (const node of this.energyNodes) {
      (node.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.4 + telemetry.coherence * 0.6;
    }
  }

  public setTransitionAlpha(alpha: number, isDirectFocus: boolean): void {
    this.visible = alpha > 0.001;
    for (const mat of this.materials) {
      mat.opacity = (isDirectFocus ? 0.95 : 0.35) * alpha;
    }
  }
}

