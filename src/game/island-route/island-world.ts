/**
 * ISLAND-ROUTE: Basalt Isle as the renderer draws it. The roads (the main road and every other branch's
 * road inside its fork), the tunnels through the mountain, timber trestles wherever a road flies above
 * the ground, the ground itself carved round the roads, the sea, the crater's lava lake and a sea-haze
 * sky. The terrain body is a stand-in until ISLAND-TERRAIN lands; the carving is the route's own.
 */
import * as THREE from 'three';
import type { TrackSpaceMap, TrackFrameData, TrackStageId } from '../track-space';
import { ISLAND_ANCHORS, ISLAND_ROUTE_GRAPH } from './basalt-route';
import { polar } from './geometry';
import {
  RoadIndex, carvedHeight, markBridges, naturalHeight, roadSamples, type GroundBump,
} from './island-ground';
import { islandBranchRoads, islandBranchSpace, islandTrackSpace } from './island-space';
import { openBranches, type RouteLayout } from '../sim/route';

export interface IslandMaterials {
  dirt: THREE.MeshStandardMaterial;
  cliff: THREE.MeshStandardMaterial;
  cave: THREE.MeshStandardMaterial;
  wood: THREE.MeshStandardMaterial;
  cobble: THREE.MeshStandardMaterial;
  caveRock: THREE.MeshStandardMaterial;
  water: THREE.MeshStandardMaterial;
  lava: THREE.MeshStandardMaterial;
}

export interface IslandWorld {
  readonly group: THREE.Group;
  /** The carved ground height at (x, z). */
  readonly groundAt: (x: number, z: number) => number;
  readonly skyColor: THREE.Color;
  readonly fogColor: THREE.Color;
  /** The sky dome; the renderer keeps it centred on the camera. */
  readonly sky: THREE.Mesh;
}

/** The island's extent (the heightfield) and the sea's. */
const GROUND_HALF = 38000;
const SEA_HALF = 160000;

/** The summit crag the shack sits on, and the basalt massif the Drain spirals down into. */
function islandBumps(): GroundBump[] {
  const start = polar(ISLAND_ANCHORS[0].at);
  const drain = polar({ theta: 700, r: 27800, y: 0 });
  return [
    { x: start.x, z: start.z, height: 2300, radius: 3200 },
    { x: drain.x, z: drain.z, height: 2600, radius: 4200 },
  ];
}

const surfaceFor = (stage: TrackStageId, M: IslandMaterials) =>
  stage === 'cavern' || stage === 'breakthrough' ? M.cave
    : stage === 'mine' ? M.wood
      : stage === 'stadium' ? M.cobble
        : M.dirt;

/** A road slab across [from, to] on a map: top, lips and a thick edge, so it never reads as paper. */
function roadMesh(rows: readonly TrackFrameData[], material: THREE.Material, texScale = 480): THREE.Mesh {
  // (side, offset, height) across the road, left to right.
  const profile: [number, number, number][] = [
    [-1, -40, -150], [-1, -40, 18], [-1, -8, 18], [-1, 0, 0], [1, 0, 0], [1, 8, 18], [1, 40, 18], [1, 40, -150],
  ];
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  for (const s of rows) {
    let u = 0;
    profile.forEach(([side, offset, height], c) => {
      const lateral = side * s.halfWidth + offset;
      positions.push(
        s.pos.x + s.right.x * lateral + s.up.x * height,
        s.pos.y + s.right.y * lateral + s.up.y * height,
        s.pos.z + s.right.z * lateral + s.up.z * height,
      );
      if (c > 0) {
        const [ps, po, ph] = profile[c - 1];
        u += Math.hypot(lateral - (ps * s.halfWidth + po), height - ph);
      }
      uvs.push(u / texScale, s.dist / texScale);
    });
  }
  const cols = profile.length;
  for (let r = 0; r < rows.length - 1; r++) {
    for (let c = 0; c < cols - 1; c++) {
      const a = r * cols + c, b = a + 1, d = a + cols, e = d + 1;
      indices.push(a, b, d, b, e, d);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return new THREE.Mesh(geo, material);
}

/** The road over [from, to] of a map, split into runs of one surface material. */
function buildRoad(map: TrackSpaceMap, from: number, to: number, M: IslandMaterials, group: THREE.Group, branch: boolean) {
  const rows = map.samples.filter((s) => s.dist >= from && s.dist <= to);
  let start = 0;
  for (let i = 1; i <= rows.length; i++) {
    if (i === rows.length || surfaceFor(rows[i].stage, M) !== surfaceFor(rows[start].stage, M)) {
      const run = rows.slice(start, Math.min(i + 1, rows.length));
      if (run.length > 1) {
        let material: THREE.Material = surfaceFor(rows[start].stage, M);
        if (branch) {
          // Where a branch's road still overlaps the main road near its split and merge, it sits behind.
          const m = (material as THREE.MeshStandardMaterial).clone();
          m.polygonOffset = true; m.polygonOffsetFactor = 2; m.polygonOffsetUnits = 2;
          material = m;
        }
        const mesh = roadMesh(run, material);
        mesh.name = 'TrackSurface';
        group.add(mesh);
      }
      start = i;
    }
  }
}

/** An arched tube round the road inside the mountain (the lava tube and the chambers). */
function buildTunnel(rows: readonly TrackFrameData[], material: THREE.Material): THREE.Mesh {
  const arch = 11;
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  for (const s of rows) {
    const w = s.halfWidth + 320;
    for (let k = 0; k <= arch; k++) {
      const a = Math.PI * (k / arch);
      const lateral = Math.cos(a) * w;
      const height = Math.sin(a) * 1300 - 120;
      positions.push(
        s.pos.x + s.right.x * lateral + s.up.x * height,
        s.pos.y + s.right.y * lateral + s.up.y * height,
        s.pos.z + s.right.z * lateral + s.up.z * height,
      );
      uvs.push(k / arch * 4, s.dist / 1400);
    }
  }
  for (let r = 0; r < rows.length - 1; r++) {
    for (let c = 0; c < arch; c++) {
      const a = r * (arch + 1) + c, b = a + 1, d = a + arch + 1, e = d + 1;
      indices.push(a, d, b, b, d, e);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, material);
  mesh.name = 'Cave rock';
  return mesh;
}

/** Timber piers under every stretch of road that flies more than `gap` above the ground. */
function buildTrestles(
  roads: readonly { map: TrackSpaceMap; from: number; to: number }[],
  groundAt: (x: number, z: number) => number,
  material: THREE.Material,
  gap = 420,
  spacing = 900,
): THREE.InstancedMesh {
  const piers: THREE.Matrix4[] = [];
  const q = new THREE.Quaternion();
  for (const { map, from, to } of roads) {
    for (let d = from + spacing / 2; d < to; d += spacing) {
      const f = map.frameAt(d);
      if (f.stage === 'cavern' || f.stage === 'mine' || f.inLoop) continue;
      for (const side of [-1, 1]) {
        const lateral = side * (f.halfWidth - 60);
        const x = f.pos.x + f.right.x * lateral;
        const z = f.pos.z + f.right.z * lateral;
        const top = f.pos.y + f.right.y * lateral - 150;
        const ground = groundAt(x, z);
        const h = top - Math.max(ground, -200);
        if (h < gap) continue;
        const yaw = Math.atan2(f.tangent.x, f.tangent.z);
        q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
        piers.push(new THREE.Matrix4().compose(new THREE.Vector3(x, top - h / 2, z), q, new THREE.Vector3(90, h, 90)));
      }
    }
  }
  const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), material, Math.max(1, piers.length));
  piers.forEach((m, i) => mesh.setMatrixAt(i, m));
  mesh.count = piers.length;
  mesh.name = 'Trestle';
  return mesh;
}

/* Ground colours (multiplied over the dirt texture's grain): sand, wet sand, ochre tops, basalt faces. */
const SAND = new THREE.Color('#e2cfa2');
const WET_SAND = new THREE.Color('#9d8a66');
const OCHRE = new THREE.Color('#c79a5c');
const BASALT = new THREE.Color('#4a423d');
const SEA_FLOOR = new THREE.Color('#6f8f86');

const smooth = (a: number, b: number, x: number) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

function buildGround(groundAt: (x: number, z: number) => number, detail: number, texture: THREE.Texture | null): THREE.Mesh {
  const n = detail;
  const cell = (2 * GROUND_HALF) / n;
  const positions = new Float32Array((n + 1) * (n + 1) * 3);
  const colors = new Float32Array((n + 1) * (n + 1) * 3);
  const uvs = new Float32Array((n + 1) * (n + 1) * 2);
  const H = new Float32Array((n + 1) * (n + 1));
  for (let j = 0; j <= n; j++) {
    for (let i = 0; i <= n; i++) {
      const x = -GROUND_HALF + i * cell, z = -GROUND_HALF + j * cell;
      H[j * (n + 1) + i] = groundAt(x, z);
    }
  }
  const c = new THREE.Color();
  for (let j = 0; j <= n; j++) {
    for (let i = 0; i <= n; i++) {
      const k = j * (n + 1) + i;
      const x = -GROUND_HALF + i * cell, z = -GROUND_HALF + j * cell;
      const h = H[k];
      positions.set([x, h, z], k * 3);
      uvs.set([x / 1600, z / 1600], k * 2);
      const hx = H[j * (n + 1) + Math.min(n, i + 1)] - H[j * (n + 1) + Math.max(0, i - 1)];
      const hz = H[Math.min(n, j + 1) * (n + 1) + i] - H[Math.max(0, j - 1) * (n + 1) + i];
      const slope = Math.hypot(hx, hz) / (2 * cell);
      // Height bands first (sea floor → wet sand → sand → ochre), then steep faces turn to basalt.
      c.copy(SEA_FLOOR).lerp(WET_SAND, smooth(-500, -40, h));
      c.lerp(SAND, smooth(-10, 90, h));
      c.lerp(OCHRE, smooth(260, 900, h));
      c.lerp(BASALT, smooth(0.55, 1.1, slope) * smooth(60, 400, h));
      colors.set([c.r, c.g, c.b], k * 3);
    }
  }
  const indices: number[] = [];
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const a = j * (n + 1) + i, b = a + 1, d = a + n + 1, e = d + 1;
      indices.push(a, d, b, b, d, e);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  const material = new THREE.MeshStandardMaterial({ map: texture, vertexColors: true, roughness: 0.97, metalness: 0 });
  const mesh = new THREE.Mesh(geo, material);
  mesh.name = 'Terrain';
  return mesh;
}

/** A sky dome that fades from sea haze at the horizon to a clear blue overhead. */
function buildSkyDome(horizon: THREE.Color, zenith: THREE.Color): THREE.Mesh {
  const geo = new THREE.SphereGeometry(190000, 32, 16);
  const colors: number[] = [];
  const pos = geo.getAttribute('position');
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const t = smooth(-0.05, 0.6, pos.getY(i) / 190000);
    c.copy(horizon).lerp(zenith, t);
    colors.push(c.r, c.g, c.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false }));
  mesh.name = 'Island sky';
  mesh.renderOrder = -10;
  return mesh;
}

/**
 * ROUTE-2's closed branches, made visible: a timber barricade across the road just past the split, and a
 * rockfall piled against it, so a player reads which roads are shut this race.
 */
export function buildClosedGates(layout: RouteLayout | null, M: IslandMaterials): THREE.Group {
  const group = new THREE.Group();
  group.name = 'Closed branches';
  if (!layout) return group;
  const beam = new THREE.BoxGeometry(1, 1, 1);
  const rock = new THREE.DodecahedronGeometry(1, 0);
  const rockMaterial = new THREE.MeshStandardMaterial({ color: '#4a423d', roughness: 1, flatShading: true });
  for (const section of ISLAND_ROUTE_GRAPH.sections) {
    const open = openBranches(section, layout).map((b) => b.id);
    for (const b of section.branches) {
      if (open.includes(b.id)) continue;
      const map = islandBranchSpace(section.id, b.id);
      const f = map.frameAt(map.distOf(`${section.id}:split`) + 1500);
      const basis = new THREE.Matrix4().makeBasis(
        new THREE.Vector3(f.right.x, f.right.y, f.right.z),
        new THREE.Vector3(f.up.x, f.up.y, f.up.z),
        new THREE.Vector3(f.tangent.x, f.tangent.y, f.tangent.z),
      );
      const gate = new THREE.Group();
      gate.name = `Closed: ${section.id}/${b.id}`;
      gate.position.set(f.pos.x, f.pos.y, f.pos.z);
      gate.quaternion.setFromRotationMatrix(basis);
      const add = (geo: THREE.BufferGeometry, material: THREE.Material, x: number, y: number, z: number, sx: number, sy: number, sz: number, rz = 0) => {
        const m = new THREE.Mesh(geo, material);
        m.position.set(x, y, z); m.scale.set(sx, sy, sz); m.rotation.z = rz;
        gate.add(m);
      };
      const w = f.halfWidth;
      // Two posts and three planks, one crooked.
      add(beam, M.wood, -w + 40, 260, 0, 90, 520, 90);
      add(beam, M.wood, w - 40, 260, 0, 90, 520, 90);
      add(beam, M.wood, 0, 380, 0, 2 * w, 70, 50);
      add(beam, M.wood, 0, 240, 0, 2 * w, 70, 50, 0.06);
      add(beam, M.wood, 0, 110, 0, 2 * w, 70, 50, -0.04);
      // The rockfall piled against it, irregular like nature.
      for (let i = 0; i < 9; i++) {
        const t = (i / 8) * 2 - 1;
        const r = 140 + ((i * 53) % 90);
        add(rock, rockMaterial, t * w * 0.9, r * 0.55, 180 + ((i * 37) % 120), r, r * 0.8, r);
      }
      group.add(gate);
    }
  }
  return group;
}

export function buildIslandWorld(M: IslandMaterials, opts: { performance?: boolean } = {}): IslandWorld {
  const group = new THREE.Group();
  group.name = 'Basalt Isle';
  const main = islandTrackSpace();
  const branches = islandBranchRoads();
  const roads = [{ map: main, from: 0, to: main.length }, ...branches.map(({ map, from, to }) => ({ map, from, to }))];

  // The ground, carved round every road.
  const index = new RoadIndex(roadSamples(roads, 2));
  markBridges(index);
  const bumps = islandBumps();
  const groundAt = (x: number, z: number) => carvedHeight(x, z, naturalHeight(x, z, bumps), index);
  // Rock grain on the ground (the road keeps the dirt), so the road reads as a road.
  group.add(buildGround(groundAt, opts.performance ? 190 : 300, M.cliff.map));

  // The roads, the tunnels and the trestles.
  buildRoad(main, 0, main.length, M, group, false);
  for (const b of branches) buildRoad(b.map, b.from, b.to, M, group, true);
  for (const { map, from, to } of roads) {
    const inside = map.samples.filter((s) => s.dist >= from && s.dist <= to && (s.stage === 'cavern' || s.stage === 'mine'));
    if (inside.length > 1) group.add(buildTunnel(inside, M.caveRock));
  }
  group.add(buildTrestles(roads, groundAt, M.wood));

  // The sea: a sheet at sea level over the sea floor, so the shallows read turquoise.
  const water = M.water.clone();
  if (water.map) {
    water.map = water.map.clone();
    water.map.repeat.set(SEA_HALF / 2400, SEA_HALF / 2400);
    water.map.needsUpdate = true;
  }
  water.color = new THREE.Color('#6fc2c0');
  water.opacity = 0.8;
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(2 * SEA_HALF, 2 * SEA_HALF), water);
  sea.rotation.x = -Math.PI / 2;
  sea.position.y = 0;
  sea.name = 'Sea';
  sea.renderOrder = 1;
  group.add(sea);

  // The sea floor goes on past the island's heightfield, so its edge never shows through the water.
  // Same rock grain and tiling as the ground (SEA_HALF / 1600 is a whole number of tiles), so they meet unseen.
  const floorMap = M.cliff.map ? M.cliff.map.clone() : null;
  if (floorMap) { floorMap.repeat.set((2 * SEA_HALF) / 1600, (2 * SEA_HALF) / 1600); floorMap.needsUpdate = true; }
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(2 * SEA_HALF, 2 * SEA_HALF),
    new THREE.MeshStandardMaterial({ color: SEA_FLOOR, map: floorMap, roughness: 1 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -2210;
  floor.name = 'Sea floor';
  group.add(floor);

  // The lava lake in the crater.
  const lava = new THREE.Mesh(new THREE.CircleGeometry(2200, 48), M.lava);
  lava.rotation.x = -Math.PI / 2;
  lava.position.y = 17640;
  lava.name = 'Lava lake';
  group.add(lava);

  const skyColor = new THREE.Color('#7d9fb3');
  const fogColor = new THREE.Color('#b9c8c6');
  const sky = buildSkyDome(fogColor, skyColor);
  group.add(sky);
  return { group, groundAt, skyColor, fogColor, sky };
}
