/**
 * ISLAND-ROUTE: the island course as the renderer draws it. The owner's Serpentine Isle model (its carved
 * grooves are the race's lanes), set on a sandy beach base, surrounded by the sea, under a sea-haze sky.
 * Nothing else is added to the island: no road is drawn (the groove is the road) and nothing is placed
 * that could stand inside the model.
 */
import * as THREE from 'three';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { openBranches, type RouteLayout } from '../sim/route';
import { ISLAND_BASE_Y, ISLAND_MODEL_FLOOR, ISLAND_ROUTE_GRAPH, ISLAND_SCALE, MODEL_TO_ROUTE } from './serpentine-route';
import { islandBranchSpace } from './island-space';
import { buildHeightField, type HeightField } from './model-heightfield';
import { IslandGround, loadGround } from './island-ground';
import { readIslandTracks } from './island-props-storage';
import { buildIslandSea, shoreRadiusOf, type SeaHorizonInput, type SeaLookInput } from './island-sea';

export interface IslandMaterials {
  dirt: THREE.MeshStandardMaterial;
  wood: THREE.MeshStandardMaterial;
  water: THREE.MeshStandardMaterial;
}

export interface IslandWorld {
  readonly group: THREE.Group;
  readonly skyColor: THREE.Color;
  readonly fogColor: THREE.Color;
  /** The sky dome; the renderer keeps it centred on the camera. */
  readonly sky: THREE.Mesh;
  /** Resolves once the island model is in the scene. */
  readonly ready: Promise<void>;
  /** The model's surface height at (x, z); null off the model, or before it has loaded. */
  groundAt(x: number, z: number): number | null;
  /** The terrain's ground shader: tint, grain, pebbles and the painted sand (build mode edits it). */
  readonly ground: IslandGround;
  /** Each frame: the sea's waves and foam move, its discs and the horizon haze follow the camera. */
  update(time: number, camera: THREE.Camera, fogColor: THREE.Color): void;
  /** The ocean's look (the Sky window's Ocean section). */
  setSea(look: SeaLookInput): void;
  /** The horizon: haze width and glow band on the sea side (the sky shader draws its half). */
  setHorizon(h: SeaHorizonInput): void;
}

/** World units per bucket of the model's triangle index (a few triangles per bucket). */
export const ISLAND_GROUND_CELL = 1500;

/**
 * The model's triangles in world space with their (soft) normals, non-indexed: what island auto paint
 * analyses (`island-terrain.ts`).
 */
export function islandTriangles(model: THREE.Object3D): { positions: Float32Array; normals: Float32Array } {
  model.updateMatrixWorld(true);
  const pos: number[] = [], nrm: number[] = [];
  const v = new THREE.Vector3(), n = new THREE.Vector3(), normalMatrix = new THREE.Matrix3();
  model.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    normalMatrix.getNormalMatrix(mesh.matrixWorld);
    const p = mesh.geometry.getAttribute('position');
    const q = mesh.geometry.getAttribute('normal');
    const index = mesh.geometry.getIndex();
    const count = index ? index.count : p.count;
    for (let k = 0; k < count; k++) {
      const i = index ? index.getX(k) : k;
      v.fromBufferAttribute(p, i).applyMatrix4(mesh.matrixWorld);
      pos.push(v.x, v.y, v.z);
      if (q) n.fromBufferAttribute(q, i).applyMatrix3(normalMatrix).normalize(); else n.set(0, 1, 0);
      nrm.push(n.x, n.y, n.z);
    }
  });
  return { positions: Float32Array.from(pos), normals: Float32Array.from(nrm) };
}

/** The height map of a placed model: every mesh's triangles in world coordinates, rasterised. */
export function islandHeightField(model: THREE.Object3D): HeightField {
  model.updateMatrixWorld(true);
  const points: number[] = [];
  const v = new THREE.Vector3();
  model.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const pos = mesh.geometry.getAttribute('position');
    const index = mesh.geometry.getIndex();
    const count = index ? index.count : pos.count;
    for (let k = 0; k < count; k++) {
      v.fromBufferAttribute(pos, index ? index.getX(k) : k).applyMatrix4(mesh.matrixWorld);
      points.push(v.x, v.y, v.z);
    }
  });
  return buildHeightField(points, ISLAND_GROUND_CELL);
}

/**
 * Soft normals everywhere (the owner's ask: no hard edges). Vertices that share a position share one
 * normal, the area-weighted average of every face around them, whatever their texture coordinates, so
 * neither the mesh's creases nor its texture seams show as edges in the light.
 */
export function softenNormals(geometry: THREE.BufferGeometry): void {
  const pos = geometry.getAttribute('position');
  const index = geometry.getIndex();
  const count = index ? index.count : pos.count;
  const vertexAt = (k: number) => (index ? index.getX(k) : k);
  // Weld by position (quantised finely enough to merge exact copies, never neighbours).
  const keyOf = (i: number) => `${Math.round(pos.getX(i) * 1e6)},${Math.round(pos.getY(i) * 1e6)},${Math.round(pos.getZ(i) * 1e6)}`;
  const slot = new Map<string, number>();
  const weld = new Int32Array(pos.count);
  for (let i = 0; i < pos.count; i++) {
    const key = keyOf(i);
    let s = slot.get(key);
    if (s === undefined) { s = slot.size; slot.set(key, s); }
    weld[i] = s;
  }
  const sum = new Float64Array(slot.size * 3);
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), n = new THREE.Vector3();
  for (let k = 0; k + 2 < count; k += 3) {
    const i0 = vertexAt(k), i1 = vertexAt(k + 1), i2 = vertexAt(k + 2);
    a.fromBufferAttribute(pos, i0); b.fromBufferAttribute(pos, i1); c.fromBufferAttribute(pos, i2);
    // The cross product's length is twice the face's area: larger faces weigh more.
    n.subVectors(c, b).cross(a.clone().sub(b));
    for (const i of [i0, i1, i2]) { const s = weld[i] * 3; sum[s] += n.x; sum[s + 1] += n.y; sum[s + 2] += n.z; }
  }
  const normals = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const s = weld[i] * 3;
    n.set(sum[s], sum[s + 1], sum[s + 2]).normalize();
    normals[i * 3] = n.x; normals[i * 3 + 1] = n.y; normals[i * 3 + 2] = n.z;
  }
  geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
}

/** Readies a loaded model: soft normals on every mesh, then placed as the game places it. */
export function prepareIslandModel(model: THREE.Object3D): void {
  model.traverse((o) => { const mesh = o as THREE.Mesh; if (mesh.isMesh) softenNormals(mesh.geometry); });
  placeIslandModel(model);
}

/** Places the model as the game does: scaled, its lowest point on the sand base. */
export function placeIslandModel(model: THREE.Object3D): void {
  model.scale.setScalar(ISLAND_SCALE * MODEL_TO_ROUTE);
  model.position.y = ISLAND_BASE_Y - ISLAND_MODEL_FLOOR * ISLAND_SCALE;
}

export const ISLAND_MODEL_URL = '/models/island/serpentine-isle.obj';
export const ISLAND_TEXTURE_URL = '/models/island/serpentine-isle.jpg';
/** The 8K texture (the owner's 8K texture, baked onto the optimised model's UVs by scripts/bake-island-texture.ts), for the Quality setting on cards that take 8K textures. */
export const ISLAND_TEXTURE_8K_URL = '/models/island/serpentine-isle-8k.jpg';

/** The sand base: flat under the island out to BEACH_FLAT, then shelving under the sea by BEACH_EDGE. */
const BEACH_FLAT = 58000;
const BEACH_EDGE = 74000;
const BEACH_TOP = ISLAND_BASE_Y - 15;
const BEACH_DEEP = -1100;

const smooth = (a: number, b: number, x: number) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** The sand base's height at (x, z): flat, then an irregular shelf into the sea. */
export function beachHeight(x: number, z: number): number {
  const a = Math.atan2(x, -z);
  const wobble = 1 + 0.05 * Math.sin(3 * a + 0.7) + 0.035 * Math.sin(7 * a + 2.2) + 0.02 * Math.sin(13 * a + 1.1);
  const r = Math.hypot(x, z) / wobble;
  return BEACH_TOP + (BEACH_DEEP - BEACH_TOP) * smooth(BEACH_FLAT, BEACH_EDGE, r);
}

const DRY_SAND = new THREE.Color('#e9d3a3');
const WET_SAND = new THREE.Color('#b59c73');
const SHALLOWS = new THREE.Color('#8fb3a4');

function buildBeach(): THREE.Mesh {
  const rings = 48, segments = 128;
  const positions: number[] = [];
  const colors: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const c = new THREE.Color();
  const maxR = BEACH_EDGE * 1.12;
  for (let i = 0; i <= rings; i++) {
    // Rings bunch up toward the shelf, where the shape changes.
    const r = maxR * Math.sqrt(i / rings);
    for (let j = 0; j <= segments; j++) {
      const a = (j / segments) * Math.PI * 2;
      const x = r * Math.sin(a), z = -r * Math.cos(a);
      const y = beachHeight(x, z);
      positions.push(x, y, z);
      uvs.push(x / 1800, z / 1800);
      c.copy(SHALLOWS).lerp(WET_SAND, smooth(-500, -20, y)).lerp(DRY_SAND, smooth(0, BEACH_TOP, y));
      // Soft drifts in the sand, so it is not one flat colour.
      const drift = 0.94 + 0.06 * Math.sin(x * 0.00031 + Math.sin(z * 0.00023) * 2) * Math.sin(z * 0.00027 - x * 0.00011);
      c.multiplyScalar(drift);
      colors.push(c.r, c.g, c.b);
    }
  }
  for (let i = 0; i < rings; i++) {
    for (let j = 0; j < segments; j++) {
      const a = i * (segments + 1) + j, b = a + 1, d = a + segments + 1, e = d + 1;
      // Counter-clockwise seen from above, so the sand faces up.
      indices.push(a, b, d, b, e, d);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 }));
  mesh.name = 'Beach';
  return mesh;
}

/** A sky dome that fades from sea haze at the horizon to a clear blue overhead. */
function buildSkyDome(horizon: THREE.Color, zenith: THREE.Color): THREE.Mesh {
  const geo = new THREE.SphereGeometry(190000, 32, 16);
  const colors: number[] = [];
  const pos = geo.getAttribute('position');
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    c.copy(horizon).lerp(zenith, smooth(-0.05, 0.6, pos.getY(i) / 190000));
    colors.push(c.r, c.g, c.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false }));
  mesh.name = 'Island sky';
  mesh.renderOrder = -10;
  return mesh;
}

/** Loads the owner's model, scaled and lifted onto the sand base, into `group`; hands back its height map. */
function loadIsland(group: THREE.Group, onGround: (ground: HeightField) => void, hiRes: boolean): { ready: Promise<void>; ground: IslandGround } {
  const texture = new THREE.TextureLoader().load(hiRes ? ISLAND_TEXTURE_8K_URL : ISLAND_TEXTURE_URL);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  const material = new THREE.MeshStandardMaterial({ map: texture, roughness: 0.95, metalness: 0 });
  // The ground shader: grain and tiny pebbles up close (never repeating), and the painted sand.
  const ground = new IslandGround(material);
  const loaded = loadGround(ground, readIslandTracks().active);
  const model = new OBJLoader().loadAsync(ISLAND_MODEL_URL).then((model) => {
    model.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.material = material;
      mesh.name = 'Island';
    });
    prepareIslandModel(model);
    model.name = 'Serpentine Isle';
    group.add(model);
    const heights = islandHeightField(model);
    onGround(heights);
    // Road auto paint is laid on the terrain only where the road runs on it (never under a bridge).
    ground.setHeightField((x, z) => heights.heightAt(x, z));
    // Island auto paint reads the terrain's slopes, hollows, shore and road.
    ground.setTerrain(islandTriangles(model));
  });
  // The loading bar also waits for the surface tiles and the island's auto paint, so the ground never
  // pops in unpainted.
  const ready = Promise.all([model, loaded]).then(() => ground.whenReady()).then(() => ground.whenAutoPainted());
  return { ready, ground };
}

/**
 * ROUTE-2's closed branches, made visible: a timber barricade across the road just past the split. The
 * course has no forks yet, so this draws nothing until the owner's platform tracks add some.
 */
export function buildClosedGates(layout: RouteLayout | null, M: Pick<IslandMaterials, 'wood'>): THREE.Group {
  const group = new THREE.Group();
  group.name = 'Closed branches';
  if (!layout) return group;
  const beam = new THREE.BoxGeometry(1, 1, 1);
  for (const section of ISLAND_ROUTE_GRAPH.sections) {
    const open = openBranches(section, layout).map((b) => b.id);
    for (const b of section.branches) {
      if (open.includes(b.id)) continue;
      const map = islandBranchSpace(section.id, b.id);
      const f = map.frameAt(map.trackDistFromEngineDistance((section.x0 - 190) / 2) + 1500);
      const gate = new THREE.Group();
      gate.name = `Closed: ${section.id}/${b.id}`;
      gate.position.set(f.pos.x, f.pos.y, f.pos.z);
      gate.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(
        new THREE.Vector3(f.right.x, f.right.y, f.right.z),
        new THREE.Vector3(f.up.x, f.up.y, f.up.z),
        new THREE.Vector3(f.tangent.x, f.tangent.y, f.tangent.z),
      ));
      for (const [x, y, sx, sy] of [[-f.halfWidth + 40, 260, 90, 520], [f.halfWidth - 40, 260, 90, 520], [0, 380, 2 * f.halfWidth, 70], [0, 200, 2 * f.halfWidth, 70]]) {
        const m = new THREE.Mesh(beam, M.wood);
        m.position.set(x, y, 0); m.scale.set(sx, sy, 50);
        gate.add(m);
      }
      group.add(gate);
    }
  }
  return group;
}

/** `hiRes`: use the 8K terrain texture (the Quality setting, on a card that takes 8K textures). */
export function buildIslandWorld(M: IslandMaterials, opts: { hiRes?: boolean } = {}): IslandWorld {
  const group = new THREE.Group();
  group.name = 'Island course';

  let ground: HeightField | null = null;
  const island = loadIsland(group, (g) => { ground = g; }, opts.hiRes === true);
  const ready = island.ready;
  group.add(buildBeach());

  // The sea: round, waves running round the island and closing in, foam at the shore, and a haze band
  // where it meets the sky (island-sea.ts). The shallows over the sand read turquoise.
  const shoreRadius = shoreRadiusOf((r) => BEACH_TOP + (BEACH_DEEP - BEACH_TOP) * smooth(BEACH_FLAT, BEACH_EDGE, r), BEACH_FLAT, BEACH_EDGE);
  const sea = buildIslandSea({ shoreRadius, floorY: BEACH_DEEP - 20, water: M.water });
  group.add(sea.group);

  // Sky and ground fill: the sea haze lights the shadow sides.
  const fill = new THREE.HemisphereLight('#c9dde4', '#7a6248', 1.35);
  fill.name = 'Island fill';
  group.add(fill);

  const skyColor = new THREE.Color('#7d9fb3');
  const fogColor = new THREE.Color('#b9c8c6');
  const sky = buildSkyDome(fogColor, skyColor);
  group.add(sky);
  return { group, skyColor, fogColor, sky, ready, ground: island.ground, groundAt: (x, z) => ground?.heightAt(x, z) ?? null, update: sea.update, setSea: sea.setLook, setHorizon: sea.setHorizon };
}
