export interface Range { min: number; max: number }
export type Ease = 'linear' | 'in' | 'out' | 'inOut' | 'hold';
export interface Keyframe { timeMs: number; value: number; ease?: Ease }
export type Pt = readonly [number, number];
export type ModulatorDef =
  | { kind: 'constant'; value: number }
  | { kind: 'random'; seed?: number; rateHz: number; mode: 'hold' | 'smooth'; distribution?: 'uniform' | 'gaussian'; out: Range }
  | { kind: 'noise'; seed?: number; freqHz: number; octaves?: number; gain?: number; out: Range }
  | { kind: 'lfo'; wave: 'sine' | 'triangle' | 'saw' | 'square'; freqHz: number; phase?: number; width?: number; out: Range }
  | { kind: 'curve'; points: readonly Pt[]; interpolation: 'linear' | 'smooth' | 'step'; input: { source: 'time'; loopMs: number } | { source: 'stream'; path: string; in: Range }; out: Range }
  | { kind: 'timeline'; durationMs: number; loop: 'none' | 'loop' | 'pingpong'; keys: readonly Keyframe[] }
  | { kind: 'sequence'; steps: readonly number[]; rateHz: number; glideMs?: number; out?: Range }
  | { kind: 'stream'; path: string; scale?: number; offset?: number; smoothMs?: number; clamp?: Range }
  | { kind: 'texture'; textureId: string; u: ModulatorDef; v: ModulatorDef; out: Range }
  | { kind: 'expr'; source: string; fallback?: number }
  | { kind: 'combine'; op: 'add' | 'multiply' | 'min' | 'max' | 'mix'; inputs: readonly ModulatorDef[]; mix?: number };
export interface Box { x: number; y: number; w: number; h: number }   // the plotting rectangle in SVG pixels
