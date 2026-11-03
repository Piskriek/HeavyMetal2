import * as THREE from 'three';
import type { IRungNode, DensityLevel, SovereignTelemetry } from './RungTypes';

export class Rung5World extends THREE.Group implements IRungNode {
  public readonly rungIndex: number = 5;
  public readonly density: DensityLevel = 'D5';
  public readonly rungName: string = 'Planetary Biome & Terrain';
  public readonly scaleRangeM: readonly [number, number] = [500, 1e5];

  private readonly terrainMesh: THREE.Mesh;
  private readonly atmosphereDome: THREE.Mesh;
  private readonly valleyMarkers: THREE.Group;
  private materials: THREE.Material[] = [];

  constructor() {
    super();

    // 1. Procedural Four Valleys Terrain Heightfield
    const terrainSize = 2000;
    const segments = 128;
    const terrainGeo = new THREE.PlaneGeometry(terrainSize, terrainSize, segments, segments);
    terrainGeo.rotateX(-Math.PI / 2);

    const pos = terrainGeo.attributes.position!;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);

      // Four Valleys elevation function: multi-scale harmonic sines
      const d = Math.sqrt(x * x + z * z);
      const valleyRadial = Math.cos(d * 0.005) * 40;
      const hills = Math.sin(x * 0.008) * Math.cos(z * 0.008) * 60;
      const ridges = Math.sin(x * 0.02 + z * 0.02) * 15;
      const centerPlain = Math.exp(-d * 0.004) * -20; // flattened central hub

      const y = valleyRadial + hills + ridges + centerPlain;
      pos.setY(i, y);
    }
    terrainGeo.computeVertexNormals();

    const terrainMat = new THREE.MeshStandardMaterial({
      color: 0x2e4033,
      roughness: 0.85,
      metalness: 0.15,
      flatShading: true,
      transparent: true,
      opacity: 0.95,
    });
    this.terrainMesh = new THREE.Mesh(terrainGeo, terrainMat);
    this.terrainMesh.position.set(0, -10, 0);
    this.add(this.terrainMesh);
    this.materials.push(terrainMat);

    // 2. Atmospheric Scattering Ring / Dome
    const atmoGeo = new THREE.SphereGeometry(terrainSize * 0.8, 32, 16, 0, Math.PI * 2, 0, Math.PI * 0.5);
    const atmoMat = new THREE.MeshBasicMaterial({
      color: 0x88c0d0,
      side: THREE.BackSide,
      transparent: true,
      opacity: 0.25,
      depthWrite: false,
    });
    this.atmosphereDome = new THREE.Mesh(atmoGeo, atmoMat);
    this.atmosphereDome.position.set(0, -50, 0);
    this.add(this.atmosphereDome);
    this.materials.push(atmoMat);

    // 3. Four Valley Quadrant Pillars / Beacons
    this.valleyMarkers = new THREE.Group();
    const valleyColors = [0x65d59a, 0x55c7df, 0x6897f5, 0x9b7af0];
    const valleyOffsets = [
      [-300, -300], [300, -300], [300, 300], [-300, 300]
    ];

    valleyOffsets.forEach(([vx, vz], idx) => {
      const beaconGeo = new THREE.CylinderGeometry(4, 8, 80, 16);
      const beaconMat = new THREE.MeshStandardMaterial({
        color: valleyColors[idx % valleyColors.length],
        emissive: valleyColors[idx % valleyColors.length],
        emissiveIntensity: 0.4,
        transparent: true,
        opacity: 0.85,
      });
      const beacon = new THREE.Mesh(beaconGeo, beaconMat);
      beacon.position.set(vx, 30, vz);
      this.valleyMarkers.add(beacon);
      this.materials.push(beaconMat);
    });
    this.add(this.valleyMarkers);
  }

  public update(_time: number, _dt: number, telemetry: SovereignTelemetry): void {
    // Terrain ambient glow reacts to Four Floats radiance (Lx)
    const lx = telemetry.fourFloats[2];
    (this.terrainMesh.material as THREE.MeshStandardMaterial).emissive = new THREE.Color(0x0a1a12).multiplyScalar(lx * 2.0);
  }

  public setTransitionAlpha(alpha: number, isDirectFocus: boolean): void {
    this.visible = alpha > 0.001;
    for (const mat of this.materials) {
      mat.opacity = (isDirectFocus ? 0.95 : 0.4) * alpha;
    }
  }
}

