// The lab's props, behind the interface of @hm/labkit (the Arena Battle brief in docs/handoff/prompts/battle/labkit.txt).
// These are plain stand-ins until the battle's winner lands: the same names, sizes, sockets and lamps, so the lab is laid
// out once and the real props drop in. Built from bevelled boxes; every prop stands on y = 0 and faces +z.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

export interface Box { min: [number, number, number]; max: [number, number, number] }
export interface Socket { name: string; at: [number, number, number] }
export interface Prop { group: THREE.Group; colliders: Box[]; sockets: Socket[]; lamps: THREE.Mesh[] }
export interface LabMaterials {
  gunmetal: THREE.MeshStandardMaterial; darkSteel: THREE.MeshStandardMaterial; paint: THREE.MeshStandardMaterial;
  copper: THREE.MeshStandardMaterial; rubber: THREE.MeshStandardMaterial; hazard: THREE.MeshStandardMaterial;
  glass: THREE.MeshPhysicalMaterial; concrete: THREE.MeshStandardMaterial;
}

function hazardTexture(): THREE.DataTexture {
  const n = 64, data = new Uint8Array(n * n * 4);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const k = (y * n + x) * 4, on = ((x + y) % 32) < 16;
    data[k] = on ? 232 : 24; data[k + 1] = on ? 182 : 22; data[k + 2] = on ? 24 : 20; data[k + 3] = 255;
  }
  const t = new THREE.DataTexture(data, n, n, THREE.RGBAFormat);
  t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true; t.needsUpdate = true;
  return t;
}

export function createMaterials(): LabMaterials {
  const hz = hazardTexture();
  hz.repeat.set(4, 1);
  return {
    gunmetal: new THREE.MeshStandardMaterial({ color: '#3b4046', roughness: 0.38, metalness: 0.85 }),
    darkSteel: new THREE.MeshStandardMaterial({ color: '#1f2327', roughness: 0.5, metalness: 0.7 }),
    paint: new THREE.MeshStandardMaterial({ color: '#8d9399', roughness: 0.55, metalness: 0.15 }),
    copper: new THREE.MeshStandardMaterial({ color: '#b5653a', roughness: 0.32, metalness: 1, emissive: '#ff8a2a', emissiveIntensity: 0 }),
    rubber: new THREE.MeshStandardMaterial({ color: '#141516', roughness: 0.8, metalness: 0 }),
    hazard: new THREE.MeshStandardMaterial({ map: hz, roughness: 0.6, metalness: 0.2 }),
    glass: new THREE.MeshPhysicalMaterial({ color: '#cfe6ff', roughness: 0.05, metalness: 0, transmission: 0, transparent: true, opacity: 0.25 }),
    concrete: new THREE.MeshStandardMaterial({ color: '#7b7c79', roughness: 0.9, metalness: 0 }),
  };
}

/** Sets a lamp's glow 0..1. */
export function setLamp(lamp: THREE.Mesh, glow: number): void {
  const m = lamp.material as THREE.MeshStandardMaterial;
  m.emissiveIntensity = glow * (lamp.userData['peak'] as number | undefined ?? 2.4);
}

/** A bevelled box with its foot on y0, centred on x, z. */
function block(mat: THREE.Material, w: number, h: number, d: number, x = 0, y0 = 0, z = 0, r = 0.02): THREE.Mesh {
  const g = r > 0 ? new RoundedBoxGeometry(w, h, d, 2, Math.min(r, w / 2 - 1e-3, h / 2 - 1e-3, d / 2 - 1e-3)) : new THREE.BoxGeometry(w, h, d);
  const m = new THREE.Mesh(g, mat);
  m.position.set(x, y0 + h / 2, z);
  return m;
}
/** A lamp of its own material (so it can be lit alone). */
function lamp(colour: string, size: number, x: number, y: number, z: number, peak = 2.4): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.SphereGeometry(size, 12, 8), new THREE.MeshStandardMaterial({ color: '#222', emissive: colour, emissiveIntensity: 0, roughness: 0.3 }));
  m.position.set(x, y, z);
  m.userData['peak'] = peak;
  return m;
}
const boxOf = (o: THREE.Object3D): Box => { const b = new THREE.Box3().setFromObject(o); return { min: [b.min.x, b.min.y, b.min.z], max: [b.max.x, b.max.y, b.max.z] }; };
const prop = (group: THREE.Group, sockets: Socket[] = [], lamps: THREE.Mesh[] = [], colliders?: Box[]): Prop => ({ group, sockets, lamps, colliders: colliders ?? [boxOf(group)] });

/** A ribbed coil block: copper fins on a dark core; its own material so it glows alone. */
function coil(w: number, h: number, d: number, fins: number): THREE.Mesh {
  const mat = new THREE.MeshStandardMaterial({ color: '#a85d34', roughness: 0.35, metalness: 1, emissive: '#ff7a1c', emissiveIntensity: 0 });
  const geos: THREE.BufferGeometry[] = [];
  for (let i = 0; i < fins; i++) { const g = new THREE.BoxGeometry(w, (h / fins) * 0.55, d); g.translate(0, -h / 2 + (i + 0.5) * (h / fins), 0); geos.push(g); }
  const core = new THREE.BoxGeometry(w * 0.82, h, d * 0.8);
  geos.push(core);
  const merged = mergeBoxes(geos);
  const m = new THREE.Mesh(merged, mat);
  m.userData['peak'] = 3.2;
  return m;
}
function mergeBoxes(geos: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const pos: number[] = [], nor: number[] = [], uv: number[] = [], idx: number[] = [];
  let base = 0;
  for (const g of geos) {
    const ng = g.index ? g : g;
    const p = ng.getAttribute('position'), n = ng.getAttribute('normal'), u = ng.getAttribute('uv');
    for (let i = 0; i < p.count; i++) { pos.push(p.getX(i), p.getY(i), p.getZ(i)); nor.push(n.getX(i), n.getY(i), n.getZ(i)); uv.push(u.getX(i), u.getY(i)); }
    const ix = ng.index;
    if (ix) for (let i = 0; i < ix.count; i++) idx.push(ix.getX(i) + base);
    base += p.count;
    g.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  out.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  out.setIndex(idx);
  return out;
}

/** The gate: opening 2.6 x 1.7, sill on the plinth and step plate; six coils lit bottom to top. */
export function gate(m: LabMaterials, o: { twin?: boolean; stage?: number } = {}): Prop & { opening: { width: number; height: number; sill: number; z: number }; coils: THREE.Mesh[] } {
  const g = new THREE.Group();
  const low = (o.stage ?? 6) <= 1, r = low ? 0 : 0.03;
  const W = 1.7, H = 2.6, post = 0.45, depth = 1.0, base = o.twin ? 0.25 : 0.15, step = 0.04, sill = base + step;
  const frameMat = o.twin ? m.darkSteel : m.gunmetal;
  // plinth (lab) or cast footing pad (planet), the hazard rim on the plinth
  if (o.twin) g.add(block(m.concrete, W + post * 2 + 1.2, base, depth + 1.4, 0, 0, 0, low ? 0 : 0.04));
  else { g.add(block(m.darkSteel, W + post * 2 + 0.9, base - 0.03, depth + 1.0, 0, 0, 0, 0.01)); g.add(block(m.hazard, W + post * 2 + 0.92, 0.03, depth + 1.02, 0, base - 0.03, 0, 0)); }
  g.add(block(m.darkSteel, W, step, depth + 0.4, 0, base, 0, 0.005));
  // uprights, lintel, buttresses
  for (const side of [-1, 1]) {
    const x = side * (W / 2 + post / 2);
    g.add(block(frameMat, post, H + 0.2, depth, x, sill, 0, r));
    const gusset = new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(0.7, 0), new THREE.Vector2(0, 1.6)]);
    const gg = new THREE.ExtrudeGeometry(gusset, { depth: 0.12, bevelEnabled: false });
    const gm = new THREE.Mesh(gg, frameMat);
    gm.rotation.y = side > 0 ? Math.PI / 2 : -Math.PI / 2;
    gm.position.set(side * (W / 2 + post), sill, side > 0 ? -0.06 : 0.06);
    g.add(gm);
  }
  g.add(block(frameMat, W + post * 2, 0.42, depth + 0.1, 0, sill + H, 0, r));
  // coils: three per upright, on the front faces, left then right at each height
  const coils: THREE.Mesh[] = [];
  for (let level = 0; level < 3; level++) for (const side of [-1, 1]) {
    const c = coil(post * 0.86, 0.62, 0.22, low ? 4 : 9);
    c.position.set(side * (W / 2 + post / 2), sill + 0.35 + level * 0.82 + 0.31, depth / 2 + 0.09);
    g.add(c);
    coils.push(c);
  }
  // rear junction box with glands, at the foot of the right upright
  const jb = block(m.paint, 0.5, 0.42, 0.24, W / 2 + post / 2, sill, -depth / 2 - 0.12, 0.02);
  g.add(jb);
  if (!low) for (let i = 0; i < 6; i++) { const gl = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.06, 10), m.rubber); gl.position.set(W / 2 + post / 2 - 0.17 + (i % 3) * 0.17, sill + 0.12 + Math.floor(i / 3) * 0.16, -depth / 2 - 0.27); gl.rotation.x = Math.PI / 2; g.add(gl); }
  const outer = W / 2 + post;
  const colliders: Box[] = [-1, 1].map((side) => ({ min: [side < 0 ? -outer - 0.75 : W / 2, 0, -depth / 2 - 0.3], max: [side < 0 ? -W / 2 : outer + 0.75, sill + H + 0.6, depth / 2 + 0.25] }));
  return { ...prop(g, [{ name: 'rear-junction', at: [W / 2 + post / 2, sill + 0.2, -depth / 2 - 0.25] }], coils, colliders), opening: { width: W, height: H, sill, z: 0 }, coils };
}

export function relayCabinet(m: LabMaterials): Prop {
  const g = new THREE.Group();
  g.add(block(m.paint, 0.6, 1.9, 0.5, 0, 0, 0, 0.015));
  for (let i = 0; i < 4; i++) g.add(block(m.darkSteel, 0.4, 0.02, 0.02, 0, 0.25 + i * 0.06, 0.255, 0));
  for (let i = 0; i < 4; i++) g.add(block(m.darkSteel, 0.4, 0.02, 0.02, 0, 1.3 + i * 0.06, 0.255, 0));
  g.add(block(m.darkSteel, 0.03, 0.18, 0.04, 0.22, 0.9, 0.26, 0));
  const lamps = [-0.16, 0, 0.16].map((x) => lamp('#ffb02a', 0.028, x, 1.78, 0.26));
  lamps.forEach((l) => g.add(l));
  return prop(g, [{ name: 'cable-top', at: [0, 1.9, 0] }, { name: 'cable-bottom', at: [0, 0.05, 0.2] }], lamps);
}

export function breakerPanel(m: LabMaterials): Prop & { handle: THREE.Object3D } {
  const g = new THREE.Group();
  for (const x of [-0.38, 0.38]) g.add(block(m.darkSteel, 0.06, 0.25, 0.06, x, 0, 0, 0));
  g.add(block(m.paint, 0.9, 1.35, 0.35, 0, 0.25, 0, 0.015));
  g.add(block(m.hazard, 0.26, 0.26, 0.02, 0, 0.95, 0.18, 0));
  const handle = new THREE.Group();
  handle.add(block(new THREE.MeshStandardMaterial({ color: '#b3261e', roughness: 0.5 }), 0.06, 0.2, 0.06, 0, -0.04, 0.03, 0.01));
  handle.position.set(0, 1.08, 0.2);
  g.add(handle);
  return { ...prop(g, [{ name: 'in', at: [0, 1.6, 0] }, { name: 'out', at: [0, 0.3, 0] }]), handle };
}

export function capacitorBank(m: LabMaterials): Prop {
  const g = new THREE.Group();
  g.add(block(m.darkSteel, 2.0, 0.12, 1.0, 0, 0, 0, 0.01));
  g.add(block(m.hazard, 2.02, 0.04, 1.02, 0, 0.12, 0, 0));
  for (let i = 0; i < 6; i++) {
    const cyl = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 1.5, 20), m.paint);
    cyl.position.set(-0.6 + (i % 3) * 0.6, 0.16 + 0.75, i < 3 ? -0.22 : 0.22);
    g.add(cyl);
  }
  for (const z of [-0.22, 0.22]) g.add(block(m.copper, 1.6, 0.06, 0.08, 0, 1.72, z, 0));
  return prop(g, [{ name: 'out', at: [0.95, 0.5, 0] }]);
}

export function operatorConsole(m: LabMaterials): Prop & { lever: THREE.Object3D; screen: THREE.Mesh } {
  const g = new THREE.Group();
  g.add(block(m.paint, 0.5, 0.95, 0.42, 0, 0, 0, 0.02));
  // the control panel slopes towards the operator standing in front (+z)
  const top = block(m.darkSteel, 0.8, 0.08, 0.55, 0, 0.95, 0.05, 0.015);
  top.rotation.x = 0.35;
  g.add(top);
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.26, 0.16), new THREE.MeshStandardMaterial({ color: '#06110a', emissive: '#3dff7a', emissiveIntensity: 0, roughness: 0.2 }));
  screen.rotation.x = -Math.PI / 2 + 0.35;
  screen.position.set(-0.18, 1.045, -0.02);
  screen.userData['peak'] = 1.6;
  g.add(screen);
  const lever = new THREE.Group();
  lever.add(block(m.darkSteel, 0.035, 0.42, 0.035, 0, 0, 0, 0.01));
  lever.add(block(new THREE.MeshStandardMaterial({ color: '#c0281c', roughness: 0.45 }), 0.07, 0.12, 0.07, 0, 0.4, 0, 0.02));
  lever.position.set(0.22, 1.02, 0.05);
  g.add(lever);
  const lamps = [lamp('#3dff7a', 0.02, 0.0, 1.08, 0.12), lamp('#ffb02a', 0.02, 0.07, 1.08, 0.12), lamp('#ff3b30', 0.02, 0.14, 1.08, 0.12)];
  lamps.forEach((l) => g.add(l));
  return { ...prop(g, [{ name: 'cable', at: [0, 0.05, -0.2] }], [screen, ...lamps]), lever, screen };
}

export function controlBox(m: LabMaterials): Prop {
  const g = new THREE.Group();
  g.add(block(m.darkSteel, 0.08, 1.0, 0.08, 0, 0, 0, 0));
  g.add(block(m.paint, 0.35, 0.45, 0.2, 0, 1.0, 0, 0.015));
  const lamps = [lamp('#3dff7a', 0.02, -0.08, 1.35, 0.11), lamp('#ffb02a', 0.02, 0.08, 1.35, 0.11)];
  lamps.forEach((l) => g.add(l));
  return prop(g, [{ name: 'cable', at: [0, 1.0, 0] }], lamps);
}

/** A low steel floor cover along a path, its glowing strip's uv.x in metres. */
export function floorCover(m: LabMaterials, path: [number, number][], width = 0.35): Prop & { pulse: THREE.Mesh; length: number } {
  const g = new THREE.Group();
  const pos: number[] = [], uv: number[] = [], idx: number[] = [];
  let along = 0;
  for (let i = 0; i + 1 < path.length; i++) {
    const [ax, az] = path[i]!, [bx, bz] = path[i + 1]!;
    const len = Math.hypot(bx - ax, bz - az);
    const body = block(m.darkSteel, width, 0.045, len + width, 0, 0, 0, 0.012);
    body.position.set((ax + bx) / 2, 0.0225, (az + bz) / 2);
    body.rotation.y = Math.atan2(bx - ax, bz - az);
    g.add(body);
    // the strip in the slots on top
    const nx = -(bz - az) / len, nz = (bx - ax) / len, hw = 0.05, y = 0.047, b = pos.length / 3;
    pos.push(ax + nx * hw, y, az + nz * hw, ax - nx * hw, y, az - nz * hw, bx + nx * hw, y, bz + nz * hw, bx - nx * hw, y, bz - nz * hw);
    uv.push(along, 0, along, 1, along + len, 0, along + len, 1);
    idx.push(b, b + 2, b + 1, b + 1, b + 2, b + 3);
    along += len;
  }
  const sg = new THREE.BufferGeometry();
  sg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  sg.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  sg.setIndex(idx);
  sg.computeVertexNormals();
  const pulse = new THREE.Mesh(sg, new THREE.MeshBasicMaterial({ color: '#1a1206' }));
  g.add(pulse);
  return { ...prop(g), pulse, length: along };
}

export function cableTray(m: LabMaterials, from: [number, number], to: [number, number], y: number, ceiling: number): Prop {
  const g = new THREE.Group();
  const len = Math.hypot(to[0] - from[0], to[1] - from[1]), yaw = Math.atan2(to[0] - from[0], to[1] - from[1]);
  const tray = block(m.darkSteel, 0.3, 0.06, len, 0, 0, 0, 0);
  tray.position.set((from[0] + to[0]) / 2, y, (from[1] + to[1]) / 2); tray.rotation.y = yaw;
  g.add(tray);
  for (let s = 0; s <= len; s += 2) {
    const t = len ? s / len : 0, x = from[0] + (to[0] - from[0]) * t, z = from[1] + (to[1] - from[1]) * t;
    g.add(block(m.darkSteel, 0.02, ceiling - y, 0.02, x, y, z, 0));
  }
  return { group: g, colliders: [{ min: [0, y, 0], max: [0, y, 0] }], sockets: [], lamps: [] };
}

export function planetTable(m: LabMaterials): Prop {
  const g = new THREE.Group();
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.7, 0.08, 32), m.darkSteel); base.position.y = 0.04; g.add(base);
  const ped = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.38, 0.8, 24), m.paint); ped.position.y = 0.48; g.add(ped);
  const top = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.15, 0.1, 48), m.darkSteel); top.position.y = 0.9; g.add(top);
  const disc = new THREE.Mesh(new THREE.CircleGeometry(0.95, 48), new THREE.MeshStandardMaterial({ color: '#111', emissive: '#ffb84a', emissiveIntensity: 0, roughness: 0.3 }));
  disc.rotation.x = -Math.PI / 2; disc.position.y = 0.956; disc.userData['peak'] = 1.2;
  g.add(disc);
  return prop(g, [], [disc]);
}

export function presetRack(m: LabMaterials, cols = 10, rows = 7): Prop {
  const g = new THREE.Group();
  g.add(block(m.darkSteel, 3.0, 2.4, 0.4, 0, 0.06, 0, 0.01));
  const lamps: THREE.Mesh[] = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const x = -1.35 + (c + 0.5) * (2.7 / cols), y = 0.3 + (r + 0.5) * (2.0 / rows);
    g.add(block(m.rubber, 2.4 / cols, 1.7 / rows, 0.02, x, y - 0.12, 0.2, 0));
    const l = lamp(r % 3 === 0 ? '#7cff4d' : '#ffb02a', 0.012, x + 0.09, y + 0.07, 0.215, 1.6);
    g.add(l); lamps.push(l);
  }
  return prop(g, [], lamps);
}

export function presetBench(m: LabMaterials): Prop {
  const g = new THREE.Group();
  for (const [x, z] of [[-0.82, -0.38], [0.82, -0.38], [-0.82, 0.38], [0.82, 0.38]] as const) g.add(block(m.darkSteel, 0.06, 0.88, 0.06, x, 0, z, 0.005));
  g.add(block(m.paint, 1.8, 0.07, 0.9, 0, 0.88, 0, 0.01));
  const top = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.6), new THREE.MeshStandardMaterial({ color: '#ddd', emissive: '#ffd9ef', emissiveIntensity: 0, roughness: 0.2 }));
  top.rotation.x = -Math.PI / 2; top.position.set(0, 0.952, 0); top.userData['peak'] = 0.9;
  g.add(top);
  return prop(g, [{ name: 'power', at: [0, 0.5, -0.4] }], [top]);
}

export function presetCombiner(m: LabMaterials): Prop {
  const g = new THREE.Group();
  const ped = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.5, 1.0, 28), m.paint); ped.position.y = 0.5; g.add(ped);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(0.34, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2), m.glass); dome.position.y = 1.0; g.add(dome);
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.12, 16, 12), new THREE.MeshStandardMaterial({ color: '#222', emissive: '#b46bff', emissiveIntensity: 0 })); core.position.y = 1.12; core.userData['peak'] = 2;
  g.add(core);
  return prop(g, [], [core]);
}

/** The texture mill: skid, hopper at the front, body, exhaust stack at the top rear. */
export function textureMill(m: LabMaterials, o: { stage?: number } = {}): Prop {
  const g = new THREE.Group();
  const low = (o.stage ?? 6) <= 1, r = low ? 0 : 0.03;
  const paint = new THREE.MeshStandardMaterial({ color: '#7d8277', roughness: 0.7, metalness: 0.3, flatShading: low });
  g.add(block(m.darkSteel, 1.7, 0.18, 1.3, 0, 0, 0, r));
  g.add(block(m.hazard, 1.72, 0.05, 1.32, 0, 0.18, 0, 0));
  g.add(block(paint, 1.2, 1.0, 0.9, 0, 0.23, -0.12, r));
  // the hopper: a frustum at the front
  const hop = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.3, 0.5, 4, 1, true), new THREE.MeshStandardMaterial({ color: '#5d625a', roughness: 0.8, metalness: 0.3, side: THREE.DoubleSide, flatShading: true }));
  hop.rotation.y = Math.PI / 4; hop.position.set(0, 1.3, 0.45);
  g.add(hop);
  // the exhaust stack at the top rear
  const stack = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.15, 0.7, low ? 6 : 16), m.darkSteel);
  stack.position.set(0.32, 1.23 + 0.35, -0.4);
  g.add(stack);
  return prop(g, [{ name: 'hopper', at: [0, 1.55, 0.45] }, { name: 'stack', at: [0.32, 1.93, -0.4] }, { name: 'power', at: [-0.4, 0.5, -0.57] }]);
}

/** Triangles in a prop. */
export function triangles(p: Prop): number {
  let n = 0;
  p.group.traverse((o) => { const mesh = o as THREE.Mesh; if (!mesh.isMesh) return; const g = mesh.geometry; n += (g.index ? g.index.count : g.getAttribute('position').count) / 3; });
  return n;
}
