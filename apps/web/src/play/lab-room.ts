// The lab you play in (SETMIX_PLAN Phase 2b), laid out as the concept art (docs/concept/setmix on the art branch):
// a white test-chamber room, the window on the left of the back wall onto a rainy pine mountainside, the gate standing
// free in the middle-right, relay cabinets, the breaker panel and the capacitor bank at the back right, the console with
// the main lever in front of the gate, the planet table centre-left, the preset rack on the left wall, the bench and the
// combiner on the right. Cables run in floor covers and ceiling trays. Lab frame: x right, y up, z towards the start.
import * as THREE from 'three';
import { floorTextures, panelTextures } from '../lab/lab-scene';
import * as kit from '@hm/labkit';
import type { Box, Prop } from '@hm/labkit';

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

const WASTELAND_VERTEX = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const WASTELAND_FRAGMENT = /* glsl */ `
  uniform float uTime;
  varying vec2 vUv;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i + vec2(0.0, 0.0)), hash(i + vec2(1.0, 0.0)), u.x),
               mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
  }
  float fbm(vec2 p) {
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 4; i++) {
      v += a * noise(p);
      p = p * 2.04 + vec2(1.7, 2.3);
      a *= 0.5;
    }
    return v;
  }

  // 4x4 Bayer dither matrix
  float bayer4(vec2 p) {
    vec2 q = mod(floor(p), 4.0);
    float i = q.x + q.y * 4.0;
    float m = 0.0;
    if (i < 0.5) m = 0.0; else if (i < 1.5) m = 8.0; else if (i < 2.5) m = 2.0; else if (i < 3.5) m = 10.0;
    else if (i < 4.5) m = 12.0; else if (i < 5.5) m = 4.0; else if (i < 6.5) m = 14.0; else if (i < 7.5) m = 6.0;
    else if (i < 8.5) m = 3.0; else if (i < 9.5) m = 11.0; else if (i < 10.5) m = 1.0; else if (i < 11.5) m = 9.0;
    else if (i < 12.5) m = 15.0; else if (i < 13.5) m = 7.0; else if (i < 14.5) m = 13.0; else m = 5.0;
    return (m + 0.5) / 16.0;
  }

  // Desolate barren Stage 0/1 planet: rock, dust, scree, craters, no vegetation
  float evalWasteland(vec2 p) {
    p = clamp(p, 0.0, 1.0);
    // Hazy desolate sky with pale low sun
    float sky = mix(0.18, 0.50, 1.0 - p.y);
    float paleSun = smoothstep(0.16, 0.0, length(p - vec2(0.68, 0.74))) * 0.35;
    float luma = sky + paleSun;

    // Distant jagged barren mountain range
    float crest1 = 0.54 + 0.11 * sin(p.x * 7.2) + 0.05 * cos(p.x * 16.8) + 0.03 * fbm(vec2(p.x * 14.0, 3.0));
    if (p.y < crest1) {
      float slope1 = 0.38 + 0.16 * fbm(vec2(p.x * 22.0, p.y * 28.0));
      luma = slope1;
    }

    // Mid scree slope and crater rim
    float crest2 = 0.40 + 0.07 * sin(p.x * 10.5 + 2.1) + 0.04 * cos(p.x * 23.0) + 0.025 * fbm(vec2(p.x * 20.0, 7.5));
    if (p.y < crest2) {
      float scree = 0.24 + 0.18 * fbm(vec2(p.x * 38.0, p.y * 48.0));
      luma = scree;
    }

    // Near barren cracked ground and scree talus with boulders
    float crest3 = 0.22 + 0.04 * sin(p.x * 14.0 + 3.8) + 0.02 * fbm(vec2(p.x * 32.0, 12.0));
    if (p.y < crest3) {
      float boulder = step(0.88, hash(floor(vec2(p.x * 80.0, p.y * 90.0)))) * 0.18;
      float rock = 0.12 + 0.16 * fbm(vec2(p.x * 55.0, p.y * 65.0)) - boulder;
      luma = max(0.04, rock);
    }

    return clamp(luma, 0.0, 1.0);
  }

  void main() {
    vec2 uv = vUv;

    // Scanlines that jitter sideways now and then (glitch band jumps)
    float tGlitch = floor(uTime * 9.0);
    float band = floor(uv.y * 38.0 + tGlitch * 6.0);
    float glitchChance = step(0.86, fract(sin(band * 45.12 + tGlitch * 13.57) * 43758.5453));
    float jitter = (fract(sin(band * 78.9) * 23456.7) - 0.5) * 0.10 * glitchChance;
    float microJitter = (fract(sin(floor(uv.y * 220.0) + uTime * 50.0) * 43758.5453) - 0.5) * 0.004;
    vec2 uvJitter = uv + vec2(jitter + microJitter, 0.0);

    // Chromatic aberration that flares and settles (like sync loss in Stage 0)
    float flarePulse = pow(max(0.0, sin(uTime * 1.1)), 10.0) * 0.035;
    float flareSpike = step(0.93, fract(sin(floor(uTime * 3.8) * 67.89) * 43758.5453)) * 0.045;
    float ca = 0.005 + flarePulse + flareSpike;

    float lumaR = evalWasteland(uvJitter + vec2(ca, 0.0));
    float lumaG = evalWasteland(uvJitter);
    float lumaB = evalWasteland(uvJitter - vec2(ca, 0.0));

    // Black-and-white CRT ordered dither (Bayer 4x4)
    vec2 ditherPos = gl_FragCoord.xy * 0.5;
    float threshold = bayer4(ditherPos);

    float bitR = step(threshold, lumaR);
    float bitG = step(threshold, lumaG);
    float bitB = step(threshold, lumaB);

    // CRT scanlines
    float scanline = 0.86 + 0.14 * sin(gl_FragCoord.y * 1.57);
    vec3 rgb = vec3(bitR, bitG, bitB) * scanline;

    // CRT phosphor darks and brights
    vec3 dark = vec3(0.015, 0.018, 0.022);
    vec3 bright = vec3(0.82, 0.86, 0.88);
    vec3 col = mix(dark, bright, rgb);

    // Static noise burst during flares
    float staticNoise = hash(floor(gl_FragCoord.xy * 0.5) + floor(uTime * 30.0));
    col = mix(col, vec3(staticNoise), clamp((flarePulse + flareSpike) * 4.0, 0.0, 0.45));

    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
  }
`;

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
  const wastelandUniforms = { uTime: { value: 0 } };
  const wastelandMat = keep(new THREE.ShaderMaterial({ vertexShader: WASTELAND_VERTEX, fragmentShader: WASTELAND_FRAGMENT, uniforms: wastelandUniforms, toneMapped: false }));
  add(new THREE.PlaneGeometry(46, 20), wastelandMat, (p) => { p.position.set(wx, wy + 1.5, ROOM.back - 14); });
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
  const pTable = place(kit.planetTable(m), -3.6, -5.2);
  const tableDisc = pTable.lamps[0];
  if (tableDisc) {
    tableDisc.material = keep(new THREE.MeshStandardMaterial({
      color: '#332200',
      emissive: new THREE.Color('#ff8811'),
      emissiveIntensity: 0,
      roughness: 0.15,
      metalness: 0.1,
    }));
  }
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
    if (tableDisc && tableDisc.material instanceof THREE.MeshStandardMaterial) {
      tableDisc.material.emissiveIntensity = p.main * 1.4;
    }
    pTable.lamps.slice(1).forEach((l) => kit.setLamp(l, p.main > 0.5 ? 1 : 0));
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
    update(now) { rainUniforms.uTime.value = now; pulseUniforms.uTime.value = now; wastelandUniforms.uTime.value = now; },
    dispose() {
      for (const x of owned) x.dispose();
      group.traverse((o) => { const mesh = o as THREE.Mesh; if (mesh.isMesh) { mesh.geometry.dispose(); } });
      for (const mat of Object.values(m)) (mat as THREE.Material).dispose();
    },
  };
}
