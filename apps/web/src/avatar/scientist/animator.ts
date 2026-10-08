import * as THREE from 'three';
import { type ClipName } from './anims-loader';

export type OneShotKind = 'lever' | 'button' | 'plant' | 'wave' | 'cheer' | 'point';

const ONE_SHOT_MAP: Record<OneShotKind, ClipName> = {
  lever: 'pulling-lever',
  button: 'button-pushing',
  plant: 'plant-a-plant',
  wave: 'waving',
  cheer: 'cheering',
  point: 'pointing',
};

export interface LocomotionInput {
  /** Forward/backward movement: +1 = forward, -1 = backward. */
  readonly forward: number;
  /** Lateral movement: +1 = strafe right, -1 = strafe left. */
  readonly strafe: number;
  /** Whether the character is running. */
  readonly run: boolean;
  /** Whether the character is jumping. */
  readonly jumping?: boolean;
}

export interface ScientistAnimator {
  readonly mixer: THREE.AnimationMixer;
  /** Updates the animator by dt seconds with optional locomotion input. */
  update: (dt: number, loco?: LocomotionInput) => void;
  /** Plays a one-shot action (lever, button, plant, wave, cheer, point). Crossfades in and out. */
  playOneShot: (kind: OneShotKind, onDone?: () => void) => void;
  /** Returns the current weight of an animation clip. */
  getClipWeight: (name: ClipName) => number;
  /** Returns the active action for a clip name, if any. */
  getAction: (name: ClipName) => THREE.AnimationAction | undefined;
  /** Name of currently playing one-shot, if any. */
  readonly currentOneShot: OneShotKind | null;
  /** Stops all actions and cleans up listeners. */
  dispose: () => void;
}

/**
 * Creates a ScientistAnimator wrapping a THREE.AnimationMixer with idle, locomotion and one-shots.
 */
export function createScientistAnimator(
  root: THREE.Object3D,
  clips: Map<string, THREE.AnimationClip>
): ScientistAnimator {
  const mixer = new THREE.AnimationMixer(root);
  const actions = new Map<ClipName, THREE.AnimationAction>();

  for (const [name, clip] of clips.entries()) {
    const act = mixer.clipAction(clip);
    actions.set(name as ClipName, act);
  }

  // Configure idle actions
  const idle = actions.get('breathing-idle');
  if (idle) {
    idle.play();
    idle.setEffectiveWeight(1);
  }

  const lookAround = actions.get('looking-around');
  if (lookAround) {
    lookAround.setLoop(THREE.LoopOnce, 1);
    lookAround.clampWhenFinished = true;
  }

  // Configure locomotion actions
  const walk = actions.get('walking');
  const run = actions.get('running');
  const strafeL = actions.get('left-strafe-walking');
  const strafeR = actions.get('right-strafe-walking');
  const walkBack = actions.get('walking-backwards');
  const jump = actions.get('jump');

  for (const act of [walk, run, strafeL, strafeR, walkBack]) {
    if (act) {
      act.play();
      act.setEffectiveWeight(0);
    }
  }

  if (jump) {
    jump.setLoop(THREE.LoopOnce, 1);
    jump.clampWhenFinished = true;
  }

  let nextLookAroundTime = 12 + Math.random() * 13; // 12 to 25s
  let lookAroundTimer = 0;
  let isLookingAround = false;

  let activeOneShot: {
    kind: OneShotKind;
    action: THREE.AnimationAction;
    remaining: number;
    duration: number;
    onDone?: () => void;
  } | null = null;

  const onFinished = (e: { action: THREE.AnimationAction }) => {
    if (lookAround && e.action === lookAround) {
      isLookingAround = false;
      lookAround.fadeOut(0.3);
      if (idle) idle.fadeIn(0.3);
      lookAroundTimer = 0;
      nextLookAroundTime = 12 + Math.random() * 13;
    }
  };

  mixer.addEventListener('finished', onFinished);

  const lerpWeight = (act: THREE.AnimationAction | undefined, target: number, dt: number, speed = 10) => {
    if (!act) return;
    const current = act.getEffectiveWeight();
    const next = THREE.MathUtils.lerp(current, target, Math.min(1, dt * speed));
    act.setEffectiveWeight(next);
  };

  const playOneShot = (kind: OneShotKind, onDone?: () => void): void => {
    const clipName = ONE_SHOT_MAP[kind];
    const action = actions.get(clipName);
    if (!action) {
      onDone?.();
      return;
    }

    if (activeOneShot && activeOneShot.action !== action) {
      activeOneShot.action.fadeOut(0.15);
      activeOneShot.onDone?.();
    }

    action.reset();
    action.setLoop(THREE.LoopOnce, 1);
    action.clampWhenFinished = true;
    action.fadeIn(0.25);
    action.play();

    const clip = clips.get(clipName);
    const duration = clip ? clip.duration : 1.5;

    activeOneShot = {
      kind,
      action,
      remaining: duration,
      duration,
      onDone,
    };
  };

  const update = (dt: number, loco?: LocomotionInput): void => {
    // 1. Handle active one-shot countdown
    if (activeOneShot) {
      activeOneShot.remaining -= dt;
      if (activeOneShot.remaining <= 0.25 && activeOneShot.remaining + dt > 0.25) {
        activeOneShot.action.fadeOut(0.25);
      }
      if (activeOneShot.remaining <= 0) {
        activeOneShot.onDone?.();
        activeOneShot = null;
      }
    }

    // 2. Locomotion vs Idle
    const forward = loco ? loco.forward : 0;
    const strafe = loco ? loco.strafe : 0;
    const isRunning = loco ? loco.run : false;
    const isJumping = loco ? !!loco.jumping : false;

    const moveMag = Math.min(1, Math.hypot(forward, strafe));
    const isMoving = moveMag > 0.05;

    if (isMoving && isLookingAround && lookAround) {
      // Abort look-around if moving
      lookAround.fadeOut(0.2);
      isLookingAround = false;
    }

    if (!isMoving && !activeOneShot) {
      // Idle looking-around countdown
      lookAroundTimer += dt;
      if (lookAroundTimer >= nextLookAroundTime && !isLookingAround && lookAround && idle) {
        isLookingAround = true;
        lookAround.reset();
        lookAround.fadeIn(0.3);
        lookAround.play();
        idle.fadeOut(0.3);
      }
    }

    // Calculate target locomotion weights
    let targetWalk = 0;
    let targetRun = 0;
    let targetBack = 0;
    let targetStrafeL = 0;
    let targetStrafeR = 0;

    if (isMoving && !isJumping) {
      if (forward > 0) {
        if (isRunning) {
          targetRun = forward * moveMag;
        } else {
          targetWalk = forward * moveMag;
        }
      } else if (forward < 0) {
        targetBack = -forward * moveMag;
      }

      if (strafe < 0) {
        targetStrafeL = -strafe * moveMag;
      } else if (strafe > 0) {
        targetStrafeR = strafe * moveMag;
      }

      const sum = targetWalk + targetRun + targetBack + targetStrafeL + targetStrafeR;
      if (sum > 1e-4) {
        targetWalk /= sum;
        targetRun /= sum;
        targetBack /= sum;
        targetStrafeL /= sum;
        targetStrafeR /= sum;
      }
    }

    // Blend actions
    const locoSpeed = 12;
    lerpWeight(walk, targetWalk, dt, locoSpeed);
    lerpWeight(run, targetRun, dt, locoSpeed);
    lerpWeight(walkBack, targetBack, dt, locoSpeed);
    lerpWeight(strafeL, targetStrafeL, dt, locoSpeed);
    lerpWeight(strafeR, targetStrafeR, dt, locoSpeed);

    if (jump) {
      if (isJumping) {
        jump.reset();
        jump.fadeIn(0.15);
        jump.play();
      } else {
        jump.fadeOut(0.2);
      }
    }

    // Base idle weight
    const targetIdle = isMoving ? 0 : isLookingAround ? 0 : 1;
    lerpWeight(idle, targetIdle, dt, locoSpeed);

    mixer.update(dt);
  };

  const getClipWeight = (name: ClipName): number => {
    const act = actions.get(name);
    return act ? act.getEffectiveWeight() : 0;
  };

  const getAction = (name: ClipName): THREE.AnimationAction | undefined => {
    return actions.get(name);
  };

  const dispose = (): void => {
    mixer.removeEventListener('finished', onFinished);
    mixer.stopAllAction();
  };

  return {
    mixer,
    update,
    playOneShot,
    getClipWeight,
    getAction,
    get currentOneShot() {
      return activeOneShot ? activeOneShot.kind : null;
    },
    dispose,
  };
}
