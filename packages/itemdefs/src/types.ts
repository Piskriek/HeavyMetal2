export type ItemEffect =
  | 'boost'
  | 'jump'
  | 'oil'
  | 'shockwave'
  | 'anchor'
  | 'slipstream'
  | 'freeze'
  | 'ghost';

export type ItemKind = 'self' | 'drop' | 'area';

export interface ItemDef {
  id: string;
  label: string;
  icon: string; /* one emoji */
  effect: ItemEffect;
  kind: ItemKind;
  durationMs: number;
  power: number; /* 0.25..4, 1 = as designed */
  radius: number; /* metres, area and drop effects, 0 for self */
  weights: [number, number, number]; /* relative roll weight for [front, middle, back] of the field, each >= 0, at least one > 0 */
  enabled: boolean;
}

export type BucketIndex = 0 | 1 | 2;
export type BucketName = 'front' | 'middle' | 'back';

export interface RollChance {
  id: string;
  chance: number;
}

export interface BucketTable {
  bucket: BucketName;
  table: RollChance[];
}

export interface BalanceReport {
  buckets: BucketTable[];
  warnings: string[];
}

export interface ValidationResult {
  ok: boolean;
  errors: string[];
}
