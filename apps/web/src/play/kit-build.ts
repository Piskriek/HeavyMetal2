/**
 * Builds a @hm/kitspec preset into three.js meshes (plan 38): every placed part is baked into its preset frame and
 * merged with the others that share its material and detail rank, so a preset is a handful of meshes and a rank change
 * only flips visibility. Box parts are built here; generated parts are cloned from their loaded model (every mesh in it,
 * with its own material). Mirrored copies get their triangle winding flipped so they still face outwards.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { flatten, type DetailRank, type Kit, type PartDef } from '@hm/kitspec';

export interface KitBuild {
  readonly group: THREE.Group;
  /** Shows every part up to `rank` (and hides the rest). */
  setMaxRank(rank: DetailRank): void;
  /** Draw calls this build makes at `rank` (one per visible mesh). */
  calls(rank: DetailRank): number;
}

export interface KitBuildOptions {
  /** Materials for box parts, by the part's material name. */
  readonly materials: Readonly<Record<string, THREE.Material>>;
  /** A generated asset's loaded model (standing on its base centre), or null while it is not loaded yet. */
  readonly gen: (asset: string) => THREE.Object3D | null;
  readonly maxRank: DetailRank;
  /** Registers what the build creates, for disposal with its owner. */
  readonly keep?: <T extends { dispose(): void }>(x: T) => T;
}

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

/**
 * The preset as merged meshes, or null while a generated part's model is not loaded (call again once it is). Mesh names
 * are `kit:<material>|<rank>`; each mesh's `userData.rank` holds its rank.
 */
export function buildKitPreset(kit: Kit, preset: string, o: KitBuildOptions): KitBuild | null {
  const placed = flatten(kit, preset);
  const buckets = new Map<string, { material: THREE.Material; rank: DetailRank; geos: THREE.BufferGeometry[] }>();
  const bucket = (material: THREE.Material, rank: DetailRank, key: string) => {
    let b = buckets.get(key);
    if (!b) buckets.set(key, (b = { material, rank, geos: [] }));
    return b;
  };
  const m4 = new THREE.Matrix4();

  for (const p of placed) {
    const def = kit.parts[p.part] as PartDef;
    m4.fromArray(p.matrix as number[]);
    if (def.source.kind === 'box') {
      const material = o.materials[def.material];
      if (!material) continue;
      const [x, y, z] = def.source.size;
      const g = new THREE.BoxGeometry(x, y, z);
      g.translate(0, y / 2, 0);
      g.applyMatrix4(m4);
      if (p.mirrored) flipWinding(g);
      bucket(material, p.rank, `${def.material}|${p.rank}`).geos.push(g);
    } else {
      const asset = def.source.asset;
      const model = o.gen(asset);
      if (!model) return null;
      model.updateMatrixWorld(true);
      const rootInv = new THREE.Matrix4().copy(model.matrixWorld).invert();
      model.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (!mesh.isMesh || Array.isArray(mesh.material)) return;
        const g = mesh.geometry.clone();
        toFloat(g);
        g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(rootInv, mesh.matrixWorld));
        g.applyMatrix4(m4);
        if (p.mirrored) flipWinding(g);
        bucket(mesh.material, p.rank, `gen:${asset}:${mesh.material.uuid}|${p.rank}`).geos.push(g);
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
    mesh.userData.rank = b.rank;
    mesh.visible = b.rank <= o.maxRank;
    meshes.push(mesh);
    group.add(mesh);
  }
  return {
    group,
    setMaxRank(rank) {
      for (const mesh of meshes) mesh.visible = (mesh.userData.rank as number) <= rank;
    },
    calls(rank) {
      return meshes.filter((mesh) => (mesh.userData.rank as number) <= rank).length;
    },
  };
}
