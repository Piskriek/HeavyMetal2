import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/* ══════════════════════════════════════════════════════════════════════
   Interfaces
   ══════════════════════════════════════════════════════════════════════ */

export interface Box {
  min: [number, number, number];
  max: [number, number, number];
}

export interface Socket {
  name: string;
  at: [number, number, number];
}

export interface Rover {
  body: THREE.Group;
  wheel: THREE.Group | null;
  wheelRadius: number;
  hubs: [number, number, number][];
  colliders: Box[];
  sockets: Socket[];
  lamps: THREE.Mesh[];
  parts: Record<string, THREE.Object3D>;
}

export interface Station {
  group: THREE.Group;
  colliders: Box[];
  sockets: Socket[];
  lamps: THREE.Mesh[];
  parts: Record<string, THREE.Object3D>;
}

export interface LabMaterials {
  gunmetal: THREE.MeshStandardMaterial;
  darkSteel: THREE.MeshStandardMaterial;
  paint: THREE.MeshStandardMaterial;
  copper: THREE.MeshStandardMaterial;
  rubber: THREE.MeshStandardMaterial;
  hazard: THREE.MeshStandardMaterial;
  concrete: THREE.MeshStandardMaterial;
  glass: THREE.MeshPhysicalMaterial;
}

/* ══════════════════════════════════════════════════════════════════════
   Materials
   ══════════════════════════════════════════════════════════════════════ */

export function createMaterials(): LabMaterials {
  return {
    gunmetal: new THREE.MeshStandardMaterial({
      color: 0x2a2d3e,
      roughness: 0.4,
      metalness: 0.8,
    }),
    darkSteel: new THREE.MeshStandardMaterial({
      color: 0x4a6a7a,
      roughness: 0.5,
      metalness: 0.7,
    }),
    paint: new THREE.MeshStandardMaterial({
      color: 0x5588aa,
      roughness: 0.6,
      metalness: 0.3,
    }),
    copper: new THREE.MeshStandardMaterial({
      color: 0xb87333,
      roughness: 0.3,
      metalness: 0.8,
    }),
    rubber: new THREE.MeshStandardMaterial({
      color: 0x1a1a1a,
      roughness: 0.9,
      metalness: 0.0,
    }),
    hazard: new THREE.MeshStandardMaterial({
      color: 0xffaa00,
      roughness: 0.6,
      metalness: 0.1,
    }),
    concrete: new THREE.MeshStandardMaterial({
      color: 0x666666,
      roughness: 0.9,
      metalness: 0.1,
    }),
    glass: new THREE.MeshPhysicalMaterial({
      color: 0x88aacc,
      roughness: 0.1,
      metalness: 0.0,
      transmission: 0,
      opacity: 0.3,
      transparent: true,
    }),
  };
}

/* ══════════════════════════════════════════════════════════════════════
   Public Utilities
   ══════════════════════════════════════════════════════════════════════ */

export function setLamp(lamp: THREE.Mesh, glow: number): void {
  const mat = lamp.material;
  if (mat instanceof THREE.MeshStandardMaterial) {
    mat.emissive.setHex(0xffaa00);
    mat.emissiveIntensity = glow;
  }
}

export function triangles(g: THREE.Object3D): number {
  let count = 0;
  g.traverse((obj) => {
    if (obj instanceof THREE.Mesh) {
      const geo = obj.geometry;
      if (geo.index) {
        count += geo.index.count / 3;
      } else {
        const pos = geo.getAttribute('position');
        if (pos) {
          count += pos.count / 3;
        }
      }
    }
  });
  return Math.floor(count);
}

/* ══════════════════════════════════════════════════════════════════════
   Internal Helpers
   ══════════════════════════════════════════════════════════════════════ */

interface Part {
  geo: THREE.BufferGeometry;
  pos: [number, number, number];
  rot?: [number, number, number];
  mat: THREE.Material;
}

function xf(
  geo: THREE.BufferGeometry,
  pos: [number, number, number],
  rot?: [number, number, number],
): THREE.BufferGeometry {
  const g = geo.toNonIndexed();
  const r = rot ?? ([0, 0, 0] as [number, number, number]);
  const m4 = new THREE.Matrix4().makeRotationFromEuler(
    new THREE.Euler(r[0], r[1], r[2]),
  );
  m4.setPosition(pos[0], pos[1], pos[2]);
  return g.applyMatrix4(m4);
}

function assemble(parts: Part[]): THREE.Group {
  const buckets = new Map<THREE.Material, THREE.BufferGeometry[]>();
  for (const p of parts) {
    const t = xf(p.geo, p.pos, p.rot);
    const existing = buckets.get(p.mat);
    if (existing !== undefined) {
      existing.push(t);
    } else {
      buckets.set(p.mat, [t]);
    }
  }
  const group = new THREE.Group();
  for (const [mat, geos] of buckets) {
    const merged = mergeGeometries(geos);
    if (merged !== null) {
      group.add(new THREE.Mesh(merged, mat));
    }
  }
  return group;
}

function lampMesh(
  pos: [number, number, number],
  r: number,
  seg: number,
  mat: THREE.MeshStandardMaterial,
): THREE.Mesh {
  const geo = new THREE.SphereGeometry(r, seg, seg).toNonIndexed();
  const m4 = new THREE.Matrix4().setPosition(pos[0], pos[1], pos[2]);
  geo.applyMatrix4(m4);
  return new THREE.Mesh(geo, mat);
}

function col(
  pos: [number, number, number],
  size: [number, number, number],
): Box {
  return {
    min: [pos[0] - size[0] / 2, pos[1] - size[1] / 2, pos[2] - size[2] / 2],
    max: [pos[0] + size[0] / 2, pos[1] + size[1] / 2, pos[2] + size[2] / 2],
  };
}

function transfer(src: THREE.Group, dst: THREE.Group): void {
  const kids = [...src.children];
  for (const kid of kids) {
    dst.add(kid);
  }
}

function freshLampMat(): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: 0xffaa00,
    emissive: 0xffaa00,
    emissiveIntensity: 0,
  });
}

/* ══════════════════════════════════════════════════════════════════════
   Wheel Builder
   ══════════════════════════════════════════════════════════════════════ */

function buildWheel(
  radius: number,
  width: number,
  stage: number,
  m: LabMaterials,
): THREE.Group {
  const seg = stage === 1 ? 8 : 16;
  const group = new THREE.Group();

  // Tire (rubber) — axis rotated to x
  const tire = new THREE.CylinderGeometry(radius, radius, width, seg);
  tire.rotateZ(Math.PI / 2);
  group.add(new THREE.Mesh(tire.toNonIndexed(), m.rubber));

  // Hub (gunmetal) + optional spokes at S6
  const hubR = radius * 0.35;
  const hubGeos: THREE.BufferGeometry[] = [];
  const hub = new THREE.CylinderGeometry(hubR, hubR, width * 1.05, seg);
  hub.rotateZ(Math.PI / 2);
  hubGeos.push(hub.toNonIndexed());

  if (stage >= 6) {
    const n = 6;
    const mid = radius * 0.62;
    const len = radius * 0.32;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const sy = Math.cos(a) * mid;
      const sz = Math.sin(a) * mid;
      const sg = new THREE.BoxGeometry(width * 0.3, len, radius * 0.06);
      const mt = new THREE.Matrix4().makeRotationX(a);
      mt.setPosition(0, sy, sz);
      sg.applyMatrix4(mt);
      hubGeos.push(sg.toNonIndexed());
    }
  }

  const hubMerged = mergeGeometries(hubGeos);
  if (hubMerged !== null) {
    group.add(new THREE.Mesh(hubMerged, m.gunmetal));
  }

  return group;
}

/* ══════════════════════════════════════════════════════════════════════
   Scout  — one-seat buggy ~3.1 m
   body ≤ 6 children  (gunmetal, darkSteel, paint, hazard + 2 lamps)
   ══════════════════════════════════════════════════════════════════════ */

export function scout(m: LabMaterials, o: { stage: number }): Rover {
  const s = o.stage;
  const seg = s === 1 ? 6 : 12;
  const ps: Part[] = [];
  const lamps: THREE.Mesh[] = [];

  /* — chassis / bumpers (darkSteel) — */
  ps.push({ geo: new THREE.BoxGeometry(1.4, 0.08, 3.0), pos: [0, 0, 0], mat: m.darkSteel });
  ps.push({ geo: new THREE.BoxGeometry(1.0, 0.08, 0.1), pos: [0, 0.04, 1.5], mat: m.darkSteel });
  ps.push({ geo: new THREE.BoxGeometry(0.8, 0.06, 0.08), pos: [0, -0.02, -1.52], mat: m.darkSteel });

  /* — frame (gunmetal) — */
  ps.push({ geo: new THREE.BoxGeometry(1.8, 0.1, 0.1), pos: [0, -0.02, 1.1], mat: m.gunmetal });
  ps.push({ geo: new THREE.BoxGeometry(1.8, 0.1, 0.1), pos: [0, -0.02, -1.1], mat: m.gunmetal });
  ps.push({ geo: new THREE.BoxGeometry(0.06, 0.12, 3.0), pos: [-0.72, 0, 0], mat: m.gunmetal });
  ps.push({ geo: new THREE.BoxGeometry(0.06, 0.12, 3.0), pos: [0.72, 0, 0], mat: m.gunmetal });

  /* — roll cage verts — */
  const rv: [number, number, number][] = [
    [-0.62, 0.55, 1.0],
    [0.62, 0.55, 1.0],
    [-0.62, 0.55, -0.85],
    [0.62, 0.55, -0.85],
  ];
  for (const p of rv) {
    ps.push({ geo: new THREE.BoxGeometry(0.045, 1.0, 0.045), pos: p, mat: m.gunmetal });
  }

  /* — roll cage top bars — */
  ps.push({ geo: new THREE.BoxGeometry(1.3, 0.045, 0.045), pos: [0, 1.05, 1.0], mat: m.gunmetal });
  ps.push({ geo: new THREE.BoxGeometry(1.3, 0.045, 0.045), pos: [0, 1.05, -0.85], mat: m.gunmetal });
  ps.push({ geo: new THREE.BoxGeometry(0.045, 0.045, 1.9), pos: [-0.62, 1.05, 0.075], mat: m.gunmetal });
  ps.push({ geo: new THREE.BoxGeometry(0.045, 0.045, 1.9), pos: [0.62, 1.05, 0.075], mat: m.gunmetal });

  /* — tool rack — */
  ps.push({ geo: new THREE.BoxGeometry(0.8, 0.04, 0.2), pos: [0, 0.08, -1.35], mat: m.gunmetal });
  ps.push({ geo: new THREE.BoxGeometry(0.04, 0.18, 0.04), pos: [-0.38, 0.17, -1.35], mat: m.gunmetal });
  ps.push({ geo: new THREE.BoxGeometry(0.04, 0.18, 0.04), pos: [0.38, 0.17, -1.35], mat: m.gunmetal });

  /* — antenna — */
  ps.push({ geo: new THREE.CylinderGeometry(0.01, 0.015, 0.55, seg), pos: [0.4, 0.82, -1.0], mat: m.gunmetal });

  /* — seat & dash (paint) — */
  ps.push({ geo: new THREE.BoxGeometry(0.44, 0.06, 0.44), pos: [0, 0.14, 0.2], mat: m.paint });
  ps.push({ geo: new THREE.BoxGeometry(0.44, 0.38, 0.06), pos: [0, 0.37, -0.02], mat: m.paint });
  ps.push({ geo: new THREE.BoxGeometry(0.8, 0.15, 0.06), pos: [0, 0.22, 0.85], mat: m.paint });

  /* — fenders (darkSteel) — */
  const fp: [number, number, number][] = [
    [-0.8, 0.22, 1.1],
    [0.8, 0.22, 1.1],
    [-0.8, 0.22, -1.1],
    [0.8, 0.22, -1.1],
  ];
  for (const p of fp) {
    ps.push({ geo: new THREE.BoxGeometry(0.48, 0.05, 0.75), pos: p, mat: m.darkSteel });
  }

  /* — hazard bands — */
  ps.push({ geo: new THREE.BoxGeometry(0.015, 0.1, 2.5), pos: [-0.73, 0.04, 0], mat: m.hazard });
  ps.push({ geo: new THREE.BoxGeometry(0.015, 0.1, 2.5), pos: [0.73, 0.04, 0], mat: m.hazard });

  /* — headlamps (amber emissive) — */
  lamps.push(
    lampMesh([-0.42, 0.25, 1.42], 0.055, seg, freshLampMat()),
    lampMesh([0.42, 0.25, 1.42], 0.055, seg, freshLampMat()),
  );

  const body = assemble(ps);
  for (const l of lamps) body.add(l);

  return {
    body,
    wheel: buildWheel(0.45, 0.2, s, m),
    wheelRadius: 0.45,
    hubs: [
      [-0.8, 0, 1.1],
      [0.8, 0, 1.1],
      [-0.8, 0, -1.1],
      [0.8, 0, -1.1],
    ],
    colliders: [col([0, 0, 0], [1.6, 0.6, 3.2])],
    sockets: [{ name: 'seat', at: [0, 0.35, 0.2] }],
    lamps,
    parts: {},
  };
}

/* ══════════════════════════════════════════════════════════════════════
   Hauler  — two-seat cab, flat bed, ~5.9 m
   body ≤ 7 children (gunmetal, darkSteel, glass, copper, hazard + 2 lamps)
   ══════════════════════════════════════════════════════════════════════ */

export function hauler(m: LabMaterials, o: { stage: number }): Rover {
  const s = o.stage;
  const seg = s === 1 ? 6 : 12;
  const ps: Part[] = [];
  const lamps: THREE.Mesh[] = [];

  /* — chassis / bumper (darkSteel) — */
  ps.push({ geo: new THREE.BoxGeometry(2.0, 0.1, 5.6), pos: [0, 0, -0.2], mat: m.darkSteel });
  ps.push({ geo: new THREE.BoxGeometry(1.5, 0.12, 0.08), pos: [0, 0.15, 2.85], mat: m.darkSteel });

  /* — cab (darkSteel) — */
  ps.push({ geo: new THREE.BoxGeometry(1.8, 0.06, 1.5), pos: [0, 0.5, 2.0], mat: m.darkSteel });
  ps.push({ geo: new THREE.BoxGeometry(1.8, 1.0, 0.06), pos: [0, 1.0, 2.72], mat: m.darkSteel });
  ps.push({ geo: new THREE.BoxGeometry(1.8, 1.0, 0.06), pos: [0, 1.0, 1.25], mat: m.darkSteel });
  ps.push({ geo: new THREE.BoxGeometry(0.06, 1.0, 1.5), pos: [-0.87, 1.0, 2.0], mat: m.darkSteel });
  ps.push({ geo: new THREE.BoxGeometry(0.06, 1.0, 1.5), pos: [0.87, 1.0, 2.0], mat: m.darkSteel });
  ps.push({ geo: new THREE.BoxGeometry(1.9, 0.06, 1.6), pos: [0, 1.53, 2.0], mat: m.darkSteel });

  /* — flat bed (darkSteel) — */
  ps.push({ geo: new THREE.BoxGeometry(2.0, 0.06, 3.2), pos: [0, 0.1, -1.0], mat: m.darkSteel });

  /* — frame (gunmetal) — */
  ps.push({ geo: new THREE.BoxGeometry(0.06, 0.3, 3.2), pos: [-1.0, 0.28, -1.0], mat: m.gunmetal });
  ps.push({ geo: new THREE.BoxGeometry(0.06, 0.3, 3.2), pos: [1.0, 0.28, -1.0], mat: m.gunmetal });
  ps.push({ geo: new THREE.BoxGeometry(0.3, 0.06, 0.8), pos: [-1.12, -0.05, 1.8], mat: m.gunmetal });
  ps.push({ geo: new THREE.BoxGeometry(0.3, 0.06, 0.8), pos: [1.12, -0.05, 1.8], mat: m.gunmetal });

  /* — axles — */
  const az: number[] = [1.8, -0.6, -1.8];
  for (const z of az) {
    ps.push({ geo: new THREE.BoxGeometry(2.2, 0.1, 0.1), pos: [0, -0.05, z], mat: m.gunmetal });
  }

  /* — storage bin + lid — */
  ps.push({ geo: new THREE.BoxGeometry(1.2, 0.5, 0.9), pos: [0, 0.42, -1.5], mat: m.gunmetal });
  ps.push({ geo: new THREE.BoxGeometry(1.22, 0.04, 0.92), pos: [0, 0.69, -1.5], mat: m.gunmetal });

  /* — tow hitch — */
  ps.push({ geo: new THREE.BoxGeometry(0.3, 0.12, 0.35), pos: [0, 0.0, -2.85], mat: m.gunmetal });
  ps.push({
    geo: new THREE.CylinderGeometry(0.04, 0.04, 0.3, seg),
    pos: [0, 0.0, -3.0],
    rot: [0, 0, Math.PI / 2],
    mat: m.gunmetal,
  });

  /* — windshield (glass) — */
  ps.push({ geo: new THREE.BoxGeometry(1.5, 0.5, 0.03), pos: [0, 1.2, 2.74], mat: m.glass });

  /* — link dish (copper) — */
  ps.push({ geo: new THREE.CylinderGeometry(0.3, 0.3, 0.04, seg), pos: [0, 0.9, -1.5], mat: m.copper });
  if (s >= 6) {
    const fins: number[] = [0, 1, 2, 3];
    for (const fi of fins) {
      const a = (fi / 4) * Math.PI * 2;
      ps.push({
        geo: new THREE.BoxGeometry(0.02, 0.08, 0.2),
        pos: [Math.cos(a) * 0.15, 0.94, -1.5 + Math.sin(a) * 0.15],
        rot: [0, a, 0],
        mat: m.copper,
      });
    }
  }

  /* — hazard bands — */
  ps.push({ geo: new THREE.BoxGeometry(0.015, 0.1, 5.0), pos: [-1.01, 0.2, -0.2], mat: m.hazard });
  ps.push({ geo: new THREE.BoxGeometry(0.015, 0.1, 5.0), pos: [1.01, 0.2, -0.2], mat: m.hazard });

  /* — headlamps — */
  lamps.push(
    lampMesh([-0.6, 0.6, 2.76], 0.06, seg, freshLampMat()),
    lampMesh([0.6, 0.6, 2.76], 0.06, seg, freshLampMat()),
  );

  const body = assemble(ps);
  for (const l of lamps) body.add(l);

  const hubs: [number, number, number][] = [
    [-1.0, 0, 1.8],
    [1.0, 0, 1.8],
    [-1.0, 0, -0.6],
    [1.0, 0, -0.6],
    [-1.0, 0, -1.8],
    [1.0, 0, -1.8],
  ];

  return {
    body,
    wheel: buildWheel(0.55, 0.22, s, m),
    wheelRadius: 0.55,
    hubs,
    colliders: [col([0, 0.2, -0.2], [2.2, 1.2, 6.0])],
    sockets: [
      { name: 'seat', at: [-0.4, 0.7, 1.8] },
      { name: 'seat', at: [0.4, 0.7, 1.8] },
      { name: 'dish', at: [0, 0.92, -1.5] },
    ],
    lamps,
    parts: {},
  };
}

/* ══════════════════════════════════════════════════════════════════════
   Crawler  — tracked, armoured, ~7.0 m
   body ≤ 8 children (gunmetal, darkSteel, rubber, copper, hazard,
                      arm-group + 2 lamps)
   ══════════════════════════════════════════════════════════════════════ */

export function crawler(m: LabMaterials, o: { stage: number }): Rover {
  const s = o.stage;
  const seg = s === 1 ? 6 : 12;
  const ps: Part[] = [];
  const lamps: THREE.Mesh[] = [];

  /* — hull (darkSteel) — */
  ps.push({ geo: new THREE.BoxGeometry(1.8, 0.7, 5.5), pos: [0, 0.35, -0.25], mat: m.darkSteel });

  /* — cab (darkSteel) — */
  ps.push({ geo: new THREE.BoxGeometry(1.6, 1.0, 1.5), pos: [0, 1.2, 1.8], mat: m.darkSteel });
  ps.push({ geo: new THREE.BoxGeometry(1.7, 0.06, 1.6), pos: [0, 1.73, 1.8], mat: m.darkSteel });

  /* — track frames (gunmetal) — */
  ps.push({ geo: new THREE.BoxGeometry(0.45, 0.55, 5.5), pos: [-1.1, 0.28, -0.25], mat: m.gunmetal });
  ps.push({ geo: new THREE.BoxGeometry(0.45, 0.55, 5.5), pos: [1.1, 0.28, -0.25], mat: m.gunmetal });

  /* — track pads (rubber) — */
  ps.push({ geo: new THREE.BoxGeometry(0.04, 0.55, 5.5), pos: [-1.34, 0.28, -0.25], mat: m.rubber });
  ps.push({ geo: new THREE.BoxGeometry(0.04, 0.55, 5.5), pos: [1.34, 0.28, -0.25], mat: m.rubber });

  /* — road wheels (rubber) — */
  const wps: number[] = [-2.0, -1.0, 0.0, 1.0, 2.0];
  for (const wz of wps) {
    ps.push({
      geo: new THREE.CylinderGeometry(0.2, 0.2, 0.3, seg),
      pos: [-1.1, 0.05, wz],
      rot: [0, 0, Math.PI / 2],
      mat: m.rubber,
    });
    ps.push({
      geo: new THREE.CylinderGeometry(0.2, 0.2, 0.3, seg),
      pos: [1.1, 0.05, wz],
      rot: [0, 0, Math.PI / 2],
      mat: m.rubber,
    });
  }

  /* — sensor mast pole (gunmetal) — */
  ps.push({ geo: new THREE.CylinderGeometry(0.02, 0.025, 1.0, seg), pos: [0, 2.4, -1.0], mat: m.gunmetal });

  /* — heat-sink spine (copper) — */
  ps.push({ geo: new THREE.BoxGeometry(0.8, 0.12, 3.5), pos: [0, 1.82, -0.5], mat: m.copper });
  const finIdx: number[] = [0, 1, 2, 3, 4, 5];
  for (const i of finIdx) {
    ps.push({ geo: new THREE.BoxGeometry(0.8, 0.15, 0.03), pos: [0, 1.95, -2.0 + i * 0.7], mat: m.copper });
  }

  /* — sensor mast base (copper) — */
  ps.push({ geo: new THREE.CylinderGeometry(0.05, 0.07, 0.3, seg), pos: [0, 1.9, -1.0], mat: m.copper });

  /* — hazard bands — */
  ps.push({ geo: new THREE.BoxGeometry(0.015, 0.12, 5.0), pos: [-0.92, 0.7, -0.25], mat: m.hazard });
  ps.push({ geo: new THREE.BoxGeometry(0.015, 0.12, 5.0), pos: [0.92, 0.7, -0.25], mat: m.hazard });

  /* — headlamps — */
  lamps.push(
    lampMesh([-0.5, 1.3, 2.58], 0.06, seg, freshLampMat()),
    lampMesh([0.5, 1.3, 2.58], 0.06, seg, freshLampMat()),
  );

  /* — drill arm (separate group, origin at hinge) — */
  const armGroup = new THREE.Group();
  armGroup.position.set(0, 1.2, 2.6);
  const armPs: Part[] = [
    { geo: new THREE.BoxGeometry(0.2, 0.15, 1.4), pos: [0, 0, 0.7], mat: m.gunmetal },
    {
      geo: new THREE.CylinderGeometry(0.08, 0.08, 0.25, seg),
      pos: [0, 0, 0],
      rot: [0, 0, Math.PI / 2],
      mat: m.gunmetal,
    },
    { geo: new THREE.CylinderGeometry(0.12, 0.05, 0.3, seg), pos: [0, -0.1, 1.4], mat: m.copper },
  ];
  const armBuilt = assemble(armPs);
  transfer(armBuilt, armGroup);

  /* — assemble body — */
  const body = assemble(ps);
  for (const l of lamps) body.add(l);
  body.add(armGroup);

  return {
    body,
    wheel: null,
    wheelRadius: 0,
    hubs: [],
    colliders: [col([0, 0.35, -0.25], [2.8, 1.0, 6.0])],
    sockets: [
      { name: 'seat', at: [0, 1.0, 1.5] },
      { name: 'drill', at: [0, 1.1, 4.0] },
      { name: 'mast', at: [0, 2.9, -1.0] },
    ],
    lamps,
    parts: { arm: armGroup },
  };
}

/* ══════════════════════════════════════════════════════════════════════
   Fabricator  — steel gantry ~5 m, 4.5 × 3 m bed
   ≤ 6 children (concrete, gunmetal, darkSteel, copper, hazard + head)
   ══════════════════════════════════════════════════════════════════════ */

export function fabricator(m: LabMaterials, o: { stage: number }): Station {
  const s = o.stage;
  const seg = s === 1 ? 6 : 12;
  const ps: Part[] = [];

  /* — base plate (concrete) — */
  ps.push({ geo: new THREE.BoxGeometry(4.5, 0.08, 3.0), pos: [0, 0.04, 0], mat: m.concrete });

  /* — gantry legs (gunmetal) — */
  const gp: [number, number, number][] = [
    [-2.0, 2.5, 1.2],
    [2.0, 2.5, 1.2],
    [-2.0, 2.5, -1.2],
    [2.0, 2.5, -1.2],
  ];
  for (const p of gp) {
    ps.push({ geo: new THREE.BoxGeometry(0.15, 5.0, 0.15), pos: p, mat: m.gunmetal });
  }

  /* — cross beams (gunmetal) — */
  ps.push({ geo: new THREE.BoxGeometry(4.15, 0.12, 0.12), pos: [0, 5.0, 1.2], mat: m.gunmetal });
  ps.push({ geo: new THREE.BoxGeometry(4.15, 0.12, 0.12), pos: [0, 5.0, -1.2], mat: m.gunmetal });
  ps.push({ geo: new THREE.BoxGeometry(0.12, 0.12, 2.52), pos: [-2.0, 5.0, 0], mat: m.gunmetal });
  ps.push({ geo: new THREE.BoxGeometry(0.12, 0.12, 2.52), pos: [2.0, 5.0, 0], mat: m.gunmetal });

  /* — S6 extra bracing (gunmetal) — */
  if (s >= 6) {
    const br: [number, number, number][] = [[-2.0, 2.5, 0], [2.0, 2.5, 0]];
    for (const p of br) {
      ps.push({ geo: new THREE.BoxGeometry(0.06, 0.06, 2.52), pos: p, mat: m.gunmetal });
    }
  }

  /* — console body (darkSteel) — */
  ps.push({ geo: new THREE.BoxGeometry(0.5, 0.9, 0.5), pos: [-1.7, 0.5, 1.1], mat: m.darkSteel });

  /* — console panel (gunmetal) — */
  ps.push({ geo: new THREE.BoxGeometry(0.4, 0.3, 0.02), pos: [-1.7, 0.9, 1.36], mat: m.gunmetal });

  /* — cable glands (copper) — */
  const cg: [number, number, number][] = [
    [-2.0, 0.12, -1.3],
    [2.0, 0.12, -1.3],
    [0, 0.12, -1.3],
  ];
  for (const p of cg) {
    ps.push({ geo: new THREE.CylinderGeometry(0.05, 0.05, 0.1, seg), pos: p, mat: m.copper });
  }

  /* — hazard markings — */
  ps.push({ geo: new THREE.BoxGeometry(0.3, 0.04, 0.04), pos: [-2.0, 0.1, 1.2], mat: m.hazard });
  ps.push({ geo: new THREE.BoxGeometry(0.3, 0.04, 0.04), pos: [2.0, 0.1, 1.2], mat: m.hazard });
  ps.push({ geo: new THREE.BoxGeometry(0.15, 0.04, 0.02), pos: [-1.7, 0.7, 1.36], mat: m.hazard });

  /* — print head (separate group, origin at beam centre) — */
  const headGroup = new THREE.Group();
  headGroup.position.set(0, 5.0, 1.2);
  const headPs: Part[] = [
    { geo: new THREE.BoxGeometry(0.35, 0.2, 0.3), pos: [0, -0.1, 0], mat: m.darkSteel },
    { geo: new THREE.CylinderGeometry(0.05, 0.03, 0.15, seg), pos: [0, -0.25, 0], mat: m.copper },
  ];
  if (s >= 6) {
    headPs.push({ geo: new THREE.BoxGeometry(0.1, 0.04, 0.04), pos: [0.15, -0.05, 0], mat: m.hazard });
  }
  const headBuilt = assemble(headPs);
  transfer(headBuilt, headGroup);

  /* — assemble — */
  const group = assemble(ps);
  group.add(headGroup);

  return {
    group,
    colliders: [col([0, 0.04, 0], [4.5, 0.08, 3.0])],
    sockets: [
      { name: 'bed', at: [0, 0.08, 0] },
      { name: 'power', at: [-2.0, 0.12, -1.3] },
    ],
    lamps: [],
    parts: { head: headGroup },
  };
}
