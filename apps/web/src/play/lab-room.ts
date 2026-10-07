// The lab you play in (SETMIX_PLAN Phase 2b), laid out as the concept art (docs/concept/setmix on the art branch):
// a white test-chamber room, the window on the left of the back wall onto a rainy pine mountainside, the gate standing
// free in the middle-right, relay cabinets, the breaker panel and the capacitor bank at the back right, the console with
// the main lever in front of the gate, the planet table centre-left, the preset rack on the left wall, the bench and the
// combiner on the right. Cables run in floor covers and ceiling trays. Lab frame: x right, y up, z towards the start.
import * as THREE from 'three';
import { hash } from '../crafter/moon';
import { floorTextures, panelTextures } from '../lab/lab-scene';
import * as kit from './kit';
import type { Box, Prop } from './kit';

export const ROOM = { left: -10, right: 10, back: -12, front: 4, height: 8 } as const;
const WINDOW = { x0: -8.6, x1: -2.6, y0: 1.0, y1: 4.3 } as const;
/** Where the gate stands and which way it faces (+z, towards where you start). */
export const GATE_AT = { x: 3.2, z: -8.6 } as const;
const PANEL_TILE = 5.12, FLOOR_TILE = 4;

/** How powered the lab is, each 0..1: the power-on sequence drives these. */
export interface Power {
  /** Fraction of the relay lamps lit, in order. */
  readonly relays: number;
  /** Power running along the floor covers. */
  readonly pulse: number;
  /** Fraction of the gate's coils lit, bottom to top. */
  readonly coils: number;
  /** The ceiling lights. */
  readonly main: number;
  /** The orange emergency lamps. */
  readonly emergency: number;
  /** Static in the gate's opening (1 = all static, 0 = a clear picture); the opening shows nothing while coils are 0. */
  readonly static: number;
}
export const POWER_OFF: Power = { relays: 0, pulse: 0, coils: 0, main: 0, emergency: 1, static: 1 };
export const POWER_ON: Power = { relays: 1, pulse: 1, coils: 1, main: 1, emergency: 0, static: 0 };
/** The power-on sequence's length, seconds. */
export const POWER_SECONDS = 6.5;

const ramp = (t: number, a: number, b: number): number => Math.max(0, Math.min(1, (t - a) / (b - a)));
/** The lab at `t` seconds after the main lever is thrown: relays click on in a row, power runs along the floor to the gate,
 *  the coils light bottom to top while the lights dip (the gate draws from everything else), static resolves, the lights recover. */
export function powerAt(t: number): Power {
  if (t >= POWER_SECONDS) return POWER_ON;
  const dip = ramp(t, 2.0, 2.6) * (1 - ramp(t, 5.0, 6.3));
  return {
    relays: ramp(t, 0.4, 1.9),
    pulse: ramp(t, 1.2, 2.4),
    coils: ramp(t, 2.0, 4.4),
    main: ramp(t, 0.9, 1.6) * (1 - 0.65 * dip),
    emergency: 1 - ramp(t, 1.2, 2.2),
    static: 1 - ramp(t, 3.8, 5.4),
  };
}

/** A rainy pine mountainside at dusk, painted once (the view out of the lab's window: the scientist's own world). */
function paintForest(w: number, h: number): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d')!;
  const sky = g.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, '#3a4a5c'); sky.addColorStop(0.55, '#7e8e9a'); sky.addColorStop(1, '#5d6b70');
  g.fillStyle = sky; g.fillRect(0, 0, w, h);
  const rnd = (i: number, s: number) => hash(i, s, 77);
  // ridges far to near: each paler with mist, pines along its crest
  const layers = [
    { y: 0.34, amp: 0.12, col: [104, 118, 128], pine: 0.018, haze: 0.55 },
    { y: 0.46, amp: 0.1, col: [74, 88, 92], pine: 0.03, haze: 0.4 },
    { y: 0.6, amp: 0.08, col: [44, 56, 54], pine: 0.05, haze: 0.22 },
    { y: 0.78, amp: 0.05, col: [24, 32, 30], pine: 0.09, haze: 0.0 },
  ];
  layers.forEach((L, li) => {
    const crest = (x: number) => h * (L.y - L.amp * (0.6 * Math.sin(x / w * 5.3 + li * 1.7) + 0.4 * Math.sin(x / w * 13.1 + li * 3.1)));
    g.fillStyle = `rgb(${L.col.join(',')})`;
    g.beginPath(); g.moveTo(0, h);
    for (let x = 0; x <= w; x += 4) g.lineTo(x, crest(x));
    g.lineTo(w, h); g.closePath(); g.fill();
    // pines: narrow dark triangles standing on the crest and below it
    const n = Math.round(w * L.pine);
    for (let i = 0; i < n; i++) {
      const x = rnd(i, li * 3 + 1) * w, base = crest(x) + rnd(i, li * 3 + 2) * h * 0.18, tall = h * (0.04 + 0.08 * (li + 1) / 4) * (0.6 + rnd(i, li * 3 + 3) * 0.7);
      g.beginPath(); g.moveTo(x, base - tall); g.lineTo(x - tall * 0.18, base); g.lineTo(x + tall * 0.18, base); g.closePath(); g.fill();
    }
    // mist rolling over the ridge
    if (L.haze > 0) {
      const mist = g.createLinearGradient(0, crest(w / 2) - h * 0.1, 0, crest(w / 2) + h * 0.15);
      mist.addColorStop(0, 'rgba(150,165,175,0)'); mist.addColorStop(0.5, `rgba(150,165,175,${L.haze})`); mist.addColorStop(1, 'rgba(150,165,175,0)');
      g.fillStyle = mist; g.fillRect(0, 0, w, h);
    }
  });
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

const RAIN_VERTEX = /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const RAIN_FRAGMENT = /* glsl */ `
  uniform float uTime; varying vec2 vUv;
  float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
  void main(){
    vec2 g = vec2(vUv.x * 140.0, vUv.y * 6.0 + uTime * 2.6);
    vec2 cell = floor(g), f = fract(g);
    float r = h(cell);
    float streak = smoothstep(0.03, 0.0, abs(f.x - r)) * smoothstep(0.0, 0.5, f.y) * step(0.55, r);
    gl_FragColor = vec4(vec3(0.85, 0.9, 0.95), streak * 0.35);
  }`;

export interface LabRoom {
  /** How bright the room's reflections should be (the scene's environment light follows the ceiling lights). */
  envLevel(): number;
  readonly group: THREE.Group;
  /** Walls and props to walk round, in the lab frame. */
  readonly colliders: readonly Box[];
  readonly gate: ReturnType<typeof kit.gate>;
  /** The surface in the gate's opening (two-sided): the planet is drawn on it. */
  readonly portal: THREE.Mesh;
  /** Where the main lever is, in the lab frame (for looking at it to pull it). */
  readonly leverAt: THREE.Vector3;
  readonly lever: THREE.Object3D;
  readonly spawn: { readonly x: number; readonly z: number; readonly yaw: number };
  setPower(p: Power): void;
  update(now: number, dt: number): void;
  dispose(): void;
}

export function createLabRoom(o: { readonly textureSize: number; readonly portalMaterial: THREE.Material }): LabRoom {
  const group = new THREE.Group();
  const owned: { dispose(): void }[] = [];
  const keep = <T extends { dispose(): void }>(x: T): T => { owned.push(x); return x; };
  const m = kit.createMaterials();
  const colliders: Box[] = [];

  // ---- the shell
  const panels = panelTextures(o.textureSize), floorTex = floorTextures(o.textureSize);
  for (const t of [panels.map, panels.roughnessMap, panels.normalMap]) { keep(t); t.repeat.set(1 / PANEL_TILE, 1 / PANEL_TILE); }
  for (const t of [floorTex.map, floorTex.roughnessMap, floorTex.normalMap]) { keep(t); t.repeat.set(1 / FLOOR_TILE, 1 / FLOOR_TILE); }
  const wallMat = keep(new THREE.MeshStandardMaterial({ ...panels, normalScale: new THREE.Vector2(0.6, 0.6), metalness: 0 }));
  const floorMat = keep(new THREE.MeshStandardMaterial({ ...floorTex, normalScale: new THREE.Vector2(0.5, 0.5), metalness: 0 }));
  const ceilingMat = keep(new THREE.MeshStandardMaterial({ color: '#1b1e22', roughness: 0.85, metalness: 0.2 }));
  const rect = (x0: number, y0: number, x1: number, y1: number): THREE.Shape => new THREE.Shape([new THREE.Vector2(x0, y0), new THREE.Vector2(x1, y0), new THREE.Vector2(x1, y1), new THREE.Vector2(x0, y1)]);
  const add = (g: THREE.BufferGeometry, mat: THREE.Material, f: (mesh: THREE.Mesh) => void = () => undefined): THREE.Mesh => { const mesh = new THREE.Mesh(keep(g), mat); f(mesh); group.add(mesh); return mesh; };
  const back = rect(ROOM.left, 0, ROOM.right, ROOM.height);
  back.holes.push(new THREE.Path([new THREE.Vector2(WINDOW.x0, WINDOW.y0), new THREE.Vector2(WINDOW.x1, WINDOW.y0), new THREE.Vector2(WINDOW.x1, WINDOW.y1), new THREE.Vector2(WINDOW.x0, WINDOW.y1)]));
  add(new THREE.ShapeGeometry(back), wallMat, (w) => { w.position.z = ROOM.back; });
  const depth = ROOM.front - ROOM.back, width = ROOM.right - ROOM.left;
  add(new THREE.ShapeGeometry(rect(0, 0, depth, ROOM.height)), wallMat, (w) => { w.rotation.y = Math.PI / 2; w.position.set(ROOM.left, 0, ROOM.front); });
  add(new THREE.ShapeGeometry(rect(0, 0, depth, ROOM.height)), wallMat, (w) => { w.rotation.y = -Math.PI / 2; w.position.set(ROOM.right, 0, ROOM.back); });
  add(new THREE.ShapeGeometry(rect(0, 0, width, ROOM.height)), wallMat, (w) => { w.rotation.y = Math.PI; w.position.set(ROOM.right, 0, ROOM.front); });
  add(new THREE.ShapeGeometry(rect(ROOM.left, -ROOM.front, ROOM.right, -ROOM.back)), floorMat, (f) => { f.rotation.x = -Math.PI / 2; });
  add(new THREE.ShapeGeometry(rect(ROOM.left, ROOM.back, ROOM.right, ROOM.front)), ceilingMat, (c) => { c.rotation.x = Math.PI / 2; c.position.y = ROOM.height; });
  // the steel kick band round the foot of the walls
  const band = (x0: number, x1: number, z0: number, z1: number) => add(new THREE.BoxGeometry(Math.max(0.1, x1 - x0), 0.6, Math.max(0.1, z1 - z0)), m.darkSteel, (b) => { b.position.set((x0 + x1) / 2, 0.3, (z0 + z1) / 2); });
  band(ROOM.left, ROOM.left + 0.1, ROOM.back, ROOM.front); band(ROOM.right - 0.1, ROOM.right, ROOM.back, ROOM.front);
  band(ROOM.left, ROOM.right, ROOM.back, ROOM.back + 0.1); band(ROOM.left, ROOM.right, ROOM.front - 0.1, ROOM.front);
  colliders.push(
    { min: [ROOM.left - 1, 0, ROOM.back - 1], max: [ROOM.left + 0.3, 9, ROOM.front + 1] }, { min: [ROOM.right - 0.3, 0, ROOM.back - 1], max: [ROOM.right + 1, 9, ROOM.front + 1] },
    { min: [ROOM.left - 1, 0, ROOM.back - 1], max: [ROOM.right + 1, 9, ROOM.back + 0.3] }, { min: [ROOM.left - 1, 0, ROOM.front - 0.3], max: [ROOM.right + 1, 9, ROOM.front + 1] },
  );

  // ---- the window: a steel frame with two mullions, the glass, the rain on it, and the mountainside beyond
  const wx = (WINDOW.x0 + WINDOW.x1) / 2, wy = (WINDOW.y0 + WINDOW.y1) / 2, ww = WINDOW.x1 - WINDOW.x0, wh = WINDOW.y1 - WINDOW.y0;
  for (const [x, y, w, h] of [[wx, WINDOW.y0 - 0.06, ww + 0.24, 0.12], [wx, WINDOW.y1 + 0.06, ww + 0.24, 0.12], [WINDOW.x0 - 0.06, wy, 0.12, wh], [WINDOW.x1 + 0.06, wy, 0.12, wh], [wx - ww / 6, wy, 0.07, wh], [wx + ww / 6, wy, 0.07, wh]] as const) {
    add(new THREE.BoxGeometry(w, h, 0.3), m.gunmetal, (f) => { f.position.set(x, y, ROOM.back); });
  }
  const forest = keep(paintForest(2048, 896));
  add(new THREE.PlaneGeometry(46, 20), keep(new THREE.MeshBasicMaterial({ map: forest, toneMapped: false })), (p) => { p.position.set(wx, wy + 1.5, ROOM.back - 16); });
  const rainUniforms = { uTime: { value: 0 } };
  add(new THREE.PlaneGeometry(ww, wh), keep(new THREE.ShaderMaterial({ vertexShader: RAIN_VERTEX, fragmentShader: RAIN_FRAGMENT, uniforms: rainUniforms, transparent: true, depthWrite: false })), (p) => { p.position.set(wx, wy, ROOM.back - 0.05); });
  add(new THREE.PlaneGeometry(ww, wh), m.glass, (p) => { p.position.set(wx, wy, ROOM.back + 0.02); });

  // ---- props, placed in the lab frame
  const place = (p: Prop, x: number, z: number, yaw = 0): Prop => {
    p.group.position.set(x, 0, z);
    p.group.rotation.y = yaw;
    group.add(p.group);
    p.group.updateMatrixWorld(true);
    for (const b of p.colliders) {
      const box = new THREE.Box3(new THREE.Vector3(...b.min), new THREE.Vector3(...b.max)).applyMatrix4(p.group.matrixWorld);
      colliders.push({ min: [box.min.x, box.min.y, box.min.z], max: [box.max.x, box.max.y, box.max.z] });
    }
    return p;
  };
  const gate = kit.gate(m);
  place(gate, GATE_AT.x, GATE_AT.z);
  const portal = new THREE.Mesh(keep(new THREE.PlaneGeometry(gate.opening.width, gate.opening.height)), o.portalMaterial);
  portal.position.set(0, gate.opening.sill + gate.opening.height / 2, gate.opening.z);
  portal.visible = false;
  gate.group.add(portal);
  const relays = [0, 1, 2, 3].map((i) => place(kit.relayCabinet(m), 5.4 + i * 0.68, ROOM.back + 0.45));
  place(kit.breakerPanel(m), 8.35, ROOM.back + 0.4);
  place(kit.capacitorBank(m), ROOM.right - 0.75, -8.4, -Math.PI / 2);
  const boxes = [place(kit.controlBox(m), 4.75, ROOM.back + 0.55), place(kit.controlBox(m), 9.2, ROOM.back + 0.55)];
  const desk = kit.operatorConsole(m);
  place(desk, 1.35, -6.2);
  place(kit.planetTable(m), -3.6, -5.2);
  place(kit.presetRack(m), ROOM.left + 0.45, -5.5, Math.PI / 2);
  place(kit.presetBench(m), ROOM.right - 0.75, -3.4, -Math.PI / 2);
  place(kit.presetCombiner(m), ROOM.right - 0.9, -0.6, -Math.PI / 2);
  // cables: the relays to the gate's rear junction box, the capacitor bank to the breaker, the console to the gate, all in floor covers
  const covers = [
    kit.floorCover(m, [[5.4, ROOM.back + 0.75], [5.4, GATE_AT.z - 0.95], [GATE_AT.x + 1.2, GATE_AT.z - 0.95]]),
    kit.floorCover(m, [[ROOM.right - 1.8, -8.4], [ROOM.right - 1.8, ROOM.back + 0.75], [8.35, ROOM.back + 0.75]]),
    kit.floorCover(m, [[1.35, -6.45], [1.35, GATE_AT.z + 1.1], [GATE_AT.x - 1.4, GATE_AT.z + 1.1]], 0.25),
  ];
  for (const c of covers) group.add(c.group);
  const pulseUniforms = { uTime: { value: 0 }, uPower: { value: 0 } };
  const pulseMat = keep(new THREE.ShaderMaterial({
    uniforms: pulseUniforms, toneMapped: false,
    vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `uniform float uTime, uPower; varying vec2 vUv;
      void main(){
        float slots = step(0.35, fract(vUv.x * 5.0));
        float travel = pow(max(0.0, sin((vUv.x - uTime * 3.2) * 1.4)), 18.0);
        vec3 amber = vec3(1.0, 0.55, 0.12);
        gl_FragColor = vec4(amber * (0.06 + uPower * (0.35 + 2.2 * travel)) * slots, 1.0);
        #include <colorspace_fragment>
      }`,
  }));
  for (const c of covers) c.pulse.material = pulseMat;
  for (const [from, to] of [[[5.4, ROOM.back + 0.4], [-3.6, ROOM.back + 0.4]], [[8.4, ROOM.back + 0.4], [8.4, -1]]] as [[number, number], [number, number]][]) group.add(kit.cableTray(m, from, to, 6.4, ROOM.height).group);

  // ---- light: ceiling strips (and one lamp standing in for them), orange emergency lamps, the gate's glow, the grey daylight from the window
  const stripMat = keep(new THREE.MeshStandardMaterial({ color: '#202428', emissive: '#eef6ff', emissiveIntensity: 0, roughness: 0.4 }));
  for (const x of [-6, -1.5, 3, 7.5]) add(new THREE.BoxGeometry(0.3, 0.06, depth - 4), stripMat, (s) => { s.position.set(x, ROOM.height - 0.04, (ROOM.back + ROOM.front) / 2); });
  // one lamp stands in for all the strips: every light costs every pixel of the room, and the minimum spec has four to spend
  const mainLamp = new THREE.PointLight('#e6f2ff', 0, 0, 2); mainLamp.position.set(1.5, ROOM.height - 0.8, -4); group.add(mainLamp);
  const emergencyMat = keep(new THREE.MeshStandardMaterial({ color: '#331a08', emissive: '#ff7a1c', emissiveIntensity: 0, roughness: 0.4 }));
  // three emergency lamps on the walls, one light for the three of them (cast from the room's middle, high up)
  for (const [x, z, face] of [[-1.2, ROOM.back + 0.08, 0], [ROOM.right - 0.08, -5, -Math.PI / 2], [ROOM.left + 0.08, -1, Math.PI / 2]] as const) {
    add(new THREE.BoxGeometry(0.18, 0.12, 0.1), emergencyMat, (e) => { e.position.set(x, 4.6, z); e.rotation.y = face; });
  }
  const emergency = new THREE.PointLight('#ff8a3a', 0, 22, 1.6); emergency.position.set(-0.5, 4.8, -6.5); group.add(emergency);
  const gateGlow = new THREE.PointLight('#ff9a4a', 0, 9, 2); gateGlow.position.set(GATE_AT.x, 1.6, GATE_AT.z + 1.4); group.add(gateGlow);
  const windowLight = new THREE.PointLight('#9fb6cc', 3, 14, 2); windowLight.position.set(wx, wy, ROOM.back + 1.2); group.add(windowLight);
  const fill = new THREE.HemisphereLight('#d8e2ea', '#2a2e33', 0.08); group.add(fill);

  const lamps = { relays: relays.flatMap((r) => r.lamps), boxes: boxes.flatMap((b) => b.lamps), desk: desk.lamps };
  const setPower = (p: Power): void => {
    lamps.relays.forEach((l, i) => kit.setLamp(l, p.relays * lamps.relays.length > i ? 1 : 0));
    lamps.boxes.forEach((l) => kit.setLamp(l, p.relays > 0.5 ? 1 : 0));
    // the console is the one thing lit on emergency power
    lamps.desk.forEach((l) => kit.setLamp(l, 1));
    gate.coils.forEach((c, i) => kit.setLamp(c, p.coils * 3 > Math.floor(i / 2) ? Math.min(1, p.coils * 3 - Math.floor(i / 2)) : 0));
    pulseUniforms.uPower.value = p.pulse;
    stripMat.emissiveIntensity = p.main * 2.2;
    mainLamp.intensity = p.main * 14;
    fill.intensity = 0.08 + p.main * 0.25;
    emergencyMat.emissiveIntensity = p.emergency * 2.4;
    emergency.intensity = p.emergency * 26;
    gateGlow.intensity = p.coils * 10;
    portal.visible = p.coils > 0.6;
  };
  setPower(POWER_OFF);

  return {
    envLevel: () => 0.03 + stripMat.emissiveIntensity / 2.2 * 0.2,
    group, colliders, gate, portal,
    leverAt: desk.lever.getWorldPosition(new THREE.Vector3()),
    lever: desk.lever,
    spawn: { x: -1.2, z: 1.8, yaw: 0.22 },
    setPower,
    update(now) { rainUniforms.uTime.value = now; pulseUniforms.uTime.value = now; },
    dispose() {
      for (const x of owned) x.dispose();
      group.traverse((o) => { const mesh = o as THREE.Mesh; if (mesh.isMesh) { mesh.geometry.dispose(); } });
      for (const mat of Object.values(m)) (mat as THREE.Material).dispose();
    },
  };
}
