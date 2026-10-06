// The Resolution Crafter's world, without a camera: your plot (two looks blended by the wave), the plains out to a far
// horizon, the neighbours' finished plots with their trees and air, smooth boulders, water, and the sky with the goblin planet
// in it. The crafter screen orbits it; the lab menu looks at it through the archway. Your plot's centre is kept clear for the
// gate's planet end (owner, 2026-10-06; docs/SETMIX_PLAN.md): it is built to the concept art, so nothing stands there yet.
import * as THREE from 'three';
import type { StageLook } from './looks';
import { MAIN_CRATER, facetedHeight, gridHeights, gridNormals, hash, makeGrid, type MoonGrid } from './moon';
import { BOULDERS, FAR, PLANET_RADIUS, PLOT_EDGE, PLOT_RADIUS, drop, heightGrid, makeDisc, makeRing, planetHeight, sunlight, type Boulder, type HeightGrid, type Plot } from './planet';
import { WAVE_BAND, WAVE_REACH } from './progress';
import { smoothModel, type SmoothId } from './smooth-models';
import { DOME_FRAGMENT, DOME_VERTEX, GROUND_FRAGMENT, GROUND_VERTEX, ROCK_FRAGMENT, ROCK_VERTEX, SKY_FRAGMENT, SKY_VERTEX, WATER_FRAGMENT, WATER_VERTEX } from './moon-shaders';

/** A neighbour's plot and the look it has reached. */
export interface Neighbour { readonly plot: Plot; readonly look: StageLook }

/** What a world can be told. */
export interface World {
  /** Lays out the planet round your plot, once, before the first look: the plains in `base` (the planet as it was before anyone came), and the neighbours. */
  setPlanet(base: StageLook, neighbours: readonly Neighbour[], options?: PlanetOptions): void;
  /** Shows a look at once, over your whole plot. */
  show(look: StageLook): void;
  /** The look the next wave carries out from your plot's centre. */
  setTarget(look: StageLook): void;
  /** Where the front is (metres from your plot's centre). */
  setFront(radius: number): void;
  /** The wave has crossed your plot: its look becomes the plot's look. */
  settle(): void;
  /** Moves what moves (water); the sky keeps centred on the eye. */
  update(now: number, dt: number, eye: THREE.Vector3): void;
  /** Height of your plot's centre (the main crater's central peak). */
  readonly peakY: number;
  dispose(): void;
}

/** The sun: low (20 degrees), to the right of the first view, so crater rims and boulders throw long shadows across the plains. */
export const SUN = new THREE.Vector3(0.42, 0.34, -0.84).normalize();
/** The goblin planet hangs low over the plains, ahead and to the left of the first view. */
export const PLANET_DIR = new THREE.Vector3(-0.935, 0.135, -0.327).normalize();
const PLANET_SIZE = 0.095;
const SKY_ZENITH = new THREE.Color('#25568f'), SKY_HORIZON = new THREE.Color('#8db9de');

interface GpuLook { readonly look: StageLook; readonly colour: THREE.DataTexture; readonly maps: THREE.DataTexture; readonly heights: Float32Array; readonly normals: Float32Array }
type Uniforms = Record<string, THREE.IUniform>;

function texture(bytes: Uint8Array, size: number, colour: boolean, pixelated: boolean): THREE.DataTexture {
  const t = new THREE.DataTexture(bytes, size, size, THREE.RGBAFormat);
  t.colorSpace = colour ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.magFilter = pixelated ? THREE.NearestFilter : THREE.LinearFilter;
  // mipmaps keep far ground from shimmering, even when near ground is crisp pixels
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true;
  t.anisotropy = 4;
  t.needsUpdate = true;
  return t;
}

function skyColour(atmosphere: number): THREE.Color {
  return new THREE.Color(0, 0, 0).lerp(SKY_HORIZON, atmosphere);
}

/** A look's uniforms, named for the shader (Base, From or To), showing `blank` until a look is set. */
function lookUniforms(name: string, blank: THREE.Texture): Uniforms {
  return {
    [`u${name}Colour`]: { value: blank }, [`u${name}Maps`]: { value: blank }, [`u${name}Look`]: { value: new THREE.Vector4() },
    [`u${name}Sky`]: { value: new THREE.Color() }, [`u${name}Tile`]: { value: 16 },
  };
}
function setLook(u: Uniforms, name: string, g: { look: StageLook; colour: THREE.Texture; maps: THREE.Texture }): void {
  u[`u${name}Colour`]!.value = g.colour; u[`u${name}Maps`]!.value = g.maps;
  (u[`u${name}Look`]!.value as THREE.Vector4).set(g.look.levels, g.look.smooth, g.look.normalStrength, g.look.light);
  (u[`u${name}Sky`]!.value as THREE.Color).copy(skyColour(g.look.atmosphere));
  u[`u${name}Tile`]!.value = g.look.tile;
}

/** Normals of a height function by central differences, `e` metres apart. */
function normalAt(height: (x: number, z: number) => number, x: number, z: number, e: number, out: Float32Array, k: number): void {
  const dx = (height(x + e, z) - height(x - e, z)) / (2 * e), dz = (height(x, z + e) - height(x, z - e)) / (2 * e);
  const len = Math.sqrt(dx * dx + 1 + dz * dz);
  out[k] = -dx / len; out[k + 1] = 1 / len; out[k + 2] = -dz / len;
}

/** Distance from a point to the segment a-b, on the ground. */
function distanceToSegment(x: number, z: number, ax: number, az: number, bx: number, bz: number): number {
  const dx = bx - ax, dz = bz - az, t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz || 1)));
  return Math.hypot(x - ax - dx * t, z - az - dz * t);
}

const smooth = (a: number, b: number, x: number): number => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

/** A boulder as a ball for its shadow: centre (on the curved ground) and radius. */
interface Ball { readonly x: number; readonly y: number; readonly z: number; readonly r: number }

/** Boulders in buckets 8 m square, for the shadows they throw. */
function bucketBoulders(list: readonly Boulder[]): Map<number, Ball[]> {
  const map = new Map<number, Ball[]>();
  for (const b of list) {
    const key = Math.floor(b.x / 8) * 4096 + Math.floor(b.z / 8);
    let bucket = map.get(key);
    if (!bucket) map.set(key, (bucket = []));
    bucket.push({ x: b.x, z: b.z, y: planetHeight(b.x, b.z) - drop(b.x, b.z) + 0.35 * b.size, r: 0.62 * b.size });
  }
  return map;
}

/** How much of the sun a point on the ground keeps past nearby boulders: their long shadows, and the dark at their foot. */
function boulderShade(sun: THREE.Vector3, buckets: Map<number, Ball[]>, x: number, y: number, z: number): number {
  let shade = 1;
  const ci = Math.floor(x / 8), cj = Math.floor(z / 8);
  for (let j = cj - 2; j <= cj + 2; j++) for (let i = ci - 2; i <= ci + 2; i++) {
    const bucket = buckets.get(i * 4096 + j);
    if (!bucket) continue;
    for (const b of bucket) {
      const cx = b.x - x, cy = b.y - y, cz = b.z - z;
      const t = cx * sun.x + cy * sun.y + cz * sun.z;
      if (t > 0) {
        const ex = cx - sun.x * t, ey = cy - sun.y * t, ez = cz - sun.z * t;
        shade = Math.min(shade, 0.12 + 0.88 * smooth(b.r * 0.7, b.r * 1.15, Math.sqrt(ex * ex + ey * ey + ez * ez)));
      }
      shade *= 1 - 0.4 * (1 - smooth(b.r * 0.7, b.r * 1.7, Math.hypot(cx, cz)));
    }
  }
  return shade;
}

/** Which trees grow on a plot, by its cartridge. */
const FOREST: Readonly<Record<string, readonly SmoothId[]>> = {
  emerald_canopy: ['broadleaf', 'broadleaf', 'conifer'], spore_meadow: ['conifer', 'broadleaf'], solar_fern_glade: ['broadleaf', 'conifer', 'conifer'],
  coral_atoll: ['palm', 'palm', 'broadleaf'], prismata_grass: ['broadleaf'],
};
/** Trees per 60 m plot at each stage: none until the air and water allow it. */
const TREES_AT: readonly number[] = [0, 0, 0, 3, 12, 34, 60];

/** Options: the sun and the goblin planet default to the crafter's (the lab's vista sets its own, so daylight falls through the arch). */
export interface WorldOptions {
  readonly gridSpacing: number;
  readonly reducedMotion: boolean;
  readonly sun?: THREE.Vector3;
  readonly planetDir?: THREE.Vector3;
}

/** How the planet is laid out: as it is now (neighbours under their air), or finished (`lush`: air everywhere, forest over the plains). */
export interface PlanetOptions {
  readonly lush?: boolean;
  /** A spot kept clear of boulders and trees (where the lab stands). */
  readonly clear?: { readonly x: number; readonly z: number; readonly r: number };
  /** Seen only from here, looking this way (the lab's arch): trees and boulders outside the view are not built at all. */
  readonly view?: { readonly x: number; readonly z: number; readonly dirX: number; readonly dirZ: number; readonly halfAngle: number };
}

export function createWorld(scene: THREE.Scene, o: WorldOptions): World {
  const sun = o.sun ?? SUN, planetDir = o.planetDir ?? PLANET_DIR;
  const sunArray: [number, number, number] = [sun.x, sun.y, sun.z];
  const owned: { dispose(): void }[] = [];
  const keep = <T extends { dispose(): void }>(x: T): T => { owned.push(x); return x; };
  const blank = keep(new THREE.DataTexture(new Uint8Array([128, 128, 128, 255]), 1, 1, THREE.RGBAFormat));
  blank.needsUpdate = true;

  // ---- uniforms the ground, boulders and water share
  const shared = {
    uRadius: { value: 0 }, uBand: { value: WAVE_BAND }, uPlanetR: { value: PLANET_RADIUS }, uSunDir: { value: sun },
    uFogColour: { value: new THREE.Color(0, 0, 0) }, uFogDensity: { value: 0.00006 },
    uPlotR: { value: PLOT_RADIUS }, uEdge: { value: PLOT_EDGE }, uCentre: { value: new THREE.Vector2(0, 0) },
  };
  const base = lookUniforms('Base', blank);

  // ---- your plot: one grid, three looks (the one it has, the one the wave brings, the plains' at its rim)
  const grid: MoonGrid = makeGrid(o.gridSpacing);
  const count = grid.xz.length / 2;
  const position = new Float32Array(count * 3), to = new Float32Array(count), normal = new Float32Array(count * 3), normalTo = new Float32Array(count * 3);
  const baseHeights = new Float32Array(count), baseNormals = new Float32Array(count * 3), plotShade = new Float32Array(count).fill(1);
  for (let k = 0; k < count; k++) { position[k * 3] = grid.xz[k * 2]!; position[k * 3 + 2] = grid.xz[k * 2 + 1]!; }
  const geometry = keep(new THREE.BufferGeometry());
  geometry.setAttribute('position', new THREE.BufferAttribute(position, 3));
  geometry.setAttribute('aTo', new THREE.BufferAttribute(to, 1));
  geometry.setAttribute('normal', new THREE.BufferAttribute(normal, 3));
  geometry.setAttribute('aNormalTo', new THREE.BufferAttribute(normalTo, 3));
  geometry.setAttribute('aBase', new THREE.BufferAttribute(baseHeights, 1));
  geometry.setAttribute('aNormalBase', new THREE.BufferAttribute(baseNormals, 3));
  geometry.setAttribute('aShade', new THREE.BufferAttribute(plotShade, 1));
  geometry.setIndex(new THREE.BufferAttribute(grid.index, 1));
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), PLOT_RADIUS + 20);
  const plotUniforms = { ...shared, ...base, ...lookUniforms('From', blank), ...lookUniforms('To', blank), uGlow: { value: 0 } };
  scene.add(new THREE.Mesh(geometry, keep(new THREE.ShaderMaterial({ vertexShader: GROUND_VERTEX, fragmentShader: GROUND_FRAGMENT, uniforms: plotUniforms, defines: { PLOT: '' } }))));

  // ---- water: rises behind the wave, in the main crater's bowl (inside its rim, so it never spills over the plains)
  const waterGeometry = keep(new THREE.CircleGeometry(MAIN_CRATER.r + 1, 96));
  waterGeometry.rotateX(-Math.PI / 2);
  const waterUniforms = {
    ...shared, uTime: { value: 0 }, uFromLevel: { value: -99 }, uToLevel: { value: -99 }, uSkyColour: { value: new THREE.Color() }, uLight: { value: 0 },
  };
  const water = new THREE.Mesh(waterGeometry, keep(new THREE.ShaderMaterial({ vertexShader: WATER_VERTEX, fragmentShader: WATER_FRAGMENT, uniforms: waterUniforms, transparent: true })));
  water.renderOrder = 2;
  scene.add(water);

  // ---- sky and stars, centred on the eye
  const skyUniforms = {
    uHorizon: { value: SKY_HORIZON.clone() }, uZenith: { value: SKY_ZENITH.clone() }, uAtmosphere: { value: 0 }, uSunDir: { value: sun },
    uPlanetDir: { value: planetDir }, uPlanetSize: { value: PLANET_SIZE },
  };
  const sky = new THREE.Mesh(keep(new THREE.SphereGeometry(600, 32, 16)), keep(new THREE.ShaderMaterial({ vertexShader: SKY_VERTEX, fragmentShader: SKY_FRAGMENT, uniforms: skyUniforms, side: THREE.BackSide, depthWrite: false })));
  sky.renderOrder = -2;
  sky.frustumCulled = false;
  scene.add(sky);
  const starLayers: THREE.Points[] = [], starMaterials: THREE.PointsMaterial[] = [];
  for (const [n, size, salt] of [[5200, 1.25, 0], [260, 2.3, 7]] as const) {
    const xyz: number[] = [], rgb: number[] = [];
    for (let i = 0; xyz.length < n * 3 && i < n * 2; i++) {
      const y = hash(i, 1, salt) * 2 - 1, r = Math.sqrt(1 - y * y), a = hash(i, 2, salt) * Math.PI * 2;
      const d = new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r);
      if (d.dot(planetDir) > Math.cos(PLANET_SIZE * 1.05)) continue; // behind the goblin planet
      xyz.push(d.x * 500, d.y * 500, d.z * 500);
      const glow = salt ? 0.75 + 0.25 * hash(i, 3, salt) : 0.16 + 0.55 * Math.pow(hash(i, 3, salt), 3);
      const warm = hash(i, 4, salt) - 0.5;
      rgb.push(glow * (1 + warm * 0.25), glow, glow * (1 - warm * 0.3));
    }
    const g = keep(new THREE.BufferGeometry());
    g.setAttribute('position', new THREE.Float32BufferAttribute(xyz, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(rgb, 3));
    const mat = keep(new THREE.PointsMaterial({ vertexColors: true, size, sizeAttenuation: false, transparent: true, depthWrite: false }));
    const pts = new THREE.Points(g, mat);
    pts.renderOrder = -1;
    pts.frustumCulled = false;
    starLayers.push(pts); starMaterials.push(mat);
    scene.add(pts);
  }

  // ---- light for the smooth models (the trees): the low sun and a faint cold fill
  const sunLight = new THREE.DirectionalLight('#fff4e6', 2.6); sunLight.position.copy(sun).multiplyScalar(100);
  const fill = new THREE.HemisphereLight('#8fb2ff', '#2a2622', 0.35);
  scene.add(sunLight, fill);
  const treeMaterial = keep(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.82, metalness: 0 }));

  // your plot's centre, on the main crater's central peak, where the gate's planet end will stand
  const peakY = planetHeight(0, 0);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), e = new THREE.Euler();

  /** Stands an object on the curved planet at x, z: down by the fall-away, tilted with the ground there. */
  const upright = new THREE.Vector3(), yAxis = new THREE.Vector3(0, 1, 0), tiltQ = new THREE.Quaternion(), spinQ = new THREE.Quaternion();
  const place = (x: number, y: number, z: number, yaw: number, tilt: number, size: number, out: THREE.Matrix4): THREE.Matrix4 => {
    upright.set(x / PLANET_RADIUS, 1, z / PLANET_RADIUS).normalize();
    tiltQ.setFromUnitVectors(yAxis, upright);
    spinQ.setFromEuler(e.set(tilt, yaw, tilt * 0.6));
    q.multiplyQuaternions(tiltQ, spinQ);
    return out.compose(p.set(x, y - drop(x, z), z), q, s.set(size, size, size));
  };

  // ---- looks on your plot
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
  const free = (g: GpuLook | null): void => { if (g && g !== current && g !== next) { g.colour.dispose(); g.maps.dispose(); } };
  /** Everything that wears your plot's looks: the plot itself, and the boulders once they are laid. */
  const lookTargets: Uniforms[] = [plotUniforms];

  const apply = (): void => {
    if (!current) return;
    const target = next ?? current;
    for (let k = 0; k < count; k++) position[k * 3 + 1] = current.heights[k]!;
    to.set(target.heights);
    normal.set(current.normals);
    normalTo.set(target.normals);
    for (const name of ['position', 'aTo', 'normal', 'aNormalTo']) geometry.attributes[name]!.needsUpdate = true;
    for (const u of lookTargets) { setLook(u, 'From', current); setLook(u, 'To', target); }
    waterUniforms.uFromLevel.value = current.look.water; waterUniforms.uToLevel.value = target.look.water;
  };

  /** Sky, haze and light follow the wave: halfway across your plot, halfway to the new sky. */
  const blendSky = (radius: number): void => {
    if (!current) return;
    const k = next ? Math.max(0, Math.min(1, radius / WAVE_REACH)) : 0;
    const target = next ?? current;
    const atmosphere = current.look.atmosphere + (target.look.atmosphere - current.look.atmosphere) * k;
    skyUniforms.uAtmosphere.value = atmosphere;
    for (const mat of starMaterials) mat.opacity = Math.max(0, 1 - atmosphere * 1.4);
    // with no air, only a trace of dust softens the far plains; air brings a blue haze
    shared.uFogColour.value.copy(new THREE.Color(0.05, 0.048, 0.046).lerp(SKY_HORIZON, atmosphere));
    shared.uFogDensity.value = 0.00006 + atmosphere * 0.0004;
    waterUniforms.uSkyColour.value.copy(new THREE.Color(0.05, 0.08, 0.1).lerp(SKY_HORIZON, atmosphere));
    waterUniforms.uLight.value = current.look.light + (target.look.light - current.look.light) * k;
    fill.intensity = 0.35 + atmosphere * 0.9;
  };
  const rest = (): void => { shared.uRadius.value = 0; plotUniforms.uGlow.value = 0; blendSky(0); };

  // ---- the planet round your plot (laid once)
  let planetSet = false;
  const setPlanet = (baseLook: StageLook, neighbours: readonly Neighbour[], options: PlanetOptions = {}): void => {
    if (planetSet) return;
    planetSet = true;
    setLook(base, 'Base', { look: baseLook, colour: keep(texture(baseLook.colour, baseLook.size, true, baseLook.pixelated)), maps: keep(texture(baseLook.maps, baseLook.size, false, baseLook.pixelated)) });
    const cell = baseLook.facetCell, clear = options.clear, view = options.view;
    const seen = (x: number, z: number): boolean => {
      if (!view) return true;
      const dx = x - view.x, dz = z - view.z, d = Math.hypot(dx, dz);
      return d > 1 && (dx * view.dirX + dz * view.dirZ) / d > Math.cos(view.halfAngle);
    };
    // where the planet is mostly seen from (the lab, or your plot), for choosing each tree's detail
    const eyeX = clear?.x ?? 0, eyeZ = clear?.z ?? 0;
    // the plains' surface: your moon's facets near the plot, the true planet beyond (blended, so no step between)
    const plains = (x: number, z: number): number => {
      const d = Math.hypot(x, z);
      if (d > 140) return planetHeight(x, z);
      const f = facetedHeight(x, z, cell);
      return d < 80 ? f : f + (planetHeight(x, z) - f) * smooth(80, 140, d);
    };
    const grids: HeightGrid[] = [heightGrid(planetHeight, 170, 340), heightGrid(planetHeight, FAR, 420)];
    const buckets = bucketBoulders(BOULDERS.filter((b) => Math.hypot(b.x, b.z) < 260));
    const shadeAt = (x: number, z: number, h: number): number => {
      const y = h - drop(x, z);
      const lit = sunlight(grids, x, z, y + 0.05, sunArray);
      return Math.hypot(x, z) < 250 ? lit * boulderShade(sun, buckets, x, y, z) : lit;
    };

    // your plot's rim: the plains' heights; and every point's sunlight
    const baseShape = shapeFor(cell);
    baseHeights.set(baseShape.heights); baseNormals.set(baseShape.normals);
    for (let k = 0; k < count; k++) { const x = grid.xz[k * 2]!, z = grid.xz[k * 2 + 1]!; plotShade[k] = shadeAt(x, z, planetHeight(x, z)); }
    for (const name of ['aBase', 'aNormalBase', 'aShade']) geometry.attributes[name]!.needsUpdate = true;

    // the plains, from just inside your plot's rim (a skirt, a little lower, so no crack shows) to the horizon and past it
    const ring = makeRing(PLOT_RADIUS - 2, FAR, 256, 150);
    const rn = ring.xz.length / 2, rPos = new Float32Array(rn * 3), rNorm = new Float32Array(rn * 3), rShade = new Float32Array(rn);
    for (let k = 0; k < rn; k++) {
      const x = ring.xz[k * 2]!, z = ring.xz[k * 2 + 1]!, d = Math.hypot(x, z), h = plains(x, z);
      rPos[k * 3] = x; rPos[k * 3 + 1] = d < PLOT_RADIUS ? h - 0.3 : h; rPos[k * 3 + 2] = z;
      normalAt(planetHeight, x, z, Math.max(1, d * 0.012), rNorm, k * 3);
      rShade[k] = shadeAt(x, z, h);
    }
    const ringGeometry = keep(new THREE.BufferGeometry());
    ringGeometry.setAttribute('position', new THREE.BufferAttribute(rPos, 3));
    ringGeometry.setAttribute('normal', new THREE.BufferAttribute(rNorm, 3));
    ringGeometry.setAttribute('aShade', new THREE.BufferAttribute(rShade, 1));
    ringGeometry.setIndex(new THREE.BufferAttribute(ring.index, 1));
    ringGeometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), FAR + 400);
    scene.add(new THREE.Mesh(ringGeometry, keep(new THREE.ShaderMaterial({ vertexShader: GROUND_VERTEX, fragmentShader: GROUND_FRAGMENT, uniforms: { ...shared, ...base, ...lookUniforms('To', blank) }, defines: { RING: '' } }))));

    // ---- the neighbours: each plot's ground in its own look, its air and its trees
    const domeGeometry = keep(new THREE.SphereGeometry(1, 48, 16, 0, Math.PI * 2, 0, Math.PI / 2));
    neighbours.forEach(({ plot, look }, i) => {
      const disc = makeDisc(plot);
      const dn = disc.xz.length / 2, dPos = new Float32Array(dn * 3), dNorm = new Float32Array(dn * 3), dShade = new Float32Array(dn);
      for (let k = 0; k < dn; k++) {
        const x = disc.xz[k * 2]!, z = disc.xz[k * 2 + 1]!, h = planetHeight(x, z);
        dPos[k * 3] = x; dPos[k * 3 + 1] = h; dPos[k * 3 + 2] = z;
        normalAt(planetHeight, x, z, 1.5, dNorm, k * 3);
        dShade[k] = shadeAt(x, z, h);
      }
      const g = keep(new THREE.BufferGeometry());
      g.setAttribute('position', new THREE.BufferAttribute(dPos, 3));
      g.setAttribute('normal', new THREE.BufferAttribute(dNorm, 3));
      g.setAttribute('aShade', new THREE.BufferAttribute(dShade, 1));
      g.setIndex(new THREE.BufferAttribute(disc.index, 1));
      g.computeBoundingSphere();
      const u: Uniforms = { ...shared, ...base, ...lookUniforms('To', blank), uCentre: { value: new THREE.Vector2(plot.x, plot.z) }, uPlotR: { value: plot.r + 6 }, uEdge: { value: 30 } };
      setLook(u, 'To', { look, colour: keep(texture(look.colour, look.size, true, look.pixelated)), maps: keep(texture(look.maps, look.size, false, look.pixelated)) });
      scene.add(new THREE.Mesh(g, keep(new THREE.ShaderMaterial({ vertexShader: GROUND_VERTEX, fragmentShader: GROUND_FRAGMENT, uniforms: u, defines: { DISC: '' }, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -8 }))));

      const groundY = planetHeight(plot.x, plot.z);
      // their air: a bubble, thicker the further they have come
      const air = options.lush ? 0 : Math.max(0, (plot.stage - 2) / 4);
      if (air > 0) {
        const dome = new THREE.Mesh(domeGeometry, keep(new THREE.ShaderMaterial({
          vertexShader: DOME_VERTEX, fragmentShader: DOME_FRAGMENT, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
          uniforms: { uTint: { value: new THREE.Color(0.42, 0.68, 1.0).lerp(new THREE.Color(0.6, 0.85, 0.75), hash(i, 1, 3) * 0.5) }, uSunDir: { value: sun }, uStrength: { value: 0.35 + air * 0.65 } },
        })));
        place(plot.x, groundY - 2, plot.z, 0, 0, 1, m).decompose(dome.position, dome.quaternion, dome.scale);
        dome.scale.set(plot.r * 1.18, plot.r * 0.55, plot.r * 1.18);
        dome.renderOrder = 3;
        scene.add(dome);
      }
      // their trees: the cartridge's kinds, more of them the further the plot has come; none round the plot's centre
      const kinds = FOREST[plot.cartridge] ?? ['broadleaf'];
      const want = Math.min(160, Math.round((TREES_AT[plot.stage] ?? 0) * (plot.r / 60) ** 2));
      const byKind = new Map<SmoothId, THREE.Matrix4[]>();
      for (let t = 0, tries = 0; t < want && tries < want * 4; tries++) {
        const a = hash(i, tries, 51) * Math.PI * 2, rr = Math.sqrt(hash(i, tries, 52)) * plot.r * 0.95;
        if (rr < 12) continue;
        const x = plot.x + Math.cos(a) * rr, z = plot.z + Math.sin(a) * rr;
        if (!seen(x, z)) continue;
        const kind = kinds[Math.floor(hash(i, tries, 53) * kinds.length)]!;
        const size = (0.75 + hash(i, tries, 54) * 0.6) * (1 + plot.r / 220);
        let list = byKind.get(kind);
        if (!list) byKind.set(kind, (list = []));
        list.push(place(x, planetHeight(x, z) - 0.2, z, hash(i, tries, 55) * 6.28, (hash(i, tries, 56) - 0.5) * 0.08, size, new THREE.Matrix4()));
        t++;
      }
      for (const [kind, list] of byKind) {
        const trees = new THREE.InstancedMesh(Math.hypot(plot.x - eyeX, plot.z - eyeZ) < 700 ? smoothModel(kind).far : smoothModel(kind).tiny, treeMaterial, list.length);
        list.forEach((mm, k) => trees.setMatrixAt(k, mm));
        trees.computeBoundingSphere();
        scene.add(trees);
      }
    });

    // ---- a finished planet: forest over the plains and round your plot's lake (off the neighbours' plots, which have their own)
    if (options.lush) {
      const byKind = new Map<string, THREE.Matrix4[]>();
      // a view sees a slice of the planet: it gets a slice of the trees
      const most = view ? 240 : 700;
      for (let k = 0, placed = 0; placed < most && k < 6000; k++) {
        const a = hash(k, 1, 61) * Math.PI * 2, u = hash(k, 2, 61), d = 34 + u * u * 1500;
        const x = Math.cos(a) * d, z = Math.sin(a) * d;
        if (clear && Math.hypot(x - clear.x, z - clear.z) < clear.r) continue;
        if (!seen(x, z)) continue;
        // keep the view from the clear spot to your plot open: no trees on the line between them
        if (clear && distanceToSegment(x, z, clear.x, clear.z, 0, 0) < 34) continue;
        if (neighbours.some(({ plot }) => Math.hypot(x - plot.x, z - plot.z) < plot.r + 30)) continue;
        // clumps: a tree only where a slow noise says woodland
        if (hash(Math.floor(x / 60), Math.floor(z / 60), 62) < 0.3) continue;
        const kind: SmoothId = hash(k, 3, 61) < 0.62 ? 'broadleaf' : 'conifer';
        const far = Math.hypot(x - eyeX, z - eyeZ), key = `${kind}@${far < 90 ? 'near' : far < 500 ? 'far' : 'tiny'}`;
        let list = byKind.get(key);
        if (!list) byKind.set(key, (list = []));
        list.push(place(x, planetHeight(x, z) - 0.2, z, hash(k, 4, 61) * 6.28, (hash(k, 5, 61) - 0.5) * 0.08, 0.8 + hash(k, 6, 61) * 0.7, new THREE.Matrix4()));
        placed++;
      }
      for (const [key, list] of byKind) {
        const [kind, detail] = key.split('@') as [SmoothId, 'near' | 'far' | 'tiny'];
        const trees = new THREE.InstancedMesh(smoothModel(kind)[detail], treeMaterial, list.length);
        list.forEach((mm, k) => trees.setMatrixAt(k, mm));
        trees.computeBoundingSphere();
        scene.add(trees);
      }
    }

    // ---- boulders: smooth, wearing the ground's cartridge (your plot's looks on your plot, the plains' look beyond)
    const rockUniforms = { ...shared, ...base, ...lookUniforms('From', blank), ...lookUniforms('To', blank) };
    lookTargets.push(rockUniforms);
    const rockMaterial = keep(new THREE.ShaderMaterial({ vertexShader: ROCK_VERTEX, fragmentShader: ROCK_FRAGMENT, uniforms: rockUniforms }));
    for (let shape = 0; shape < 3; shape++) for (const near of [true, false]) {
      const list = BOULDERS.filter((b) => b.shape === shape && (Math.hypot(b.x, b.z) < 160) === near && !(clear && Math.hypot(b.x - clear.x, b.z - clear.z) < clear.r) && seen(b.x, b.z));
      if (!list.length) continue;
      const model = smoothModel(`boulder${shape}` as SmoothId);
      // a copy, so this world's sunlight per boulder does not stick to the kept model
      const geo = keep((near ? model.near : model.far).clone());
      const sun = new Float32Array(list.length);
      const rocks = new THREE.InstancedMesh(geo, rockMaterial, list.length);
      list.forEach((b, k) => {
        const h = planetHeight(b.x, b.z);
        rocks.setMatrixAt(k, place(b.x, h - b.size * 0.22, b.z, b.turn, b.tilt, b.size, m));
        sun[k] = sunlight(grids, b.x, b.z, h - drop(b.x, b.z) + b.size * 0.6, sunArray);
      });
      geo.setAttribute('aSun', new THREE.InstancedBufferAttribute(sun, 1));
      rocks.computeBoundingSphere();
      scene.add(rocks);
    }
    apply();
  };

  return {
    peakY,
    setPlanet,
    show(look) {
      const oldCurrent = current, oldNext = next;
      current = upload(look); next = null;
      free(oldCurrent); free(oldNext);
      apply();
      rest();
    },
    setTarget(look) {
      if (!current) { this.show(look); return; }
      const old = next; next = upload(look);
      free(old);
      apply();
    },
    setFront(radius) {
      shared.uRadius.value = radius;
      // the rings fade in as the wave leaves your plot's centre and out as it reaches its rim
      plotUniforms.uGlow.value = next ? Math.min(1, radius / 6) * Math.min(1, Math.max(0, (WAVE_REACH - radius) / 12)) : 0;
      blendSky(radius);
    },
    settle() {
      if (!next) return;
      const old = current; current = next; next = null;
      free(old);
      apply();
      rest();
    },
    update(now, _dt, eye) {
      sky.position.copy(eye);
      for (const layer of starLayers) layer.position.copy(eye);
      waterUniforms.uTime.value = now;
    },
    dispose() {
      for (const g of [current, next]) if (g) { g.colour.dispose(); g.maps.dispose(); }
      // the smooth models' own geometries are kept for the next visit; everything else this world made goes
      for (const x of owned) x.dispose();
    },
  };
}
