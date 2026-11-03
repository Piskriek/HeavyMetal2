import * as THREE from 'three';
import type { IRungNode, DensityLevel, SovereignTelemetry } from './RungTypes';

export class Rung6Space extends THREE.Group implements IRungNode {
  public readonly rungIndex: number = 6;
  public readonly density: DensityLevel = 'D6';
  public readonly rungName: string = 'Space & Multiverse Starfield';
  public readonly scaleRangeM: readonly [number, number] = [1e5, 1e9];

  private readonly starfield: THREE.Points;
  private readonly solSun: THREE.Mesh;
  private readonly stargateRing: THREE.Mesh;
  private readonly selenePlanet: THREE.Mesh;
  private readonly ignisPlanet: THREE.Mesh;

  private materials: THREE.Material[] = [];

  constructor() {
    super();

    // 1. Starfield Particles (10,000 stars distributed across celestial sphere)
    const starCount = 8000;
    const starGeo = new THREE.BufferGeometry();
    const starPos = new Float32Array(starCount * 3);
    const starColors = new Float32Array(starCount * 3);

    for (let i = 0; i < starCount; i++) {
      const u = Math.random();
      const v = Math.random();
      const theta = u * 2.0 * Math.PI;
      const phi = Math.acos(2.0 * v - 1.0);
      const r = 400000 + Math.random() * 200000;

      starPos[i * 3 + 0] = r * Math.sin(phi) * Math.cos(theta);
      starPos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      starPos[i * 3 + 2] = r * Math.cos(phi);

      // Varied stellar temperatures (blue-white to reddish-orange)
      const colorTemp = Math.random();
      if (colorTemp > 0.8) {
        starColors[i * 3 + 0] = 0.7; starColors[i * 3 + 1] = 0.85; starColors[i * 3 + 2] = 1.0;
      } else if (colorTemp > 0.3) {
        starColors[i * 3 + 0] = 1.0; starColors[i * 3 + 1] = 0.98; starColors[i * 3 + 2] = 0.92;
      } else {
        starColors[i * 3 + 0] = 1.0; starColors[i * 3 + 1] = 0.7; starColors[i * 3 + 2] = 0.5;
      }
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    starGeo.setAttribute('color', new THREE.BufferAttribute(starColors, 3));

    const starMat = new THREE.PointsMaterial({
      size: 400,
      vertexColors: true,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
    });
    this.starfield = new THREE.Points(starGeo, starMat);
    this.add(this.starfield);
    this.materials.push(starMat);

    // 2. Central Sol (Luminous Star)
    const solGeo = new THREE.SphereGeometry(15000, 32, 32);
    const solMat = new THREE.MeshBasicMaterial({
      color: 0xfff2cc,
      transparent: true,
      opacity: 0.95,
    });
    this.solSun = new THREE.Mesh(solGeo, solMat);
    this.solSun.position.set(0, 80000, -350000);
    this.add(this.solSun);
    this.materials.push(solMat);

    // 3. Stargate Network Ring (Harmonic portal)
    const gateGeo = new THREE.TorusGeometry(35000, 3000, 24, 64);
    const gateMat = new THREE.MeshStandardMaterial({
      color: 0x4aa3ff,
      emissive: 0x1a4380,
      roughness: 0.2,
      metalness: 0.8,
      transparent: true,
      opacity: 0.85,
    });
    this.stargateRing = new THREE.Mesh(gateGeo, gateMat);
    this.stargateRing.position.set(0, 100000, 0);
    this.stargateRing.rotation.x = Math.PI * 0.45;
    this.add(this.stargateRing);
    this.materials.push(gateMat);

    // 4. Selene Outpost Planet
    const seleneGeo = new THREE.SphereGeometry(8000, 32, 32);
    const seleneMat = new THREE.MeshStandardMaterial({
      color: 0x6897f5,
      roughness: 0.8,
      transparent: true,
      opacity: 0.9,
    });
    this.selenePlanet = new THREE.Mesh(seleneGeo, seleneMat);
    this.selenePlanet.position.set(-120000, 60000, -100000);
    this.add(this.selenePlanet);
    this.materials.push(seleneMat);

    // 5. Ignis-IV Planet with Rings
    const ignisGeo = new THREE.SphereGeometry(12000, 32, 32);
    const ignisMat = new THREE.MeshStandardMaterial({
      color: 0xff6b4a,
      roughness: 0.7,
      transparent: true,
      opacity: 0.9,
    });
    this.ignisPlanet = new THREE.Mesh(ignisGeo, ignisMat);
    this.ignisPlanet.position.set(160000, -40000, -180000);

    const ringGeo = new THREE.RingGeometry(16000, 26000, 32);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xd8885b,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.6,
    });
    const rings = new THREE.Mesh(ringGeo, ringMat);
    rings.rotation.x = Math.PI * 0.6;
    this.ignisPlanet.add(rings);

    this.add(this.ignisPlanet);
    this.materials.push(ignisMat, ringMat);
  }

  public update(time: number, _dt: number, telemetry: SovereignTelemetry): void {
    // Stargate harmonic rotation modulated by system coherence
    this.stargateRing.rotation.z += 0.005 * (0.5 + telemetry.coherence);
    this.solSun.rotation.y += 0.002;
    this.selenePlanet.rotation.y += 0.004;
    this.ignisPlanet.rotation.y += 0.003;
  }

  public setTransitionAlpha(alpha: number, isDirectFocus: boolean): void {
    this.visible = alpha > 0.001;
    for (const mat of this.materials) {
      mat.opacity = (isDirectFocus ? 1.0 : 0.4) * alpha;
    }
  }
}

