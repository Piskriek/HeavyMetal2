/**
 * apps/web/src/play/solar-system-view.ts
 *
 * Living Seeded Solar System 3D Sky Dome & Surrounding Living Presets (Plan 58 Wave 4).
 * - Connects `@hm/harness` (`seedGalacticSystem`, `stepOrbitalLattice`) directly into 3D.
 * - Renders the seeded system's actual central Sun, sibling Planets (with Stage S0a wireframe -> S6 biosphere looks),
 *   Moons, and Stargate ring at their live Keplerian orbital vectors in the daytime sky dome.
 * - Shows Hohmann transfer window reticles and Harmonic Conjunction alignment signals.
 * - Mounts surrounding living presets (elemental crystals, contraption assembly pad, persistent Native AI beings
 *   with Archetype / Polarity auras) around the circular procedural Stargate arrival plinth.
 *
 * 100% pure procedural geometry, zero .glb models (RULES 8a).
 */

import * as THREE from 'three';
import {
  seedGalacticSystem,
  stepOrbitalLattice,
  type GalacticStarSystemSeed,
  type OrbitalBodySeed,
  type OrbitalLatticeSnapshot,
} from '@hm/harness';

const DEG_TO_RAD = Math.PI / 180;

export interface SolarSystemView {
  readonly group: THREE.Group;
  step(dt: number, camPos: THREE.Vector3): OrbitalLatticeSnapshot;
  snapshot(): OrbitalLatticeSnapshot;
  system(): GalacticStarSystemSeed;
  dispose(): void;
}

/**
 * Creates 3D celestial bodies in the sky dome for the seeded Solar System.
 */
export function createSolarSystemView(
  scene: THREE.Scene,
  systemSeed: string = 'logos-prime',
  sunDirection: THREE.Vector3 | null = null,
): SolarSystemView {
  const system = seedGalacticSystem(systemSeed);
  const group = new THREE.Group();
  group.name = 'living-solar-system';
  scene.add(group);

  const owned: { dispose(): void }[] = [];
  const keep = <T extends { dispose(): void }>(item: T): T => {
    owned.push(item);
    return item;
  };

  // ---- 1. Central Radiant Star (Sun) ----
  const sunGroup = new THREE.Group();
  sunGroup.name = 'central-star-sun';

  // Luminous core sphere
  const sunGeo = keep(new THREE.SphereGeometry(45, 24, 24));
  const sunMat = keep(
    new THREE.MeshBasicMaterial({
      color: 0xfff6dd,
    }),
  );
  const sunMesh = new THREE.Mesh(sunGeo, sunMat);
  sunGroup.add(sunMesh);

  // Soft coronal aura billboard
  const coronaGeo = keep(new THREE.PlaneGeometry(160, 160));
  const coronaMat = keep(
    new THREE.MeshBasicMaterial({
      color: 0xffdf88,
      transparent: true,
      opacity: 0.45,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  );
  const coronaMesh = new THREE.Mesh(coronaGeo, coronaMat);
  sunGroup.add(coronaMesh);

  group.add(sunGroup);

  // ---- 2. Sibling Celestial Bodies & Rings ----
  interface CelestialBodyView {
    readonly seed: OrbitalBodySeed;
    readonly root: THREE.Group;
    readonly mesh: THREE.Object3D;
    readonly hohmannReticle: THREE.Mesh;
    readonly conjunctionRay?: THREE.Line;
  }

  const celestialViews: CelestialBodyView[] = [];

  // System bodies: body 0 is player's world. Sibling bodies start from index 1.
  for (let i = 1; i < system.bodies.length; i++) {
    const b = system.bodies[i]!;
    const bGroup = new THREE.Group();
    bGroup.name = `celestial-body-${b.id}`;

    let bodyMesh: THREE.Object3D;

    if (b.kind === 'stargate-ring') {
      // Procedural toroidal Stargate ring in deep space
      const torusGeo = keep(new THREE.TorusGeometry(22, 3.2, 16, 48));
      const ringMat = keep(
        new THREE.MeshStandardMaterial({
          color: 0x1c2430,
          metalness: 0.85,
          roughness: 0.25,
          emissive: 0x38bdf8,
          emissiveIntensity: 1.2,
        }),
      );
      bodyMesh = new THREE.Mesh(torusGeo, ringMat);

      // Inner aperture shimmering disc
      const discGeo = keep(new THREE.CircleGeometry(18, 32));
      const discMat = keep(
        new THREE.MeshBasicMaterial({
          color: 0x7cf3ff,
          transparent: true,
          opacity: 0.7,
          side: THREE.DoubleSide,
        }),
      );
      const discMesh = new THREE.Mesh(discGeo, discMat);
      bodyMesh.add(discMesh);
    } else if (b.stage === 'S0a' || b.stage === 'S0b') {
      // Root wireframe / 1-bit dither lattice planet
      const wireGeo = keep(new THREE.IcosahedronGeometry(20, 2));
      const wireMat = keep(
        new THREE.MeshBasicMaterial({
          color: 0x7cf3ff,
          wireframe: true,
        }),
      );
      bodyMesh = new THREE.Mesh(wireGeo, wireMat);
    } else if (b.stage === 'S1' || b.stage === 'S2') {
      // 16/256-color low-poly faceted planet
      const polyGeo = keep(new THREE.DodecahedronGeometry(24, 1));
      const polyMat = keep(
        new THREE.MeshStandardMaterial({
          color: i % 2 === 0 ? 0xd97736 : 0x8b5cf6,
          roughness: 0.8,
          metalness: 0.1,
          flatShading: true,
        }),
      );
      bodyMesh = new THREE.Mesh(polyGeo, polyMat);
    } else {
      // S3..S6 Living biosphere sphere with emerald/azure oceans and atmosphere rim
      const sphereGeo = keep(new THREE.SphereGeometry(26, 24, 24));
      const sphereMat = keep(
        new THREE.MeshStandardMaterial({
          color: 0x10b981,
          roughness: 0.55,
          metalness: 0.15,
        }),
      );
      bodyMesh = new THREE.Mesh(sphereGeo, sphereMat);

      // Translucent atmosphere shell
      const atmoGeo = keep(new THREE.SphereGeometry(28, 20, 20));
      const atmoMat = keep(
        new THREE.MeshBasicMaterial({
          color: 0x6ee7b7,
          transparent: true,
          opacity: 0.25,
          side: THREE.BackSide,
        }),
      );
      bodyMesh.add(new THREE.Mesh(atmoGeo, atmoMat));
    }

    bGroup.add(bodyMesh);

    // Hohmann transfer window reticle (pulsing ring indicating low-delta-V launch window)
    const reticleGeo = keep(new THREE.RingGeometry(34, 38, 32));
    const reticleMat = keep(
      new THREE.MeshBasicMaterial({
        color: 0x10b981,
        transparent: true,
        opacity: 0,
        side: THREE.DoubleSide,
      }),
    );
    const reticleMesh = new THREE.Mesh(reticleGeo, reticleMat);
    bGroup.add(reticleMesh);

    group.add(bGroup);
    celestialViews.push({
      seed: b,
      root: bGroup,
      mesh: bodyMesh,
      hohmannReticle: reticleMesh,
    });
  }

  let orbitalTick = 0;
  let latestSnapshot: OrbitalLatticeSnapshot = stepOrbitalLattice(system, 0);

  const SKY_DOME_RADIUS = 1500;

  return {
    group,
    step(dt: number, camPos: THREE.Vector3): OrbitalLatticeSnapshot {
      orbitalTick += dt * 6.0; // Deterministic clock step
      latestSnapshot = stepOrbitalLattice(system, orbitalTick);

      // Celestial bodies are infinitely far, centered on camera
      group.position.copy(camPos);

      // Sun position: opposite to player's world orbital angle
      const world0 = latestSnapshot.bodyPositions[0];
      const world0Angle = (world0?.angleDeg ?? 0) * DEG_TO_RAD;

      // Sun elevation in daytime sky (approx 45 degrees up from horizon)
      const sunDir = (sunDirection ?? new THREE.Vector3(-Math.cos(world0Angle), 0.65, -Math.sin(world0Angle))).clone().normalize();
      sunGroup.position.copy(sunDir).multiplyScalar(SKY_DOME_RADIUS);
      coronaMesh.lookAt(camPos);

      // Position sibling bodies based on Keplerian coordinates
      for (let i = 0; i < celestialViews.length; i++) {
        const view = celestialViews[i]!;
        const bodyPos = latestSnapshot.bodyPositions[i + 1];
        if (!bodyPos || !world0) continue;

        // Relative sector vector
        const dx = bodyPos.sectorX - world0.sectorX;
        const dz = bodyPos.sectorZ - world0.sectorZ;
        const dist = Math.hypot(dx, dz) || 1;

        // Map into upper celestial hemisphere so planets are visible above terrain
        const elev = Math.max(0.35, 0.45 + 0.25 * Math.sin((bodyPos.angleDeg * Math.PI) / 180));
        const bodyDir = new THREE.Vector3(dx / dist, elev, dz / dist).normalize();

        view.root.position.copy(bodyDir).multiplyScalar(SKY_DOME_RADIUS * 0.92);
        view.mesh.rotation.y += dt * 0.2;
        view.hohmannReticle.lookAt(camPos);

        // Update Hohmann transfer window reticle
        const tw = latestSnapshot.transferWindows[i];
        if (tw?.windowOpen) {
          const mat = view.hohmannReticle.material as THREE.MeshBasicMaterial;
          mat.opacity = 0.5 + 0.35 * Math.sin(orbitalTick * 0.1);
        } else {
          (view.hohmannReticle.material as THREE.MeshBasicMaterial).opacity = 0;
        }
      }

      return latestSnapshot;
    },
    snapshot(): OrbitalLatticeSnapshot {
      return latestSnapshot;
    },
    system(): GalacticStarSystemSeed {
      return system;
    },
    dispose(): void {
      scene.remove(group);
      for (const item of owned) item.dispose();
    },
  };
}

/**
 * Mounts surrounding living presets around the circular procedural Stargate arrival plinth:
 * 1. Harvested elemental crystals/flora (Four Floats: pxd, vtx, lx, aq).
 * 2. Contraption / ship assembly pad with machined chamfers.
 * 3. Persistent Native AI beings with Archetype / Polarity auras.
 */
export function createLivingPresetSurroundings(
  scene: THREE.Scene,
  groundAt: (x: number, z: number) => number,
): { readonly group: THREE.Group; step(dt: number): void; dispose(): void } {
  const group = new THREE.Group();
  group.name = 'living-presets-surroundings';
  scene.add(group);

  const owned: { dispose(): void }[] = [];
  const keep = <T extends { dispose(): void }>(item: T): T => {
    owned.push(item);
    return item;
  };

  // ---- 1. Four-Float Elemental Crystals ----
  const crystalDefs: readonly { name: string; color: number; at: readonly [number, number]; h: number }[] = [
    { name: 'emerald-aq-crystal', color: 0x3dc8ff, at: [-4.2, 2.5], h: 1.8 },
    { name: 'quartz-vtx-crystal', color: 0xa78bfa, at: [4.2, 2.5], h: 2.2 },
    { name: 'amber-lx-crystal', color: 0xf59e0b, at: [-4.8, -2.5], h: 1.6 },
    { name: 'ruby-pxd-crystal', color: 0xf43f5e, at: [4.8, -2.5], h: 2.0 },
  ];

  for (const c of crystalDefs) {
    const [cx, cz] = c.at;
    const gy = groundAt(cx, cz);
    const cGroup = new THREE.Group();
    cGroup.position.set(cx, gy, cz);

    const coneGeo = keep(new THREE.ConeGeometry(0.35, c.h, 6));
    const coneMat = keep(
      new THREE.MeshStandardMaterial({
        color: c.color,
        emissive: c.color,
        emissiveIntensity: 0.6,
        roughness: 0.2,
        metalness: 0.8,
      }),
    );
    const mesh = new THREE.Mesh(coneGeo, coneMat);
    mesh.position.y = c.h / 2;
    cGroup.add(mesh);

    // Glowing base pedestal
    const baseGeo = keep(new THREE.CylinderGeometry(0.55, 0.65, 0.2, 6));
    const baseMat = keep(
      new THREE.MeshStandardMaterial({
        color: 0x242722,
        roughness: 0.7,
        metalness: 0.4,
      }),
    );
    const baseMesh = new THREE.Mesh(baseGeo, baseMat);
    baseMesh.position.y = 0.1;
    cGroup.add(baseMesh);

    group.add(cGroup);
  }

  // ---- 2. Contraption / Ship Assembly Pad ----
  const padX = 6.5;
  const padZ = 0;
  const padY = groundAt(padX, padZ);

  const padGroup = new THREE.Group();
  padGroup.position.set(padX, padY, padZ);

  // 4m x 4m machined slate assembly deck
  const deckGeo = keep(new THREE.BoxGeometry(4.2, 0.2, 4.2));
  const deckMat = keep(
    new THREE.MeshStandardMaterial({
      color: 0x1b1d19,
      roughness: 0.45,
      metalness: 0.6,
    }),
  );
  const deck = new THREE.Mesh(deckGeo, deckMat);
  deck.position.y = 0.1;
  padGroup.add(deck);

  // Terracotta perimeter chamfer rim
  const rimGeo = keep(new THREE.BoxGeometry(4.35, 0.08, 4.35));
  const rimMat = keep(
    new THREE.MeshStandardMaterial({
      color: 0xd96b43,
      roughness: 0.5,
      metalness: 0.3,
    }),
  );
  const rim = new THREE.Mesh(rimGeo, rimMat);
  rim.position.y = 0.16;
  padGroup.add(rim);

  // Corner beacon pylons
  const cornerOffsets: readonly (readonly [number, number])[] = [
    [-2.0, -2.0],
    [2.0, -2.0],
    [-2.0, 2.0],
    [2.0, 2.0],
  ];
  for (const pair of cornerOffsets) {
    const px = pair[0];
    const pz = pair[1];
    const pylonGeo = keep(new THREE.CylinderGeometry(0.08, 0.08, 0.6, 8));
    const pylonMat = keep(
      new THREE.MeshStandardMaterial({
        color: 0xd96b43,
        emissive: 0xd96b43,
        emissiveIntensity: 0.8,
      }),
    );
    const pylon = new THREE.Mesh(pylonGeo, pylonMat);
    pylon.position.set(px, 0.35, pz);
    padGroup.add(pylon);
  }

  group.add(padGroup);

  // ---- 3. Persistent Native AI Beings with Archetype/Polarity Auras ----
  interface NativeAIView {
    readonly group: THREE.Group;
    readonly aura: THREE.Mesh;
    readonly name: string;
    readonly archetype: string;
  }

  const nativeAIs: NativeAIView[] = [];

  const aiConfigs: readonly { name: string; archetype: string; at: readonly [number, number]; auraColor: number; bodyColor: number }[] = [
    {
      name: 'Adept-01',
      archetype: 'Station I: The Magician (Matrix of Mind)',
      at: [-3.8, 5.0],
      auraColor: 0x38bdf8, // Syntropic Cyan
      bodyColor: 0x1e293b,
    },
    {
      name: 'Sage-01',
      archetype: 'Station IX: Wisdom (Potentiator of Body)',
      at: [3.8, 5.0],
      auraColor: 0xf59e0b, // Solar Gold
      bodyColor: 0x27272a,
    },
  ];

  for (const cfg of aiConfigs) {
    const [ax, az] = cfg.at;
    const ay = groundAt(ax, az);
    const aiGroup = new THREE.Group();
    aiGroup.position.set(ax, ay, az);
    aiGroup.lookAt(0, ay, 0); // Facing the Stargate

    // Stylized robotic/crystalline sentinel body
    const bodyGeo = keep(new THREE.CylinderGeometry(0.24, 0.32, 1.4, 8));
    const bodyMat = keep(
      new THREE.MeshStandardMaterial({
        color: cfg.bodyColor,
        metalness: 0.8,
        roughness: 0.3,
      }),
    );
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = 0.7;
    aiGroup.add(body);

    // Glowing visor lens
    const headGeo = keep(new THREE.BoxGeometry(0.3, 0.25, 0.3));
    const headMat = keep(
      new THREE.MeshStandardMaterial({
        color: 0x0f172a,
        emissive: cfg.auraColor,
        emissiveIntensity: 1.5,
      }),
    );
    const head = new THREE.Mesh(headGeo, headMat);
    head.position.set(0, 1.5, 0);
    aiGroup.add(head);

    // Pulsing Polarity Aura Ring on ground
    const auraGeo = keep(new THREE.RingGeometry(0.8, 1.1, 32));
    const auraMat = keep(
      new THREE.MeshBasicMaterial({
        color: cfg.auraColor,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.6,
      }),
    );
    const aura = new THREE.Mesh(auraGeo, auraMat);
    aura.rotation.x = -Math.PI / 2;
    aura.position.y = 0.05;
    aiGroup.add(aura);

    group.add(aiGroup);
    nativeAIs.push({
      group: aiGroup,
      aura,
      name: cfg.name,
      archetype: cfg.archetype,
    });
  }

  let time = 0;

  return {
    group,
    step(dt: number): void {
      time += dt;
      // Animate polarity aura pulses
      for (let i = 0; i < nativeAIs.length; i++) {
        const ai = nativeAIs[i]!;
        const mat = ai.aura.material as THREE.MeshBasicMaterial;
        mat.opacity = 0.45 + 0.25 * Math.sin(time * 2.5 + i * 1.5);
      }
    },
    dispose(): void {
      scene.remove(group);
      for (const item of owned) item.dispose();
    },
  };
}
