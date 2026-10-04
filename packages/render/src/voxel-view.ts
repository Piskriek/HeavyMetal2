import * as THREE from 'three';
import { decodeModel, meshVoxels, type VoxelModel, type MeshOptions } from '@hm/voxel';

/**
 * Voxel models on screen. The mesher (pure, in @hm/voxel) does the work; this turns its arrays into one three.js mesh per model:
 * opaque blocks and see-through blocks go into two meshes so glass sorts properly. Per-block roughness/metalness/glow come from the palette
 * through a vertex-colour material, and AO is already baked into the vertex colours.
 */
export interface VoxelViewOptions extends MeshOptions { readonly scale?: number; readonly castShadow?: boolean }

export function voxelGeometry(model: VoxelModel, opts: MeshOptions = {}, wantAlpha = false): THREE.BufferGeometry | null {
  const out = meshVoxels(model, opts);
  if (out.triangleCount === 0) return null;
  const keep: number[] = [];
  for (let t = 0; t < out.triangleCount; t++) {
    const pal = out.paletteIndex[out.indices[t * 3]!]!;
    const translucent = (model.palette[pal - 1]?.alpha ?? 1) < 1;
    if (translucent === wantAlpha) keep.push(out.indices[t * 3]!, out.indices[t * 3 + 1]!, out.indices[t * 3 + 2]!);
  }
  if (keep.length === 0) return null;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(out.positions, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(out.normals, 3));
  g.setAttribute('color', new THREE.BufferAttribute(out.colors, 3));
  g.setIndex(new THREE.BufferAttribute(new Uint32Array(keep), 1));
  g.computeBoundingSphere();
  return g;
}

export class VoxelView {
  readonly group = new THREE.Group();
  private readonly geometries: THREE.BufferGeometry[] = [];
  private readonly materials: THREE.Material[] = [];

  constructor(model: VoxelModel, opts: VoxelViewOptions = {}) {
    const first = model.palette.find((p) => p.roughness !== undefined);
    const roughness = first?.roughness ?? 0.8, metalness = first?.metalness ?? 0;
    for (const alpha of [false, true]) {
      const g = voxelGeometry(model, opts, alpha);
      if (!g) continue;
      const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness, metalness, transparent: alpha, opacity: alpha ? 0.5 : 1, depthWrite: !alpha });
      const mesh = new THREE.Mesh(g, mat);
      mesh.castShadow = opts.castShadow !== false && !alpha;
      mesh.receiveShadow = true;
      this.geometries.push(g); this.materials.push(mat);
      this.group.add(mesh);
    }
    this.group.scale.setScalar(opts.scale ?? 1);
  }

  dispose(): void { for (const g of this.geometries) g.dispose(); for (const m of this.materials) m.dispose(); this.group.clear(); }
}

/** Build a view from a model preset's params (`data` is the encoded model). Returns null when there is nothing valid to draw. */
export function voxelViewFromParams(params: Readonly<Record<string, unknown>>): VoxelView | null {
  const data = params['data'];
  if (typeof data !== 'string' || !data) return null;
  const { model } = decodeModel(data);
  if (!model) return null;
  return new VoxelView(model, { ao: params['ao'] !== false, greedy: params['greedy'] !== false, castShadow: params['castShadow'] !== false, scale: Number(params['scale'] ?? 0.1) });
}

export interface ModelPlacement { readonly params: Readonly<Record<string, unknown>>; readonly x: number; readonly y: number; readonly z: number; readonly yawDeg: number }

/** Several placed models (statues, props, avatars) in one group; rebuilt whenever the list changes. */
export class ModelsView {
  readonly group = new THREE.Group();
  private readonly views: VoxelView[] = [];
  private readonly slots: (VoxelView | null)[] = [];
  constructor(items: readonly ModelPlacement[]) {
    for (const it of items) {
      const v = voxelViewFromParams(it.params);
      this.slots.push(v);
      if (!v) continue;
      v.group.position.set(it.x, it.y, it.z);
      v.group.rotation.y = (it.yawDeg * Math.PI) / 180;
      this.views.push(v);
      this.group.add(v.group);
    }
  }
  /** Move one placed model without rebuilding it (index = position in the list given to the constructor). */
  pose(i: number, x: number, y: number, z: number, yawDeg: number, scale?: number): void {
    const v = this.slots[i];
    if (!v) return;
    v.group.position.set(x, y, z);
    v.group.rotation.y = (yawDeg * Math.PI) / 180;
    if (scale !== undefined && scale > 0) v.group.scale.setScalar(scale);
  }
  dispose(): void { for (const v of this.views) v.dispose(); this.views.length = 0; this.slots.length = 0; this.group.clear(); }
}
