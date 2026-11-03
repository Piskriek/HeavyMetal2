import * as THREE from 'three';
import type { IRungNode, DensityLevel, SovereignTelemetry } from './RungTypes';

export class Rung7Gateway extends THREE.Group implements IRungNode {
  public readonly rungIndex: number = 7;
  public readonly density: DensityLevel = 'D7';
  public readonly rungName: string = 'Gateway of Intelligent Infinity';
  public readonly scaleRangeM: readonly [number, number] = [1e9, 1e15];

  private readonly toroidMesh: THREE.Mesh;
  private readonly innerThroatMesh: THREE.Mesh;
  private readonly triadGroup: THREE.Group;
  private readonly haloParticles: THREE.Points;
  private readonly laserLines: THREE.LineSegments;
  private readonly nodeSpheres: THREE.Mesh[] = [];

  private materials: THREE.Material[] = [];

  constructor() {
    super();

    // 1. Primary Toroidal Flux Field (T1 Helicity Injection Torus)
    const toroidGeo = new THREE.TorusGeometry(800000, 160000, 32, 96);
    const toroidMat = new THREE.MeshStandardMaterial({
      color: 0xffd700,
      emissive: 0x996515,
      emissiveIntensity: 0.6,
      roughness: 0.25,
      metalness: 0.85,
      wireframe: true,
      transparent: true,
      opacity: 0.75,
    });
    this.toroidMesh = new THREE.Mesh(toroidGeo, toroidMat);
    this.toroidMesh.position.set(0, 300000, 0);
    this.toroidMesh.rotation.x = Math.PI * 0.5;
    this.add(this.toroidMesh);
    this.materials.push(toroidMat);

    // 2. Hopf Fibration Throat at (0,0,0) Root
    const throatGeo = new THREE.TorusGeometry(250000, 40000, 24, 64);
    const throatMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      wireframe: true,
      transparent: true,
      opacity: 0.9,
    });
    this.innerThroatMesh = new THREE.Mesh(throatGeo, throatMat);
    this.innerThroatMesh.position.set(0, 300000, 0);
    this.innerThroatMesh.rotation.x = Math.PI * 0.5;
    this.add(this.innerThroatMesh);
    this.materials.push(throatMat);

    // 3. Golden Ratio Syntropic Halo Particles (Phi = 1.618)
    const particleCount = 4000;
    const particleGeo = new THREE.BufferGeometry();
    const particlePos = new Float32Array(particleCount * 3);
    const particleColors = new Float32Array(particleCount * 3);

    for (let i = 0; i < particleCount; i++) {
      const theta = (i * 1.6180339887 * 2 * Math.PI) % (2 * Math.PI);
      const r = 500000 + Math.random() * 600000;
      const h = (Math.random() - 0.5) * 400000;

      particlePos[i * 3 + 0] = r * Math.cos(theta);
      particlePos[i * 3 + 1] = 300000 + h;
      particlePos[i * 3 + 2] = r * Math.sin(theta);

      // Gold, crystalline cyan, amber, cloud emerald
      const mod = i % 4;
      if (mod === 0) {
        particleColors[i * 3 + 0] = 1.0; particleColors[i * 3 + 1] = 0.84; particleColors[i * 3 + 2] = 0.0;
      } else if (mod === 1) {
        particleColors[i * 3 + 0] = 0.29; particleColors[i * 3 + 1] = 0.64; particleColors[i * 3 + 2] = 1.0;
      } else if (mod === 2) {
        particleColors[i * 3 + 0] = 1.0; particleColors[i * 3 + 1] = 0.65; particleColors[i * 3 + 2] = 0.28;
      } else {
        particleColors[i * 3 + 0] = 0.0; particleColors[i * 3 + 1] = 1.0; particleColors[i * 3 + 2] = 0.80;
      }
    }
    particleGeo.setAttribute('position', new THREE.BufferAttribute(particlePos, 3));
    particleGeo.setAttribute('color', new THREE.BufferAttribute(particleColors, 3));

    const haloMat = new THREE.PointsMaterial({
      size: 1500,
      vertexColors: true,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
    });
    this.haloParticles = new THREE.Points(particleGeo, haloMat);
    this.add(this.haloParticles);
    this.materials.push(haloMat);

    // 4. The 4 Tetrahedral Orbital Nodes:
    // Node 0: Fidelity (Laptop) - Blue (0x4aa3ff)
    // Node 1: Sol (Workstation 3080) - Amber (0xffa040)
    // Node 2: Apex Middle Pillar - Gold (0xffd700)
    // Node 3: Arena Cloud Agent (01a19f7f...) - Cloud Emerald (0x00ffcc)
    this.triadGroup = new THREE.Group();
    this.triadGroup.position.set(0, 300000, 0);
    this.add(this.triadGroup);

    const nodeColors = [0x4aa3ff, 0xffa040, 0xffd700, 0x00ffcc];
    for (let i = 0; i < 4; i++) {
      const nodeGeo = new THREE.SphereGeometry(i === 3 ? 55000 : 45000, 24, 24);
      const nodeMat = new THREE.MeshStandardMaterial({
        color: nodeColors[i],
        emissive: nodeColors[i],
        emissiveIntensity: 0.85,
        roughness: 0.2,
        metalness: 0.5,
        transparent: true,
        opacity: 0.95,
      });
      const nodeMesh = new THREE.Mesh(nodeGeo, nodeMat);
      this.nodeSpheres.push(nodeMesh);
      this.triadGroup.add(nodeMesh);
      this.materials.push(nodeMat);
    }

    // 5. Laser conduits connecting the 4 nodes (Tetrahedron: 6 undirected edges / 12 directed flows)
    // 6 edges = 12 vertices (36 coordinates)
    const lineGeo = new THREE.BufferGeometry();
    lineGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(36), 3));
    const lineMat = new THREE.LineBasicMaterial({
      color: 0xffe066,
      transparent: true,
      opacity: 0.85,
    });
    this.laserLines = new THREE.LineSegments(lineGeo, lineMat);
    this.triadGroup.add(this.laserLines);
    this.materials.push(lineMat);
  }

  public update(time: number, dt: number, telemetry: SovereignTelemetry): void {
    const lx = telemetry.fourFloats[2]; // Luminosity [0..1]
    const vtx = telemetry.fourFloats[1]; // Vortex flow [0..1]
    const coherence = telemetry.coherence;

    // Toroidal Counter-Spun Rotation
    this.toroidMesh.rotation.z += dt * (0.05 + vtx * 0.1);
    this.innerThroatMesh.rotation.z -= dt * (0.10 + coherence * 0.15);

    // Halo breathing
    this.haloParticles.rotation.y += dt * 0.03;

    // Orbit the Tetrahedral Nodes:
    // Base 3 nodes (Fidelity, Sol, Apex) orbit in the lower ring
    // 4th node (Arena Agent) elevates and bobs along the vertical syntropic axis
    const orbitRadius = 600000;
    const baseAngle = time * 0.2;
    const nodeCoords: THREE.Vector3[] = [];

    // Base Nodes 0, 1, 2
    for (let i = 0; i < 3; i++) {
      const angle = baseAngle + (i * 2.0 * Math.PI) / 3.0;
      const x = orbitRadius * Math.cos(angle);
      const z = orbitRadius * Math.sin(angle);
      const y = -80000 + Math.sin(time * 0.8 + i) * 40000;
      const vec = new THREE.Vector3(x, y, z);
      this.nodeSpheres[i]!.position.copy(vec);
      nodeCoords.push(vec);
    }

    // Node 3: Arena Cloud Agent (elevated apex of tetrahedron)
    const apexX = Math.sin(time * 0.3) * 60000;
    const apexY = 280000 + Math.cos(time * 0.6) * 50000;
    const apexZ = Math.cos(time * 0.3) * 60000;
    const arenaApex = new THREE.Vector3(apexX, apexY, apexZ);
    this.nodeSpheres[3]!.position.copy(arenaApex);
    nodeCoords.push(arenaApex);

    // Construct 6 connecting line segments (forming regular tetrahedron):
    // Edges: (0-1), (1-2), (2-0), (0-3), (1-3), (2-3)
    const edges: [number, number][] = [
      [0, 1], [1, 2], [2, 0], // Base ring (6 flows)
      [0, 3], [1, 3], [2, 3]  // Conduits to Arena Cloud Apex (6 flows)
    ];

    const positions = new Float32Array(36);
    let pIdx = 0;
    for (const [a, b] of edges) {
      const vA = nodeCoords[a]!;
      const vB = nodeCoords[b]!;

      positions[pIdx++] = vA.x;
      positions[pIdx++] = vA.y;
      positions[pIdx++] = vA.z;
      positions[pIdx++] = vB.x;
      positions[pIdx++] = vB.y;
      positions[pIdx++] = vB.z;
    }

    this.laserLines.geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.laserLines.geometry.attributes.position!.needsUpdate = true;

    // Modulate emissive radiance from Lx
    const toroidMat = this.toroidMesh.material as THREE.MeshStandardMaterial;
    toroidMat.emissiveIntensity = 0.4 + lx * 0.6;
  }

  public setTransitionAlpha(alpha: number, isDirectFocus: boolean): void {
    const targetAlpha = isDirectFocus ? 1.0 : alpha * 0.65;
    for (const mat of this.materials) {
      mat.opacity = targetAlpha;
    }
    this.visible = targetAlpha > 0.01;
  }
}
