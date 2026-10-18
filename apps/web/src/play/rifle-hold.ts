/**
 * Where the extraction rifle sits: in the view (first person, right of centre, barrel forward) and in the right hand (third
 * person). Both come from the rifle prop's own sockets (`@hm/beamkit`): the grip, the muzzle and the foregrip. Pure math, no
 * clock, no random.
 */
import * as THREE from 'three';

export interface RiflePose {
  readonly position: THREE.Vector3;
  readonly quaternion: THREE.Quaternion;
}

/** The first-person view model: the rifle's barrel points down the view (-Z), its grip nearer the player, right of centre. */
export function viewPose(): RiflePose {
  return {
    position: new THREE.Vector3(0.2, -0.24, -0.6),
    quaternion: new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI),
  };
}

/**
 * The pose that puts the grip socket at the origin of the hand bone with the barrel along the hand's forward axis (its +Y, the
 * way a Mixamo hand bone points to its fingers). `grip` and `muzzle` are the socket positions in the rifle's own space.
 */
export function handPose(grip: THREE.Vector3, muzzle: THREE.Vector3): RiflePose {
  const barrel = muzzle.clone().sub(grip).normalize();
  const quaternion = new THREE.Quaternion().setFromUnitVectors(barrel, new THREE.Vector3(0, 1, 0));
  const position = grip.clone().applyQuaternion(quaternion).negate();
  return { position, quaternion };
}

export {
  solveLeftArmForegripIk,
  solveTwoBoneIk,
  type Bone3DLike,
  type TwoBoneIkInput,
  type TwoBoneIkSolution,
} from '../avatar/two-bone-ik';
