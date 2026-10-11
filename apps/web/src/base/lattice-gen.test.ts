import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import * as basekit from '@hm/basekit';
import * as basekit2 from '@hm/basekit2';
import * as basegear from '@hm/basegear';
import type { Kind } from '@hm/structure';
import { LATTICE_GEN_IDS, LATTICE_GEN_HELD, latticeGenAssets, latticeGenId } from './lattice-gen';
import { ensureFloatGeometry } from './piece-meshes';

/**
 * TASK-10b fit test. Each lattice kind's procedural piece (built at stage 6, its own frame: the group before the
 * pivot offset) is measured against its generated GLB (the low level, which ships inlined). Every axis must match
 * within 2% of the procedural extent. The kinds that miss are the held list, and the held list must be exactly the
 * kinds that miss.
 */

const GEN_DIR = new URL('../assets/gen/', import.meta.url);
const TOLERANCE = 0.02;
const STAGE = 6;

const bkm = basekit.createMaterials();
const bgm = basegear.createMaterials();

type Built = { group: THREE.Group; lamps: THREE.Mesh[] };

const procedural: Partial<Record<Kind, () => Built>> = {
  foundation: () => basekit.foundation(bkm, { stage: STAGE, skirt: 1 }),
  wall: () => basekit.wall(bkm, { stage: STAGE }),
  pillar: () => basekit.pillar(bkm, { stage: STAGE }),
  floor: () => basekit.floor(bkm, { stage: STAGE }),
  ramp: () => basekit.ramp(bkm, { stage: STAGE }),
  stairs: () => basekit2.stairs(bkm, { stage: STAGE }),
  airlock: () => basekit.airlock(bkm, { stage: STAGE }),
  hardpoint: () => basegear.hardpoint(bgm, { stage: STAGE }),
  roof: () => basekit.pitchedRoof(bkm, { stage: STAGE }),
  lowRoof: () => basekit.lowRoof(bkm, { stage: STAGE }),
  roofOuter: () => basekit.roofOuterCorner(bkm, { stage: STAGE }),
  roofInner: () => basekit.roofInnerCorner(bkm, { stage: STAGE }),
  ridgeCap: () => basekit.ridgeCap(bkm, { stage: STAGE }),
  gable: () => basekit.gable(bkm, { stage: STAGE }),
  halfWall: () => basekit2.halfWall(bkm, { stage: STAGE }),
  windowWall: () => basekit2.windowWall(bkm, { stage: STAGE }),
  doorframe: () => basekit2.doorframe(bkm, { stage: STAGE }),
  door: () => basekit2.door(bkm, { stage: STAGE }),
};

// three's FileLoader reports progress with ProgressEvent, which node lacks (the HD pack loads through it).
if (typeof globalThis.ProgressEvent === 'undefined') {
  globalThis.ProgressEvent = class extends Event {
    constructor(type: string, init: Record<string, unknown> = {}) {
      super(type);
      Object.assign(this, init);
    }
  } as unknown as typeof ProgressEvent;
}

const HD_DIR = new URL('../../public/hd/', import.meta.url);

const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
// The GLBs carry WebP colour and normal maps. Node cannot decode images, and this test measures geometry only.
loader.register(() => ({ name: 'EXT_texture_webp', loadTexture: () => Promise.resolve(new THREE.Texture()) }));

async function loadGlb(id: string): Promise<THREE.Group> {
  const buf = readFileSync(new URL(`${id}.glb`, GEN_DIR));
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
  const gltf = await new Promise<GLTF>((resolve, reject) => loader.parse(ab, '', resolve, reject));
  return gltf.scene;
}

/** The mid or high HD level (public/hd/<id>/<level>.gltf), with its external buffers and images inlined as data URIs. */
async function loadHd(id: string, level: 'mid' | 'high'): Promise<THREE.Group> {
  const dir = new URL(`${id}/`, HD_DIR);
  const json = JSON.parse(readFileSync(new URL(`${level}.gltf`, dir), 'utf8')) as {
    buffers?: { uri?: string }[];
    images?: { uri?: string }[];
  };
  const inline = (uri: string, type: string): string =>
    `data:${type};base64,${readFileSync(new URL(uri, dir)).toString('base64')}`;
  for (const b of json.buffers ?? []) if (b.uri && !b.uri.startsWith('data:')) b.uri = inline(b.uri, 'application/octet-stream');
  for (const im of json.images ?? []) if (im.uri && !im.uri.startsWith('data:')) im.uri = inline(im.uri, 'image/webp');
  const gltf = await new Promise<GLTF>((resolve, reject) => loader.parse(JSON.stringify(json), '', resolve, reject));
  return gltf.scene;
}

/**
 * Bounding box of meshes in a frame. `toFloat` reads the geometry the way the batcher does (ensureFloatGeometry),
 * so a normalized Int16 position is measured after it is read back, not as a raw integer.
 */
function boxOf(meshes: readonly THREE.Mesh[], frame: THREE.Matrix4, toFloat: boolean): THREE.Box3 {
  const out = new THREE.Box3();
  for (const m of meshes) {
    const geom = toFloat ? ensureFloatGeometry(m.geometry) : m.geometry;
    geom.computeBoundingBox();
    const local = geom.boundingBox!.clone();
    out.union(local.applyMatrix4(m.matrixWorld.clone().premultiply(frame)));
  }
  return out;
}

function meshesIn(root: THREE.Object3D, skip: readonly THREE.Object3D[] = []): THREE.Mesh[] {
  const list: THREE.Mesh[] = [];
  root.traverse((o) => {
    if (o instanceof THREE.Mesh && !skip.includes(o)) list.push(o);
  });
  return list;
}

interface Fit {
  kind: Kind;
  id: string;
  proc: THREE.Box3;
  gen: THREE.Box3;
  worst: number; // largest per-axis deviation, as a share of the procedural extent
  axis: 'x' | 'y' | 'z';
  pass: boolean;
}

function measure(kind: Kind, id: string, proc: THREE.Box3, genBox: THREE.Box3): Fit {
  const axes = ['x', 'y', 'z'] as const;
  let worst = 0;
  let worstAxis: 'x' | 'y' | 'z' = 'x';
  for (const a of axes) {
    const extent = proc.max[a] - proc.min[a];
    const dev = Math.max(Math.abs(genBox.min[a] - proc.min[a]), Math.abs(genBox.max[a] - proc.max[a]));
    const share = extent > 0 ? dev / extent : dev;
    if (share > worst) {
      worst = share;
      worstAxis = a;
    }
  }
  return { kind, id, proc, gen: genBox, worst, axis: worstAxis, pass: worst <= TOLERANCE };
}

const fmt = (v: THREE.Vector3): string => v.toArray().map((n) => n.toFixed(3)).join(',');

test('every lattice kind has a procedural builder and a packed GLB', () => {
  for (const kind of Object.keys(LATTICE_GEN_IDS) as Kind[]) {
    assert.ok(procedural[kind], `${kind} has a procedural builder for the fit test`);
    const id = LATTICE_GEN_IDS[kind]!;
    assert.ok(readFileSync(new URL(`${id}.glb`, GEN_DIR)).length > 0, `${id}.glb is packed`);
  }
});

test('lattice GLBs match their procedural boxes within 2%; the held list is exactly the misses', async () => {
  const fits: Fit[] = [];

  for (const kind of Object.keys(LATTICE_GEN_IDS) as Kind[]) {
    const id = LATTICE_GEN_IDS[kind]!;
    const built = procedural[kind]!();
    built.group.updateMatrixWorld(true);

    // The procedural piece's visible box, in the piece's own frame: no lamps, and the door measured in its leaf frame.
    let procBox: THREE.Box3;
    if (kind === 'door') {
      const leaf = built.group.getObjectByName('door-leaf')!;
      leaf.updateMatrixWorld(true);
      const inv = leaf.matrixWorld.clone().invert();
      procBox = boxOf(meshesIn(leaf), inv, false);
    } else {
      procBox = boxOf(meshesIn(built.group, built.lamps), new THREE.Matrix4(), false);
    }

    const gen = await loadGlb(id);
    gen.updateMatrixWorld(true);
    const genMeshes = meshesIn(gen);
    const genBox = boxOf(genMeshes, new THREE.Matrix4(), true);
    const fit = measure(kind, id, procBox, genBox);
    fits.push(fit);

    const extent = procBox.getSize(new THREE.Vector3());
    console.log(
      `[fit] ${kind.padEnd(10)} ${id.padEnd(20)} proc ${fmt(procBox.min)} | ${fmt(procBox.max)}`
      + `  gen ${fmt(genBox.min)} | ${fmt(genBox.max)}`
      + `  worst ${(fit.worst * 100).toFixed(2)}% on ${fit.axis} (extent ${extent.toArray().map((n) => n.toFixed(3)).join(' x ')})`
      + `  ${fit.pass ? 'PASS' : 'MISS'}`,
    );
  }

  const misses = fits.filter((f) => !f.pass).map((f) => f.kind).sort();
  const held = [...LATTICE_GEN_HELD].sort();
  assert.deepEqual(misses, held, `kinds that miss the 2% fit must equal LATTICE_GEN_HELD (misses: ${misses.join(', ')})`);

  // Stage 3 and up render the mid and high HD levels. Every kind that is not held must fit at both of them too.
  const hdMisses: string[] = [];
  for (const fit of fits.filter((f) => !LATTICE_GEN_HELD.includes(f.kind))) {
    for (const level of ['mid', 'high'] as const) {
      const hd = await loadHd(fit.id, level);
      hd.updateMatrixWorld(true);
      const hdFit = measure(fit.kind, fit.id, fit.proc, boxOf(meshesIn(hd), new THREE.Matrix4(), true));
      console.log(`[fit-hd] ${fit.kind.padEnd(10)} ${level.padEnd(5)} worst ${(hdFit.worst * 100).toFixed(2)}% on ${hdFit.axis}  ${hdFit.pass ? 'PASS' : 'MISS'}`);
      if (!hdFit.pass) hdMisses.push(`${fit.kind} ${level} ${(hdFit.worst * 100).toFixed(2)}% on ${hdFit.axis}`);
    }
  }
  assert.deepEqual(hdMisses, [], 'mid and high HD levels fit the procedural box');
});

test('the batched geometry conversion keeps the generated box (normalized Int16 positions and normals)', async () => {
  for (const id of latticeGenAssets()) {
    const gen = await loadGlb(id);
    gen.updateMatrixWorld(true);
    const mesh = meshesIn(gen)[0]!;
    const pos = mesh.geometry.getAttribute('position') as THREE.BufferAttribute;
    assert.ok(pos.normalized, `${id}: position is a normalized quantized attribute (the path this guards)`);

    const raw = boxOf([mesh], new THREE.Matrix4(), false);
    const batched = boxOf([mesh], new THREE.Matrix4(), true);
    for (const a of ['x', 'y', 'z'] as const) {
      assert.ok(Math.abs(raw.min[a] - batched.min[a]) < 1e-4, `${id} min.${a} ${raw.min[a]} vs ${batched.min[a]}`);
      assert.ok(Math.abs(raw.max[a] - batched.max[a]) < 1e-4, `${id} max.${a} ${raw.max[a]} vs ${batched.max[a]}`);
    }
    assert.ok(batched.getSize(new THREE.Vector3()).length() < 50, `${id}: batched geometry is metres, not raw integers`);
  }
});

test('lattice mapping: foundations keep the procedural mesh when their skirt is deeper than the fitted 1 m', () => {
  assert.equal(latticeGenId('foundation', 0), 'foundation');
  assert.equal(latticeGenId('foundation', 1), 'foundation');
  assert.equal(latticeGenId('foundation', 1.25), null);
  assert.equal(latticeGenId('wall'), 'wall');
  assert.equal(latticeGenId('roofOuter'), 'roof-corner-outer');
  assert.equal(latticeGenId('ramp'), null, 'held kinds stay procedural');
  assert.equal(latticeGenId('bin'), null, 'fixtures keep their own generated path');
  const assets = latticeGenAssets();
  assert.ok(assets.includes('roof-corner-inner') && assets.includes('stairs'), 'every active lattice id is preloaded');
  assert.ok(!assets.includes('door-leaf') && !assets.includes('ramp'), 'held ids are not preloaded');
});
