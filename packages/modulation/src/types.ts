export interface Range { min: number; max: number }

export interface ModContext {
  timeMs: number;                       // time since the modulator started (the caller supplies it, so it is replayable)
  dtMs: number;                         // time since the previous sample (>= 0)
  tick: number;
  read(path: string): number | undefined;                      // a live data stream, e.g. 'entity:5/velocity.vx' or 'global:speed'
  sampleTexture?(id: string, u: number, v: number): number;    // 0..1 greyscale lookup of a named texture
  evaluate?(source: string, scope: Readonly<Record<string, number>>): number;   // expression language
}

export type Ease = 'linear' | 'in' | 'out' | 'inOut' | 'hold';

export interface Keyframe { timeMs: number; value: number; ease?: Ease }

export type ModulatorDef =
  | { kind: 'constant'; value: number }
  | { kind: 'random'; seed?: number; rateHz: number; mode: 'hold' | 'smooth'; distribution?: 'uniform' | 'gaussian'; out: Range }
  | { kind: 'noise'; seed?: number; freqHz: number; octaves?: number; gain?: number; out: Range }
  | { kind: 'lfo'; wave: 'sine' | 'triangle' | 'saw' | 'square'; freqHz: number; phase?: number /* 0..1 */; width?: number /* square duty 0..1, default 0.5 */; out: Range }
  | { kind: 'curve'; points: readonly (readonly [number, number])[] /* x 0..1, y 0..1, sorted by x */; interpolation: 'linear' | 'smooth' | 'step'; input: { source: 'time'; loopMs: number } | { source: 'stream'; path: string; in: Range }; out: Range }
  | { kind: 'timeline'; durationMs: number; loop: 'none' | 'loop' | 'pingpong'; keys: readonly Keyframe[] }
  | { kind: 'sequence'; steps: readonly number[]; rateHz: number; glideMs?: number; out?: Range /* steps are 0..1 when out is given, else raw values */ }
  | { kind: 'stream'; path: string; scale?: number; offset?: number; smoothMs?: number; clamp?: Range }
  | { kind: 'texture'; textureId: string; u: ModulatorDef; v: ModulatorDef; out: Range }
  | { kind: 'expr'; source: string; fallback?: number }
  | { kind: 'combine'; op: 'add' | 'multiply' | 'min' | 'max' | 'mix'; inputs: readonly ModulatorDef[]; mix?: number /* 0..1 weight of the second input for 'mix' */ };

export interface Modulator { readonly def: ModulatorDef; sample(ctx: ModContext): number; reset(): void }
