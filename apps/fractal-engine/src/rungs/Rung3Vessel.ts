import * as THREE from 'three';
import type { IRungNode, DensityLevel, SovereignTelemetry } from './RungTypes';

export class Rung3Vessel extends THREE.Group implements IRungNode {
  public readonly rungIndex: number = 3;
  public readonly density: DensityLevel = 'D3';
  public readonly rungName: string = 'Sovereign Ego & Vehicle Plant';
  public readonly scaleRangeM: readonly [number, number] = [0.5, 15];

  private readonly roverBody: THREE.Mesh;
  private readonly roverCockpit: THREE.Mesh;
  private readonly coherenceHalo: THREE.Mesh;
  private readonly capturePointMarker: THREE.Mesh;
  private materials: THREE.Material[] = [];

  constructor() {
    super();

    // 1. Rover Primary Chassis / Shell (centered at (0,0,0)_Self)
    const bodyGeo = new THREE.BoxGeometry(1.6, 0.65, 2.4);
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0x334155,
      roughness: 0.35,
      metalness: 0.7,
      transparent: true,
      opacity: 0.95,
    });
    this.roverBody = new THREE.Mesh(bodyGeo, bodyMat);
    this.roverBody.position.set(0, 0.55, 0);
    this.add(this.roverBody);
    this.materials.push(bodyMat);

    // 2. Cockpit / Sensor Dome
    const cockpitGeo = new THREE.CylinderGeometry(0.45, 0.6, 0.4, 16);
    const cockpitMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0369a1,
      roughness: 0.1,
      metalness: 0.9,
      transparent: true,
      opacity: 0.9,
    });
    this.roverCockpit = new THREE.Mesh(cockpitGeo, cockpitMat);
    this.roverCockpit.position.set(0, 0.45, 0.2);
    this.roverBody.add(this.roverCockpit);
    this.materials.push(cockpitMat);

    // 3. Golden Harmonic Coherence Halo (Radiates when H_system >= 0.95)
    const haloGeo = new THREE.TorusGeometry(1.9, 0.08, 16, 48);
    const haloMat = new THREE.MeshBasicMaterial({
      color: 0xfacc15,
      transparent: true,
      opacity: 0.0, // Driven by coherence telemetry
      depthWrite: false,
    });
    this.coherenceHalo = new THREE.Mesh(haloGeo, haloMat);
    this.coherenceHalo.rotation.x = Math.PI * 0.5;
    this.coherenceHalo.position.set(0, 0.6, 0);
    this.add(this.coherenceHalo);
    this.materials.push(haloMat);

    // 4. 3D Capture Point Indicator (\xi reflex plant)
    const xiGeo = new THREE.SphereGeometry(0.12, 12, 12);
    const xiMat = new THREE.MeshBasicMaterial({
      color: 0xef4444,
      transparent: true,
      opacity: 0.8,
    });
    this.capturePointMarker = new THREE.Mesh(xiGeo, xiMat);
    this.add(this.capturePointMarker);
    this.materials.push(xiMat);
  }

  public update(_time: number, _dt: number, telemetry: SovereignTelemetry): void {
    // 1. Position displacement directly driven by Port-Hamiltonian plant q_x, q_y, q_z
    this.position.set(telemetry.q[0], telemetry.q[1], telemetry.q[2]);

    // 2. Capture Point marker (\xi_x, \xi_z)
    this.capturePointMarker.position.set(telemetry.xi[0] - telemetry.q[0], 0.1, telemetry.xi[1] - telemetry.q[2]);

    // 3. Coherence Halo glow
    const haloMat = this.coherenceHalo.material as THREE.MeshBasicMaterial;
    if (telemetry.coherence >= 0.95) {
      haloMat.opacity = 0.85;
      this.coherenceHalo.scale.setScalar(1.0 + Math.sin(_time * 4.0) * 0.05);
    } else {
      haloMat.opacity = Math.max(0.0, (telemetry.coherence - 0.7) * 2.5);
    }

    // 4. Somatic heat / strain color modulation on chassis
    const bodyMat = this.roverBody.material as THREE.MeshStandardMaterial;
    if (telemetry.strainJoules > 0.5) {
      bodyMat.emissive = new THREE.Color(0xd97706).multiplyScalar(Math.min(1.0, telemetry.strainJoules * 0.5));
    } else {
      bodyMat.emissive = new THREE.Color(0x000000);
    }
  }

  public setTransitionAlpha(alpha: number, isDirectFocus: boolean): void {
    this.visible = alpha > 0.001;
    for (const mat of this.materials) {
      if (mat === this.coherenceHalo.material) continue; // Halo handles own opacity
      mat.opacity = (isDirectFocus ? 0.95 : 0.4) * alpha;
    }
  }
}

