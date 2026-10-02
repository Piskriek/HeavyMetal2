import * as THREE from 'three';
import type { VoxelModel } from '@hm/voxel';
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
