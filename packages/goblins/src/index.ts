export type {
  Vec3,
  Quat,
  HatKind,
  EarKind,
  Mood,
  GoblinLook,
  PartRole,
  Part,
} from './types.js';

export {
  IDENTITY,
  quatFromAxisAngle,
  quatMul,
  rotateVec,
  quatFromYaw,
} from './quat.js';

export { goblinParts } from './goblin.js';

export type { Pose } from './place.js';
export { placePart, placeAll, yawFromHeading } from './place.js';

export { HATS, EARS, MOODS, allLooks, lookFromParams } from './variants.js';