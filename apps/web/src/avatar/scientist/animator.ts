import * as THREE from 'three';
import { type ClipName } from './anims-loader';
import { adaptClipsForAstro } from './scientist-model';

export type OneShotKind = 'lever' | 'button' | 'plant' | 'wave' | 'cheer' | 'point' | 'draw' | 'holster' | 'reload';

const ONE_SHOT_MAP: Record<OneShotKind, ClipName> = {
  lever: 'pulling-lever',
  button: 'button-pushing',
  plant: 'plant-a-plant',
  wave: 'waving',
  cheer: 'cheering',
  point: 'pointing',
  draw: 'rifle-pull-out',
  holster: 'rifle-put-away',
  reload: 'reloading',
};

/** The one-shots that hold the body while they play (the rifle's draw, holster and reload): nothing else blends under them. */
const RIFLE_ONE_SHOTS: ReadonlySet<OneShotKind> = new Set<OneShotKind>(['draw', 'holster', 'reload']);

export interface LocomotionInput {
  /** Forward/backward movement: +1 = forward, -1 = backward. */
  readonly forward: number;
  /** Lateral movement: +1 = strafe right, -1 = strafe left. */
  readonly strafe: number;
  /** Whether the character is running. */
  readonly run: boolean;
  /** Whether the character is jumping. */
  readonly jumping?: boolean;
  /**
   * The extraction rifle (TASK-21). Held: the rifle clips replace the unarmed locomotion and idle. Aiming (the left button):
   * the aiming idle, not the relaxed one. Firing (the beam is on): the firing loop while standing still.
   */
  readonly rifle?: { readonly held: boolean; readonly aiming: boolean; readonly firing: boolean };
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
  // an Astro instance gets its own walk and run, and the set's hips motion in its scale
  const fitted = root.userData.astroClips ? adaptClipsForAstro(root, clips) : clips;

  for (const [name, clip] of fitted.entries()) {
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

  // The rifle's set (TASK-21): the same locomotion with the rifle, a standing idle with it raised, and the firing loop
  const rifle = {
    idle: actions.get('rifle-idle'),
    aim: actions.get('rifle-aiming-idle'),
    fire: actions.get('firing-rifle'),
    walk: actions.get('rifle-walk'),
    run: actions.get('rifle-run'),
    back: actions.get('backwards-rifle-walk'),
    strafeL: actions.get('strafe-left'),
    strafeR: actions.get('strafe-right'),
  };
  for (const act of [rifle.idle, rifle.aim, rifle.fire, rifle.walk, rifle.run, rifle.back, rifle.strafeL, rifle.strafeR]) {
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
  let wasJumping = false;

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
    // the rifle (TASK-21): held, its set takes the body; a rifle one-shot (draw, holster, reload) holds the body alone
    const rifleHeld = !!loco?.rifle?.held;
    const rifleBusy = activeOneShot !== null && RIFLE_ONE_SHOTS.has(activeOneShot.kind);
    const armed = rifleHeld && !rifleBusy;
    const rifleFiring = armed && !!loco?.rifle?.firing;
    const rifleAiming = armed && !!loco?.rifle?.aiming;

    if (isMoving && isLookingAround && lookAround) {
      // Abort look-around if moving
      lookAround.fadeOut(0.2);
      isLookingAround = false;
    }

    if (!isMoving && !activeOneShot && !rifleHeld) {
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

    // Blend actions: the unarmed locomotion, or the rifle's when it is held (the other set fades out; a rifle one-shot holds both at zero)
    const locoSpeed = 12;
    const unarmed = armed || rifleBusy ? 0 : 1;
    const armedScale = armed ? 1 : 0;
    lerpWeight(walk, targetWalk * unarmed, dt, locoSpeed);
    lerpWeight(run, targetRun * unarmed, dt, locoSpeed);
    lerpWeight(walkBack, targetBack * unarmed, dt, locoSpeed);
    lerpWeight(strafeL, targetStrafeL * unarmed, dt, locoSpeed);
    lerpWeight(strafeR, targetStrafeR * unarmed, dt, locoSpeed);
    lerpWeight(rifle.walk, targetWalk * armedScale, dt, locoSpeed);
    lerpWeight(rifle.run, targetRun * armedScale, dt, locoSpeed);
    lerpWeight(rifle.back, targetBack * armedScale, dt, locoSpeed);
    lerpWeight(rifle.strafeL, targetStrafeL * armedScale, dt, locoSpeed);
    lerpWeight(rifle.strafeR, targetStrafeR * armedScale, dt, locoSpeed);

    if (jump) {
      if (isJumping && !wasJumping) {
        jump.reset();
        jump.fadeIn(0.15);
        jump.play();
      } else if (!isJumping && wasJumping) {
        jump.fadeOut(0.2);
      }
      wasJumping = isJumping;
    }

    // Base idle weight, and the rifle's standing poses: relaxed with it held, aiming with the left button, firing with the beam on
    const targetIdle = isMoving || isJumping || isLookingAround || armed || rifleBusy ? 0 : 1;
    lerpWeight(idle, targetIdle, dt, locoSpeed);
    const standingArmed = armed && !isMoving;
    lerpWeight(rifle.idle, standingArmed && !rifleAiming && !rifleFiring ? 1 : 0, dt, locoSpeed);
    lerpWeight(rifle.aim, standingArmed && rifleAiming && !rifleFiring ? 1 : 0, dt, locoSpeed);
    lerpWeight(rifle.fire, standingArmed && rifleFiring ? 1 : 0, dt, locoSpeed);

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
