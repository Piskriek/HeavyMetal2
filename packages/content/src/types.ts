export type SeedValue = number | boolean | string | null;
export interface PresetSeed {
  kind: 'material' | 'racer' | 'camera' | 'entity';
  name: string;
  tags: string[];
  tier: 'play' | 'build' | 'pro';
  params: Record<string, SeedValue>;
  refs?: Record<string, string> /* param key -> NAME of another seed of the right kind */;
  doc?: string;
}
export const PARAM_KEYS: Record<PresetSeed['kind'], readonly string[]> = {
  material: ['color', 'roughness', 'metalness', 'repeat', 'normalStrength'],
  racer: ['weight', 'speed', 'bounce', 'color', 'accent', 'skill', 'hat', 'ears'],
  camera: ['fov', 'distance', 'yaw', 'pitch', 'targetX', 'targetY', 'targetZ'],
  entity: ['shape', 'size', 'x', 'y', 'z', 'yaw', 'scaleX', 'scaleY', 'scaleZ', 'body', 'mass', 'friction', 'restitution', 'visible'],
};
export const REF_KEYS: Record<PresetSeed['kind'], readonly string[]> = {
  material: [],
  racer: [],
  camera: [],
  entity: ['material'],
};
