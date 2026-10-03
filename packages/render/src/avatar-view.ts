import * as THREE from 'three';
import type { PaletteEntry, VoxelModel } from '@hm/voxel';
import { BONES, type Bone, type Pose } from '@hm/anim';
import { voxelGeometry } from './voxel-view';

/**
 * A voxel character that moves: the model is split into six bones (body, head, two arms, two legs), each meshed on its own and hung on a
 * joint, so animation presets (`@hm/anim`) can swing them. Legs hang from the hips on the root; head and arms hang on the body, so the body's
 * twist and sway carry them.
 *
 * Axes: the model faces -Z (its nose is at the small-z side), y is up, its left side is -X. A limb's rx swings it forward (towards -Z); rz
 * lifts it out to its own side.
 */
export type Vec3 = [number, number, number];
export interface Rig {
  /** Which bone a voxel (x, y, z) belongs to. */
  readonly boneOf: (x: number, y: number, z: number) => Bone;
  /** Joint of each bone, in voxel coordinates (cell corners: a cell spans x..x+1). */
  readonly joints: Readonly<Record<Bone, Vec3>>;
}

/** The voxel goblin of `@hm/voxelart` (28 x 44 x 20, mirrored about x = 14): its bones by the boxes it is built from. */
export const HERO_GOBLIN_RIG: Rig = {
  boneOf: (x, y) => {
    if (y >= 31 || (y >= 29 && x >= 10 && x <= 17)) return 'head';
    if ((x <= 7 || x >= 20) && y <= 28) return x <= 7 ? 'armL' : 'armR';
    if (y <= 12 && x >= 8 && x <= 12) return 'legL';
    if (y <= 12 && x >= 15 && x <= 19) return 'legR';
    return 'body';
  },
  joints: { body: [14, 13, 10], head: [14, 30, 10], armL: [6, 27.5, 10], armR: [22, 27.5, 10], legL: [10.5, 13, 10], legR: [17.5, 13, 10] },
};

/** A part to add to a character: its cells (1-based into its own palette), the cell that sits on the anchor, the anchor, and the bone it moves with. */
export interface DressItem {
  readonly size: Vec3;
  readonly cells: ArrayLike<number>;
  readonly palette: readonly PaletteEntry[];
  /** The part's own attach point (its cell coordinates). */
  readonly root: Vec3;
  /** Where that point goes on the character (the character's cell coordinates). */
  readonly at: Vec3;
  readonly bone: Bone;
}

const MAX_DIM = 96;

/**
 * Add parts (a hat, a held club, a backpack ...) to a voxel character. The grid grows to hold them; a part's cells cover what was there; every
 * part cell moves with the part's bone whatever its position (a long braid hangs from the head, it does not split at the neck); everything
 * else keeps the character's own rig. Pure: the base model and rig are not changed.
 */
export function dressAvatar(base: VoxelModel, rig: Rig, items: readonly DressItem[]): { model: VoxelModel; rig: Rig } {
  if (!items.length) return { model: base, rig };
  const [bx, by, bz] = base.size;
  let x0 = 0, y0 = 0, z0 = 0, x1 = bx, y1 = by, z1 = bz;
  for (const it of items) {
    const o = [it.at[0] - it.root[0], it.at[1] - it.root[1], it.at[2] - it.root[2]];
    x0 = Math.min(x0, o[0]!); y0 = Math.min(y0, o[1]!); z0 = Math.min(z0, o[2]!);
    x1 = Math.max(x1, o[0]! + it.size[0]); y1 = Math.max(y1, o[1]! + it.size[1]); z1 = Math.max(z1, o[2]! + it.size[2]);
  }
  const d: Vec3 = [-x0, -y0, -z0];
  const size: Vec3 = [Math.min(MAX_DIM, x1 - x0), Math.min(MAX_DIM, y1 - y0), Math.min(MAX_DIM, z1 - z0)];
  const [sx, sy, sz] = size;
  const cells = new Uint8Array(sx * sy * sz);
  const put = (x: number, y: number, z: number, v: number): number => {
    if (x < 0 || y < 0 || z < 0 || x >= sx || y >= sy || z >= sz) return -1;
    const i = x + sx * (y + sy * z);
    cells[i] = v;
    return i;
  };
  for (let z = 0; z < bz; z++) for (let y = 0; y < by; y++) for (let x = 0; x < bx; x++) {
    const v = base.cells[x + bx * (y + by * z)] ?? 0;
    if (v) put(x + d[0], y + d[1], z + d[2], v);
  }
  // palette: the character's entries, then each part's (an identical entry is shared)
  const palette: PaletteEntry[] = base.palette.map((e) => ({ ...e, color: [...e.color] as Vec3 }));
  const key = (e: PaletteEntry): string => `${e.name}|${e.color.map((c) => c.toFixed(3)).join(',')}|${e.roughness}|${e.metalness}|${e.emissive}`;
  const index = new Map(palette.map((e, i) => [key(e), i + 1]));
  const labels = new Map<number, Bone>();
  for (const it of items) {
    const map = it.palette.map((e) => {
      const k = key(e);
      let i = index.get(k);
      if (i === undefined && palette.length < 255) { palette.push({ ...e, color: [...e.color] as Vec3 }); i = palette.length; index.set(k, i); }
      return i ?? 0;
    });
    const ox = it.at[0] - it.root[0] + d[0], oy = it.at[1] - it.root[1] + d[1], oz = it.at[2] - it.root[2] + d[2];
    const [px, py, pz] = it.size;
    for (let z = 0; z < pz; z++) for (let y = 0; y < py; y++) for (let x = 0; x < px; x++) {
      const v = it.cells[x + px * (y + py * z)] ?? 0;
      const pv = v > 0 ? map[v - 1] ?? 0 : 0;
      if (!pv) continue;
      const i = put(x + ox, y + oy, z + oz, pv);
      if (i >= 0) labels.set(i, it.bone);
    }
  }
  const joints = Object.fromEntries(BONES.map((b) => [b, [rig.joints[b][0] + d[0], rig.joints[b][1] + d[1], rig.joints[b][2] + d[2]]])) as Record<Bone, Vec3>;
  const dressed: Rig = {
    boneOf: (x, y, z) => labels.get(x + sx * (y + sy * z)) ?? rig.boneOf(x - d[0], y - d[1], z - d[2]),
    joints,
  };
  return { model: { ...base, size, pivot: [base.pivot[0] + d[0], base.pivot[1] + d[1], base.pivot[2] + d[2]], palette, cells }, rig: dressed };
}

/** Split a model's cells by bone. Every filled cell goes to exactly one bone. */
export function splitBones(model: VoxelModel, rig: Rig): Record<Bone, Uint8Array> {
  const [sx, sy, sz] = model.size;
  const out = Object.fromEntries(BONES.map((b) => [b, new Uint8Array(model.cells.length)])) as Record<Bone, Uint8Array>;
  for (let z = 0; z < sz; z++) for (let y = 0; y < sy; y++) for (let x = 0; x < sx; x++) {
    const i = x + sx * (y + sy * z);
    const v = model.cells[i] ?? 0;
    if (v) out[rig.boneOf(x, y, z)][i] = v;
  }
  return out;
}

export class AvatarView {
  readonly group = new THREE.Group();
  private readonly joints = {} as Record<Bone, THREE.Group>;
  private readonly geometries: THREE.BufferGeometry[] = [];
  private readonly materials: THREE.Material[] = [];
  private readonly height: number;

  /** `block` is metres per voxel. */
  constructor(model: VoxelModel, rig: Rig = HERO_GOBLIN_RIG, block = 0.04) {
    const cells = splitBones(model, rig);
    const piv = model.pivot;
    const first = model.palette.find((p) => p.roughness !== undefined);
    const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: first?.roughness ?? 0.75, metalness: 0 });
    this.materials.push(material);
    const scaled = new THREE.Group();
    scaled.scale.setScalar(block);
    this.group.add(scaled);
    for (const bone of BONES) {
      const j = rig.joints[bone];
      const g = new THREE.Group();
      g.name = bone;
      this.joints[bone] = g;
      const geo = voxelGeometry({ ...model, pivot: [j[0], j[1], j[2]], cells: cells[bone] }, { ao: true, greedy: true });
      if (geo) {
        this.geometries.push(geo);
        const mesh = new THREE.Mesh(geo, material);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        g.add(mesh);
      }
    }
    // the root holds the legs and the body; the body holds the head and the arms (positions are joint minus parent joint)
    const at = (bone: Bone, parent: Vec3): void => { const j = rig.joints[bone]; this.joints[bone].position.set(j[0] - parent[0], j[1] - parent[1], j[2] - parent[2]); };
    const root: Vec3 = [piv[0], piv[1], piv[2]];
    at('body', root); at('legL', root); at('legR', root);
    at('head', rig.joints.body); at('armL', rig.joints.body); at('armR', rig.joints.body);
    scaled.add(this.joints.body, this.joints.legL, this.joints.legR);
    this.joints.body.add(this.joints.head, this.joints.armL, this.joints.armR);
    this.height = model.size[1] * block;
  }

  /** Place the character: feet at (x, y, z), facing `yaw` radians (0 = facing -Z). */
  place(x: number, y: number, z: number, yaw: number, visible = true): void {
    this.group.position.set(x, y, z);
    this.group.rotation.y = yaw;
    this.group.visible = visible;
  }

  setPose(p: Pose): void {
    const B = p.bones, J = this.joints;
    J.body.rotation.set(-(p.lean + B.body.rx), B.body.ry, B.body.rz, 'YXZ');
    J.head.rotation.set(-B.head.rx, B.head.ry, B.head.rz, 'YXZ');
    J.armL.rotation.set(B.armL.rx, B.armL.ry, -B.armL.rz, 'XZY');
    J.armR.rotation.set(B.armR.rx, B.armR.ry, B.armR.rz, 'XZY');
    J.legL.rotation.set(B.legL.rx, B.legL.ry, -B.legL.rz, 'XZY');
    J.legR.rotation.set(B.legR.rx, B.legR.ry, B.legR.rz, 'XZY');
    (this.group.children[0] as THREE.Object3D).position.y = p.lift * this.height;
  }

  dispose(): void {
    for (const g of this.geometries) g.dispose();
    for (const m of this.materials) m.dispose();
    this.group.removeFromParent();
    this.group.clear();
  }
}
