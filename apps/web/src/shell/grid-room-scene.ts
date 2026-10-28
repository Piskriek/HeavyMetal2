/**
 * Plan 57 §10: the grid room's three.js scene. An open-fronted room on a square grid, a gate frame on its base against the
 * back wall, a screen on two legs for a bridged game, and a plinth per rung of the preset ladder. Every surface draws through
 * one stage shader, so the whole room changes era at once (1-bit, EGA, VGA, Gouraud) and the program compiles once.
 *
 * It draws only when told to (the component draws on change, under a frame cap): an idle room costs nothing. Square sections,
 * nothing floating, no lettering (the owner's rules).
 */
import * as THREE from 'three';
import { EGA_PALETTE, RUNGS, hexToRgb, type RoomStage, type Rung } from './grid-room-warm';

const VERT = /* glsl */ `
uniform vec3 uLamp;
varying vec3 vN;
varying vec3 vW;
varying float vGouraud;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vec3 n = normalize(mat3(modelMatrix) * normal);
  vN = n;
  vW = w.xyz;
  // stage 3: lit per vertex from the room's lamp, so light falls across a face (Gouraud), with a soft falloff
  vec3 toLamp = uLamp - w.xyz;
  float fall = 1.0 / (1.0 + 0.035 * dot(toLamp, toLamp));
  vGouraud = 0.22 + 0.95 * max(dot(n, normalize(toLamp)), 0.0) * fall + 0.12 * max(n.y, 0.0);
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

const FRAG = /* glsl */ `
uniform float uStage;
uniform vec3 uBase;
uniform vec3 uLamp;
uniform vec3 uEga[16];
varying vec3 vN;
varying vec3 vW;
varying float vGouraud;
// a 4x4 ordered (Bayer) threshold, built from two 2x2 levels
float bayer2(vec2 a) { return a.x * 2.0 + a.y * 3.0 - 4.0 * a.x * a.y; }
float bayer4(vec2 p) {
  vec2 q = mod(floor(p), 4.0);
  return (bayer2(mod(q, 2.0)) * 4.0 + bayer2(floor(q / 2.0)) + 0.5) / 16.0;
}
void main() {
  vec3 toLamp = uLamp - vW;
  float fall = 1.0 / (1.0 + 0.035 * dot(toLamp, toLamp));
  float lam = 0.22 + 0.95 * max(dot(normalize(vN), normalize(toLamp)), 0.0) * fall + 0.12 * max(vN.y, 0.0);
  vec3 c = clamp(uBase * lam, 0.0, 1.0);
  float t = bayer4(gl_FragCoord.xy);
  vec3 outc;
  if (uStage < 1.5) {
    // 0b: one bit, ordered dither
    outc = vec3(step(t, dot(c, vec3(0.299, 0.587, 0.114)) * 1.2));
  } else if (uStage < 2.5) {
    // 1: the nearest of the 16 EGA colours, flat per pixel
    float best = 1e9;
    outc = uEga[0];
    for (int i = 0; i < 16; i++) {
      vec3 d = c - uEga[i];
      float e = dot(d, d);
      if (e < best) { best = e; outc = uEga[i]; }
    }
  } else if (uStage < 3.5) {
    // 2: VGA, six levels a channel with an ordered dither between them
    outc = floor(clamp(c + (t - 0.5) / 5.0, 0.0, 1.0) * 5.0 + 0.5) / 5.0;
  } else {
    // 3: Gouraud, lit per vertex
    outc = clamp(uBase * vGouraud, 0.0, 1.0);
  }
  gl_FragColor = vec4(outc, 1.0);
}`;

const STAGE_CODE: Readonly<Record<RoomStage, number>> = { '0a': 0, '0b': 1, '1': 2, '2': 3, '3': 4 };
/** The grid lines: white vectors, then EGA's light cyan, then quieter as the room fills in. */
const LINE_COLOUR: Readonly<Record<RoomStage, string>> = { '0a': '#ffffff', '0b': '#ffffff', '1': '#55ffff', '2': '#5a86a0', '3': '#46505e' };
const CLEAR: Readonly<Record<RoomStage, string>> = { '0a': '#000000', '0b': '#000000', '1': '#000000', '2': '#0d0b16', '3': '#151a22' };

const ROOM = { w: 10, h: 4, d: 9 } as const;
const LAMP: readonly [number, number, number] = [0.8, 3.7, -3.2];
const FLOOR = '#7a8494';
const WALL = '#5d6676';
const STEEL = '#9aa3b0';
const FRAME = '#3a404a';
const GLASS = '#0b0f14';
const PANEL_SHUT = '#1c2230';
const PANEL_OPEN = '#ffd27a';
/** A plinth per rung, each in its own hue: the drone's violet for atoms, canopy green, brass, rust, signal blue. */
const RUNG_HUE: Readonly<Record<Rung, string>> = { atoms: '#a050c8', stacks: '#4caf7a', parts: '#c8a05a', assemblies: '#c86a4a', worlds: '#5a8ad2' };

export interface GridRoomScene {
  setStage(stage: RoomStage): void;
  /** Fill each rung's plinth that is warm; the rest stay outlines. */
  setWarm(rungs: ReadonlySet<Rung>): void;
  /** The gate's panel lights when play is ready. */
  setGateOpen(open: boolean): void;
  /** A small parallax from the pointer (-1..1 each way). */
  lean(x: number, y: number): void;
  resize(width: number, height: number, pixelRatio: number): void;
  /** Compile the room's one stage program (the first atom of the warm-up). */
  compile(): void;
  render(): void;
  stats(): { readonly calls: number; readonly triangles: number };
  dispose(): void;
}

interface Solid {
  readonly mesh: THREE.Mesh;
  readonly edges: THREE.LineSegments | null;
  readonly role: 'room' | 'fixture' | 'plinth';
  readonly rung?: Rung;
}

export function createGridRoomScene(opts: { readonly canvas: HTMLCanvasElement; readonly antialias: boolean; readonly powerPreference: WebGLPowerPreference }): GridRoomScene {
  const renderer = new THREE.WebGLRenderer({ canvas: opts.canvas, antialias: opts.antialias, powerPreference: opts.powerPreference });
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, 16 / 9, 0.1, 60);
  const eye = new THREE.Vector3(-0.6, 1.75, 2.2);
  const target = new THREE.Vector3(1.6, 1.25, -6);
  camera.position.copy(eye);
  camera.lookAt(target);

  // one program for every surface; the stage, lamp and palette uniforms are shared objects, so a stage change is one write
  const shared = {
    uStage: { value: 0 },
    uLamp: { value: new THREE.Vector3(...LAMP) },
    uEga: { value: EGA_PALETTE.map((h) => new THREE.Vector3(...hexToRgb(h))) },
  };
  const materials: THREE.ShaderMaterial[] = [];
  const stageMaterial = (hex: string): THREE.ShaderMaterial => {
    const m = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: { uStage: shared.uStage, uLamp: shared.uLamp, uEga: shared.uEga, uBase: { value: new THREE.Vector3(...hexToRgb(hex)) } },
    });
    materials.push(m);
    return m;
  };
  const edgeMaterial = new THREE.LineBasicMaterial({ color: '#ffffff' });
  const gridMaterial = new THREE.LineBasicMaterial({ color: '#ffffff' });
  const solids: Solid[] = [];

  // the room: floor and three walls, finely divided so stage 3's per-vertex light falls smoothly across them
  const plane = (geo: THREE.PlaneGeometry, hex: string, at: readonly [number, number, number]): void => {
    const mesh = new THREE.Mesh(geo, stageMaterial(hex));
    mesh.position.set(...at);
    scene.add(mesh);
    solids.push({ mesh, edges: null, role: 'room' });
  };
  plane(new THREE.PlaneGeometry(ROOM.w, ROOM.d, 20, 18).rotateX(-Math.PI / 2), FLOOR, [0, 0, -ROOM.d / 2]);
  plane(new THREE.PlaneGeometry(ROOM.w, ROOM.h, 20, 8), WALL, [0, ROOM.h / 2, -ROOM.d]);
  plane(new THREE.PlaneGeometry(ROOM.d, ROOM.h, 18, 8).rotateY(Math.PI / 2), WALL, [-ROOM.w / 2, ROOM.h / 2, -ROOM.d / 2]);
  plane(new THREE.PlaneGeometry(ROOM.d, ROOM.h, 18, 8).rotateY(-Math.PI / 2), WALL, [ROOM.w / 2, ROOM.h / 2, -ROOM.d / 2]);

  // the grid: 1 m squares over the floor and the walls, one draw, lifted off each surface so it never fights it
  const lines: number[] = [];
  const seg = (a: readonly number[], b: readonly number[]): void => { lines.push(a[0]!, a[1]!, a[2]!, b[0]!, b[1]!, b[2]!); };
  const e = 0.004, hw = ROOM.w / 2;
  for (let x = -hw; x <= hw + 1e-6; x += 1) {
    seg([x, e, 0], [x, e, -ROOM.d]);
    seg([x, 0, -ROOM.d + e], [x, ROOM.h, -ROOM.d + e]);
  }
  for (let z = 0; z >= -ROOM.d - 1e-6; z -= 1) {
    seg([-hw, e, z], [hw, e, z]);
    seg([-hw + e, 0, z], [-hw + e, ROOM.h, z]);
    seg([hw - e, 0, z], [hw - e, ROOM.h, z]);
  }
  for (let y = 0; y <= ROOM.h + 1e-6; y += 1) {
    seg([-hw, y, -ROOM.d + e], [hw, y, -ROOM.d + e]);
    seg([-hw + e, y, 0], [-hw + e, y, -ROOM.d]);
    seg([hw - e, y, 0], [hw - e, y, -ROOM.d]);
  }
  const gridGeo = new THREE.BufferGeometry();
  gridGeo.setAttribute('position', new THREE.Float32BufferAttribute(lines, 3));
  scene.add(new THREE.LineSegments(gridGeo, gridMaterial));

  // a box that stands on its base, in a group with its outline (stage 0a draws only the outline)
  const box = (parent: THREE.Object3D, size: readonly [number, number, number], at: readonly [number, number, number], hex: string, role: Solid['role'], rung?: Rung): THREE.Mesh => {
    const geo = new THREE.BoxGeometry(size[0], size[1], size[2]).translate(0, size[1] / 2, 0);
    const group = new THREE.Group();
    group.position.set(...at);
    const mesh = new THREE.Mesh(geo, stageMaterial(hex));
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geo), edgeMaterial);
    group.add(mesh, edges);
    parent.add(group);
    solids.push({ mesh, edges, role, rung });
    return mesh;
  };

  // the gate: a square frame of two posts and a lintel on a base block, its panel between the posts (it lights when ready)
  const gate = new THREE.Group();
  gate.position.set(1.6, 0, -8.3);
  scene.add(gate);
  box(gate, [3.4, 0.3, 1.0], [0, 0, 0], STEEL, 'fixture');
  box(gate, [0.4, 3.0, 0.4], [-1.3, 0.3, 0], STEEL, 'fixture');
  box(gate, [0.4, 3.0, 0.4], [1.3, 0.3, 0], STEEL, 'fixture');
  box(gate, [3.0, 0.4, 0.4], [0, 3.3, 0], STEEL, 'fixture');
  const panel = box(gate, [2.2, 3.0, 0.06], [0, 0.3, -0.05], PANEL_SHUT, 'fixture');

  // the bridge screen (Plan 53's stage): a framed screen on two legs, each on its own foot; dark until a game is bridged
  const screen = new THREE.Group();
  screen.position.set(3.9, 0, -7.2);
  screen.rotation.y = -0.38;
  scene.add(screen);
  for (const sx of [-0.8, 0.8]) {
    box(screen, [0.5, 0.06, 0.5], [sx, 0, 0], FRAME, 'fixture');
    box(screen, [0.12, 1.05, 0.12], [sx, 0.06, 0], FRAME, 'fixture');
  }
  box(screen, [2.0, 1.2, 0.12], [0, 1.11, 0], FRAME, 'fixture');
  box(screen, [1.84, 1.04, 0.02], [0, 1.19, 0.07], GLASS, 'fixture');

  // a plinth per rung, rising rung by rung along the floor: an outline until its rung is warm, then solid
  RUNGS.forEach((rung, i) => {
    const side = 0.45 + 0.1 * i;
    box(scene, [side, 0.35 + 0.18 * i, side], [-0.2 + 0.9 * i, 0, -3.2 - 0.55 * i], RUNG_HUE[rung], 'plinth', rung);
  });

  let stage: RoomStage = '0a';
  let warm: ReadonlySet<Rung> = new Set();
  const apply = (): void => {
    const flat = stage !== '0a';
    for (const s of solids) {
      if (s.role === 'plinth') {
        const lit = flat && warm.has(s.rung!);
        s.mesh.visible = lit;
        if (s.edges) s.edges.visible = !lit;
      } else {
        s.mesh.visible = flat;
        if (s.edges) s.edges.visible = !flat;
      }
    }
    shared.uStage.value = STAGE_CODE[stage];
    gridMaterial.color.set(LINE_COLOUR[stage]);
    edgeMaterial.color.set(stage === '0a' ? '#ffffff' : '#c9d2dc');
    renderer.setClearColor(CLEAR[stage]);
  };
  apply();

  return {
    setStage(s) { stage = s; apply(); },
    setWarm(r) { warm = r; apply(); },
    setGateOpen(open) { (panel.material as THREE.ShaderMaterial).uniforms.uBase!.value = new THREE.Vector3(...hexToRgb(open ? PANEL_OPEN : PANEL_SHUT)); },
    lean(x, y) {
      camera.position.set(eye.x + x * 0.3, eye.y - y * 0.15, eye.z);
      camera.lookAt(target);
    },
    resize(width, height, pixelRatio) {
      renderer.setPixelRatio(pixelRatio);
      renderer.setSize(width, height, false);
      camera.aspect = width / Math.max(1, height);
      camera.updateProjectionMatrix();
    },
    compile() { renderer.compile(scene, camera); },
    render() { renderer.render(scene, camera); },
    stats() { return { calls: renderer.info.render.calls, triangles: renderer.info.render.triangles }; },
    dispose() {
      scene.traverse((o) => {
        if (o instanceof THREE.Mesh || o instanceof THREE.LineSegments) o.geometry.dispose();
      });
      for (const m of materials) m.dispose();
      edgeMaterial.dispose();
      gridMaterial.dispose();
      renderer.dispose();
    },
  };
}
