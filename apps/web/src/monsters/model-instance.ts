// One 3D monster: a clone of the skin's model (skinned or morph-target, both play their glTF clips through an AnimationMixer). Its
// clip time is set from the phase time each frame, so the animation follows the simulation (no drift), and the mixer evaluates it
// only when the renderer's animation budget allows (renderer.ts).
import * as THREE from 'three';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import type { ModelAsset } from './loader';
import { clipTime, type Play, type SpriteGroup } from './timing';

export class ModelInstance {
  /** Carries the position and the yaw; the model sits inside it. */
  readonly root: THREE.Group;
  private readonly body: THREE.Object3D;
  private readonly mixer: THREE.AnimationMixer;
  private readonly actions = new Map<SpriteGroup, THREE.AnimationAction>();
  private current: SpriteGroup | null = null;

  constructor(asset: ModelAsset) {
    this.body = SkeletonUtils.clone(asset.prototype);
    this.root = new THREE.Group();
    this.root.name = `monster-model:${asset.id}`;
    this.root.add(this.body);
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

  /** Evaluates the current pose now (a zero step: the clip time is the one set). */
  apply(): void {
    this.mixer.update(0);
  }

  /** Stops every clip. The cloned bones and geometry are shared with the prototype, so nothing is freed here. */
  dispose(): void {
    this.mixer.stopAllAction();
    this.root.removeFromParent();
  }
}
