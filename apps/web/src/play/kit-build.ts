/**
 * Builds a @hm/kitspec preset into three.js meshes (plan 38): every placed part is baked into its preset frame and
 * merged with the others that share its material and rank window, so a preset is a handful of meshes and a rank change
 * only flips visibility. Box parts are built here; generated parts are cloned from their loaded model (every mesh in it,
 * with its own material); Shape Press parts come from @hm/partgen, one variant per rank they can show at (a beam is a
 * solid bar at rank 0 and a bevelled tube at rank 2), each slot with its own material. Mirrored copies get their winding
 * flipped. Every vertex carries its placed part's index (`partId`), so a hit names the part (the beam's Apply).
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { flatten, type DetailRank, type Kit, type Overrides, type PlacedPart } from '@hm/kitspec';
import { buildPart, type Rank } from '@hm/partgen';
import { applyOps } from './part-cartridge';

export interface KitBuild {
  readonly group: THREE.Group;
  /** Every placed part, in flatten order; `partId` indexes this list. */
  readonly placed: readonly PlacedPart[];
  /** Shows what the rank cap draws (and hides the rest). */
  setMaxRank(rank: DetailRank): void;
  /** Draw calls this build makes at `rank` (one per visible mesh). */
  calls(rank: DetailRank): number;
  /** The placed part a ray hit, from the hit mesh and its face index; null when the mesh is not this build's. */
  partAt(mesh: THREE.Object3D, faceIndex: number): PlacedPart | null;
}

export interface KitBuildOptions {
  /** Materials by name, for box parts, partgen slots and the `material` of a param part. */
  readonly materials: Readonly<Record<string, THREE.Material>>;
  /** A generated asset's loaded model (standing on its base centre), or null while it is not loaded yet. */
  readonly gen: (asset: string) => THREE.Object3D | null;
  readonly maxRank: DetailRank;
  /** Per-path changes (the beam's Apply with a part cartridge). */
  readonly overrides?: Overrides;
  /** Registers what the build creates, for disposal with its owner. */
  readonly keep?: <T extends { dispose(): void }>(x: T) => T;
  /** A material the record does not hold, by name (a Texture Mill skin, `vault:<preset>`), or null. */
  readonly resolveMaterial?: (name: string) => THREE.Material | null;
  /**
   * What a material reads from its geometry (a layered material's edge lines and flattened colours), in two steps around
   * the part's placement. Placements are rigid (moves, turns, mirrors), so `local` may cache by `key`, which names the
   * part's own shape (a generator with its sliders, rank, operators and slot; a box's size): twenty identical bolts cost
   * one. `placed` sees the geometry where it stands (its height above the foot, its facing). Each returns the geometry to
   * go on with. Absent: geometry as built.
   */
  readonly layering?: {
    readonly local: (g: THREE.BufferGeometry, material: THREE.Material, key: string) => THREE.BufferGeometry;
    readonly placed: (g: THREE.BufferGeometry, material: THREE.Material) => THREE.BufferGeometry;
  };
}

/**
 * A box's face UVs in metres (one tile per metre, as the Shape Press parts' box projection), so a skin's texture keeps
 * its scale on a long skid and a small cap alike. BoxGeometry's faces run +x, -x, +y, -y, +z, -z, four vertices each.
 */
const metricBoxUvs = (g: THREE.BufferGeometry, x: number, y: number, z: number): void => {
  const uv = g.getAttribute('uv') as THREE.BufferAttribute;
  const span: readonly (readonly [number, number])[] = [[z, y], [z, y], [x, z], [x, z], [x, y], [x, y]];
  for (let face = 0; face < 6; face++) {
    const [su, sv] = span[face]!;
    for (let k = 0; k < 4; k++) {
      const i = face * 4 + k;
      uv.setXY(i, uv.getX(i) * su, uv.getY(i) * sv);
    }
  }
  uv.needsUpdate = true;
};

const flipWinding = (g: THREE.BufferGeometry): void => {
  const index = g.getIndex();
  if (index) {
    const a = index.array;
    for (let i = 0; i + 2 < a.length; i += 3) {
      const t = a[i + 1] as number;
      a[i + 1] = a[i + 2] as number;
      a[i + 2] = t;
    }
    index.needsUpdate = true;
    return;
  }
  for (const name of Object.keys(g.attributes)) {
    const attr = g.getAttribute(name) as THREE.BufferAttribute;
    const n = attr.itemSize;
    const arr = attr.array;
    for (let v = 0; v + 2 < attr.count; v += 3) {
      for (let k = 0; k < n; k++) {
        const i1 = (v + 1) * n + k, i2 = (v + 2) * n + k;
        const t = arr[i1] as number;
        arr[i1] = arr[i2] as number;
        arr[i2] = t;
      }
    }
    attr.needsUpdate = true;
  }
};

/**
 * Packed models are meshopt-quantised (normalised Int16 positions under a compensating node scale), and baking a
 * transform into a normalised attribute would clamp it to [-1, 1]: every attribute goes to plain Float32 first.
 */
const toFloat = (g: THREE.BufferGeometry): void => {
  for (const name of Object.keys(g.attributes)) {
    const attr = g.getAttribute(name) as THREE.BufferAttribute;
    if (attr.array instanceof Float32Array && !attr.normalized && !(attr as unknown as THREE.InterleavedBufferAttribute).isInterleavedBufferAttribute) continue;
    const n = attr.itemSize;
    const out = new Float32Array(attr.count * n);
    for (let i = 0; i < attr.count; i++) for (let k = 0; k < n; k++) out[i * n + k] = attr.getComponent(i, k);
    g.setAttribute(name, new THREE.BufferAttribute(out, n));
  }
};

/** Only the attributes every geometry in a merge shares survive, so boxes and differently exported meshes still merge. */
const commonAttributes = (geos: readonly THREE.BufferGeometry[]): void => {
  const names = Object.keys((geos[0] as THREE.BufferGeometry).attributes).filter((n) => geos.every((g) => g.getAttribute(n) !== undefined));
  for (const g of geos) {
    for (const n of Object.keys(g.attributes)) if (!names.includes(n)) g.deleteAttribute(n);
    if (!g.getIndex()) {
      const count = (g.getAttribute('position') as THREE.BufferAttribute).count;
      g.setIndex([...Array(count).keys()]);
    }
  }
};

const tagPart = (g: THREE.BufferGeometry, id: number): void => {
  const count = (g.getAttribute('position') as THREE.BufferAttribute).count;
  g.setAttribute('partId', new THREE.BufferAttribute(new Float32Array(count).fill(id), 1));
};

interface Bucket {
  readonly material: THREE.Material;
  /** Visible while lo <= rank cap <= hi. */
  readonly lo: number;
  readonly hi: number;
  readonly geos: THREE.BufferGeometry[];
}

/**
 * The preset as merged meshes, or null while a generated part's model is not loaded (call again once it is). Mesh names
 * are `kit:<material>|<lo>-<hi>`; `userData.lo` and `userData.hi` hold each mesh's rank window.
 */
export function buildKitPreset(kit: Kit, preset: string, o: KitBuildOptions): KitBuild | null {
  const placed = flatten(kit, preset, o.overrides);
  const materialOf = (name: string): THREE.Material | null => o.materials[name] ?? o.resolveMaterial?.(name) ?? null;
  const buckets = new Map<string, Bucket>();
  const add = (material: THREE.Material, lo: number, hi: number, key: string, g: THREE.BufferGeometry): void => {
    const k = `${key}|${lo}-${hi}`;
    let b = buckets.get(k);
    if (!b) buckets.set(k, (b = { material, lo, hi, geos: [] }));
    b.geos.push(g);
  };
  const m4 = new THREE.Matrix4();

  for (let pid = 0; pid < placed.length; pid++) {
    const p = placed[pid] as PlacedPart;
    const src = p.source;
    m4.fromArray(p.matrix as number[]);
    const finish = (g: THREE.BufferGeometry, material: THREE.Material, key: string): THREE.BufferGeometry => {
      const local = o.layering ? o.layering.local(g, material, key) : g;
      local.applyMatrix4(m4);
      if (p.mirrored) flipWinding(local);
      const ready = o.layering ? o.layering.placed(local, material) : local;
      tagPart(ready, pid);
      return ready;
    };
    if (src.kind === 'box') {
      const material = materialOf(p.material);
      if (!material) continue;
      const [x, y, z] = src.size;
      const g = new THREE.BoxGeometry(x, y, z);
      metricBoxUvs(g, x, y, z);
      g.translate(0, y / 2, 0);
      add(material, p.rank, 2, p.material, finish(g, material, `box:${x},${y},${z}`));
    } else if (src.kind === 'param') {
      // one variant per rank this part can show at: the generator's own detail follows the cap
      for (let gr = p.rank; gr <= 2; gr++) {
        const base = buildPart(src.gen, src.params, gr as Rank);
        if (!base) break;
        const md = applyOps(base, src.ops);
        for (const slot of md.slots) {
          const matName = p.slotMaterials?.[slot.name] ?? p.material;
          const material = materialOf(matName);
          if (!material || slot.count === 0) continue;
          const g = new THREE.BufferGeometry();
          g.setAttribute('position', new THREE.BufferAttribute(md.positions.slice(), 3));
          g.setAttribute('normal', new THREE.BufferAttribute(md.normals.slice(), 3));
          g.setAttribute('uv', new THREE.BufferAttribute(md.uvs.slice(), 2));
          g.setIndex(new THREE.BufferAttribute(md.indices.slice(slot.start, slot.start + slot.count), 1));
          const key = `param:${src.gen}|${JSON.stringify(src.params)}|${JSON.stringify(src.ops ?? [])}|${gr}|${slot.name}`;
          add(material, gr, gr === 2 ? 2 : gr, matName, finish(g, material, key));
        }
      }
    } else {
      const model = o.gen(src.asset);
      if (!model) return null;
      const asset = src.asset;
      model.updateMatrixWorld(true);
      const rootInv = new THREE.Matrix4().copy(model.matrixWorld).invert();
      model.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (!mesh.isMesh || Array.isArray(mesh.material)) return;
        const g = mesh.geometry.clone();
        toFloat(g);
        g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(rootInv, mesh.matrixWorld));
        add(mesh.material, p.rank, 2, `gen:${asset}:${mesh.material.uuid}`, finish(g, mesh.material, `gen:${asset}:${mesh.uuid}`));
      });
    }
  }

  const group = new THREE.Group();
  group.name = `kit:${preset}`;
  const meshes: THREE.Mesh[] = [];
  for (const [key, b] of buckets) {
    commonAttributes(b.geos);
    const merged = b.geos.length === 1 ? (b.geos[0] as THREE.BufferGeometry) : mergeGeometries(b.geos, false);
    if (b.geos.length > 1) b.geos.forEach((g) => g.dispose());
    if (!merged) continue;
    o.keep?.(merged);
    const mesh = new THREE.Mesh(merged, b.material);
    mesh.name = `kit:${key}`;
    mesh.userData.lo = b.lo;
    mesh.userData.hi = b.hi;
    meshes.push(mesh);
    group.add(mesh);
  }
  const shows = (mesh: THREE.Mesh, rank: number): boolean => (mesh.userData.lo as number) <= rank && rank <= (mesh.userData.hi as number);
  const build: KitBuild = {
    group,
    placed,
    setMaxRank(rank) {
      for (const mesh of meshes) mesh.visible = shows(mesh, rank);
    },
    calls(rank) {
      return meshes.filter((mesh) => shows(mesh, rank)).length;
    },
    partAt(hit, faceIndex) {
      const mesh = hit as THREE.Mesh;
      if (!meshes.includes(mesh)) return null;
      const ids = mesh.geometry.getAttribute('partId') as THREE.BufferAttribute | undefined;
      const index = mesh.geometry.getIndex();
      if (!ids || !index) return null;
      const v = index.getX(faceIndex * 3);
      return placed[Math.round(ids.getX(v))] ?? null;
    },
  };
  build.setMaxRank(o.maxRank);
  return build;
}
