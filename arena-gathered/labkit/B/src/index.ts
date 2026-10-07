import * as THREE from 'three';

/* ═══════════════════════════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════════════════════════ */

export interface Box {
  min: [number, number, number];
  max: [number, number, number];
}

export interface Socket {
  name: string;
  at: [number, number, number];
}

export interface Prop {
  group: THREE.Group;
  colliders: Box[];
  sockets: Socket[];
  lamps: THREE.Mesh[];
}

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

/* ═══════════════════════════════════════════════════════════════════════════
   Helpers
   ═══════════════════════════════════════════════════════════════════════════ */

function boxG(w: number, h: number, d: number): THREE.BoxGeometry {
  return new THREE.BoxGeometry(w, h, d);
}

function cylG(r: number, h: number, seg: number): THREE.CylinderGeometry {
  return new THREE.CylinderGeometry(r, r, h, seg);
}

function mesh(
  g: THREE.BufferGeometry,
  m: THREE.Material,
  p?: [number, number, number],
  r?: [number, number, number],
): THREE.Mesh {
  const o = new THREE.Mesh(g, m);
  if (p) o.position.set(p[0], p[1], p[2]);
  if (r) o.rotation.set(r[0], r[1], r[2]);
  return o;
}

function bevelBox(w: number, h: number, d: number, b: number): THREE.BufferGeometry {
  if (b < 0.0005) return new THREE.BoxGeometry(w, h, d);
  const s = new THREE.Shape();
  s.moveTo(-w / 2, -h / 2);
  s.lineTo(w / 2, -h / 2);
  s.lineTo(w / 2, h / 2);
  s.lineTo(-w / 2, h / 2);
  s.closePath();
  const dep = Math.max(d - 2 * b, 0.001);
  const g = new THREE.ExtrudeGeometry(s, {
    depth: dep,
    bevelEnabled: true,
    bevelThickness: b,
    bevelSize: b,
    bevelSegments: 1,
    steps: 1,
  });
  g.translate(0, 0, -(dep / 2));
  return g;
}

function lampMat(color: number): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: 0,
    metalness: 0.3,
    roughness: 0.4,
  });
}

/* ═══════════════════════════════════════════════════════════════════════════
   Materials
   ═══════════════════════════════════════════════════════════════════════════ */

export function createMaterials(): LabMaterials {
  const sz = 32;
  const d = new Uint8Array(sz * sz * 4);
  for (let y = 0; y < sz; y++) {
    for (let x = 0; x < sz; x++) {
      const on = ((x + y) % 8) < 4;
      const i = (y * sz + x) * 4;
      d[i]     = on ? 230 : 25;
      d[i + 1] = on ? 190 : 25;
      d[i + 2] = on ? 20  : 25;
      d[i + 3] = 255;
    }
  }
  const hTex = new THREE.DataTexture(d, sz, sz, THREE.RGBAFormat);
  hTex.needsUpdate = true;
  hTex.wrapS = hTex.wrapT = THREE.RepeatWrapping;

  return {
    gunmetal:  new THREE.MeshStandardMaterial({ color: 0x4a4a52, metalness: 0.85, roughness: 0.30 }),
    darkSteel: new THREE.MeshStandardMaterial({ color: 0x2a2a30, metalness: 0.70, roughness: 0.40 }),
    paint:     new THREE.MeshStandardMaterial({ color: 0x8a8a8a, metalness: 0.10, roughness: 0.60 }),
    copper:    new THREE.MeshStandardMaterial({ color: 0xb87333, metalness: 0.90, roughness: 0.25 }),
    rubber:    new THREE.MeshStandardMaterial({ color: 0x1a1a1a, metalness: 0.00, roughness: 0.90 }),
    hazard:    new THREE.MeshStandardMaterial({ map: hTex, metalness: 0.30, roughness: 0.50 }),
    glass:     new THREE.MeshPhysicalMaterial({ color: 0xaaddff, metalness: 0.0, roughness: 0.1, transmission: 0.8, thickness: 0.02, transparent: true }),
    concrete:  new THREE.MeshStandardMaterial({ color: 0x999999, metalness: 0.00, roughness: 0.85 }),
  };
}

/* ═══════════════════════════════════════════════════════════════════════════
   Lamp control
   ═══════════════════════════════════════════════════════════════════════════ */

export function setLamp(lamp: THREE.Mesh, glow: number): void {
  const mat = lamp.material;
  if (mat instanceof THREE.MeshStandardMaterial) {
    mat.emissiveIntensity = glow;
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   GATE
   ═══════════════════════════════════════════════════════════════════════════ */

export function gate(m: LabMaterials, o?: { twin?: boolean; stage?: number }): Prop & {
  opening: { width: number; height: number; sill: number; z: number };
  coils: THREE.Mesh[];
} {
  const twin = o?.twin ?? false;
  const stage = o?.stage ?? 6;
  const lo = stage <= 2;
  const seg = lo ? 6 : 16;
  const bv = lo ? 0 : 0.008;

  const group = new THREE.Group();
  const lamps: THREE.Mesh[] = [];
  const sockets: Socket[] = [];
  const colliders: Box[] = [];
  const coils: THREE.Mesh[] = [];

  const opW = 1.7, opH = 2.6, sill = 0.15;
  const upW = 0.45, frW = opW + 2 * upW, frD = 1.1, frH = 3.2;
  const lintelH = frH - sill - opH;
  const lx = -(opW / 2 + upW / 2);
  const rx = opW / 2 + upW / 2;

  // ── Plinth ──
  const plinthMat = twin ? m.concrete : m.paint;
  const pw = twin ? frW : frW + 0.06;
  const pd = twin ? frD : frD + 0.06;
  group.add(mesh(bevelBox(pw, 0.15, pd, bv), plinthMat, [0, 0.075, 0]));
  colliders.push({ min: [-pw / 2, 0, -pd / 2], max: [pw / 2, 0.15, pd / 2] });

  if (!twin) {
    group.add(mesh(boxG(frW + 0.08, 0.02, frD + 0.08), m.hazard, [0, 0.16, 0]));
    // anchor bolts
    for (let sx = -1; sx <= 1; sx += 2) {
      for (let sz = -1; sz <= 1; sz += 2) {
        group.add(mesh(cylG(0.015, 0.03, 6), m.gunmetal,
          [sx * (frW / 2 - 0.05), 0.165, sz * (frD / 2 - 0.05)]));
      }
    }
  }

  // ── Step plate ──
  if (!twin) {
    group.add(mesh(boxG(opW, 0.04, 0.3), m.darkSteel,
      [0, sill + 0.02, frD / 2 - 0.15]));
  }

  // ── Uprights ──
  const upGeom = bevelBox(upW, frH, frD, bv);
  group.add(mesh(upGeom, m.gunmetal, [lx, frH / 2, 0]));
  group.add(mesh(upGeom.clone(), m.gunmetal, [rx, frH / 2, 0]));
  colliders.push({ min: [lx - upW / 2, 0, -frD / 2], max: [lx + upW / 2, frH, frD / 2] });
  colliders.push({ min: [rx - upW / 2, 0, -frD / 2], max: [rx + upW / 2, frH, frD / 2] });

  // ── Lintel ──
  group.add(mesh(bevelBox(frW, lintelH, frD, bv), m.gunmetal,
    [0, sill + opH + lintelH / 2, 0]));
  colliders.push({ min: [-frW / 2, sill + opH, -frD / 2], max: [frW / 2, frH, frD / 2] });

  // ── Coils (6) ──
  const cW = 0.25, cH = 0.35, cD = 0.12;
  const cYs: [number, number, number] = [sill + 0.4, sill + 1.05, sill + 1.7];
  for (let j = 0; j < 3; j++) {
    for (let side = 0; side < 2; side++) {
      const sx = side === 0 ? lx : rx;
      const cMat = new THREE.MeshStandardMaterial({
        color: 0xb87333, metalness: 0.9, roughness: 0.25,
        emissive: 0xff8800, emissiveIntensity: 0,
      });
      const c = mesh(boxG(cW, cH, cD), cMat,
        [sx, cYs[j]!, frD / 2 + cD / 2 + 0.01]);
      group.add(c);
      coils.push(c);
      // ribs
      if (!lo) {
        for (let r = 0; r < 4; r++) {
          const ry = cYs[j]! - cH / 2 + (r + 0.5) * (cH / 4);
          group.add(mesh(boxG(cW + 0.02, 0.01, cD + 0.02), m.copper,
            [sx, ry, frD / 2 + cD / 2 + 0.01]));
        }
      }
    }
  }

  // ── Gussets ──
  const gLen = 0.55, gW = 0.25, gTh = 0.02;
  const gGeom = boxG(gW, gLen, gTh);
  const gAngle = 0.35;
  group.add(mesh(gGeom, m.darkSteel,
    [lx - upW / 2 - gW / 2 + 0.02, gLen / 2 * Math.cos(gAngle), 0],
    [0, 0, gAngle]));
  group.add(mesh(gGeom.clone(), m.darkSteel,
    [rx + upW / 2 + gW / 2 - 0.02, gLen / 2 * Math.cos(gAngle), 0],
    [0, 0, -gAngle]));

  // ── Junction box ──
  const jbW = 0.2, jbH = 0.2, jbD = 0.1;
  group.add(mesh(boxG(jbW, jbH, jbD), m.darkSteel,
    [rx, 0.25 + jbH / 2, -frD / 2 - jbD / 2]));
  // cable glands
  if (!lo) {
    for (let gy = 0; gy < 2; gy++) {
      for (let gx = 0; gx < 3; gx++) {
        group.add(mesh(cylG(0.015, 0.03, seg), m.rubber,
          [rx - jbW / 3 + gx * jbW / 3, 0.25 + 0.04 + gy * 0.08, -frD / 2 - jbD - 0.015],
          [Math.PI / 2, 0, 0]));
      }
    }
  } else {
    // fewer glands for low poly
    for (let gx = 0; gx < 3; gx++) {
      group.add(mesh(cylG(0.02, 0.03, 6), m.rubber,
        [rx - jbW / 3 + gx * jbW / 3, 0.33, -frD / 2 - jbD - 0.015],
        [Math.PI / 2, 0, 0]));
    }
  }

  // ── Service hatches ──
  if (!lo) {
    for (const sx of [lx, rx]) {
      const hGeom = bevelBox(upW * 0.5, 0.4, 0.02, 0.003);
      group.add(mesh(hGeom, m.darkSteel, [sx, 1.5, frD / 2 + 0.01]));
    }
  }

  // ── Emitter channels (inner faces) ──
  if (!lo) {
    const emGeom = bevelBox(0.05, opH - 0.3, 0.03, 0.003);
    group.add(mesh(emGeom, m.darkSteel, [lx + upW / 2 + 0.025, sill + opH / 2, 0]));
    group.add(mesh(emGeom.clone(), m.darkSteel, [rx - upW / 2 - 0.025, sill + opH / 2, 0]));
  }

  sockets.push({ name: 'rear-junction', at: [rx, 0.33, -frD / 2 - jbD - 0.03] });

  return {
    group, colliders, sockets, lamps, coils,
    opening: { width: opW, height: opH, sill, z: 0 },
  };
}

/* ═══════════════════════════════════════════════════════════════════════════
   RELAY CABINET
   ═══════════════════════════════════════════════════════════════════════════ */

export function relayCabinet(m: LabMaterials): Prop {
  const group = new THREE.Group();
  const lamps: THREE.Mesh[] = [];
  const sockets: Socket[] = [];
  const colliders: Box[] = [];

  const W = 0.6, H = 1.9, D = 0.5, bv = 0.006;

  // body
  group.add(mesh(bevelBox(W, H, D, bv), m.paint, [0, H / 2, 0]));
  colliders.push({ min: [-W / 2, 0, -D / 2], max: [W / 2, H, D / 2] });

  // door
  group.add(mesh(bevelBox(W - 0.06, H - 0.12, 0.015, 0.003), m.paint,
    [0, H / 2, D / 2 + 0.008]));

  // handle
  group.add(mesh(boxG(0.03, 0.14, 0.035), m.gunmetal,
    [W / 4, H / 2, D / 2 + 0.03]));

  // louvres
  for (let i = 0; i < 5; i++) {
    const ly = 0.25 + i * 0.11;
    group.add(mesh(boxG(W - 0.08, 0.018, 0.008), m.darkSteel,
      [0, ly, D / 2 + 0.004]));
  }

  // three indicator lamps
  const colors = [0xff8800, 0x00ff00, 0xff0000];
  for (let i = 0; i < 3; i++) {
    const lx = -W / 4 + i * W / 4;
    const lMat = lampMat(colors[i]!);
    const l = mesh(new THREE.SphereGeometry(0.018, 8, 6), lMat,
      [lx, H - 0.04, D / 2 + 0.018]);
    group.add(l);
    lamps.push(l);
  }

  // cable gland at top
  group.add(mesh(cylG(0.028, 0.035, 8), m.rubber, [0, H + 0.018, 0]));

  sockets.push({ name: 'cable-top', at: [0, H + 0.04, 0] });
  sockets.push({ name: 'cable-bottom', at: [0, 0.02, 0] });

  return { group, colliders, sockets, lamps };
}

/* ═══════════════════════════════════════════════════════════════════════════
   BREAKER PANEL
   ═══════════════════════════════════════════════════════════════════════════ */

export function breakerPanel(m: LabMaterials): Prop & { handle: THREE.Object3D } {
  const group = new THREE.Group();
  const lamps: THREE.Mesh[] = [];
  const sockets: Socket[] = [];
  const colliders: Box[] = [];

  const W = 0.9, H = 1.6, D = 0.35, legH = 0.1, bv = 0.006;

  // legs
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      group.add(mesh(boxG(0.05, legH, 0.05), m.darkSteel,
        [sx * (W / 2 - 0.06), legH / 2, sz * (D / 2 - 0.06)]));
    }
  }

  // body
  group.add(mesh(bevelBox(W, H, D, bv), m.paint, [0, legH + H / 2, 0]));
  colliders.push({ min: [-W / 2, 0, -D / 2], max: [W / 2, legH + H, D / 2] });

  // louvres
  for (let i = 0; i < 4; i++) {
    const ly = legH + 0.15 + i * 0.1;
    group.add(mesh(boxG(W - 0.06, 0.015, 0.008), m.darkSteel,
      [0, ly, D / 2 + 0.004]));
  }

  // yellow plate
  const yellow = new THREE.MeshStandardMaterial({ color: 0xffcc00, metalness: 0.1, roughness: 0.5 });
  group.add(mesh(boxG(0.18, 0.18, 0.008), yellow,
    [0, legH + H * 0.6, D / 2 + 0.004]));

  // rotary isolator handle
  const handle = new THREE.Group();
  const handleShaft = mesh(cylG(0.025, 0.07, 8), m.gunmetal, [0, 0, 0], [Math.PI / 2, 0, 0]);
  handle.add(handleShaft);
  const redGrip = mesh(cylG(0.035, 0.04, 8),
    new THREE.MeshStandardMaterial({ color: 0xff0000, emissive: 0xff0000, emissiveIntensity: 0 }),
    [0, 0.035, 0]);
  handle.add(redGrip);
  handle.position.set(0, legH + H * 0.6, D / 2 + 0.045);
  group.add(handle);

  // two gauges
  for (let i = 0; i < 2; i++) {
    const gx = -0.15 + i * 0.3;
    group.add(mesh(cylG(0.045, 0.015, 12), m.gunmetal,
      [gx, legH + H * 0.82, D / 2 + 0.008], [Math.PI / 2, 0, 0]));
    group.add(mesh(cylG(0.04, 0.005, 12), m.glass,
      [gx, legH + H * 0.82, D / 2 + 0.016], [Math.PI / 2, 0, 0]));
  }

  sockets.push({ name: 'in', at: [0, legH + H + 0.02, 0] });
  sockets.push({ name: 'out', at: [0, 0.02, 0] });

  return { group, colliders, sockets, lamps, handle };
}

/* ═══════════════════════════════════════════════════════════════════════════
   CAPACITOR BANK
   ═══════════════════════════════════════════════════════════════════════════ */

export function capacitorBank(m: LabMaterials): Prop {
  const group = new THREE.Group();
  const lamps: THREE.Mesh[] = [];
  const sockets: Socket[] = [];
  const colliders: Box[] = [];

  const sW = 2.0, sD = 1.0, sH = 0.1;

  // skid
  group.add(mesh(boxG(sW, sH, sD), m.darkSteel, [0, sH / 2, 0]));

  // hazard rim
  group.add(mesh(boxG(sW + 0.02, 0.018, sD + 0.02), m.hazard, [0, sH + 0.009, 0]));

  // lifting eyes
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      group.add(mesh(new THREE.TorusGeometry(0.028, 0.007, 4, 8), m.gunmetal,
        [sx * (sW / 2 - 0.08), sH + 0.03, sz * (sD / 2 - 0.08)]));
    }
  }

  // six capacitor cylinders
  const capSeg = 12;
  for (let i = 0; i < 6; i++) {
    const cx = -0.75 + i * 0.3;
    group.add(mesh(cylG(0.175, 1.5, capSeg), m.paint, [cx, sH + 0.75, 0]));
    // ribs
    for (let r = 0; r < 2; r++) {
      const ry = sH + 0.35 + r * 0.55;
      group.add(mesh(cylG(0.185, 0.018, capSeg), m.paint, [cx, ry, 0]));
    }
  }

  colliders.push({ min: [-sW / 2, 0, -sD / 2], max: [sW / 2, sH + 1.5, sD / 2] });

  // bus bars on insulators
  const busGeom = boxG(sW - 0.3, 0.018, 0.025);
  for (const bz of [-0.12, 0.12]) {
    group.add(mesh(busGeom.clone(), m.copper, [0, sH + 1.55, bz]));
    for (let i = 0; i < 4; i++) {
      const ix = -0.55 + i * 0.37;
      group.add(mesh(cylG(0.018, 0.045, 8), m.paint, [ix, sH + 1.52, bz]));
    }
  }

  sockets.push({ name: 'out', at: [sW / 2, sH + 0.3, 0] });

  return { group, colliders, sockets, lamps };
}

/* ═══════════════════════════════════════════════════════════════════════════
   OPERATOR CONSOLE
   ═══════════════════════════════════════════════════════════════════════════ */

export function operatorConsole(m: LabMaterials): Prop & {
  lever: THREE.Object3D;
  screen: THREE.Mesh;
} {
  const group = new THREE.Group();
  const lamps: THREE.Mesh[] = [];
  const sockets: Socket[] = [];
  const colliders: Box[] = [];

  const bv = 0.005;

  // base plate
  group.add(mesh(bevelBox(0.8, 0.05, 0.6, bv), m.darkSteel, [0, 0.025, 0]));

  // pedestal column
  group.add(mesh(bevelBox(0.28, 0.9, 0.28, bv), m.gunmetal, [0, 0.5, 0]));

  // sloped control panel
  const panelH = 0.45;
  const panelGeom = bevelBox(0.85, panelH, 0.025, 0.003);
  group.add(mesh(panelGeom, m.darkSteel,
    [0, 1.05 + panelH / 2 * Math.cos(0.3), -panelH / 2 * Math.sin(0.3)],
    [-0.3, 0, 0]));

  // gauges
  for (let i = 0; i < 3; i++) {
    const gx = -0.22 + i * 0.22;
    group.add(mesh(cylG(0.035, 0.012, 12), m.gunmetal,
      [gx, 1.15, 0.01], [Math.PI / 2, 0, 0]));
  }

  // screen
  const screenMat = new THREE.MeshStandardMaterial({
    color: 0x003366, emissive: 0x0066cc, emissiveIntensity: 0.3,
  });
  const screenMesh = mesh(bevelBox(0.2, 0.15, 0.012, 0.002), screenMat,
    [0, 1.35, -0.02]);
  group.add(screenMesh);

  // switch rows
  for (let r = 0; r < 2; r++) {
    for (let c = 0; c < 4; c++) {
      group.add(mesh(cylG(0.012, 0.018, 6), m.gunmetal,
        [-0.25 + c * 0.14, 1.05 + r * 0.07, 0.018], [Math.PI / 2, 0, 0]));
    }
  }

  // lever
  const leverPivot = new THREE.Group();
  leverPivot.position.set(0.28, 1.05, 0.04);
  leverPivot.add(mesh(cylG(0.013, 0.22, 8), m.darkSteel, [0, 0.11, 0]));
  leverPivot.add(mesh(cylG(0.022, 0.07, 8),
    new THREE.MeshStandardMaterial({ color: 0xff0000, emissive: 0xff0000, emissiveIntensity: 0 }),
    [0, 0.24, 0]));
  group.add(leverPivot);

  colliders.push({
    min: [-0.45, 0, -0.35],
    max: [0.45, 1.55, 0.35],
  });

  sockets.push({ name: 'cable', at: [0, 0.04, -0.35] });

  return { group, colliders, sockets, lamps, lever: leverPivot, screen: screenMesh };
}

/* ═══════════════════════════════════════════════════════════════════════════
   CONTROL BOX
   ═══════════════════════════════════════════════════════════════════════════ */

export function controlBox(m: LabMaterials): Prop {
  const group = new THREE.Group();
  const lamps: THREE.Mesh[] = [];
  const sockets: Socket[] = [];
  const colliders: Box[] = [];

  const postH = 1.0;
  const bW = 0.35, bH = 0.45, bD = 0.2;

  // post
  group.add(mesh(cylG(0.028, postH, 8), m.darkSteel, [0, postH / 2, 0]));

  // box
  group.add(mesh(bevelBox(bW, bH, bD, 0.004), m.paint, [0, postH + bH / 2, 0]));

  // two lamps
  const lColors = [0x00ff00, 0xff0000];
  for (let i = 0; i < 2; i++) {
    const lx = -0.055 + i * 0.11;
    const lMat = lampMat(lColors[i]!);
    const l = mesh(new THREE.SphereGeometry(0.014, 8, 6), lMat,
      [lx, postH + bH - 0.05, bD / 2 + 0.014]);
    group.add(l);
    lamps.push(l);
  }

  // two buttons
  for (let i = 0; i < 2; i++) {
    group.add(mesh(cylG(0.013, 0.012, 8), m.gunmetal,
      [-0.04 + i * 0.08, postH + bH / 2, bD / 2 + 0.006], [Math.PI / 2, 0, 0]));
  }

  // cable gland underneath
  group.add(mesh(cylG(0.018, 0.025, 8), m.rubber, [0, postH - 0.012, 0]));

  colliders.push({ min: [-bW / 2, 0, -bD / 2], max: [bW / 2, postH + bH, bD / 2] });
  sockets.push({ name: 'cable', at: [0, postH - 0.025, 0] });

  return { group, colliders, sockets, lamps };
}

/* ═══════════════════════════════════════════════════════════════════════════
   FLOOR COVER (cable ramp)
   ═══════════════════════════════════════════════════════════════════════════ */

export function floorCover(
  m: LabMaterials,
  path: [number, number][],
  width?: number,
): Prop & { pulse: THREE.Mesh; length: number } {
  const group = new THREE.Group();
  const lamps: THREE.Mesh[] = [];
  const sockets: Socket[] = [];
  const colliders: Box[] = [];

  const w = width ?? 0.35;
  const h = 0.05;

  // total length
  let totalLen = 0;
  for (let i = 1; i < path.length; i++) {
    const dx = path[i]![0] - path[i - 1]![0];
    const dz = path[i]![1] - path[i - 1]![1];
    totalLen += Math.sqrt(dx * dx + dz * dz);
  }

  // segments
  for (let i = 1; i < path.length; i++) {
    const p0 = path[i - 1]!;
    const p1 = path[i]!;
    const dx = p1[0] - p0[0];
    const dz = p1[1] - p0[1];
    const len = Math.sqrt(dx * dx + dz * dz);
    const angle = Math.atan2(dx, dz);
    const segGeom = boxG(w, h, len);
    group.add(mesh(segGeom, m.darkSteel,
      [(p0[0] + p1[0]) / 2, h / 2, (p0[1] + p1[1]) / 2],
      [0, angle, 0]));

    colliders.push({
      min: [Math.min(p0[0], p1[0]) - w / 2, 0, Math.min(p0[1], p1[1]) - w / 2],
      max: [Math.max(p0[0], p1[0]) + w / 2, h, Math.max(p0[1], p1[1]) + w / 2],
    });
  }

  // pulse strip
  const verts: number[] = [];
  const uvs: number[] = [];
  let dist = 0;
  const hw = w * 0.3;

  for (let i = 0; i < path.length; i++) {
    const px = path[i]![0];
    const pz = path[i]![1];

    let perpX: number, perpZ: number;
    if (i < path.length - 1) {
      const dx = path[i + 1]![0] - px;
      const dz = path[i + 1]![1] - pz;
      const l = Math.sqrt(dx * dx + dz * dz) || 1;
      perpX = -dz / l;
      perpZ = dx / l;
    } else {
      const dx = px - path[i - 1]![0];
      const dz = pz - path[i - 1]![1];
      const l = Math.sqrt(dx * dx + dz * dz) || 1;
      perpX = -dz / l;
      perpZ = dx / l;
    }

    verts.push(px + perpX * hw, h + 0.001, pz + perpZ * hw);
    verts.push(px - perpX * hw, h + 0.001, pz - perpZ * hw);
    uvs.push(dist, 1);
    uvs.push(dist, 0);

    if (i < path.length - 1) {
      const dx = path[i + 1]![0] - px;
      const dz = path[i + 1]![1] - pz;
      dist += Math.sqrt(dx * dx + dz * dz);
    }
  }

  const idx: number[] = [];
  for (let i = 0; i < path.length - 1; i++) {
    const b = i * 2;
    idx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2);
  }

  const pGeom = new THREE.BufferGeometry();
  pGeom.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  pGeom.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  pGeom.setIndex(idx);
  pGeom.computeVertexNormals();

  const pMat = new THREE.MeshStandardMaterial({
    color: 0x00aaff, emissive: 0x00aaff, emissiveIntensity: 0.5,
  });
  const pulseMesh = new THREE.Mesh(pGeom, pMat);
  group.add(pulseMesh);

  return { group, colliders, sockets, lamps, pulse: pulseMesh, length: totalLen };
}

/* ═══════════════════════════════════════════════════════════════════════════
   CABLE TRAY
   ═══════════════════════════════════════════════════════════════════════════ */

export function cableTray(
  m: LabMaterials,
  from: [number, number],
  to: [number, number],
  y: number,
  ceiling: number,
): Prop {
  const group = new THREE.Group();
  const lamps: THREE.Mesh[] = [];
  const sockets: Socket[] = [];
  const colliders: Box[] = [];

  const dx = to[0] - from[0];
  const dz = to[1] - from[1];
  const len = Math.sqrt(dx * dx + dz * dz);
  const angle = Math.atan2(dx, dz);

  const tW = 0.3, tH = 0.1;
  const cx = (from[0] + to[0]) / 2;
  const cz = (from[1] + to[1]) / 2;

  // tray
  group.add(mesh(boxG(tW, tH, len), m.darkSteel, [cx, y, cz], [0, angle, 0]));

  // drop rods
  const rodCount = Math.max(2, Math.floor(len / 2));
  const rodH = ceiling - y;
  for (let i = 0; i < rodCount; i++) {
    const t = (i + 0.5) / rodCount;
    const rx = from[0] + dx * t;
    const rz = from[1] + dz * t;
    group.add(mesh(cylG(0.008, rodH, 6), m.darkSteel,
      [rx, y + rodH / 2, rz]));
  }

  // three cables
  for (let i = 0; i < 3; i++) {
    const offset = (i - 1) * 0.06;
    // perpendicular offset
    const l = len || 1;
    const perpX = -dz / l * offset;
    const perpZ = dx / l * offset;
    group.add(mesh(cylG(0.012, len, 6), m.rubber,
      [cx + perpX, y + tH / 2 + 0.012, cz + perpZ],
      [0, angle, Math.PI / 2]));
  }

  colliders.push({
    min: [Math.min(from[0], to[0]) - tW / 2, y - tH / 2, Math.min(from[1], to[1]) - tW / 2],
    max: [Math.max(from[0], to[0]) + tW / 2, ceiling, Math.max(from[1], to[1]) + tW / 2],
  });

  return { group, colliders, sockets, lamps };
}

/* ═══════════════════════════════════════════════════════════════════════════
   PLANET TABLE
   ═══════════════════════════════════════════════════════════════════════════ */

export function planetTable(m: LabMaterials): Prop {
  const group = new THREE.Group();
  const lamps: THREE.Mesh[] = [];
  const sockets: Socket[] = [];
  const colliders: Box[] = [];

  const tR = 1.2, tH = 0.95, pR = 0.3, seg = 20;

  // base
  group.add(mesh(cylG(pR + 0.08, 0.04, seg), m.darkSteel, [0, 0.02, 0]));

  // column
  group.add(mesh(cylG(pR, tH - 0.04, seg), m.gunmetal, [0, 0.04 + (tH - 0.04) / 2, 0]));

  // bolts
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    group.add(mesh(cylG(0.012, 0.018, 6), m.gunmetal,
      [Math.cos(a) * (pR + 0.04), 0.04, Math.sin(a) * (pR + 0.04)]));
  }

  // table top
  group.add(mesh(cylG(tR, 0.04, seg), m.darkSteel, [0, tH + 0.02, 0]));

  // projection disc
  const discMat = new THREE.MeshStandardMaterial({
    color: 0x0088ff, emissive: 0x0088ff, emissiveIntensity: 0,
  });
  const disc = mesh(cylG(tR - 0.08, 0.008, seg), discMat, [0, tH + 0.044, 0]);
  group.add(disc);
  lamps.push(disc);

  colliders.push({ min: [-tR, 0, -tR], max: [tR, tH + 0.05, tR] });

  return { group, colliders, sockets, lamps };
}

/* ═══════════════════════════════════════════════════════════════════════════
   PRESET RACK
   ═══════════════════════════════════════════════════════════════════════════ */

export function presetRack(m: LabMaterials, cols?: number, rows?: number): Prop {
  const group = new THREE.Group();
  const lamps: THREE.Mesh[] = [];
  const sockets: Socket[] = [];
  const colliders: Box[] = [];

  const c = cols ?? 10, r = rows ?? 8;
  const rW = 3.0, rH = 2.4, rD = 0.4;

  // body
  group.add(mesh(bevelBox(rW, rH, rD, 0.008), m.paint, [0, rH / 2, 0]));

  // feet
  for (const sx of [-1, 1]) {
    group.add(mesh(boxG(0.1, 0.04, rD + 0.08), m.darkSteel,
      [sx * (rW / 2 - 0.1), 0.02, 0]));
  }

  // slots with lamps
  const slotW = (rW - 0.16) / c;
  const slotH = (rH - 0.16) / r;

  for (let row = 0; row < r; row++) {
    for (let col = 0; col < c; col++) {
      const sx = -rW / 2 + 0.08 + (col + 0.5) * slotW;
      const sy = 0.08 + (row + 0.5) * slotH;
      group.add(mesh(boxG(slotW - 0.016, slotH - 0.016, 0.04), m.darkSteel,
        [sx, sy, rD / 2 - 0.02]));

      const lMat = lampMat(0x00ff00);
      const l = mesh(new THREE.SphereGeometry(0.007, 4, 4), lMat,
        [sx, sy + slotH / 2 - 0.015, rD / 2 + 0.007]);
      group.add(l);
      lamps.push(l);
    }
  }

  colliders.push({ min: [-rW / 2, 0, -rD / 2 - 0.04], max: [rW / 2, rH, rD / 2] });

  return { group, colliders, sockets, lamps };
}

/* ═══════════════════════════════════════════════════════════════════════════
   PRESET BENCH
   ═══════════════════════════════════════════════════════════════════════════ */

export function presetBench(m: LabMaterials): Prop {
  const group = new THREE.Group();
  const lamps: THREE.Mesh[] = [];
  const sockets: Socket[] = [];
  const colliders: Box[] = [];

  const bW = 1.8, bD = 0.9, legH = 0.75;

  // legs
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      group.add(mesh(boxG(0.045, legH, 0.045), m.darkSteel,
        [sx * (bW / 2 - 0.05), legH / 2, sz * (bD / 2 - 0.05)]));
    }
  }

  // table top (glowing)
  const topMat = new THREE.MeshStandardMaterial({
    color: 0xeeeeee, emissive: 0xffffff, emissiveIntensity: 0,
  });
  const top = mesh(boxG(bW, 0.025, bD), topMat, [0, legH + 0.0125, 0]);
  group.add(top);
  lamps.push(top);

  // cartridge slot at side
  group.add(mesh(boxG(0.14, 0.08, 0.18), m.darkSteel,
    [bW / 2 + 0.07, legH + 0.04, 0]));

  // articulated lamp arm
  group.add(mesh(cylG(0.008, 0.38, 6), m.gunmetal,
    [-bW / 2 + 0.1, legH + 0.19, 0]));
  group.add(mesh(new THREE.ConeGeometry(0.04, 0.07, 8), m.gunmetal,
    [-bW / 2 + 0.1, legH + 0.4, 0]));

  colliders.push({
    min: [-bW / 2, 0, -bD / 2],
    max: [bW / 2, legH + 0.5, bD / 2],
  });

  return { group, colliders, sockets, lamps };
}

/* ═══════════════════════════════════════════════════════════════════════════
   PRESET COMBINER
   ═══════════════════════════════════════════════════════════════════════════ */

export function presetCombiner(m: LabMaterials): Prop {
  const group = new THREE.Group();
  const lamps: THREE.Mesh[] = [];
  const sockets: Socket[] = [];
  const colliders: Box[] = [];

  const pR = 0.3, pH = 1.3, dR = 0.5, seg = 16;

  // base
  group.add(mesh(cylG(pR + 0.08, 0.04, seg), m.darkSteel, [0, 0.02, 0]));

  // column
  group.add(mesh(cylG(pR, pH - 0.04, seg), m.gunmetal, [0, 0.04 + (pH - 0.04) / 2, 0]));

  // glass dome
  group.add(mesh(
    new THREE.SphereGeometry(dR, seg, Math.floor(seg * 0.75), 0, Math.PI * 2, 0, Math.PI / 2),
    m.glass, [0, pH, 0]));

  // four cartridge slots
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    group.add(mesh(boxG(0.09, 0.07, 0.09), m.darkSteel,
      [Math.cos(a) * (pR + 0.12), pH * 0.65, Math.sin(a) * (pR + 0.12)]));
  }

  colliders.push({ min: [-dR, 0, -dR], max: [dR, pH + dR, dR] });

  return { group, colliders, sockets, lamps };
}

/* ═══════════════════════════════════════════════════════════════════════════
   TEXTURE MILL
   ═══════════════════════════════════════════════════════════════════════════ */

export function textureMill(m: LabMaterials, o?: { stage?: number }): Prop {
  const stage = o?.stage ?? 6;
  const lo = stage <= 2;
  const seg = lo ? 6 : 16;

  const group = new THREE.Group();
  const lamps: THREE.Mesh[] = [];
  const sockets: Socket[] = [];
  const colliders: Box[] = [];

  const sW = 1.5, sD = 1.0, sH = 0.1;
  const bW = 1.0, bH = 1.0, bD = 0.8;

  // skid
  group.add(mesh(boxG(sW, sH, sD), m.darkSteel, [0, sH / 2, 0]));

  // hazard rim
  group.add(mesh(boxG(sW + 0.02, 0.018, sD + 0.02), m.hazard, [0, sH + 0.009, 0]));

  // four bolted feet
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      group.add(mesh(boxG(0.14, 0.04, 0.14), m.gunmetal,
        [sx * (sW / 2 - 0.1), 0.02, sz * (sD / 2 - 0.1)]));
      group.add(mesh(cylG(0.012, 0.025, 6), m.gunmetal,
        [sx * (sW / 2 - 0.1), 0.045, sz * (sD / 2 - 0.1)]));
    }
  }

  // body
  group.add(mesh(lo ? boxG(bW, bH, bD) : bevelBox(bW, bH, bD, 0.006), m.paint,
    [0, sH + bH / 2, 0]));

  // service door
  group.add(mesh(boxG(0.38, 0.45, 0.015), m.paint,
    [0.18, sH + 0.25, bD / 2 + 0.008]));
  // handle
  group.add(mesh(boxG(0.018, 0.09, 0.025), m.gunmetal,
    [0.32, sH + 0.25, bD / 2 + 0.02]));

  // label plate
  if (!lo) {
    group.add(mesh(boxG(0.13, 0.08, 0.004), m.gunmetal,
      [-0.28, sH + 0.65, bD / 2 + 0.002]));
  }

  // feed hopper at FRONT
  const hopW = 0.5, hopH = 0.7, hopD = 0.45;
  const hopGeom = lo
    ? boxG(hopW, hopH, hopD)
    : new THREE.CylinderGeometry(hopW / 2, hopW / 2 * 0.6, hopH, seg);
  group.add(mesh(hopGeom, m.darkSteel,
    [0, sH + bH + hopH / 2, bD / 2 + hopD / 2 - 0.08]));

  // exhaust stack at TOP REAR
  const stR = 0.14, stH = 0.9;
  group.add(mesh(cylG(stR, stH, seg), m.darkSteel,
    [0, sH + bH + stH / 2, -bD / 2 - stR]));
  // grilles
  if (!lo) {
    for (let g = 0; g < 3; g++) {
      group.add(mesh(cylG(stR + 0.004, 0.008, seg), m.gunmetal,
        [0, sH + bH + 0.15 + g * 0.28, -bD / 2 - stR]));
    }
  }

  // cartridge slot on side
  group.add(mesh(boxG(0.09, 0.07, 0.09), m.darkSteel,
    [bW / 2 + 0.05, sH + bH / 2, 0]));

  // power cable gland at back
  group.add(mesh(cylG(0.022, 0.035, 8), m.rubber,
    [0, sH + 0.28, -bD / 2 - 0.018]));

  colliders.push({
    min: [-sW / 2, 0, -bD / 2 - stR - 0.01],
    max: [sW / 2, sH + bH + Math.max(hopH, stH), bD / 2 + hopD],
  });

  const hopY = sH + bH + hopH;
  const hopZ = bD / 2 + hopD / 2 - 0.08 + hopW / 2;
  sockets.push({ name: 'hopper', at: [0, hopY, hopZ] });

  const stkY = sH + bH + stH;
  const stkZ = -bD / 2 - stR;
  sockets.push({ name: 'stack', at: [0, stkY, stkZ] });

  sockets.push({ name: 'power', at: [0, sH + 0.28, -bD / 2 - 0.035] });

  return { group, colliders, sockets, lamps };
}

/* ═══════════════════════════════════════════════════════════════════════════
   Triangle counter
   ═══════════════════════════════════════════════════════════════════════════ */

export function triangles(p: Prop): number {
  let count = 0;
  p.group.traverse((obj: THREE.Object3D) => {
    if (obj instanceof THREE.Mesh) {
      const g = obj.geometry;
      const idx = g.index;
      if (idx) {
        count += idx.count / 3;
      } else {
        const pos = g.getAttribute('position');
        if (pos) count += pos.count / 3;
      }
    }
  });
  return count;
}
