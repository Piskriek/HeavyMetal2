/**
 * The Mixamo rest skeleton Astro's clips were authored on, as data.
 *
 * Every clip in `scientist/anims.bin` and `astro/rifle-anims.bin` is a set of quaternion tracks keyed by these bone
 * names, so the rig is the contract: the suit's *geometry* is procedural (`ASTRO_SUIT_CREATURE_KIT`), but the bones the
 * animator drives are these, with these rest offsets. The numbers are the rest pose measured off the owner's Meshy
 * character (the retired `astro-low.glb`), rounded to six decimals — bones are a rig, not a mesh, so this is a table and
 * not an asset.
 */
import * as THREE from 'three';

/** One rest bone: its name, its parent's name (null for the root), and its local rest transform. */
export interface MixamoRestBone {
  readonly name: string;
  readonly parent: string | null;
  readonly translation: readonly [number, number, number];
  readonly rotation: readonly [number, number, number, number];
}

/** Parent before child, so a builder can walk the list once. */
export const MIXAMO_REST_SKELETON: readonly MixamoRestBone[] = Object.freeze([
  { name: 'mixamorigHips', parent: 'target_character', translation: [0.0061347, 0.916041, 0.00671707], rotation: [-0.0183089, 0.00200016, 0.00200016, 0.999828] },
  { name: 'mixamorigSpine', parent: 'mixamorigHips', translation: [-1.86265e-09, 0.132594, 0], rotation: [0, 0, 0, 1] },
  { name: 'mixamorigSpine1', parent: 'mixamorigSpine', translation: [-9.31323e-10, 0.132593, 0], rotation: [0, 0, 0, 1] },
  { name: 'mixamorigSpine2', parent: 'mixamorigSpine1', translation: [9.31323e-10, 0.136611, 3.72529e-09], rotation: [-1.9753e-05, 0.0026175, 0.00271507, 0.999993] },
  { name: 'mixamorigNeck', parent: 'mixamorigSpine2', translation: [3.72529e-09, 0.0959476, 0], rotation: [0, 0, 0, 1] },
  { name: 'mixamorigHead', parent: 'mixamorigNeck', translation: [-1.30385e-08, 0.0762581, 2.6077e-08], rotation: [0.0968512, -0.0546055, -0.0557238, 0.992236] },
  { name: 'mixamorigHeadTop_End', parent: 'mixamorigHead', translation: [0, 0.200672, 0], rotation: [0, 0, 0, 1] },
  { name: 'headfront', parent: 'mixamorigHead', translation: [0.0152849, 0.026673, 0.162271], rotation: [-1.13585e-08, -0.758711, -0.647495, 0.0714656] },
  { name: 'mixamorigLeftShoulder', parent: 'mixamorigSpine2', translation: [0.0412204, 0.040309, 0.000408035], rotation: [-0.514712, -0.465322, -0.48781, 0.529705] },
  { name: 'mixamorigLeftArm', parent: 'mixamorigLeftShoulder', translation: [-5.12227e-09, 0.167847, -3.57628e-07], rotation: [-0.415168, 0.469079, -0.259734, 0.734941] },
  { name: 'mixamorigLeftForeArm', parent: 'mixamorigLeftArm', translation: [-1.19209e-07, 0.217651, 2.98023e-08], rotation: [0.216544, 0.18821, 0.065298, 0.955731] },
  { name: 'mixamorigLeftHand', parent: 'mixamorigLeftForeArm', translation: [1.19209e-07, 0.21322, 1.19209e-07], rotation: [0.0445077, -0.125886, -0.119983, 0.983756] },
  { name: 'mixamorigLeftHandMiddle4', parent: 'mixamorigLeftHand', translation: [-1.78814e-07, 0.117834, 0], rotation: [3.56155e-07, -0.893532, 1.24672e-08, 0.449] },
  { name: 'mixamorigRightShoulder', parent: 'mixamorigSpine2', translation: [-0.0437047, 0.0411183, -0.000432618], rotation: [-0.51164, 0.468699, 0.481552, 0.535401] },
  { name: 'mixamorigRightArm', parent: 'mixamorigRightShoulder', translation: [-8.5216e-08, 0.173399, -2.38419e-07], rotation: [-0.418028, -0.466102, 0.255313, 0.736761] },
  { name: 'mixamorigRightForeArm', parent: 'mixamorigRightArm', translation: [5.96046e-08, 0.217637, -5.96046e-08], rotation: [0.210942, -0.181757, -0.0601809, 0.958565] },
  { name: 'mixamorigRightHand', parent: 'mixamorigRightForeArm', translation: [0, 0.204524, -2.98023e-08], rotation: [-0.0399146, 0.0940425, 0.0849821, 0.991131] },
  { name: 'mixamorigRightHandMiddle4', parent: 'mixamorigRightHand', translation: [-1.19209e-07, 0.138954, 5.96046e-08], rotation: [1.39903e-07, 0.893532, -1.67541e-07, 0.448999] },
  { name: 'mixamorigLeftUpLeg', parent: 'mixamorigHips', translation: [0.102295, -0.0807371, -0.00254036], rotation: [0.990811, 0.079528, 0.0865328, 0.0669399] },
  { name: 'mixamorigLeftLeg', parent: 'mixamorigLeftUpLeg', translation: [-2.98023e-08, 0.330828, 7.45058e-09], rotation: [0.161782, -0.0601997, 0.0757678, 0.98207] },
  { name: 'mixamorigLeftFoot', parent: 'mixamorigLeftLeg', translation: [0, 0.39957, -3.72529e-09], rotation: [-0.423793, 0.172277, -0.21554, 0.862707] },
  { name: 'mixamorigLeftToeBase', parent: 'mixamorigLeftFoot', translation: [0, 0.112544, -1.30385e-08], rotation: [0.120901, 0.870407, -0.331779, 0.34307] },
  { name: 'mixamorigLeftToe_End', parent: 'mixamorigLeftToeBase', translation: [-2.98023e-08, 0.0657255, 1.11759e-08], rotation: [0.0379099, 0.272927, -0.958405, 0.0743901] },
  { name: 'mixamorigRightUpLeg', parent: 'mixamorigHips', translation: [-0.110037, -0.0798724, -0.00337406], rotation: [0.989438, -0.0920327, -0.0914366, 0.0646738] },
  { name: 'mixamorigRightLeg', parent: 'mixamorigRightUpLeg', translation: [0, 0.331644, -3.72529e-08], rotation: [0.160091, 0.0679306, -0.0847597, 0.981108] },
  { name: 'mixamorigRightFoot', parent: 'mixamorigRightLeg', translation: [-4.47035e-08, 0.39957, 0], rotation: [-0.432121, -0.150551, 0.190396, 0.868536] },
  { name: 'mixamorigRightToeBase', parent: 'mixamorigRightFoot', translation: [5.96046e-08, 0.11244, -2.42144e-08], rotation: [0.120836, -0.881098, 0.336429, 0.309644] },
  { name: 'mixamorigRightToe_End', parent: 'mixamorigRightToeBase', translation: [4.47035e-08, 0.064064, -7.45058e-09], rotation: [0.0548122, -0.399669, 0.887941, 0.220954] },
]);

/** The rig's own root: the character container the Hips hang from (the clips address `mixamorigHips` and below). */
export const MIXAMO_RIG_ROOT = 'target_character';

export interface MixamoRig {
  /** The scene node to add: carries the root and every bone. */
  readonly root: THREE.Group;
  readonly bones: ReadonlyMap<string, THREE.Bone>;
}

/**
 * Builds the rest rig: one `THREE.Bone` per row, parented exactly as the table says. Bones are objects, not meshes —
 * nothing is skinned, the suit's rigid parts are parented onto them.
 */
export function buildMixamoRig(): MixamoRig {
  const bones = new Map<string, THREE.Bone>();
  const root = new THREE.Group();
  root.name = MIXAMO_RIG_ROOT;
  for (const row of MIXAMO_REST_SKELETON) {
    const bone = new THREE.Bone();
    bone.name = row.name;
    bone.position.fromArray(row.translation);
    bone.quaternion.fromArray(row.rotation);
    bone.matrixAutoUpdate = true;
    bones.set(row.name, bone);
    const parent = row.parent === null ? null : bones.get(row.parent);
    if (parent) parent.add(bone);
    else if (row.parent === null || row.parent === MIXAMO_RIG_ROOT) root.add(bone);
    else root.add(bone);
  }
  root.updateMatrixWorld(true);
  return { root, bones };
}

/** The bone a part binds to by name, or null when the rig has no such bone. */
export function mixamoBone(rig: MixamoRig, name: string | null | undefined): THREE.Bone | null {
  return name ? rig.bones.get(name) ?? null : null;
}
