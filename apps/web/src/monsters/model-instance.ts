// One 3D monster: a clone of the skin's model (skinned or morph-target, both play their glTF clips through an AnimationMixer). Its
// clip time is set from the phase time each frame, so the animation follows the simulation (no drift), and the mixer evaluates it
// only when the renderer's animation budget allows (renderer.ts).
//
// Morph targets are blended on the CPU, not by the GPU: three.js draws them from a data texture, and that path drew the LibreQuake
// models at their base frame (a third of their height) on the bench. The blend is base + sum(weight x delta) per frame, which is
// cheap for a handful of monsters and the same on every GPU. The instance's geometry is its own copy, so the blend never touches the
// shared skin.
import * as THREE from 'three';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import type { ModelAsset } from './loader';
import { clipTime, type Play, type SpriteGroup } from './timing';

interface Channel {
  readonly attr: THREE.BufferAttribute;
  readonly base: Float32Array;
  /** The skin's deltas for this attribute (shared, read only). */
  readonly deltas: readonly Float32Array[];
}
interface MorphMesh { readonly mesh: THREE.Mesh; readonly channels: readonly Channel[] }

/** The xyz triples of an attribute, read through its accessors (correct for interleaved buffers too). */
function flatten(attr: THREE.BufferAttribute | THREE.InterleavedBufferAttribute): Float32Array {
  const out = new Float32Array(attr.count * 3);
  for (let i = 0; i < attr.count; i++) {
    out[i * 3] = attr.getX(i);
    out[i * 3 + 1] = attr.getY(i);
    out[i * 3 + 2] = attr.getZ(i);
  }
  return out;
}

/**
 * Gives every morphing mesh under `root` its own geometry without morph attributes (so three does not blend them on the GPU), and
 * returns the channels the CPU blend writes into.
 */
export function detachMorphs(root: THREE.Object3D): MorphMesh[] {
  const out: MorphMesh[] = [];
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const src = mesh.geometry;
    const srcMorph = src.morphAttributes as Record<string, THREE.BufferAttribute[] | undefined>;
    if (!srcMorph.position?.length) return;
    const g = new THREE.BufferGeometry();
    for (const name of Object.keys(src.attributes)) g.setAttribute(name, src.attributes[name]!.clone());
    g.setIndex(src.index);
    g.groups = src.groups.slice();
    const channels: Channel[] = [];
    for (const name of ['position', 'normal'] as const) {
      const list = srcMorph[name];
      const srcAttr = src.attributes[name];
      if (!list?.length || !srcAttr) continue;
      // flattened through the accessors (interleaved or not), into plain triples the blend can write
      const base = flatten(srcAttr);
      const attr = new THREE.BufferAttribute(Float32Array.from(base), 3);
      g.setAttribute(name, attr);
      channels.push({ attr, base, deltas: list.map(flatten) });
    }
    mesh.geometry = g;
    out.push({ mesh, channels });
  });
  return out;
}

export class ModelInstance {
  /** Carries the position and the yaw; the model sits inside it. */
  readonly root: THREE.Group;
  private readonly body: THREE.Object3D;
  private readonly mixer: THREE.AnimationMixer;
  private readonly actions = new Map<SpriteGroup, THREE.AnimationAction>();
  private readonly morphs: readonly MorphMesh[];
  private current: SpriteGroup | null = null;

  constructor(asset: ModelAsset) {
    this.body = SkeletonUtils.clone(asset.prototype);
    this.root = new THREE.Group();
    this.root.name = `monster-model:${asset.id}`;
    this.root.add(this.body);
    this.morphs = detachMorphs(this.body);
    this.mixer = new THREE.AnimationMixer(this.body);
    for (const [group, clip] of asset.clips) {
      const action = this.mixer.clipAction(clip, this.body);
      if (group === 'walk' || group === 'attack') {
        action.setLoop(THREE.LoopRepeat, Infinity);
      } else {
        action.setLoop(THREE.LoopOnce, 1);
        action.clampWhenFinished = true;
      }
      this.actions.set(group, action);
    }
  }

  /** Sets the clip for a phase at `t` seconds into it. The pose is applied by `apply()`. */
  setPlay(play: Play, t: number): void {
    const action = this.actions.get(play.group);
    if (!action) return;
    if (this.current !== play.group) {
      for (const [g, other] of this.actions) if (g !== play.group) other.stop();
      action.reset().play();
      this.current = play.group;
    }
    action.time = clipTime(action.getClip().duration, t, play.mode);
  }

  /** Evaluates the current pose now: the clip's weights and bones at the clip time set, then the morph blend. */
  apply(): void {
    this.mixer.update(0);
    this.blend();
  }

  /** The morph blend on the CPU: base + sum(weight x delta), for each channel of each morphing mesh. */
  private blend(): void {
    for (const m of this.morphs) {
      const w = m.mesh.morphTargetInfluences ?? [];
      for (const ch of m.channels) {
        const out = ch.attr.array as Float32Array;
        out.set(ch.base);
        for (let k = 0; k < ch.deltas.length; k++) {
          const wk = w[k] ?? 0;
          if (wk === 0) continue;
          const d = ch.deltas[k]!;
          for (let i = 0; i < out.length; i++) out[i] = out[i]! + wk * d[i]!;
        }
        ch.attr.needsUpdate = true;
      }
    }
  }

  /** Stops every clip. The cloned bones are shared with the prototype, so nothing is freed here beyond the instance's own geometry. */
  dispose(): void {
    this.mixer.stopAllAction();
    this.root.removeFromParent();
    for (const m of this.morphs) m.mesh.geometry.dispose();
  }
}
