export type Vec3 = readonly [number, number, number];
export type Quat = readonly [number, number, number, number];

export type HatKind =
  | 'none'
  | 'cap'
  | 'helmet'
  | 'crown'
  | 'bandana'
  | 'horns'
  | 'leaf'
  | 'pot';

export type EarKind = 'small' | 'big' | 'floppy' | 'pointy';

export type Mood = 'happy' | 'angry' | 'surprised';

export interface GoblinLook {
  color: string;
  accent: string;
  hat: HatKind;
  ears: EarKind;
  mood?: Mood;
}

export type PartRole =
  | 'glass'
  | 'body'
  | 'head'
  | 'ear'
  | 'eye'
  | 'pupil'
  | 'nose'
  | 'mouth'
  | 'tooth'
  | 'hat'
  | 'hat-detail';

export interface Part {
  id: string;
  role: PartRole;
  shape: 'sphere' | 'box' | 'cylinder';
  /** sphere radius / cylinder radius / box half extent, BEFORE scale */
  size: number;
  position: Vec3;
  rotation: Quat;
  scale: Vec3;
  color: string;
  metalness: number;
  roughness: number;
  opacity: number;
}
