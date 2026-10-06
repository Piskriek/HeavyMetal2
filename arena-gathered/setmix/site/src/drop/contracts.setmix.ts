/* ============================================================================
 *  packages/contracts/src/setmix.ts
 *  ---------------------------------------------------------------------------
 *  SetMix: The Resolution Crafter — the one source of truth.
 *
 *  ZERO DEPENDENCIES. Types only. No imports, not even from @hm/texgraph —
 *  the texgraph DAG shape is declared structurally below so that `contracts`
 *  remains the root of the dependency graph (kernel principle 6).
 *
 *  Everything downstream (fidelity, field, mesh, outliner, audio, export)
 *  imports from here and from nothing else.
 * ==========================================================================*/

/* ───────────────────────────── texgraph (structural mirror) ───────────── */

export interface TexNode {
  id: string;
  type:
    | "noise" | "cellular" | "grain" | "stripes" | "checker" | "constant"
    | "warp" | "curl" | "blend" | "levels" | "invert" | "ramp" | "scaleBias";
  [param: string]: unknown;
}

export interface TexGraph {
  id: string;
  name: string;
  nodes: TexNode[];
  out: { albedo?: string; height?: string; roughness?: string };
}

export interface Bounds { x0: number; y0: number; x1: number; y1: number }

export interface EvaluateOptions {
  size?: number;
  seed?: number;
  relief?: number;
  normal?: boolean;
  bounds?: Bounds;
}

export type TexelSize = 16 | 32 | 64 | 128 | 256 | 512 | 1024 | 2048 | 4096;

/* ───────────────────────────────── kernel conformance ─────────────────── */

/** Every parameter is a Variable. `label` is poetic, `real` is the true
 *  technical term — Jargon Mode is a toggle between two fields of one record.
 *  `tier` maps onto the harness's three depths: 1 play · 2 build · 3 pro. */
export interface VarDecl {
  path: string;
  label: string;
  real: string;
  unit: string;
  min: number;
  max: number;
  step: number;
  def: number;
  explain: string;
  tier: 1 | 2 | 3;
}

/** One node type: Preset. Immutable revisions, copy-on-write forks,
 *  content hashes. */
export interface PresetHeader {
  id: string;
  rev: number;
  name: string;
  kind: string;
  hash: string;
  parents: string[];
  author: string;
}

export type CartClass = "MATERIAL" | "OPERATOR" | "RULE" | "BIOME" | "MESH" | "RIG";

export interface Cartridge extends PresetHeader {
  kind: "setmix.cartridge";
  cls: CartClass;
  graph: TexGraph;
  vars: VarDecl[];
  minStage: Stage;
  affinity: Partial<Record<MetricKey, number>>;
  tint: string;
}

/* ───────────────────────────────────── fidelity ───────────────────────── */

export type MetricKey = "pxd" | "vtx" | "lx" | "aq";
export type Stage = 1 | 2 | 3 | 4 | 5 | 6;

/** The entire save state of a planet, besides its cartridge graph. */
export interface FidelityState {
  pxd: number;
  vtx: number;
  lx: number;
  aq: number;
  tick: number;
}

export interface Emitter {
  id: string;
  metric: MetricKey;
  tier: 0 | 1 | 2 | 3;
  base: number;
  clock: number;
  cartridge?: string;
  pos: [number, number];
}

export interface StepOptions {
  clockSupply: number;
  maintenance: number;
  ticks?: number;
}

/* ───────────────────────────────────── rendering ──────────────────────── */

export interface DeviceProfile {
  id: string;
  label: string;
  maxTexel: TexelSize;
  msBudget: number;
  allowNormal: boolean;
  allowWarp: boolean;
  maxOctaves: number;
}

/** The output of the single seam between simulation and rendering. */
export interface RenderBudget {
  stage: Stage;
  size: TexelSize;
  octaveBudget: number;
  relief: number;
  normal: boolean;
  roughness: boolean;
  /** −1 = hard 4-colour ramp · 0 = truecolour · n = n levels per channel */
  paletteLevels: number;
  shadowCascades: number;
  allowWarp: boolean;
  allowCellular: boolean;
  wetness: number;
  demoted: string[];
}

/* ───────────────────────────────────── field ──────────────────────────── */

export type Vec2 = readonly [number, number];
export type ChunkWaveState = "DORMANT" | "APPROACHING" | "INSIDE_BAND" | "STABILIZED";

export interface WaveSource {
  id: string;
  spireId: string;
  cartridgeId: string | null;
  pos: Vec2;
  startedAt: number;
  tier: number;
  bandwidth: number;
  complexity: number;
  dir: 1 | -1;
  reversedAt?: number;
  reversedElapsed?: number;
  influence: number;
  dominance: number;
}

export interface ChunkRef {
  id: string;
  cx: number;
  cz: number;
  centre: Vec2;
  radius: number;
}

export interface ChunkWaveSample {
  state: ChunkWaveState;
  sourceId: string | null;
  phase: number;
  coverage: number;
  edgeDist: number;
  needsRemesh: boolean;
}

export interface ChunkSchedule {
  chunkId: string;
  sourceId: string;
  tEnter: number;
  tExit: number;
  reachable: boolean;
}

/* ───────────────────────────────────── mesh ───────────────────────────── */

export type MeshMode = "CUBIC" | "CHAMFER" | "DUAL";

export interface MeshPolicy {
  lod: number;
  cellSize: number;
  mode: MeshMode;
  chamfer: number;
  relaxIterations: number;
  smoothAngleDeg: number;
  qefClamp: number;
  stage: Stage;
}

export interface SmoothvoxRequest {
  cellSize: number;
  mode: MeshMode;
  chamfer: number;
  relaxIterations: number;
  qefClamp: number;
  smoothAngleDeg: number;
  sharpFeatureThreshold: number;
  generateSkirts: boolean;
  skirtDepth: number;
  boundaryPolicy: "own" | "coarser-neighbour";
  triplanarSharpness: number;
  maxMaterialsPerVertex: 1 | 2 | 4;
}

/* ───────────────────────────────────── outliner ───────────────────────── */

export type ScopeKind =
  | "GALAXY" | "SYSTEM" | "MOON" | "BIOME" | "CHUNK"
  | "OBJECT" | "CARTRIDGE" | "TEXNODE" | "VARIABLE";

export type ToolId =
  | "POINTER" | "BRUSH" | "SCULPT" | "TIMELINE" | "SPEAKER" | "CHARACTER";

export interface OutlinerNode {
  id: string;
  kind: ScopeKind;
  name: string;
  parentId: string | null;
  childIds: string[];
  visible: boolean;
  locked: boolean;
  tris?: number;
  ms?: number;
  lod?: string;
  tint?: string;
  payload?: {
    cartridge?: Cartridge;
    texNode?: TexNode;
    variable?: VarDecl;
    value?: number;
    metrics?: Record<MetricKey, number>;
    chunk?: { cx: number; cz: number; state: ChunkWaveState; policy: string };
  };
}

/* ───────────────────────────────────── commands ───────────────────────── */

export interface Command<T = unknown> {
  type: string;
  /** sim tick at 120 Hz — every edit is replayable */
  at: number;
  payload: T;
}

export type SetmixCommand =
  | Command<{ emitterId: string; cartridgeId: string | null }>
  | Command<{ a: string; b: string; dominance: number }>
  | Command<{ path: string; value: number }>
  | Command<{ cartridgeId: string }>
  | Command<{ id: string; metric: MetricKey; tier: number; pos: Vec2 }>
  | Command<{ reactorId: string; factor: number }>
  | Command<{ nodeId: string }>
  | Command<{ nodeId: string; name: string }>
  | Command<{ nodeId: string; parentId: string }>
  | Command<{ tool: ToolId; mode: string }>;

export const SETMIX_COMMAND_TYPES = [
  "setmix/slotCartridge",
  "setmix/fuse",
  "setmix/setVariable",
  "setmix/printCartridge",
  "setmix/placeEmitter",
  "setmix/overclock",
  "setmix/zoomScope",
  "setmix/renameNode",
  "setmix/reparentNode",
  "setmix/selectTool",
  "setmix/cycleHotbar",
  "setmix/promoteToPreset",
] as const;

export type SetmixCommandType = (typeof SETMIX_COMMAND_TYPES)[number];

/* ───────────────────────────────────── export gate ────────────────────── */

export interface Certificate {
  nodes: number;
  weight: number;
  texels: number;
  evalMs: number;
  minStage: number;
  determinism: "seed-stable";
  pass: boolean;
  failures: string[];
}

export interface FusionResult {
  child: Cartridge | null;
  confidence: number;
  grammar: string;
  rationale: string;
  addedNodes: string[];
}

/* ───────────────────────────────────── constants ──────────────────────── */

export const TICK_HZ = 120;

export const FI_WEIGHTS: Readonly<Record<MetricKey, number>> = Object.freeze({
  pxd: 0.3, vtx: 0.3, lx: 0.25, aq: 0.15,
});

export const METRIC_TARGET: Readonly<Record<MetricKey, number>> = Object.freeze({
  pxd: 1.24e8, vtx: 9.4e7, lx: 6.6e7, aq: 4.1e7,
});

/** Fi thresholds; index i is the floor of stage i+1. */
export const STAGE_FI: readonly number[] = Object.freeze([
  0, 1.2e3, 3.0e4, 7.5e5, 5.0e6, 2.6e7, 1.0e8,
]);

export const TEXEL_LADDER: readonly TexelSize[] = Object.freeze([
  16, 32, 64, 128, 256, 512,
]);

export const CELL_LADDER: readonly number[] = Object.freeze([8, 4, 2, 1, 0.5, 0.25]);
