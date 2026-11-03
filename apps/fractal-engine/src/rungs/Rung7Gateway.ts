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

      // Gold to crystalline cyan
      if (i % 3 === 0) {
        particleColors[i * 3 + 0] = 1.0; particleColors[i * 3 + 1] = 0.84; particleColors[i * 3 + 2] = 0.0;
      } else if (i % 3 === 1) {
        particleColors[i * 3 + 0] = 0.29; particleColors[i * 3 + 1] = 0.64; particleColors[i * 3 + 2] = 1.0;
      } else {
        particleColors[i * 3 + 0] = 1.0; particleColors[i * 3 + 1] = 0.65; particleColors[i * 3 + 2] = 0.28;
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

    // 4. The 3 Triad Orbital Nodes (Fidelity, Sol, Apex)
    this.triadGroup = new THREE.Group();
    this.triadGroup.position.set(0, 300000, 0);
    this.add(this.triadGroup);

    const nodeColors = [0x4aa3ff, 0xffa040, 0xffd700]; // Fidelity Blue, Sol Amber, Apex Gold
    for (let i = 0; i < 3; i++) {
      const nodeGeo = new THREE.SphereGeometry(45000, 24, 24);
      const nodeMat = new THREE.MeshStandardMaterial({
        color: nodeColors[i],
        emissive: nodeColors[i],
        emissiveIntensity: 0.8,
        roughness: 0.2,
        transparent: true,
        opacity: 0.95,
      });
      const nodeMesh = new THREE.Mesh(nodeGeo, nodeMat);
      this.nodeSpheres.push(nodeMesh);
      this.triadGroup.add(nodeMesh);
      this.materials.push(nodeMat);
    }

    // 5. Laser conduits connecting the 3 nodes
    const lineGeo = new THREE.BufferGeometry();
    lineGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(18), 3));
    const lineMat = new THREE.LineBasicMaterial({
      color: 0xffe066,
      transparent: true,
      opacity: 0.8,
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

    // Orbit the 3 Triad nodes at 120-degree phase separation
    const orbitRadius = 600000;
    const baseAngle = time * 0.2;
    const positions = new Float32Array(18);

    for (let i = 0; i < 3; i++) {
      const angle = baseAngle + (i * 2.0 * Math.PI) / 3.0;
      const x = orbitRadius * Math.cos(angle);
      const z = orbitRadius * Math.sin(angle);
      const y = Math.sin(time * 0.8 + i) * 60000;

      this.nodeSpheres[i]!.position.set(x, y, z);

      // Construct 3 connecting line segments: 0-1, 1-2, 2-0
      const nextIdx = (i + 1) % 3;
      const nextAngle = baseAngle + (nextIdx * 2.0 * Math.PI) / 3.0;
      const nextX = orbitRadius * Math.cos(nextAngle);
      const nextZ = orbitRadius * Math.sin(nextAngle);
      const nextY = Math.sin(time * 0.8 + nextIdx) * 60000;

      positions[i * 6 + 0] = x;
      positions[i * 6 + 1] = y;
      positions[i * 6 + 2] = z;
      positions[i * 6 + 3] = nextX;
      positions[i * 6 + 4] = nextY;
      positions[i * 6 + 5] = nextZ;
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

