import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export interface LabMaterials {
  gunmetal: THREE.MeshStandardMaterial;
  darkSteel: THREE.MeshStandardMaterial;
  paint: THREE.MeshStandardMaterial;
  copper: THREE.MeshStandardMaterial;
  rubber: THREE.MeshStandardMaterial;
  hazard: THREE.MeshStandardMaterial;
  glass: THREE.MeshPhysicalMaterial;
  concrete: THREE.MeshStandardMaterial;
}

export interface Box {
  min: [number, number, number];
  max: [number, number, number];
}

export interface Piece {
  group: THREE.Group;
  colliders: Box[];
  lamps: THREE.Mesh[];
}

type GeoList = THREE.BufferGeometry[];

interface Buckets {
  gunmetal: GeoList;
  darkSteel: GeoList;
  paint: GeoList;
  copper: GeoList;
  rubber: GeoList;
  hazard: GeoList;
  glass: GeoList;
  concrete: GeoList;
}

const PI = Math.PI;
const CELL = 4;
const STOREY = 3;
const WALL_T = 0.25;
const COL_W = 0.4;
const RAMP_ANG = Math.atan2(STOREY, CELL);
const RAMP_Y = 0.12;
const MAT_ORDER: (keyof Buckets)[] = [
  'concrete',
  'gunmetal',
  'darkSteel',
  'paint',
  'hazard',
  'copper',
  'rubber',
  'glass',
];

export function createMaterials(): LabMaterials {
  return {
    gunmetal: new THREE.MeshStandardMaterial({
      color: 0x5a6570,
      metalness: 0.84,
      roughness: 0.36,
    }),
    darkSteel: new THREE.MeshStandardMaterial({
      color: 0x24282e,
      metalness: 0.9,
      roughness: 0.44,
    }),
    paint: new THREE.MeshStandardMaterial({
      color: 0xc9c2b4,
      metalness: 0.12,
      roughness: 0.64,
    }),
    copper: new THREE.MeshStandardMaterial({
      color: 0xb26a38,
      metalness: 0.94,
      roughness: 0.3,
    }),
    rubber: new THREE.MeshStandardMaterial({
      color: 0x161618,
      metalness: 0.04,
      roughness: 0.94,
    }),
    hazard: new THREE.MeshStandardMaterial({
      color: 0xf0c200,
      metalness: 0.22,
      roughness: 0.5,
    }),
    glass: new THREE.MeshPhysicalMaterial({
      color: 0x7fe8a8,
      metalness: 0.12,
      roughness: 0.16,
      emissive: 0x1c8a4a,
      emissiveIntensity: 0.9,
    }),
    concrete: new THREE.MeshStandardMaterial({
      color: 0x8e8980,
      metalness: 0.05,
      roughness: 0.88,
    }),
  };
}

export function triangles(p: Piece): number {
  let n = 0;
  p.group.traverse((obj) => {
    if (!(obj instanceof THREE.Mesh)) return;
    const geo = obj.geometry;
    const idx = geo.getIndex();
    if (idx !== null) {
      n += idx.count / 3;
      return;
    }
    const pos = geo.getAttribute('position');
    if (pos === undefined) return;
    n += pos.count / 3;
  });
  return n;
}

export function foundation(m: LabMaterials, opts: { stage: number; skirt?: number }): Piece {
  const hi = opts.stage > 1;
  const skirtIn = opts.skirt;
  const skirt = skirtIn === undefined ? 1 : skirtIn < 0 ? 0 : skirtIn > 3 ? 3 : skirtIn;
  const mats = stageMaterials(m, opts.stage);
  const b = buckets();
  const chamfer = hi ? 0.07 : 0;
  b.concrete.push(slabGeo(CELL, CELL, 0.5, chamfer));

  const bandH = hi ? 0.1 : 0.16;
  const bandY = hi ? -0.07 : -0.1;
  const bandD = hi ? 0.035 : 0.06;
  const stripes = hi ? 16 : 1;
  stripesAlongX(b.hazard, b.darkSteel, 0.02, 3.98, bandY, bandD / 2, bandH, bandD, stripes);
  stripesAlongX(b.hazard, b.darkSteel, 0.02, 3.98, bandY, 4 - bandD / 2, bandH, bandD, stripes);
  stripesAlongZ(b.hazard, b.darkSteel, bandD / 2, bandY, 0.12, 3.88, bandH, bandD, stripes);
  stripesAlongZ(b.hazard, b.darkSteel, 4 - bandD / 2, bandY, 0.12, 3.88, bandH, bandD, stripes);

  const yBot = -(0.5 + skirt);
  const yTop = -0.05;
  const sh = yTop - yBot;
  const yM = (yTop + yBot) / 2;
  const st = hi ? 0.042 : 0.08;
  b.darkSteel.push(box(CELL, sh, st, 2, yM, st / 2));
  b.darkSteel.push(box(CELL, sh, st, 2, yM, 4 - st / 2));
  b.darkSteel.push(box(st, sh, CELL - 2 * st, st / 2, yM, 2));
  b.darkSteel.push(box(st, sh, CELL - 2 * st, 4 - st / 2, yM, 2));

  b.gunmetal.push(box(CELL, 0.06, 0.14, 2, yBot + 0.03, 0.09));
  b.gunmetal.push(box(CELL, 0.06, 0.14, 2, yBot + 0.03, 3.91));
  b.gunmetal.push(box(0.14, 0.06, CELL - 0.28, 0.09, yBot + 0.03, 2));
  b.gunmetal.push(box(0.14, 0.06, CELL - 0.28, 3.91, yBot + 0.03, 2));

  if (hi) {
    const ribs = 7;
    for (let i = 1; i <= ribs; i++) {
      const u = (i / (ribs + 1)) * CELL;
      b.gunmetal.push(box(0.07, sh - 0.08, 0.05, u, yM, st + 0.03));
      b.gunmetal.push(box(0.07, sh - 0.08, 0.05, u, yM, 4 - st - 0.03));
      b.gunmetal.push(box(0.05, sh - 0.08, 0.07, st + 0.03, yM, u));
      b.gunmetal.push(box(0.05, sh - 0.08, 0.07, 4 - st - 0.03, yM, u));
    }
    const rows = Math.max(2, Math.floor(sh / 0.32));
    for (let i = 0; i < rows; i++) {
      const yy = yBot + 0.16 + (i + 0.5) * ((sh - 0.28) / rows);
      b.darkSteel.push(box(3.72, 0.035, 0.028, 2, yy, st + 0.02));
      b.darkSteel.push(box(3.72, 0.035, 0.028, 2, yy, 4 - st - 0.02));
      b.darkSteel.push(box(0.028, 0.035, 3.72, st + 0.02, yy, 2));
      b.darkSteel.push(box(0.028, 0.035, 3.72, 4 - st - 0.02, yy, 2));
    }
    const anchors: [number, number][] = [
      [0.38, 0.38],
      [3.62, 0.38],
      [0.38, 3.62],
      [3.62, 3.62],
    ];
    for (const a of anchors) {
      const ax = a[0];
      const az = a[1];
      b.gunmetal.push(cyl(0.055, 0.055, 0.01, 8, ax, 0.004, az));
      boltY(b.darkSteel, ax, 0.006, az, 0.95);
      b.gunmetal.push(box(0.22, 0.025, 0.22, ax, -0.02, az));
    }
    welds(b.darkSteel, 0.2, -0.5, 0.05, 3.8, -0.5, 0.05, 10, 0.028);
    welds(b.darkSteel, 0.2, -0.5, 3.95, 3.8, -0.5, 3.95, 10, 0.028);
  } else {
    b.gunmetal.push(box(0.28, 0.08, 0.28, 0.4, -0.04, 0.4));
    b.gunmetal.push(box(0.28, 0.08, 0.28, 3.6, -0.04, 0.4));
    b.gunmetal.push(box(0.28, 0.08, 0.28, 0.4, -0.04, 3.6));
    b.gunmetal.push(box(0.28, 0.08, 0.28, 3.6, -0.04, 3.6));
  }

  const { group } = buildGroup(b, mats);
  return {
    group,
    colliders: [{ min: [0, yBot, 0], max: [CELL, 0, CELL] }],
    lamps: [],
  };
}

export function wall(m: LabMaterials, opts: { stage: number }): Piece {
  const hi = opts.stage > 1;
  const mats = stageMaterials(m, opts.stage);
  const b = buckets();
  const zt = WALL_T;
  buildWallBody(b, hi, zt, false);
  const { group } = buildGroup(b, mats);
  return {
    group,
    colliders: [{ min: [0, 0, -zt / 2], max: [CELL, STOREY, zt / 2] }],
    lamps: [],
  };
}

export function pillar(m: LabMaterials, opts: { stage: number }): Piece {
  const hi = opts.stage > 1;
  const mats = stageMaterials(m, opts.stage);
  const b = buckets();
  const w = COL_W;
  const base = hi ? 0.72 : 0.7;
  b.darkSteel.push(box(base, hi ? 0.055 : 0.08, base, 0, 0.028, 0));
  b.darkSteel.push(box(hi ? 0.52 : 0.5, hi ? 0.05 : 0.07, hi ? 0.52 : 0.5, 0, STOREY - 0.025, 0));

  if (hi) {
    b.gunmetal.push(chamferedColumn(w, 2.86, 0.035, 0, 0.07, 0));
    for (let face = 0; face < 4; face++) {
      const ang = (face * PI) / 2;
      const nx = Math.cos(ang);
      const nz = Math.sin(ang);
      b.darkSteel.push(box(0.22, 0.012, 0.08, nx * 0.06, 1.55, nz * 0.06, 0, -ang, 0));
    }
  } else {
    b.gunmetal.push(box(w, 2.86, w, 0, 1.5, 0));
  }

  const bandY = 1.0;
  const bandH = hi ? 0.16 : 0.2;
  const faces: [number, number, number, number, number][] = [
    [w + 0.012, bandH, 0.03, 0, w / 2 + 0.012],
    [w + 0.012, bandH, 0.03, 0, -(w / 2 + 0.012)],
    [0.03, bandH, w + 0.012, w / 2 + 0.012, 0],
    [0.03, bandH, w + 0.012, -(w / 2 + 0.012), 0],
  ];
  for (let fi = 0; fi < faces.length; fi++) {
    const f = faces[fi];
    if (f === undefined) continue;
    if (!hi) {
      b.hazard.push(box(f[0], f[1], f[2], f[3], bandY, f[4]));
      continue;
    }
    const n = 3;
    const useX = f[0] > f[2];
    const span = useX ? f[0] : f[2];
    const pitch = span / n;
    for (let i = 0; i < n; i++) {
      const dest = i % 2 === 0 ? b.hazard : b.darkSteel;
      const cx = useX ? f[3] - span / 2 + (i + 0.5) * pitch : f[3];
      const cz = useX ? f[4] : f[4] - span / 2 + (i + 0.5) * pitch;
      dest.push(box(useX ? pitch * 0.94 : f[0], f[1], useX ? f[2] : pitch * 0.94, cx, bandY, cz));
    }
  }

  const gW = hi ? 0.05 : 0.09;
  const gL = hi ? 0.22 : 0.2;
  const gH = hi ? 0.22 : 0.2;
  const gOff = w / 2 + gL / 2 - 0.01;
  const gY = 0.055 + gH / 2;
  const dirs: [number, number, number][] = [
    [gOff, 0, 0],
    [-gOff, 0, 0],
    [0, 0, gOff],
    [0, 0, -gOff],
  ];
  for (let di = 0; di < dirs.length; di++) {
    const d = dirs[di];
    if (d === undefined) continue;
    const alongX = Math.abs(d[0]) > Math.abs(d[2]);
    if (alongX) {
      if (hi) {
        b.darkSteel.push(box(gL, 0.045, gW, d[0], 0.07, 0));
        b.darkSteel.push(box(0.045, gH, gW, (w / 2 + 0.02) * Math.sign(d[0]), gY, 0));
      }
      b.darkSteel.push(
        box(gL * 1.05, hi ? 0.04 : 0.09, gW * (hi ? 0.85 : 1), d[0], gY - 0.02, 0, 0, 0, -Math.sign(d[0]) * (PI / 4)),
      );
    } else {
      if (hi) {
        b.darkSteel.push(box(gW, 0.045, gL, 0, 0.07, d[2]));
        b.darkSteel.push(box(gW, gH, 0.045, 0, gY, (w / 2 + 0.02) * Math.sign(d[2])));
      }
      b.darkSteel.push(
        box(gW * (hi ? 0.85 : 1), hi ? 0.04 : 0.09, gL * 1.05, 0, gY - 0.02, d[2], Math.sign(d[2]) * (PI / 4), 0, 0),
      );
    }
  }

  if (hi) {
    const boltR = base / 2 - 0.08;
    boltY(b.darkSteel, boltR, 0.06, boltR, 1);
    boltY(b.darkSteel, -boltR, 0.06, boltR, 1);
    boltY(b.darkSteel, boltR, 0.06, -boltR, 1);
    boltY(b.darkSteel, -boltR, 0.06, -boltR, 1);
    welds(b.gunmetal, -0.16, 0.08, w / 2, 0.16, 0.08, w / 2, 5, 0.02);
    welds(b.gunmetal, -0.16, 0.08, -w / 2, 0.16, 0.08, -w / 2, 5, 0.02);
  }

  const { group } = buildGroup(b, mats);
  const hw = base / 2;
  return {
    group,
    colliders: [{ min: [-hw, 0, -hw], max: [hw, STOREY, hw] }],
    lamps: [],
  };
}

export function floor(m: LabMaterials, opts: { stage: number }): Piece {
  const hi = opts.stage > 1;
  const mats = stageMaterials(m, opts.stage);
  const b = buckets();
  const thick = 0.3;
  b.gunmetal.push(box(CELL, hi ? 0.26 : thick, CELL, 2, hi ? -0.17 : -thick / 2, 2));

  const lipH = hi ? 0.045 : 0.05;
  const lipW = hi ? 0.08 : 0.1;
  const lipY = lipH / 2 - 0.002;
  b.paint.push(box(CELL, lipH, lipW, 2, lipY, lipW / 2));
  b.paint.push(box(CELL, lipH, lipW, 2, lipY, 4 - lipW / 2));
  b.paint.push(box(CELL - 2 * lipW, lipH, lipW, lipW / 2, lipY, 2));
  b.paint.push(box(CELL - 2 * lipW, lipH, lipW, 4 - lipW / 2, lipY, 2));

  if (hi) {
    const gap = 0.028;
    const n = 4;
    const plate = (CELL - (n + 1) * gap) / n;
    for (let ix = 0; ix < n; ix++) {
      for (let iz = 0; iz < n; iz++) {
        const cx = gap + plate / 2 + ix * (plate + gap);
        const cz = gap + plate / 2 + iz * (plate + gap);
        b.paint.push(box(plate, 0.05, plate, cx, -0.02, cz));
      }
    }
    for (let i = 1; i < n; i++) {
      const u = i * (plate + gap) + gap / 2;
      b.darkSteel.push(box(3.9, 0.012, 0.03, 2, -0.002, u));
      b.darkSteel.push(box(0.03, 0.012, 3.9, u, -0.002, 2));
    }
    const beams = 3;
    for (let i = 1; i <= beams; i++) {
      const u = (i / (beams + 1)) * CELL;
      b.darkSteel.push(box(0.1, 0.12, 3.7, u, -0.3, 2));
      b.darkSteel.push(box(3.7, 0.12, 0.1, 2, -0.3, u));
    }
    const pads: [number, number][] = [
      [0.35, 0.35],
      [3.65, 0.35],
      [0.35, 3.65],
      [3.65, 3.65],
    ];
    for (const p of pads) {
      b.darkSteel.push(box(0.22, 0.04, 0.22, p[0], -0.34, p[1]));
    }
    welds(b.darkSteel, 0.15, 0.0, 0.08, 3.85, 0.0, 0.08, 8, 0.02);
    welds(b.darkSteel, 0.15, 0.0, 3.92, 3.85, 0.0, 3.92, 8, 0.02);
  }

  const { group } = buildGroup(b, mats);
  return {
    group,
    colliders: [{ min: [0, -thick, 0], max: [CELL, 0, CELL] }],
    lamps: [],
  };
}

export function ramp(m: LabMaterials, opts: { stage: number }): Piece {
  const hi = opts.stage > 1;
  const mats = stageMaterials(m, opts.stage);
  const b = buckets();

  if (hi) {
    const bars = 13;
    const span = 3.62;
    const x0 = 0.19;
    for (let i = 0; i < bars; i++) {
      const x = x0 + (i + 0.5) * (span / bars);
      b.gunmetal.push(rampBox(0.055, 0.03, 4.86, x, 0.02, 0));
    }
    const cross = 6;
    for (let i = 0; i < cross; i++) {
      const lz = -2.28 + (i + 0.5) * (4.56 / cross);
      b.darkSteel.push(rampBox(3.7, 0.035, 0.055, 2, -0.01, lz));
    }
    b.darkSteel.push(rampBox(0.12, 0.08, 4.96, 0.22, 0.0, 0));
    b.darkSteel.push(rampBox(0.12, 0.08, 4.96, 3.78, 0.0, 0));
  } else {
    b.gunmetal.push(rampBox(3.7, 0.14, 4.9, 2, 0.0, 0));
  }

  b.darkSteel.push(rampBox(0.12, hi ? 0.2 : 0.24, 4.78, 0.1, -0.1, 0));
  b.darkSteel.push(rampBox(0.12, hi ? 0.2 : 0.24, 4.78, 3.9, -0.1, 0));

  const kickH = hi ? 0.12 : 0.18;
  stripesRampKick(b, 0.16, kickH, hi);
  stripesRampKick(b, 3.84, kickH, hi);

  if (hi) {
    const zs = [0.25, 1.15, 2.05, 2.95, 3.75];
    for (const z of zs) {
      const yDeck = (STOREY / CELL) * z + 0.06;
      b.gunmetal.push(box(0.045, 0.92, 0.045, 0.12, yDeck + 0.46, z));
      b.gunmetal.push(box(0.045, 0.92, 0.045, 3.88, yDeck + 0.46, z));
    }
    b.paint.push(rampBox(0.05, 0.05, 4.95, 0.12, 0.98, 0));
    b.paint.push(rampBox(0.05, 0.05, 4.95, 3.88, 0.98, 0));
    b.paint.push(rampBox(0.04, 0.04, 4.95, 0.12, 0.52, 0));
    b.paint.push(rampBox(0.04, 0.04, 4.95, 3.88, 0.52, 0));
    const yNewel0 = 0.55;
    const yNewel1 = 3.55;
    b.darkSteel.push(box(0.08, 1.05, 0.08, 0.12, yNewel0, 0.12));
    b.darkSteel.push(box(0.08, 1.05, 0.08, 3.88, yNewel0, 0.12));
    b.darkSteel.push(box(0.08, 1.05, 0.08, 0.12, yNewel1, 3.88));
    b.darkSteel.push(box(0.08, 1.05, 0.08, 3.88, yNewel1, 3.88));
    welds(b.darkSteel, 0.16, 0.02, 0.05, 0.16, 0.02, 0.8, 4, 0.02);
  } else {
    b.paint.push(rampBox(0.1, 0.85, 4.9, 0.12, 0.48, 0));
    b.paint.push(rampBox(0.1, 0.85, 4.9, 3.88, 0.48, 0));
  }

  const { group } = buildGroup(b, mats);
  const colliders: Box[] = [];
  for (let i = 0; i < 4; i++) {
    const z0 = i;
    const z1 = i + 1;
    const y0 = (STOREY / CELL) * z0;
    const y1 = (STOREY / CELL) * z1;
    colliders.push({ min: [0.08, y0, z0], max: [3.92, y1 + 0.14, z1] });
  }
  return { group, colliders, lamps: [] };
}

export function airlock(m: LabMaterials, opts: { stage: number }): Piece {
  const hi = opts.stage > 1;
  const mats = stageMaterials(m, opts.stage);
  const b = buckets();
  const zt = WALL_T;
  const doorW = 1.4;
  const doorH = 2.3;
  const doorX = 2;
  const doorBot = 0.12;
  const doorTop = doorBot + doorH;
  const xL = doorX - doorW / 2;
  const xR = doorX + doorW / 2;

  buildWallBody(b, hi, zt, true, xL, xR, doorTop);

  const frameT = hi ? 0.12 : 0.16;
  const frameD = hi ? 0.34 : 0.32;
  b.gunmetal.push(box(doorW + frameT * 2, frameT, frameD, doorX, doorTop + frameT / 2, 0));
  b.gunmetal.push(box(frameT, doorH + frameT, frameD, xL - frameT / 2, doorBot + doorH / 2, 0));
  b.gunmetal.push(box(frameT, doorH + frameT, frameD, xR + frameT / 2, doorBot + doorH / 2, 0));
  b.gunmetal.push(box(doorW + frameT * 2, 0.1, frameD, doorX, doorBot - 0.02, 0));

  if (hi) {
    b.paint.push(roundedDoor(doorW - 0.06, doorH - 0.06, 0.1, 0.16, 4, doorX, doorBot + doorH / 2, 0.02));
    b.darkSteel.push(roundedDoor(doorW - 0.02, doorH - 0.02, 0.05, 0.18, 4, doorX, doorBot + doorH / 2, -0.03));
    const dogs = 8;
    for (let i = 0; i < dogs; i++) {
      let dx = doorX;
      let dy = doorBot + doorH / 2;
      if (i < 3) {
        dx = xL + 0.08 + i * ((doorW - 0.16) / 2);
        dy = doorTop - 0.12;
      } else if (i < 5) {
        dx = i === 3 ? xL + 0.1 : xR - 0.1;
        dy = doorBot + doorH / 2;
      } else {
        dx = xL + 0.08 + (i - 5) * ((doorW - 0.16) / 2);
        dy = doorBot + 0.12;
      }
      b.darkSteel.push(box(0.1, 0.045, 0.08, dx, dy, 0.12));
      b.gunmetal.push(box(0.035, 0.035, 0.12, dx, dy, 0.18));
    }
    const stripeN = 8;
    for (let i = 0; i < stripeN; i++) {
      const dest = i % 2 === 0 ? b.hazard : b.darkSteel;
      dest.push(box((doorW - 0.2) / stripeN, 0.12, 0.02, xL + 0.1 + (i + 0.5) * ((doorW - 0.2) / stripeN), doorBot + 0.28, 0.08));
    }
    b.darkSteel.push(cyl(0.2, 0.2, 0.04, 10, doorX + 0.28, 1.55, 0.1, PI / 2, 0, 0));
    b.glass.push(cyl(0.15, 0.15, 0.03, 10, doorX + 0.28, 1.55, 0.13, PI / 2, 0, 0));
    b.copper.push(cyl(0.07, 0.08, 0.05, 8, doorX - 0.55, 2.05, 0.16, PI / 2, 0, 0));
    b.copper.push(box(0.08, 0.12, 0.06, doorX - 0.55, 1.92, 0.12));
    b.glass.push(cyl(0.05, 0.05, 0.015, 8, doorX - 0.55, 2.05, 0.19, PI / 2, 0, 0));
    b.darkSteel.push(box(0.18, 0.1, 0.12, doorX, doorTop + 0.22, 0.14));
    b.glass.push(cyl(0.045, 0.045, 0.06, 8, doorX, doorTop + 0.22, 0.2, PI / 2, 0, 0));
    b.gunmetal.push(box(0.02, 0.08, 0.08, doorX - 0.07, doorTop + 0.22, 0.2));
    b.gunmetal.push(box(0.02, 0.08, 0.08, doorX + 0.07, doorTop + 0.22, 0.2));
    const bf = 6;
    for (let i = 0; i < bf; i++) {
      const yb = doorBot + 0.2 + i * ((doorH - 0.4) / (bf - 1));
      boltZ(b.darkSteel, xL - frameT / 2, yb, 0.18, 0.9, 1);
      boltZ(b.darkSteel, xR + frameT / 2, yb, 0.18, 0.9, 1);
    }
    welds(b.darkSteel, xL - 0.04, doorBot, 0.16, xL - 0.04, doorTop, 0.16, 8, 0.018);
  } else {
    b.paint.push(box(doorW - 0.08, doorH - 0.08, 0.1, doorX, doorBot + doorH / 2, 0.02));
    b.hazard.push(box(doorW - 0.16, 0.18, 0.04, doorX, doorBot + 0.28, 0.08));
    b.darkSteel.push(box(0.22, 0.14, 0.16, doorX, doorTop + 0.2, 0.12));
    b.glass.push(box(0.12, 0.08, 0.08, doorX, doorTop + 0.2, 0.18));
    b.copper.push(box(0.12, 0.16, 0.1, doorX - 0.5, 2.0, 0.12));
  }

  const built = buildGroup(b, mats);
  const lamps: THREE.Mesh[] = [];
  const lampMesh = built.byName.glass;
  if (lampMesh !== undefined) lamps.push(lampMesh);

  const colliders: Box[] = [
    { min: [0, 0, -zt / 2], max: [xL, STOREY, zt / 2] },
    { min: [xR, 0, -zt / 2], max: [CELL, STOREY, zt / 2] },
    { min: [xL, doorTop, -zt / 2], max: [xR, STOREY, zt / 2] },
    { min: [xL, 0, -zt / 2], max: [xR, doorBot, zt / 2] },
  ];
  return { group: built.group, colliders, lamps };
}

function isHi(_stage: number): boolean {
  return _stage > 1;
}

function buckets(): Buckets {
  return {
    gunmetal: [],
    darkSteel: [],
    paint: [],
    copper: [],
    rubber: [],
    hazard: [],
    glass: [],
    concrete: [],
  };
}

function flattenMat<T extends THREE.MeshStandardMaterial>(mat: T): T {
  const c = mat.clone();
  c.flatShading = true;
  c.needsUpdate = true;
  return c;
}

function stageMaterials(src: LabMaterials, stage: number): LabMaterials {
  if (isHi(stage)) return src;
  return {
    gunmetal: flattenMat(src.gunmetal),
    darkSteel: flattenMat(src.darkSteel),
    paint: flattenMat(src.paint),
    copper: flattenMat(src.copper),
    rubber: flattenMat(src.rubber),
    hazard: flattenMat(src.hazard),
    glass: flattenMat(src.glass),
    concrete: flattenMat(src.concrete),
  };
}

function box(
  sx: number,
  sy: number,
  sz: number,
  x: number,
  y: number,
  z: number,
  rx = 0,
  ry = 0,
  rz = 0,
): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(sx, sy, sz);
  if (rx !== 0) g.rotateX(rx);
  if (ry !== 0) g.rotateY(ry);
  if (rz !== 0) g.rotateZ(rz);
  g.translate(x, y, z);
  return g;
}

function cyl(
  rTop: number,
  rBot: number,
  h: number,
  segs: number,
  x: number,
  y: number,
  z: number,
  rx = 0,
  ry = 0,
  rz = 0,
): THREE.BufferGeometry {
  const g = new THREE.CylinderGeometry(rTop, rBot, h, segs < 3 ? 3 : segs);
  if (rx !== 0) g.rotateX(rx);
  if (ry !== 0) g.rotateY(ry);
  if (rz !== 0) g.rotateZ(rz);
  g.translate(x, y, z);
  return g;
}

function boltY(dest: GeoList, x: number, y: number, z: number, s: number): void {
  dest.push(cyl(0.013 * s, 0.013 * s, 0.048 * s, 6, x, y, z));
  dest.push(cyl(0.024 * s, 0.021 * s, 0.02 * s, 6, x, y + 0.028 * s, z));
}

function boltZ(dest: GeoList, x: number, y: number, z: number, s: number, dir: number): void {
  dest.push(cyl(0.012 * s, 0.012 * s, 0.046 * s, 6, x, y, z, PI / 2, 0, 0));
  dest.push(cyl(0.022 * s, 0.02 * s, 0.018 * s, 6, x, y, z + dir * 0.028 * s, PI / 2, 0, 0));
}

function welds(
  dest: GeoList,
  x0: number,
  y0: number,
  z0: number,
  x1: number,
  y1: number,
  z1: number,
  n: number,
  s: number,
): void {
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n;
    dest.push(box(s, s * 0.7, s, x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, z0 + (z1 - z0) * t));
  }
}

function stripesAlongX(
  yellow: GeoList,
  black: GeoList,
  x0: number,
  x1: number,
  y: number,
  z: number,
  sy: number,
  sz: number,
  count: number,
): void {
  const n = count < 1 ? 1 : count;
  const w = (x1 - x0) / n;
  for (let i = 0; i < n; i++) {
    const dest = i % 2 === 0 ? yellow : black;
    dest.push(box(w * 0.96, sy, sz, x0 + (i + 0.5) * w, y, z));
  }
}

function stripesAlongZ(
  yellow: GeoList,
  black: GeoList,
  x: number,
  y: number,
  z0: number,
  z1: number,
  sy: number,
  sx: number,
  count: number,
): void {
  const n = count < 1 ? 1 : count;
  const w = (z1 - z0) / n;
  for (let i = 0; i < n; i++) {
    const dest = i % 2 === 0 ? yellow : black;
    dest.push(box(sx, sy, w * 0.96, x, y, z0 + (i + 0.5) * w));
  }
}

function slabGeo(w: number, d: number, thick: number, chamfer: number): THREE.BufferGeometry {
  if (chamfer <= 0) {
    return box(w, thick, d, w / 2, -thick / 2, d / 2);
  }
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.lineTo(w, 0);
  shape.lineTo(w, d);
  shape.lineTo(0, d);
  shape.closePath();
  const depth = thick - 2 * chamfer;
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: depth > 0.05 ? depth : 0.05,
    bevelEnabled: true,
    bevelThickness: chamfer,
    bevelSize: chamfer,
    bevelSegments: 1,
    steps: 1,
  });
  geo.rotateX(-PI / 2);
  geo.computeBoundingBox();
  const bb = geo.boundingBox;
  if (bb !== null) {
    geo.translate(-bb.min.x, -bb.max.y, -bb.min.z);
  }
  return geo;
}

function chamferedColumn(w: number, h: number, c: number, x: number, yBottom: number, z: number): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  const hw = w / 2;
  shape.moveTo(-hw + c, -hw);
  shape.lineTo(hw - c, -hw);
  shape.lineTo(hw, -hw + c);
  shape.lineTo(hw, hw - c);
  shape.lineTo(hw - c, hw);
  shape.lineTo(-hw + c, hw);
  shape.lineTo(-hw, hw - c);
  shape.lineTo(-hw, -hw + c);
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: h,
    bevelEnabled: false,
    steps: 1,
  });
  geo.rotateX(-PI / 2);
  geo.translate(x, yBottom, z);
  return geo;
}

function roundedDoor(
  w: number,
  h: number,
  t: number,
  r: number,
  segs: number,
  x: number,
  y: number,
  z: number,
): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  const hw = w / 2;
  const hh = h / 2;
  const rr = r;
  shape.moveTo(-hw + rr, -hh);
  shape.lineTo(hw - rr, -hh);
  shape.quadraticCurveTo(hw, -hh, hw, -hh + rr);
  shape.lineTo(hw, hh - rr);
  shape.quadraticCurveTo(hw, hh, hw - rr, hh);
  shape.lineTo(-hw + rr, hh);
  shape.quadraticCurveTo(-hw, hh, -hw, hh - rr);
  shape.lineTo(-hw, -hh + rr);
  shape.quadraticCurveTo(-hw, -hh, -hw + rr, -hh);
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: t,
    bevelEnabled: true,
    bevelThickness: 0.018,
    bevelSize: 0.014,
    bevelSegments: 1,
    curveSegments: segs < 2 ? 2 : segs,
    steps: 1,
  });
  geo.translate(0, 0, -t / 2);
  geo.translate(x, y, z);
  return geo;
}

function rampBox(
  sx: number,
  sy: number,
  sz: number,
  x: number,
  ly: number,
  lz: number,
): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(sx, sy, sz);
  g.translate(x, ly, lz);
  g.rotateX(-RAMP_ANG);
  g.translate(0, 1.5 + RAMP_Y, 2);
  return g;
}

function stripesRampKick(b: Buckets, x: number, kickH: number, hi: boolean): void {
  if (!hi) {
    b.hazard.push(rampBox(0.05, kickH, 4.85, x, 0.08, 0));
    return;
  }
  const n = 10;
  for (let i = 0; i < n; i++) {
    const dest = i % 2 === 0 ? b.hazard : b.darkSteel;
    const lz = -2.2 + (i + 0.5) * (4.4 / n);
    dest.push(rampBox(0.045, kickH, 4.4 / n - 0.04, x, 0.08, lz));
  }
}

function buildWallBody(
  b: Buckets,
  hi: boolean,
  zt: number,
  cutDoor: boolean,
  xL = 1.3,
  xR = 2.7,
  doorTop = 2.42,
): void {
  const postW = hi ? 0.14 : 0.2;
  b.gunmetal.push(box(postW, STOREY, zt, postW / 2, STOREY / 2, 0));
  b.gunmetal.push(box(postW, STOREY, zt, CELL - postW / 2, STOREY / 2, 0));
  if (hi) {
    b.gunmetal.push(box(CELL, 0.1, 0.05, 2, STOREY - 0.08, 0));
    b.gunmetal.push(box(CELL, 0.03, 0.3, 2, STOREY - 0.02, 0));
    b.gunmetal.push(box(CELL, 0.03, 0.28, 2, STOREY - 0.14, 0));
  } else {
    b.gunmetal.push(box(CELL, 0.18, 0.28, 2, STOREY - 0.06, 0));
  }

  const footH = hi ? 0.16 : 0.2;
  const footY = footH / 2;
  if (cutDoor) {
    stripesAlongX(b.hazard, b.darkSteel, 0.02, xL - 0.02, footY, 0, footH, zt + 0.04, hi ? 5 : 1);
    stripesAlongX(b.hazard, b.darkSteel, xR + 0.02, 3.98, footY, 0, footH, zt + 0.04, hi ? 5 : 1);
  } else {
    stripesAlongX(b.hazard, b.darkSteel, 0.02, 3.98, footY, 0, footH, zt + 0.04, hi ? 16 : 1);
  }

  if (cutDoor) {
    const leftW = xL - postW;
    const rightW = CELL - postW - xR;
    if (leftW > 0.2) {
      b.paint.push(box(leftW - 0.04, 2.52, zt - 0.08, postW + leftW / 2, 1.5, 0));
    }
    if (rightW > 0.2) {
      b.paint.push(box(rightW - 0.04, 2.52, zt - 0.08, xR + rightW / 2, 1.5, 0));
    }
    b.paint.push(box(xR - xL, STOREY - doorTop - 0.14, zt - 0.08, 2, (STOREY + doorTop) / 2, 0));
  } else if (hi) {
    const gaps = [0.22, 1.36, 2.64, 3.78];
    for (let i = 0; i < 3; i++) {
      const a = gaps[i];
      const c = gaps[i + 1];
      if (a === undefined || c === undefined) continue;
      b.paint.push(box(c - a - 0.06, 2.42, zt - 0.08, (a + c) / 2, 1.48, 0));
    }
    b.darkSteel.push(box(0.04, 2.42, zt - 0.04, 1.33, 1.48, 0));
    b.darkSteel.push(box(0.04, 2.42, zt - 0.04, 2.67, 1.48, 0));
    b.gunmetal.push(box(3.6, 0.08, zt, 2, 1.55, 0));
    for (let i = 0; i < 3; i++) {
      const a = gaps[i];
      const c = gaps[i + 1];
      if (a === undefined || c === undefined) continue;
      const cx = (a + c) / 2;
      boltZ(b.darkSteel, cx - 0.35, 0.45, zt / 2 + 0.01, 0.85, 1);
      boltZ(b.darkSteel, cx + 0.35, 0.45, zt / 2 + 0.01, 0.85, 1);
      boltZ(b.darkSteel, cx - 0.35, 2.45, zt / 2 + 0.01, 0.85, 1);
      boltZ(b.darkSteel, cx + 0.35, 2.45, zt / 2 + 0.01, 0.85, 1);
    }
    b.darkSteel.push(box(0.16, 0.16, 0.06, postW + 0.08, STOREY - 0.16, zt / 2));
    b.darkSteel.push(box(0.16, 0.16, 0.06, CELL - postW - 0.08, STOREY - 0.16, zt / 2));
    welds(b.darkSteel, 0.22, 0.28, zt / 2, 1.3, 0.28, zt / 2, 5, 0.018);
  } else {
    b.paint.push(box(3.52, 2.5, zt - 0.06, 2, 1.5, 0));
  }
}

function mergeList(list: THREE.BufferGeometry[]): THREE.BufferGeometry | null {
  if (list.length === 0) return null;
  for (const g of list) {
    if (g.getAttribute('normal') === undefined) g.computeVertexNormals();
    if (g.getAttribute('uv') === undefined) {
      const pos = g.getAttribute('position');
      const n = pos === undefined ? 0 : pos.count;
      g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(n * 2), 2));
    }
  }
  const first = mergeGeometries(list, false);
  if (first !== null) return first;
  const copies: THREE.BufferGeometry[] = [];
  for (const g of list) copies.push(g.index !== null ? g.toNonIndexed() : g);
  const second = mergeGeometries(copies, false);
  for (const g of copies) {
    let shared = false;
    for (const o of list) {
      if (o === g) {
        shared = true;
        break;
      }
    }
    if (!shared) g.dispose();
  }
  return second;
}

function buildGroup(
  b: Buckets,
  mats: LabMaterials,
): { group: THREE.Group; byName: Partial<Record<keyof Buckets, THREE.Mesh>> } {
  const group = new THREE.Group();
  const byName: Partial<Record<keyof Buckets, THREE.Mesh>> = {};
  for (const key of MAT_ORDER) {
    const list = b[key];
    if (list.length === 0) continue;
    if (group.children.length >= 6) {
      for (const g of list) g.dispose();
      continue;
    }
    const merged = mergeList(list);
    for (const g of list) g.dispose();
    if (merged === null) continue;
    const mesh = new THREE.Mesh(merged, mats[key]);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    byName[key] = mesh;
  }
  return { group, byName };
}
