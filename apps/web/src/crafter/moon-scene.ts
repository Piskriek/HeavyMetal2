// The Resolution Crafter's 3D view: the moon patch, its sky, water, the Pixel Chimney and its plume, with a small orbit camera.
// The scene draws two looks (the one it has and the one a wave brings) and the screen tells it where the wave front is.
import * as THREE from 'three';
import type { StageLook } from './looks';
import { MAIN_CRATER, SPAN, gridHeights, gridNormals, makeGrid, moonHeight, type MoonGrid } from './moon';
import { WAVE_BAND, WAVE_REACH } from './progress';
import { GROUND_FRAGMENT, GROUND_VERTEX, SKY_FRAGMENT, SKY_VERTEX, WATER_FRAGMENT, WATER_VERTEX } from './moon-shaders';

/** What the screen needs from the scene. */
export interface MoonScene {
  /** Shows a look at once, everywhere (the first look, or after a wave settles). */
  show(look: StageLook): void;
  /** The look the next wave carries out from the chimney. */
  setTarget(look: StageLook): void;
  /** Where the front is (metres from the chimney); call every frame while a wave runs. */
  setFront(radius: number): void;
  /** The wave has crossed the whole moon: its look becomes the moon's look. */
  settle(): void;
  /** Runs or stops the chimney (its plume), in the cartridge's colours. */
  setChimney(running: boolean, palette: readonly string[]): void;
  /** Draws one frame. */
  frame(now: number, dt: number): void;
  /** `covered` is how many pixels the console covers at the bottom: the view centres on what is left above it. */
  resize(width: number, height: number, pixelRatio: number, covered?: number): void;
  dispose(): void;
}

export interface MoonSceneOptions {
  readonly canvas: HTMLCanvasElement;
  /** Metres between grid points: 1 on Potato and Low, 0.5 above. */
  readonly gridSpacing: number;
  readonly antialias: boolean;
  readonly powerPreference: WebGLPowerPreference;
  readonly reducedMotion: boolean;
}

const SUN = new THREE.Vector3(0.82, 0.52, 0.12).normalize();
const SKY_ZENITH = new THREE.Color('#25568f'), SKY_HORIZON = new THREE.Color('#8db9de');

function texture(bytes: Uint8Array, size: number, colour: boolean, pixelated: boolean): THREE.DataTexture {
  const t = new THREE.DataTexture(bytes, size, size, THREE.RGBAFormat);
  t.colorSpace = colour ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.magFilter = pixelated ? THREE.NearestFilter : THREE.LinearFilter;
  // mipmaps keep far ground from shimmering, even when near ground is crisp pixels
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true;
  t.needsUpdate = true;
  return t;
}

/** One look on the GPU: its two textures and the numbers the shader reads. */
interface GpuLook { readonly look: StageLook; readonly colour: THREE.DataTexture; readonly maps: THREE.DataTexture; readonly heights: Float32Array; readonly normals: Float32Array }

/** A fixed scatter for the stars (0..1), so every visit has the same sky. */
function starHash(i: number, salt: number): number {
  let h = (Math.imul(i, 374761393) + Math.imul(salt, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

function skyColour(atmosphere: number): THREE.Color {
  return new THREE.Color(0, 0, 0).lerp(SKY_HORIZON, atmosphere);
}

/** Builds the scene on a canvas. Throws if WebGL is not available (the screen says so in plain words). */
export function createMoonScene(o: MoonSceneOptions): MoonScene {
  const renderer = new THREE.WebGLRenderer({ canvas: o.canvas, antialias: o.antialias, powerPreference: o.powerPreference });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor(0x000000, 1);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(48, 1, 0.5, 900);

  // ---- the ground: one grid, two looks
  const grid: MoonGrid = makeGrid(o.gridSpacing);
  const count = grid.xz.length / 2;
  const position = new Float32Array(count * 3), to = new Float32Array(count), normal = new Float32Array(count * 3), normalTo = new Float32Array(count * 3);
  for (let k = 0; k < count; k++) { position[k * 3] = grid.xz[k * 2]!; position[k * 3 + 2] = grid.xz[k * 2 + 1]!; }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(position, 3));
  geometry.setAttribute('aTo', new THREE.BufferAttribute(to, 1));
  geometry.setAttribute('normal', new THREE.BufferAttribute(normal, 3));
  geometry.setAttribute('aNormalTo', new THREE.BufferAttribute(normalTo, 3));
  geometry.setIndex(new THREE.BufferAttribute(grid.index, 1));
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), SPAN);

  const blank = new THREE.DataTexture(new Uint8Array([128, 128, 128, 255]), 1, 1, THREE.RGBAFormat);
  blank.needsUpdate = true;
  const groundUniforms = {
    uRadius: { value: 0 }, uBand: { value: WAVE_BAND }, uGlow: { value: 0 },
    uFromColour: { value: blank as THREE.Texture }, uFromMaps: { value: blank as THREE.Texture },
    uToColour: { value: blank as THREE.Texture }, uToMaps: { value: blank as THREE.Texture },
    uFromLook: { value: new THREE.Vector4() }, uToLook: { value: new THREE.Vector4() },
    uFromSky: { value: new THREE.Color() }, uToSky: { value: new THREE.Color() },
    uFromTile: { value: 16 }, uToTile: { value: 16 }, uSunDir: { value: SUN },
    uFogColour: { value: new THREE.Color(0, 0, 0) }, uFogDensity: { value: 0.0075 },
  };
  const ground = new THREE.Mesh(geometry, new THREE.ShaderMaterial({ vertexShader: GROUND_VERTEX, fragmentShader: GROUND_FRAGMENT, uniforms: groundUniforms }));
  scene.add(ground);

  // ---- water: rises behind the wave
  const waterGeometry = new THREE.PlaneGeometry(SPAN, SPAN, 48, 48);
  waterGeometry.rotateX(-Math.PI / 2);
  const waterUniforms = {
    uRadius: groundUniforms.uRadius, uBand: groundUniforms.uBand, uTime: { value: 0 },
    uFromLevel: { value: -99 }, uToLevel: { value: -99 }, uSunDir: { value: SUN },
    uSkyColour: { value: new THREE.Color() }, uFogColour: groundUniforms.uFogColour, uFogDensity: groundUniforms.uFogDensity, uLight: { value: 0 },
  };
  const water = new THREE.Mesh(waterGeometry, new THREE.ShaderMaterial({ vertexShader: WATER_VERTEX, fragmentShader: WATER_FRAGMENT, uniforms: waterUniforms, transparent: true }));
  water.renderOrder = 2;
  scene.add(water);

  // ---- sky and stars
  const skyUniforms = { uHorizon: { value: SKY_HORIZON.clone() }, uZenith: { value: SKY_ZENITH.clone() }, uAtmosphere: { value: 0 }, uSunDir: { value: SUN } };
  const sky = new THREE.Mesh(new THREE.SphereGeometry(600, 32, 16), new THREE.ShaderMaterial({ vertexShader: SKY_VERTEX, fragmentShader: SKY_FRAGMENT, uniforms: skyUniforms, side: THREE.BackSide, depthWrite: false }));
  sky.renderOrder = -2;
  scene.add(sky);
  const starCount = 2400, stars = new Float32Array(starCount * 3), starColours = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount; i++) {
    // hashed, so they scatter (a spiral lines up into rows near the horizon); packed low, where a camera looking into the crater sees the sky
    const y = -0.08 + 1.08 * Math.pow(starHash(i, 1), 1.7), r = Math.sqrt(1 - y * y), a = starHash(i, 2) * Math.PI * 2;
    stars[i * 3] = Math.cos(a) * r * 500; stars[i * 3 + 1] = y * 500; stars[i * 3 + 2] = Math.sin(a) * r * 500;
    const glow = 0.35 + 0.65 * Math.pow(starHash(i, 3), 3);
    starColours[i * 3] = glow; starColours[i * 3 + 1] = glow; starColours[i * 3 + 2] = glow * 0.96;
  }
  const starGeometry = new THREE.BufferGeometry();
  starGeometry.setAttribute('position', new THREE.BufferAttribute(stars, 3));
  starGeometry.setAttribute('color', new THREE.BufferAttribute(starColours, 3));
  const starMaterial = new THREE.PointsMaterial({ vertexColors: true, size: 2, sizeAttenuation: false, transparent: true, depthWrite: false });
  const starField = new THREE.Points(starGeometry, starMaterial);
  starField.renderOrder = -1;
  scene.add(starField);

  // ---- the Pixel Chimney, on the main crater's floor (lab white: it came through the portal)
  const floorY = moonHeight(0, 0);
  const machine = new THREE.Group();
  const white = new THREE.MeshLambertMaterial({ color: '#e7e4da', flatShading: true });
  const dark = new THREE.MeshLambertMaterial({ color: '#2b2e33', flatShading: true });
  const slotMaterial = new THREE.MeshBasicMaterial({ color: '#c56443' });
  const plinth = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.9, 1.2, 6), white); plinth.position.y = 0.6;
  const tower = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 1.5, 7.5, 6), white); tower.position.y = 1.2 + 3.75;
  const collar = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 1.05, 0.5, 6), dark); collar.position.y = 1.2 + 7.5;
  const slot = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.5, 0.25), slotMaterial); slot.position.set(0, 1.0, 2.55);
  machine.add(plinth, tower, collar, slot);
  machine.position.y = floorY - 0.2;
  scene.add(machine);
  const sunLight = new THREE.DirectionalLight('#ffffff', 1.6); sunLight.position.copy(SUN).multiplyScalar(50);
  const fill = new THREE.AmbientLight('#ffffff', 0.35);
  scene.add(sunLight, fill);

  // ---- the plume: cubes of the cartridge's colours, spiralling up
  const plumeCount = 140;
  const plume = new THREE.InstancedMesh(new THREE.BoxGeometry(0.45, 0.45, 0.45), new THREE.MeshBasicMaterial(), plumeCount);
  plume.frustumCulled = false;
  scene.add(plume);
  const top = floorY + 9.6;
  let plumeLevel = 0, running = false;
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), e = new THREE.Euler();
  const phase = (i: number) => ((i * 0.618034) % 1);

  // ---- the camera: drag to look round the crater, wheel to come closer
  const orbit = { yaw: 0.85, pitch: 0.36, distance: 62, idle: 0 };
  const target = new THREE.Vector3(0, floorY + 3.5, 0);
  let dragging: { x: number; y: number } | null = null;
  const onDown = (ev: PointerEvent): void => { dragging = { x: ev.clientX, y: ev.clientY }; orbit.idle = 0; o.canvas.setPointerCapture(ev.pointerId); };
  const onMove = (ev: PointerEvent): void => {
    if (!dragging) return;
    orbit.yaw -= (ev.clientX - dragging.x) * 0.005;
    orbit.pitch = Math.max(0.12, Math.min(1.25, orbit.pitch + (ev.clientY - dragging.y) * 0.004));
    dragging = { x: ev.clientX, y: ev.clientY };
  };
  const onUp = (): void => { dragging = null; };
  const onWheel = (ev: WheelEvent): void => { ev.preventDefault(); orbit.idle = 0; orbit.distance = Math.max(18, Math.min(78, orbit.distance * (1 + Math.sign(ev.deltaY) * 0.08))); };
  o.canvas.addEventListener('pointerdown', onDown);
  o.canvas.addEventListener('pointermove', onMove);
  o.canvas.addEventListener('pointerup', onUp);
  o.canvas.addEventListener('pointercancel', onUp);
  o.canvas.addEventListener('wheel', onWheel, { passive: false });

  // ---- looks
  let current: GpuLook | null = null, next: GpuLook | null = null;
  const heightCache = new Map<number, { heights: Float32Array; normals: Float32Array }>();
  const shapeFor = (cell: number) => {
    let hit = heightCache.get(cell);
    if (!hit) { const heights = gridHeights(grid, cell); hit = { heights, normals: gridNormals(grid, heights) }; heightCache.set(cell, hit); }
    return hit;
  };
  const upload = (look: StageLook): GpuLook => ({
    look, ...shapeFor(look.facetCell),
    colour: texture(look.colour, look.size, true, look.pixelated),
    maps: texture(look.maps, look.size, false, look.pixelated),
  });
  const lookVector = (l: StageLook) => new THREE.Vector4(l.levels, l.smooth, l.normalStrength, l.light);
  const free = (g: GpuLook | null): void => { if (g && g !== current && g !== next) { g.colour.dispose(); g.maps.dispose(); } };

  const apply = (): void => {
    if (!current) return;
    const target2 = next ?? current;
    for (let k = 0; k < count; k++) position[k * 3 + 1] = current.heights[k]!;
    to.set(target2.heights);
    normal.set(current.normals);
    normalTo.set(target2.normals);
    geometry.attributes.position!.needsUpdate = true;
    geometry.attributes.aTo!.needsUpdate = true;
    geometry.attributes.normal!.needsUpdate = true;
    geometry.attributes.aNormalTo!.needsUpdate = true;
    groundUniforms.uFromColour.value = current.colour; groundUniforms.uFromMaps.value = current.maps;
    groundUniforms.uToColour.value = target2.colour; groundUniforms.uToMaps.value = target2.maps;
    groundUniforms.uFromLook.value = lookVector(current.look); groundUniforms.uToLook.value = lookVector(target2.look);
    groundUniforms.uFromTile.value = current.look.tile; groundUniforms.uToTile.value = target2.look.tile;
    groundUniforms.uFromSky.value = skyColour(current.look.atmosphere); groundUniforms.uToSky.value = skyColour(target2.look.atmosphere);
    waterUniforms.uFromLevel.value = current.look.water; waterUniforms.uToLevel.value = target2.look.water;
  };

  /** Sky, fog and light follow the wave: halfway across the moon, halfway to the new sky. */
  const blendSky = (radius: number): void => {
    if (!current) return;
    const k = next ? Math.max(0, Math.min(1, radius / WAVE_REACH)) : 0;
    const target2 = next ?? current;
    const atmosphere = current.look.atmosphere + (target2.look.atmosphere - current.look.atmosphere) * k;
    skyUniforms.uAtmosphere.value = atmosphere;
    starMaterial.opacity = Math.max(0, 1 - atmosphere * 1.4);
    groundUniforms.uFogColour.value.copy(skyColour(atmosphere));
    groundUniforms.uFogDensity.value = 0.0075 - atmosphere * 0.002;
    waterUniforms.uSkyColour.value.copy(new THREE.Color(0.05, 0.08, 0.1).lerp(SKY_HORIZON, atmosphere));
    const light = current.look.light + (target2.look.light - current.look.light) * k;
    waterUniforms.uLight.value = light;
    sunLight.intensity = 0.9 + light * 0.9;
    fill.intensity = 0.25 + atmosphere * 0.45;
  };

  return {
    show(look) {
      const oldCurrent = current, oldNext = next;
      current = upload(look); next = null;
      free(oldCurrent); free(oldNext);
      apply();
      groundUniforms.uRadius.value = 0; groundUniforms.uGlow.value = 0;
      blendSky(0);
    },
    setTarget(look) {
      if (!current) { this.show(look); return; }
      const old = next; next = upload(look);
      free(old);
      apply();
    },
    setFront(radius) {
      groundUniforms.uRadius.value = radius;
      // the rings fade in as the wave leaves the chimney and out as it leaves the moon
      groundUniforms.uGlow.value = next ? Math.min(1, radius / 6) * Math.min(1, Math.max(0, (WAVE_REACH - radius) / 12)) : 0;
      blendSky(radius);
    },
    settle() {
      if (!next) return;
      const old = current; current = next; next = null;
      free(old);
      apply();
      groundUniforms.uRadius.value = 0; groundUniforms.uGlow.value = 0;
      blendSky(0);
    },
    setChimney(on, palette) {
      running = on;
      slotMaterial.color.set(palette[Math.min(2, palette.length - 1)] ?? '#c56443');
      const colours = palette.map((c) => new THREE.Color(c));
      for (let i = 0; i < plumeCount; i++) plume.setColorAt(i, colours[(i % Math.max(1, colours.length - 1)) + (colours.length > 1 ? 1 : 0)] ?? new THREE.Color('#ffffff'));
      if (plume.instanceColor) plume.instanceColor.needsUpdate = true;
    },
    frame(now, dt) {
      if (!o.reducedMotion && !dragging) { orbit.idle += dt; if (orbit.idle > 5) orbit.yaw += dt * 0.035; }
      const cp = Math.cos(orbit.pitch);
      camera.position.set(target.x + Math.sin(orbit.yaw) * cp * orbit.distance, target.y + Math.sin(orbit.pitch) * orbit.distance, target.z + Math.cos(orbit.yaw) * cp * orbit.distance);
      camera.lookAt(target);
      waterUniforms.uTime.value = now;
      plumeLevel = Math.max(0, Math.min(1, plumeLevel + (running ? dt / 1.2 : -dt / 1.6)));
      for (let i = 0; i < plumeCount; i++) {
        const life = (now * 0.16 + phase(i)) % 1;
        const angle = phase(i * 7 + 3) * Math.PI * 2 + now * 0.5 + life * 4;
        const radius = 0.5 + life * (3 + phase(i * 13 + 1) * 5);
        p.set(Math.cos(angle) * radius, top + life * 30, Math.sin(angle) * radius);
        const size = plumeLevel * Math.pow(1 - life, 0.6) * (0.7 + phase(i * 5 + 2) * 0.6);
        s.set(size, size, size);
        e.set(life * 3 + i, life * 2, 0); q.setFromEuler(e);
        plume.setMatrixAt(i, m.compose(p, q, s));
      }
      plume.instanceMatrix.needsUpdate = true;
      plume.visible = plumeLevel > 0.001;
      renderer.render(scene, camera);
    },
    resize(width, height, pixelRatio, covered = 0) {
      renderer.setPixelRatio(pixelRatio);
      renderer.setSize(width, height, false);
      // draw the bottom of a taller picture, so the camera's centre sits in the middle of the part the console leaves open
      const inset = Math.max(0, Math.min(height * 0.6, covered)), open = Math.max(1, height - inset);
      // the open part shows 48 degrees top to bottom (62 on a portrait screen, for more of the moon); the field of view
      // is set for the whole taller picture so that the open part comes out at that
      const openFov = width / open < 0.9 ? 62 : 48;
      camera.fov = (2 * Math.atan(Math.tan((openFov * Math.PI) / 360) * ((height + inset) / open)) * 180) / Math.PI;
      camera.aspect = width / Math.max(1, height + inset);
      camera.setViewOffset(width, height + inset, 0, inset, width, height);
      camera.updateProjectionMatrix();
    },
    dispose() {
      o.canvas.removeEventListener('pointerdown', onDown);
      o.canvas.removeEventListener('pointermove', onMove);
      o.canvas.removeEventListener('pointerup', onUp);
      o.canvas.removeEventListener('pointercancel', onUp);
      o.canvas.removeEventListener('wheel', onWheel);
      for (const g of [current, next]) if (g) { g.colour.dispose(); g.maps.dispose(); }
      scene.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        mesh.geometry?.dispose();
        const mat = mesh.material as THREE.Material | THREE.Material[] | undefined;
        if (Array.isArray(mat)) mat.forEach((x) => x.dispose()); else mat?.dispose();
      });
      blank.dispose();
      renderer.dispose();
    },
  };
}

/** The main crater's radius, for the screen's copy and checks. */
export const CRATER_RADIUS = MAIN_CRATER.r;
