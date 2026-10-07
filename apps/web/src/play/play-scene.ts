// The first Play's 3D (SETMIX_PLAN Phase 2b): you walk the lab in first person; the gate is a two-sided doorway onto your
// plot; the planet is drawn at low resolution and post-processed by stage (black-and-white dither at stage 0, colour from
// stage 1, a wave between, sweeping out from your first machine); sync runs down while you are there.
//
// Two scenes, one walker. Crossing the gate's opening carries you (and the camera) from one gate's frame to the other's.
// Each frame the far side is drawn from a virtual camera into a texture, and the near side shows it in the opening.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import type { StageLook } from '../crafter/looks';
import { drop, planetHeight } from '../crafter/planet';
import { createWorld, PLANET_DIR, type Neighbour, type World } from '../crafter/world';
import * as kit from './kit';
import { createLabRoom, GATE_AT, POWER_OFF, POWER_ON, POWER_SECONDS, powerAt, ROOM, type LabRoom } from './lab-room';
import { COLOUR_MARK_FRAGMENT, MARK_VERTEX, OPENING_FRAGMENT, OPENING_MARK_FRAGMENT, OPENING_VERTEX, POST_FRAGMENT, QUAD_VERTEX } from './portal-shaders';
import { CABLE_REACH, MACHINE_FIELD, placeCheck, stepSync, type PlacedMachine } from './quest';

export type Where = 'lab' | 'planet';
/** What the screen gives the scene each frame. */
export interface Controls {
  /** Walk: x right, z forward, each -1..1. */
  readonly move: { readonly x: number; readonly z: number };
  /** Look: mouse movement since the last frame, in pixels. */
  readonly look: { readonly dx: number; readonly dy: number };
  readonly run: boolean;
}
/** What the scene tells the screen each frame. */
export interface FrameOut {
  readonly where: Where;
  readonly sync: number;
  /** You are looking at the main lever, close enough to pull it. */
  readonly atLever: boolean;
  /** The build ghost's verdict, when building. */
  readonly ghost: { readonly ok: boolean; readonly why: string } | null;
  /** Something happened this frame. */
  readonly event: 'to-planet' | 'to-lab' | 'sync-lost' | 'powered' | 'stage-1' | null;
}

const EYE = 1.68, RADIUS = 0.3, WALK = 3.0, RUN = 5.6;
/** The planet is drawn at a third of the screen's resolution (stage 1's pixels); stage 0 doubles them again in the post pass. */
const PLANET_SCALE = 1 / 3;
const WAVE_SECONDS = 14, WAVE_REACH = 170;

export interface PlayScene {
  /** Puts the planet in place (once, after its looks are baked). */
  setPlanet(base: StageLook, plot: StageLook, neighbours: readonly Neighbour[]): void;
  /** The saved state, applied at once: the gate on or off, the machines standing, the stage reached. */
  restore(o: { readonly gateOn: boolean; readonly machines: readonly PlacedMachine[]; readonly stage: number }): void;
  /** Throws the main lever: the power-on sequence runs, then a 'powered' event. */
  pullLever(): void;
  /** Shows or hides the build ghost (a texture mill), on the planet. */
  setBuilding(on: boolean): void;
  /** Places the ghost's machine if it may stand there: the cable runs, it starts, and the first one sends the wave. */
  place(): PlacedMachine | null;
  frame(now: number, dt: number, c: Controls): FrameOut;
  resize(width: number, height: number, pixelRatio: number): void;
  /** For the tests and the e2e: where you are, and a way to stand somewhere. */
  readonly debug: {
    where(): Where; position(): THREE.Vector3; teleport(where: Where, x: number, z: number, yaw: number): void; sync(): number;
    stats(): { readonly triangles: number; readonly calls: number }; wave(): number; gatePlanet(): { x: number; z: number };
    /** Places a mill at x, z as if the ghost stood there (the e2e has no mouse to aim with). */
    placeAt(x: number, z: number): PlacedMachine | null;
  };
  dispose(): void;
}

export function createPlayScene(o: { readonly canvas: HTMLCanvasElement; readonly gridSpacing: number; readonly antialias: boolean; readonly powerPreference: WebGLPowerPreference; readonly reducedMotion: boolean; readonly textureSize: number }): PlayScene {
  const renderer = new THREE.WebGLRenderer({ canvas: o.canvas, antialias: o.antialias, powerPreference: o.powerPreference });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor(0x000000, 1);
  const camera = new THREE.PerspectiveCamera(72, 1, 0.08, 9000);
  const virtual = new THREE.PerspectiveCamera(72, 1, 0.08, 9000);
  const owned: { dispose(): void }[] = [];
  const keep = <T extends { dispose(): void }>(x: T): T => { owned.push(x); return x; };

  // ---- render targets: the planet (low res, with depth), its post-processed picture (for the lab's view), the lab (for the planet's view)
  const target = (w: number, h: number, depth: boolean, nearest: boolean): THREE.WebGLRenderTarget => {
    const t = new THREE.WebGLRenderTarget(w, h, { depthBuffer: true, ...(depth ? { depthTexture: new THREE.DepthTexture(w, h) } : {}) });
    t.texture.minFilter = t.texture.magFilter = nearest ? THREE.NearestFilter : THREE.LinearFilter;
    t.texture.generateMipmaps = false;
    return keep(t);
  };
  let planetRT = target(16, 16, true, true), viewRT = target(16, 16, false, true), labRT = target(16, 16, false, false);
  const screen = new THREE.Vector2(1, 1);

  // ---- the lab
  const openingUniforms = { uView: { value: viewRT.texture as THREE.Texture }, uScreen: { value: screen }, uStatic: { value: 1 }, uTime: { value: 0 } };
  const openingMat = keep(new THREE.ShaderMaterial({ vertexShader: OPENING_VERTEX, fragmentShader: OPENING_FRAGMENT, uniforms: openingUniforms, side: THREE.DoubleSide }));
  const labScene = new THREE.Scene();
  const room: LabRoom = createLabRoom({ textureSize: o.textureSize, portalMaterial: openingMat });
  labScene.add(room.group);
  const pmrem = keep(new THREE.PMREMGenerator(renderer));
  const roomEnv = new RoomEnvironment();
  labScene.environment = keep(pmrem.fromScene(roomEnv, 0.04).texture);
  labScene.environmentIntensity = 0.22;
  roomEnv.dispose();
  room.group.updateMatrixWorld(true);
  const labGateM = room.gate.group.matrixWorld.clone();

  // ---- the planet
  const planetScene = new THREE.Scene();
  const m = kit.createMaterials();
  let world: World | null = null;
  const twin = kit.gate(m, { twin: true, stage: 1 });
  const openingMark = keep(new THREE.ShaderMaterial({ vertexShader: MARK_VERTEX, fragmentShader: OPENING_MARK_FRAGMENT, side: THREE.DoubleSide, blending: THREE.NoBlending }));
  const twinOpening = new THREE.Mesh(keep(new THREE.PlaneGeometry(twin.opening.width, twin.opening.height)), openingMark);
  twinOpening.position.set(0, twin.opening.sill + twin.opening.height / 2, twin.opening.z);
  twin.group.add(twinOpening);
  // the footing goes down into the ground, so the pad never floats on the slope of the peak
  const footing = new THREE.Mesh(keep(new THREE.BoxGeometry(3.6, 2.4, 2.6)), m.concrete);
  footing.position.y = -1.2;
  twin.group.add(footing);
  // you step out facing the goblin planet: the twin's back (-z) looks that way
  const view = new THREE.Vector2(PLANET_DIR.x, PLANET_DIR.z).normalize();
  twin.group.rotation.y = Math.atan2(-view.x, -view.y);
  const gateYawDelta = twin.group.rotation.y;
  planetScene.add(twin.group);
  let planetGateM = new THREE.Matrix4(), toPlanet = new THREE.Matrix4(), toLab = new THREE.Matrix4();
  let padTop = 0;
  const groundAt = (x: number, z: number): number => {
    // on the footing pad you stand on the pad
    const local = new THREE.Vector3(x, 0, z).applyMatrix4(new THREE.Matrix4().copy(twin.group.matrixWorld).invert());
    if (Math.abs(local.x) < 1.9 && Math.abs(local.z) < 1.25) return padTop;
    return planetHeight(x, z) - drop(x, z);
  };

  // machines: the mill, its cable from the gate's junction box, and the pink pixels from its stack
  const machines: { readonly m: PlacedMachine; readonly stack: THREE.Vector3; readonly power: THREE.Vector3; started: number }[] = [];
  const PIXELS = 160;
  const pixelMat = keep(new THREE.ShaderMaterial({ vertexShader: MARK_VERTEX, fragmentShader: COLOUR_MARK_FRAGMENT, blending: THREE.NoBlending, uniforms: { uColour: { value: new THREE.Color('#ff3d8a') }, uLit: { value: 0.35 } } }));
  const pixelGeo = keep(new THREE.BoxGeometry(0.14, 0.14, 0.14));
  const pixelSets: THREE.InstancedMesh[] = [];
  const cableMat = m.rubber;
  const millGroups: THREE.Group[] = [];
  const addMachine = (pm: PlacedMachine, now: number, animate: boolean): void => {
    const mill = kit.textureMill(m, { stage: 1 });
    const y = groundAt(pm.x, pm.z);
    mill.group.position.set(pm.x, y - 0.05, pm.z);
    mill.group.rotation.y = pm.yaw;
    planetScene.add(mill.group);
    millGroups.push(mill.group);
    mill.group.updateMatrixWorld(true);
    const at = (name: string) => new THREE.Vector3(...mill.sockets.find((s) => s.name === name)!.at).applyMatrix4(mill.group.matrixWorld);
    const stack = at('stack'), power = at('power');
    // the cable lies on the ground from the junction box to the mill's gland
    const from = new THREE.Vector3(...twin.sockets.find((s) => s.name === 'rear-junction')!.at).applyMatrix4(twin.group.matrixWorld);
    const pts: THREE.Vector3[] = [];
    const n = Math.max(6, Math.ceil(from.distanceTo(power) / 0.8));
    for (let i = 0; i <= n; i++) {
      const t = i / n, x = from.x + (power.x - from.x) * t, z = from.z + (power.z - from.z) * t;
      const lift = i === 0 ? from.y : i === n ? power.y : groundAt(x, z) + 0.05;
      pts.push(new THREE.Vector3(x, lift, z));
    }
    const cable = new THREE.Mesh(keep(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), n * 3, 0.045, 6, false)), cableMat);
    planetScene.add(cable);
    const set = new THREE.InstancedMesh(pixelGeo, pixelMat, PIXELS);
    set.frustumCulled = false;
    planetScene.add(set);
    pixelSets.push(set);
    machines.push({ m: pm, stack, power, started: animate ? now + 1.2 : -100 });
  };

  // the build ghost: the mill's shape, green where it may stand, red where it may not; always in colour
  const ghostOk = keep(new THREE.ShaderMaterial({ vertexShader: MARK_VERTEX, fragmentShader: COLOUR_MARK_FRAGMENT, blending: THREE.NoBlending, uniforms: { uColour: { value: new THREE.Color('#6dff8a') }, uLit: { value: 1 } } }));
  const ghostBad = keep(new THREE.ShaderMaterial({ vertexShader: MARK_VERTEX, fragmentShader: COLOUR_MARK_FRAGMENT, blending: THREE.NoBlending, uniforms: { uColour: { value: new THREE.Color('#ff5a4a') }, uLit: { value: 1 } } }));
  const ghost = kit.textureMill(m, { stage: 1 }).group;
  ghost.visible = false;
  planetScene.add(ghost);
  let building = false, ghostVerdict: { ok: boolean; why: string } = { ok: false, why: '' };
  const ghostAt = new THREE.Vector3();

  // ---- the post pass (planet picture by stage)
  const postUniforms = {
    uColour: { value: planetRT.texture as THREE.Texture }, uDepth: { value: planetRT.depthTexture as THREE.Texture | null }, uLab: { value: labRT.texture as THREE.Texture },
    uRes: { value: new THREE.Vector2(16, 16) }, uInvProj: { value: new THREE.Matrix4() }, uCamWorld: { value: new THREE.Matrix4() },
    uWaveCentre: { value: new THREE.Vector3() }, uWaveR: { value: -1 }, uGlitch: { value: 0 }, uTime: { value: 0 }, uLost: { value: 0 },
  };
  const postScene = new THREE.Scene();
  const postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  postScene.add(new THREE.Mesh(keep(new THREE.PlaneGeometry(2, 2)), keep(new THREE.ShaderMaterial({ vertexShader: QUAD_VERTEX, fragmentShader: POST_FRAGMENT, uniforms: postUniforms, depthTest: false, depthWrite: false }))));

  // ---- you
  let where: Where = 'lab';
  const pos = new THREE.Vector3(room.spawn.x, EYE, room.spawn.z);
  let yaw = room.spawn.yaw, pitch = -0.04;
  let sync = 1, lostAt = -100;
  let powerT = -1, gateOn = false, stage = 0, waveStart = -1;
  let pendingEvent: FrameOut['event'] = null;
  let clock = 0;

  const syncPlanetMatrices = (): void => {
    twin.group.updateMatrixWorld(true);
    planetGateM = twin.group.matrixWorld.clone();
    toPlanet = planetGateM.clone().multiply(labGateM.clone().invert());
    toLab = toPlanet.clone().invert();
  };

  /** Push a circle of RADIUS out of the lab's boxes. */
  const collide = (p: THREE.Vector3): void => {
    for (let pass = 0; pass < 2; pass++) for (const b of room.colliders) {
      if (b.max[1] < 0.15 || b.min[1] > 1.8) continue;
      const cx = Math.max(b.min[0], Math.min(p.x, b.max[0])), cz = Math.max(b.min[2], Math.min(p.z, b.max[2]));
      const dx = p.x - cx, dz = p.z - cz, d = Math.hypot(dx, dz);
      if (d >= RADIUS) continue;
      if (d > 1e-6) { p.x = cx + (dx / d) * RADIUS; p.z = cz + (dz / d) * RADIUS; continue; }
      // inside the box: out by the nearest face
      const out = [p.x - b.min[0], b.max[0] - p.x, p.z - b.min[2], b.max[2] - p.z];
      const k = out.indexOf(Math.min(...out));
      if (k === 0) p.x = b.min[0] - RADIUS; else if (k === 1) p.x = b.max[0] + RADIUS; else if (k === 2) p.z = b.min[2] - RADIUS; else p.z = b.max[2] + RADIUS;
    }
  };

  /** Where a point is in a gate's own frame. */
  const local = (gateM: THREE.Matrix4, p: THREE.Vector3): THREE.Vector3 => p.clone().applyMatrix4(gateM.clone().invert());

  const crossTo = (next: Where): void => {
    const M = next === 'planet' ? toPlanet : toLab;
    pos.applyMatrix4(M);
    yaw += next === 'planet' ? gateYawDelta : -gateYawDelta;
    where = next;
    pendingEvent = next === 'planet' ? 'to-planet' : 'to-lab';
  };

  const aimGround = (): THREE.Vector3 | null => {
    const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
    const p = camera.position.clone();
    for (let d = 1; d < 36; d += 0.25) {
      const q = p.clone().addScaledVector(dir, d);
      if (q.y <= groundAt(q.x, q.z)) return q;
    }
    return null;
  };

  const visible = (mesh: THREE.Object3D, cam: THREE.Camera): boolean => {
    const f = new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse));
    return f.intersectsBox(new THREE.Box3().setFromObject(mesh));
  };

  const drawPlanet = (cam: THREE.PerspectiveCamera, to: THREE.WebGLRenderTarget | null, hideTwin: boolean): void => {
    twin.group.visible = !hideTwin;
    renderer.setRenderTarget(planetRT);
    renderer.clear();
    renderer.render(planetScene, cam);
    twin.group.visible = true;
    postUniforms.uInvProj.value.copy(cam.projectionMatrixInverse);
    postUniforms.uCamWorld.value.copy(cam.matrixWorld);
    renderer.setRenderTarget(to);
    renderer.render(postScene, postCam);
  };

  const waveRadius = (): number => {
    if (stage < 1) return -1;
    if (waveStart < 0) return 1e7;
    const t = (clock - waveStart) / WAVE_SECONDS;
    if (t >= 1) return 1e7;
    return WAVE_REACH * (1 - Math.pow(1 - Math.max(0, t), 2.2));
  };

  const api: PlayScene = {
    setPlanet(base, plot, neighbours) {
      if (world) return;
      world = createWorld(planetScene, { gridSpacing: o.gridSpacing, reducedMotion: o.reducedMotion });
      world.setPlanet(base, neighbours, { clear: { x: 0, z: 0, r: 7 }, treeDetailRange: 150 });
      world.show(plot);
      padTop = world.peakY + 0.25;
      twin.group.position.set(0, world.peakY, 0);
      syncPlanetMatrices();
    },
    restore(s) {
      gateOn = s.gateOn;
      room.setPower(gateOn ? POWER_ON : POWER_OFF);
      if (gateOn) room.lever.rotation.x = -1.1;
      openingUniforms.uStatic.value = gateOn ? 0 : 1;
      stage = s.stage;
      for (const pm of s.machines) addMachine(pm, clock, false);
    },
    pullLever() {
      if (gateOn || powerT >= 0) return;
      powerT = 0;
    },
    setBuilding(on) { building = on && where === 'planet'; ghost.visible = building; },
    place() {
      if (!building || !ghostVerdict.ok) return null;
      const g = twin.group.position;
      const pm: PlacedMachine = { kind: 'texture-mill', x: ghostAt.x, z: ghostAt.z, yaw: Math.atan2(ghostAt.x - g.x, ghostAt.z - g.z) };
      addMachine(pm, clock, true);
      building = false; ghost.visible = false;
      if (stage < 1) { stage = 1; waveStart = clock + 2.0; postUniforms.uWaveCentre.value.set(pm.x, groundAt(pm.x, pm.z), pm.z); }
      return pm;
    },
    frame(now, dt, c) {
      clock = now;
      // ---- the power-on sequence
      if (powerT >= 0) {
        powerT += dt;
        room.lever.rotation.x = -1.1 * Math.min(1, powerT / 0.35);
        const p = powerAt(powerT);
        room.setPower(p);
        openingUniforms.uStatic.value = p.static;
        if (powerT >= POWER_SECONDS) { powerT = -1; gateOn = true; pendingEvent = 'powered'; }
      }
      // ---- look and walk
      const sens = 0.0024;
      yaw -= c.look.dx * sens;
      pitch = Math.max(-1.45, Math.min(1.45, pitch - c.look.dy * sens));
      const speed = (c.run ? RUN : WALK) * dt;
      const fx = -Math.sin(yaw), fz = -Math.cos(yaw), rx = Math.cos(yaw), rz = -Math.sin(yaw);
      const before = pos.clone();
      pos.x += (fx * c.move.z + rx * c.move.x) * speed;
      pos.z += (fz * c.move.z + rz * c.move.x) * speed;
      if (where === 'lab') {
        collide(pos);
        pos.y = EYE;
      } else {
        // keep to your plot's surroundings; stand on the ground
        const r = Math.hypot(pos.x, pos.z);
        if (r > 420) { pos.x *= 420 / r; pos.z *= 420 / r; }
        const target = groundAt(pos.x, pos.z) + EYE;
        pos.y += (target - pos.y) * Math.min(1, dt * 14);
      }
      // ---- through the gate (only when it is on and the picture is clear)
      if (gateOn && world) {
        const gateM = where === 'lab' ? labGateM : planetGateM;
        const a = local(gateM, before), b = local(gateM, pos);
        const op = where === 'lab' ? room.gate.opening : twin.opening;
        if (Math.sign(a.z - op.z) !== Math.sign(b.z - op.z) && Math.abs(b.x) < op.width / 2 - 0.15) crossTo(where === 'lab' ? 'planet' : 'lab');
      }
      // ---- sync
      const nearMachine = stage >= 1 && waveRadius() > 1e6 && machines.some((mm) => Math.hypot(mm.m.x - pos.x, mm.m.z - pos.z) < MACHINE_FIELD);
      sync = stepSync(sync, dt, { onPlanet: where === 'planet', stage, nearMachine });
      if (where === 'planet' && sync <= 0) {
        // pulled back to the lab, in front of the gate, facing it
        lostAt = now;
        where = 'lab';
        pos.set(GATE_AT.x, EYE, GATE_AT.z + 3.2);
        yaw = 0; pitch = 0;
        sync = 0.05;
        building = false; ghost.visible = false;
        pendingEvent = 'sync-lost';
      }
      // ---- the camera
      camera.position.copy(pos);
      camera.rotation.set(pitch, yaw, 0, 'YXZ');
      camera.updateMatrixWorld(true);
      // ---- the build ghost
      if (building) {
        const hit = aimGround();
        ghost.visible = !!hit;
        if (hit) {
          ghostAt.copy(hit);
          ghost.position.set(hit.x, groundAt(hit.x, hit.z), hit.z);
          ghost.rotation.y = Math.atan2(hit.x - twin.group.position.x, hit.z - twin.group.position.z);
          ghostVerdict = placeCheck(hit.x, hit.z, twin.group.position, machines.map((mm) => mm.m));
          ghost.traverse((obj) => { const mesh = obj as THREE.Mesh; if (mesh.isMesh) mesh.material = ghostVerdict.ok ? ghostOk : ghostBad; });
        } else ghostVerdict = { ok: false, why: `Aim at the ground within ${CABLE_REACH} m of the gate.` };
      }
      // ---- machines: pixels pour from the stack while they run, rising and spreading on the wind
      const mtx = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), e = new THREE.Euler();
      machines.forEach((mm, k) => {
        const set = pixelSets[k]!;
        const on = Math.max(0, Math.min(1, (now - mm.started) / 1.5));
        for (let i = 0; i < PIXELS; i++) {
          const ph = (i * 0.618034) % 1, life = (now * 0.32 + ph) % 1;
          // a pour that widens as it rises and leans downwind, each pixel on its own small spiral
          const spread = 0.15 + life * (0.9 + 2.6 * ((i * 0.37) % 1));
          const a = i * 2.39996 + now * 0.25;
          p.set(mm.stack.x + Math.cos(a) * spread + life * life * 3.2, mm.stack.y + life * 6.5, mm.stack.z + Math.sin(a) * spread + life * life * 1.2);
          const size = on * (1 - life) * (0.7 + ((i * 0.53) % 1) * 0.6);
          s.set(size, size, size);
          q.setFromEuler(e.set(life * 4 + i, life * 3, 0));
          set.setMatrixAt(i, mtx.compose(p, q, s));
        }
        set.instanceMatrix.needsUpdate = true;
      });
      // ---- the wave, and the event when it has crossed
      const r = waveRadius();
      if (waveStart >= 0 && r > 1e6) { waveStart = -1; pendingEvent = pendingEvent ?? 'stage-1'; }
      postUniforms.uWaveR.value = r;
      postUniforms.uTime.value = now;
      postUniforms.uGlitch.value = where === 'planet' ? Math.max(0, Math.min(1, (0.4 - sync) / 0.4)) : 0;
      postUniforms.uLost.value = Math.max(0, 1 - (now - lostAt) / 0.6);
      openingUniforms.uTime.value = now;
      room.update(now, dt);
      labScene.environmentIntensity = room.envLevel();
      world?.update(now, dt, where === 'planet' ? camera.position : virtual.position);

      // ---- draw
      renderer.info.autoReset = false;
      renderer.info.reset();
      if (where === 'lab') {
        if (world && room.portal.visible && visible(room.portal, camera)) {
          virtual.matrixWorld.copy(camera.matrixWorld).premultiply(toPlanet);
          virtual.matrixWorld.decompose(virtual.position, virtual.quaternion, virtual.scale);
          virtual.updateMatrixWorld(true);
          drawPlanet(virtual, viewRT, true);
        }
        renderer.setRenderTarget(null);
        renderer.clear();
        renderer.render(labScene, camera);
      } else {
        if (gateOn && visible(twinOpening, camera)) {
          virtual.matrixWorld.copy(camera.matrixWorld).premultiply(toLab);
          virtual.matrixWorld.decompose(virtual.position, virtual.quaternion, virtual.scale);
          virtual.updateMatrixWorld(true);
          room.gate.group.visible = false;
          renderer.setRenderTarget(labRT);
          renderer.clear();
          renderer.render(labScene, virtual);
          room.gate.group.visible = true;
        }
        drawPlanet(camera, null, false);
      }
      // ---- what you are looking at
      let atLever = false;
      if (where === 'lab' && !gateOn && powerT < 0) {
        const to = room.leverAt.clone().sub(camera.position);
        const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
        atLever = to.length() < 2.4 && to.normalize().dot(dir) > 0.86;
      }
      const ev = pendingEvent;
      pendingEvent = null;
      return { where, sync, atLever, ghost: building ? ghostVerdict : null, event: ev };
    },
    resize(width, height, pixelRatio) {
      renderer.setPixelRatio(pixelRatio);
      renderer.setSize(width, height, false);
      const buf = renderer.getDrawingBufferSize(new THREE.Vector2());
      screen.copy(buf);
      camera.aspect = virtual.aspect = width / Math.max(1, height);
      camera.updateProjectionMatrix(); virtual.updateProjectionMatrix();
      const pw = Math.max(64, Math.round(buf.x * PLANET_SCALE)), ph = Math.max(36, Math.round(buf.y * PLANET_SCALE));
      for (const t of [planetRT, viewRT, labRT]) t.dispose();
      planetRT = target(pw, ph, true, true);
      viewRT = target(pw, ph, false, true);
      labRT = target(Math.round(buf.x / 2), Math.round(buf.y / 2), false, false);
      postUniforms.uColour.value = planetRT.texture; postUniforms.uDepth.value = planetRT.depthTexture; postUniforms.uLab.value = labRT.texture;
      postUniforms.uRes.value.set(pw, ph);
      openingUniforms.uView.value = viewRT.texture;
    },
    debug: {
      where: () => where,
      position: () => pos.clone(),
      teleport(w, x, z, y) { where = w; pos.set(x, w === 'lab' ? EYE : groundAt(x, z) + EYE, z); yaw = y; },
      sync: () => sync,
      stats: () => ({ triangles: renderer.info.render.triangles, calls: renderer.info.render.calls }),
      wave: () => waveRadius(),
      gatePlanet: () => ({ x: twin.group.position.x, z: twin.group.position.z }),
      placeAt(x, z) {
        if (where !== 'planet') return null;
        building = true;
        ghostAt.set(x, groundAt(x, z), z);
        ghostVerdict = placeCheck(x, z, twin.group.position, machines.map((mm) => mm.m));
        const pm = api.place();
        building = false; ghost.visible = false;
        return pm;
      },
    },
    dispose() {
      world?.dispose();
      room.dispose();
      for (const x of owned) x.dispose();
      for (const mat of Object.values(m)) (mat as THREE.Material).dispose();
      renderer.dispose();
    },
  };
  return api;
}

/** Lab bounds, for the screen's hints. */
export const LAB_BOUNDS = ROOM;
