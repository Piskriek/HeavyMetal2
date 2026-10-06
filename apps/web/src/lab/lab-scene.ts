// The SetMix home's 3D view: a lab (white test-chamber panels, a steel band, a concrete floor, cold strip lights) with an
// archway on the right that opens onto the planet as it will look once everyone has terraformed it. The menu sits over
// the lab's left side.
// Two scenes share one camera: the lab draws first and fills the depth buffer, so the planet shows only through the arch,
// and neither scene's lights reach into the other. Daylight comes in through the arch as a patch on the floor (drawn, not
// lit: there are no shadow maps on the minimum spec) and a warm lamp standing in for its bounce.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import type { StageLook } from '../crafter/looks';
import { hash } from '../crafter/moon';
import { drop, planetHeight } from '../crafter/planet';
import { createWorld, type Neighbour, type World } from '../crafter/world';

/** Where the lab stands on the planet (just off your plot) and which way its arch looks: over the chimney, towards the goblin planet. */
export const LAB_AT = { x: 86, z: 30 } as const;
const OUT = new THREE.Vector2(-0.944, -0.33).normalize();
/** The vista's sun: 45 degrees to the right of the arch's view and 26 up, so its light falls in through the arch. */
const VISTA_SUN = (() => {
  const right = new THREE.Vector2(-OUT.y, OUT.x), a = Math.PI / 4, up = 0.45;
  const xz = OUT.clone().multiplyScalar(Math.cos(a)).add(right.multiplyScalar(Math.sin(a))).normalize();
  return new THREE.Vector3(xz.x * Math.cos(up), Math.sin(up), xz.y * Math.cos(up)).normalize();
})();
/** The goblin planet, low in the arch. */
const VISTA_PLANET = new THREE.Vector3(OUT.x * Math.cos(0.1), Math.sin(0.1), OUT.y * Math.cos(0.1)).normalize();

// the room, in the lab's own frame: x right, y up, z towards the camera; the arch is in the back wall, right of centre
const ROOM = { left: -8, right: 8, back: -14, front: 3, height: 8 } as const;
const ARCH = { x: 2.8, half: 2.6, spring: 4.4 } as const;
const EYE = new THREE.Vector3(-2.2, 1.7, 0.8), LOOK = new THREE.Vector3(-0.9, 3.1, -14);
/** On a tall screen the menu takes the top: the eye stands back and aims at the arch, which sits below it. */
const EYE_TALL = new THREE.Vector3(0.9, 1.5, 2.7), LOOK_TALL = new THREE.Vector3(2.7, 9.4, -14);
/** One panel texture covers 4 x 4 panels of 1.28 m. */
const PANEL_TILE = 5.12, FLOOR_TILE = 4;

/** The arch's outline (x, y) in the back wall: up the left side, over the round top, down the right. */
function archOutline(half: number, from = 0, steps = 24): THREE.Vector2[] {
  const pts = [new THREE.Vector2(ARCH.x - half, from), new THREE.Vector2(ARCH.x - half, ARCH.spring)];
  for (let i = 1; i < steps; i++) { const a = Math.PI - (i / steps) * Math.PI; pts.push(new THREE.Vector2(ARCH.x + Math.cos(a) * half, ARCH.spring + Math.sin(a) * half)); }
  pts.push(new THREE.Vector2(ARCH.x + half, ARCH.spring), new THREE.Vector2(ARCH.x + half, from));
  return pts;
}

const smoothstep = (a: number, b: number, x: number): number => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

/** Albedo, roughness and normal textures from a height function over a tile (h 0 in seams .. 1 on faces), drawn once. */
function surfaceTextures(size: number, at: (px: number, py: number) => { h: number; colour: [number, number, number]; rough: number }, bump: number) {
  const albedo = new Uint8Array(size * size * 4), rough = new Uint8Array(size * size * 4), normal = new Uint8Array(size * size * 4), height = new Float32Array(size * size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const s = at(x, y), k = (y * size + x) * 4;
    height[y * size + x] = s.h;
    albedo[k] = s.colour[0] * 255; albedo[k + 1] = s.colour[1] * 255; albedo[k + 2] = s.colour[2] * 255; albedo[k + 3] = 255;
    rough[k] = 255; rough[k + 1] = s.rough * 255; rough[k + 2] = 255; rough[k + 3] = 255; // three reads roughness from green
  }
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const h = (xx: number, yy: number) => height[((yy + size) % size) * size + ((xx + size) % size)]!;
    const dx = (h(x + 1, y) - h(x - 1, y)) * bump, dy = (h(x, y + 1) - h(x, y - 1)) * bump, len = Math.hypot(dx, dy, 1), k = (y * size + x) * 4;
    normal[k] = (0.5 - 0.5 * dx / len) * 255; normal[k + 1] = (0.5 + 0.5 * dy / len) * 255; normal[k + 2] = (0.5 + 0.5 / len) * 255; normal[k + 3] = 255;
  }
  const tex = (bytes: Uint8Array, colour: boolean) => {
    const t = new THREE.DataTexture(bytes, size, size, THREE.RGBAFormat);
    t.colorSpace = colour ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter; t.generateMipmaps = true; t.anisotropy = 8;
    t.needsUpdate = true;
    return t;
  };
  return { map: tex(albedo, true), roughnessMap: tex(rough, false), normalMap: tex(normal, false) };
}

/** Test-chamber wall panels: cool white squares with dark seams and a soft bevel, a few a shade off from their neighbours. */
function panelTextures(size: number) {
  const cell = size / 4;
  return surfaceTextures(size, (px, py) => {
    const lx = px % cell, ly = py % cell, edge = Math.min(lx, ly, cell - 1 - lx, cell - 1 - ly);
    const ix = Math.floor(px / cell), iy = Math.floor(py / cell), tint = 0.93 + hash(ix, iy, 3) * 0.07;
    // grime gathers low on a panel and in its corners
    const grime = 1 - 0.05 * (ly / cell) - 0.04 * (1 - smoothstep(0, cell * 0.25, edge));
    const seam = edge < 1.5;
    const c = seam ? 0.13 : tint * grime;
    return { h: smoothstep(0, cell * 0.04, edge), colour: [c * 0.9, c * 0.94, c * 0.95], rough: seam ? 0.9 : 0.38 + hash(ix, iy, 4) * 0.12 };
  }, 2.2);
}

/** Concrete floor tiles: mottled grey, darker seams, a little polish so the strip lights and the daylight show in it. */
function floorTextures(size: number) {
  const cell = size / 2;
  const noise = (x: number, y: number, s: number, seed: number) => {
    const fx = x / s, fy = y / s, i = Math.floor(fx), j = Math.floor(fy), u = fx - i, v = fy - j, n = size / s;
    const h = (a: number, b: number) => hash(((a % n) + n) % n, ((b % n) + n) % n, seed);
    return (h(i, j) * (1 - u) + h(i + 1, j) * u) * (1 - v) + (h(i, j + 1) * (1 - u) + h(i + 1, j + 1) * u) * v;
  };
  return surfaceTextures(size, (px, py) => {
    const lx = px % cell, ly = py % cell, edge = Math.min(lx, ly, cell - 1 - lx, cell - 1 - ly);
    const m = 0.6 * noise(px, py, size / 8, 9) + 0.4 * noise(px, py, size / 32, 10);
    const seam = edge < 1.5, c = seam ? 0.1 : 0.27 + m * 0.08;
    return { h: smoothstep(0, 3, edge), colour: [c, c * 1.02, c * 1.05], rough: seam ? 0.95 : 0.42 + m * 0.3 };
  }, 1.4);
}

export interface LabScene {
  /** Puts the finished planet outside the arch (once, after its looks and models are ready). */
  setVista(base: StageLook, plot: StageLook, neighbours: readonly Neighbour[]): void;
  frame(now: number, dt: number): void;
  /** What the last frame drew (for the test hook). */
  stats(): { readonly triangles: number; readonly calls: number };
  resize(width: number, height: number, pixelRatio: number): void;
  /** Where the pointer is, -1..1 across the screen: the eye leans a little towards it. */
  lean(x: number, y: number): void;
  dispose(): void;
}

export function createLabScene(o: { readonly canvas: HTMLCanvasElement; readonly gridSpacing: number; readonly antialias: boolean; readonly powerPreference: WebGLPowerPreference; readonly reducedMotion: boolean; readonly textureSize: number }): LabScene {
  const renderer = new THREE.WebGLRenderer({ canvas: o.canvas, antialias: o.antialias, powerPreference: o.powerPreference });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.autoClear = false;
  renderer.setClearColor(0x000000, 1);
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 9000);
  const owned: { dispose(): void }[] = [];
  const keep = <T extends { dispose(): void }>(x: T): T => { owned.push(x); return x; };

  // ---- the lab stands on the planet, its floor above the highest ground under it
  const lab = new THREE.Scene();
  const room = new THREE.Group();
  const toEye = new THREE.Vector2(ARCH.x - EYE.x, ROOM.back - EYE.z);
  room.rotation.y = Math.atan2(toEye.y, toEye.x) - Math.atan2(OUT.y, OUT.x);
  room.updateMatrix();
  let floorY = -Infinity;
  for (let x = ROOM.left; x <= ROOM.right; x += 2) for (let z = ROOM.back - 3; z <= ROOM.front; z += 2) {
    const w = new THREE.Vector3(x, 0, z).applyMatrix4(room.matrix).add(new THREE.Vector3(LAB_AT.x, 0, LAB_AT.z));
    floorY = Math.max(floorY, planetHeight(w.x, w.z) - drop(w.x, w.z));
  }
  // raised a few metres, so the arch looks down over the plains
  room.position.set(LAB_AT.x, floorY + 5, LAB_AT.z);
  room.updateMatrixWorld(true);
  lab.add(room);
  const pmrem = keep(new THREE.PMREMGenerator(renderer));
  const room0 = new RoomEnvironment();
  const env = keep(pmrem.fromScene(room0, 0.04).texture);
  room0.dispose();
  lab.environment = env;
  lab.environmentIntensity = 0.24;

  const panels = panelTextures(o.textureSize), floorTex = floorTextures(o.textureSize);
  for (const t of [panels.map, panels.roughnessMap, panels.normalMap]) { keep(t); t.repeat.set(1 / PANEL_TILE, 1 / PANEL_TILE); }
  for (const t of [floorTex.map, floorTex.roughnessMap, floorTex.normalMap]) { keep(t); t.repeat.set(1 / FLOOR_TILE, 1 / FLOOR_TILE); }
  const wallMat = keep(new THREE.MeshStandardMaterial({ ...panels, normalScale: new THREE.Vector2(0.6, 0.6), metalness: 0 }));
  const floorMat = keep(new THREE.MeshStandardMaterial({ ...floorTex, normalScale: new THREE.Vector2(0.5, 0.5), metalness: 0 }));
  const steel = keep(new THREE.MeshStandardMaterial({ color: '#2a2f34', roughness: 0.42, metalness: 0.75 }));
  const ceilingMat = keep(new THREE.MeshStandardMaterial({ color: '#1f2327', roughness: 0.85, metalness: 0.2 }));
  const glow = keep(new THREE.MeshBasicMaterial({ color: '#eef8ff' }));
  const trim = keep(new THREE.MeshBasicMaterial({ color: '#9ff1ff' }));

  /** A flat shape as geometry, its UVs in metres (so every wall's panels line up at the same size). */
  const flat = (shape: THREE.Shape): THREE.ShapeGeometry => keep(new THREE.ShapeGeometry(shape, 24));
  const rect = (x0: number, y0: number, x1: number, y1: number): THREE.Shape => new THREE.Shape([new THREE.Vector2(x0, y0), new THREE.Vector2(x1, y0), new THREE.Vector2(x1, y1), new THREE.Vector2(x0, y1)]);
  const add = (g: THREE.BufferGeometry, m: THREE.Material, f: (mesh: THREE.Mesh) => void = () => undefined): THREE.Mesh => { const mesh = new THREE.Mesh(g, m); f(mesh); room.add(mesh); return mesh; };

  // back wall, with the arch cut through it (the wall starts below the floor, so the arch's foot is not on its edge)
  const back = rect(ROOM.left, -0.2, ROOM.right, ROOM.height);
  back.holes.push(new THREE.Path(archOutline(ARCH.half)));
  add(flat(back), wallMat, (m) => { m.position.z = ROOM.back; });
  const depth = ROOM.front - ROOM.back;
  add(flat(rect(0, 0, depth, ROOM.height)), wallMat, (m) => { m.rotation.y = Math.PI / 2; m.position.set(ROOM.left, 0, ROOM.front); });
  add(flat(rect(0, 0, depth, ROOM.height)), wallMat, (m) => { m.rotation.y = -Math.PI / 2; m.position.set(ROOM.right, 0, ROOM.back); });
  // the floor runs on out through the arch: a threshold to stand on above the planet
  add(flat(rect(ROOM.left, -ROOM.front, ROOM.right, -(ROOM.back - 3.5))), floorMat, (m) => { m.rotation.x = -Math.PI / 2; });
  add(flat(rect(ROOM.left, ROOM.back, ROOM.right, ROOM.front)), ceilingMat, (m) => { m.rotation.x = Math.PI / 2; m.position.y = ROOM.height; });
  // the threshold's front edge and the lab's outer skin round the arch (seen from outside the lab only edge-on)
  add(keep(new THREE.BoxGeometry(ARCH.half * 2 + 1.4, 0.6, 0.25)), steel, (m) => { m.position.set(ARCH.x, -0.3, ROOM.back - 3.5); });

  // the steel band along the foot of the walls
  const band = (x0: number, x1: number, z0: number, z1: number) => add(keep(new THREE.BoxGeometry(Math.max(0.12, x1 - x0), 1.05, Math.max(0.12, z1 - z0))), steel, (m) => { m.position.set((x0 + x1) / 2, 0.525, (z0 + z1) / 2); });
  band(ROOM.left, ROOM.left + 0.12, ROOM.back, ROOM.front);
  band(ROOM.right - 0.12, ROOM.right, ROOM.back, ROOM.front);
  band(ROOM.left, ARCH.x - ARCH.half - 0.5, ROOM.back, ROOM.back + 0.12);
  band(ARCH.x + ARCH.half + 0.5, ROOM.right, ROOM.back, ROOM.back + 0.12);

  // the arch: a deep steel frame with a cold light strip round its inner edge
  const frame = new THREE.Shape(archOutline(ARCH.half + 0.5, -0.05));
  frame.holes.push(new THREE.Path(archOutline(ARCH.half, 0.02)));
  add(keep(new THREE.ExtrudeGeometry(frame, { depth: 0.9, bevelEnabled: false, curveSegments: 24 })), steel, (m) => { m.position.z = ROOM.back - 0.3; });
  const strip = new THREE.Shape(archOutline(ARCH.half + 0.02, 0.0));
  strip.holes.push(new THREE.Path(archOutline(ARCH.half - 0.07, 0.04)));
  add(keep(new THREE.ExtrudeGeometry(strip, { depth: 0.04, bevelEnabled: false, curveSegments: 24 })), trim, (m) => { m.position.z = ROOM.back + 0.6; });

  // the ceiling's light strips, and the light they give
  for (const x of [-5, -1, 3]) add(keep(new THREE.BoxGeometry(0.28, 0.06, depth - 3)), glow, (m) => { m.position.set(x, ROOM.height - 0.04, (ROOM.back + ROOM.front) / 2); });
  // one lamp stands in for all three strips (each light costs every pixel of the room)
  const lamp = new THREE.PointLight('#e6f2ff', 13, 0, 2);
  lamp.position.set(-1, ROOM.height - 0.6, -5.5);
  room.add(lamp);
  // the room is dim: the brightest thing in it is the arch
  room.add(new THREE.HemisphereLight('#dfe8f0', '#2f3438', 0.32));

  // ---- daylight through the arch: where it lands on the floor, and a lamp standing in for its bounce
  const inward = VISTA_SUN.clone().negate().applyQuaternion(room.quaternion.clone().invert());
  const outline = archOutline(ARCH.half, 0, 16).map((p) => new THREE.Vector3(p.x, p.y, ROOM.back));
  const onFloor = outline.map((p) => p.clone().addScaledVector(inward, p.y / -inward.y));
  const patch = new THREE.Shape(onFloor.map((p) => new THREE.Vector2(p.x, -p.z)));
  add(keep(new THREE.ShapeGeometry(patch)), keep(new THREE.MeshBasicMaterial({ color: '#ffe9c8', transparent: true, opacity: 0.26, blending: THREE.AdditiveBlending, depthWrite: false })), (m) => { m.rotation.x = -Math.PI / 2; m.position.y = 0.01; });
  // daylight bouncing in off the floor by the arch: warm, strongest near it
  const bounce = new THREE.PointLight('#ffe2bd', 60, 0, 2);
  bounce.position.set(ARCH.x - 1, 1.2, ROOM.back + 3.5);
  room.add(bounce);

  // ---- the planet outside
  const outside = new THREE.Scene();
  let world: World | null = null;
  const eye = new THREE.Vector3(), look = new THREE.Vector3(), leanTo = new THREE.Vector2(), leanNow = new THREE.Vector2();
  let tall = false;

  return {
    setVista(base, plot, neighbours) {
      if (world) return;
      world = createWorld(outside, { gridSpacing: o.gridSpacing, reducedMotion: o.reducedMotion, sun: VISTA_SUN, planetDir: VISTA_PLANET });
      // only the arch's view is ever seen: what lies outside it is not built
      world.setPlanet(base, neighbours, { lush: true, clear: { x: LAB_AT.x, z: LAB_AT.z, r: 40 }, view: { x: LAB_AT.x, z: LAB_AT.z, dirX: OUT.x, dirZ: OUT.y, halfAngle: 0.5 } });
      world.show(plot);
      world.setChimney(false, ['#ffffff']);
    },
    lean(x, y) { leanTo.set(x, y); },
    stats: () => ({ triangles: renderer.info.render.triangles, calls: renderer.info.render.calls }),
    frame(now, dt) {
      // the eye breathes a little and leans towards the pointer; it never moves far (the menu stays over the same wall)
      const k = Math.min(1, dt * 2.5);
      leanNow.lerp(leanTo, k);
      const sway = o.reducedMotion ? 0 : 1;
      eye.copy(tall ? EYE_TALL : EYE).add(new THREE.Vector3(Math.sin(now * 0.31) * 0.05 * sway + leanNow.x * 0.25, Math.sin(now * 0.43) * 0.03 * sway - leanNow.y * 0.12, 0));
      look.copy(tall ? LOOK_TALL : LOOK).add(new THREE.Vector3(leanNow.x * 0.9, -leanNow.y * 0.5, 0));
      camera.position.copy(room.localToWorld(eye.clone()));
      camera.lookAt(room.localToWorld(look.clone()));
      world?.update(now, dt, camera.position);
      renderer.info.autoReset = false;
      renderer.info.reset();
      renderer.clear();
      renderer.render(lab, camera);
      if (world) renderer.render(outside, camera);
    },
    resize(width, height, pixelRatio) {
      renderer.setPixelRatio(pixelRatio);
      renderer.setSize(width, height, false);
      camera.aspect = width / Math.max(1, height);
      // a tall screen sees more of the room top to bottom, and aims at the arch
      tall = camera.aspect < 0.8;
      camera.fov = tall ? 74 : camera.aspect < 1 ? 62 : 50;
      camera.updateProjectionMatrix();
    },
    dispose() {
      world?.dispose();
      for (const x of owned) x.dispose();
      renderer.dispose();
    },
  };
}
