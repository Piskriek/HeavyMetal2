/**
 * SERVICE SHELLS for waves B and C (physics, render, tools). They are contracts now so wave A code can already depend on their shape;
 * the tasks that implement them may ADD members but must not change or remove these (change requests go through the integrator).
 */
import type { Color, Params, PresetId, Quat, Ref, Unsubscribe, Vec3 } from './core';
import type { Command } from './commands';
import type { CommandBus } from './commands';
import type { PresetStore } from './preset';
import type { EntityId, World } from './sim';
import type { VariableSystem } from './variables';

/* ───────────── physics (T4) ───────────── */

export type ColliderSpec =
  | { readonly shape: 'sphere'; readonly radius: number }
  | { readonly shape: 'box'; readonly half: Vec3 }
  | { readonly shape: 'heightfield'; readonly cols: number; readonly rows: number; readonly cell: number; readonly heights: readonly number[] }
  | { readonly shape: 'mesh'; readonly positions: readonly number[]; readonly indices: readonly number[] };

export interface BodySpec {
  readonly kind: 'dynamic' | 'static' | 'kinematic';
  readonly collider: ColliderSpec;
  readonly mass?: number;
  readonly friction?: number;
  readonly restitution?: number;
  readonly linearDamping?: number;
  readonly angularDamping?: number;
  readonly position: Vec3;
  readonly rotation?: Quat;
  /** Collision tier: 'racing' bodies collide with the road; 'decor' never does (HeavyMetal2's collision tiers). */
  readonly tier?: 'racing' | 'decor' | 'trigger';
}

export interface PhysicsService {
  /** Registers the physics components on the world and a fixed-order system; bodies live on entities (component 'body'). */
  attach(world: World): void;
  addBody(entity: EntityId, spec: BodySpec): void;
  removeBody(entity: EntityId): void;
  applyForce(entity: EntityId, force: Vec3): void;
  applyImpulse(entity: EntityId, impulse: Vec3): void;
  raycast(origin: Vec3, direction: Vec3, maxDistance: number): { readonly entity: EntityId; readonly distance: number; readonly point: Vec3; readonly normal: Vec3 } | null;
  /** Deterministic: same inputs, same order, same result on every machine. */
  step(dt: number): void;
}

/* ───────────── render (T5) ───────────── */

/** A material preset's resolved look: the PBR slots refer to assets from the art pipeline. */
export interface MaterialLook {
  readonly albedo?: string;
  readonly normal?: string;
  readonly orm?: string;
  readonly tint: Color;
  /** World units per texture repeat. */
  readonly repeat: number;
  readonly roughness: number;
  readonly metalness: number;
  readonly normalStrength: number;
}

export interface Pick {
  readonly entity: EntityId | null;
  readonly point: Vec3 | null;
  readonly normal: Vec3 | null;
  readonly distance: number;
}

export interface RenderService {
  /** Mounts a canvas into `host`, syncs from `world` every frame with interpolation alpha. */
  mount(host: HTMLElement, world: World, store: PresetStore): void;
  unmount(): void;
  render(alpha: number): void;
  pick(clientX: number, clientY: number): Pick;
  setCamera(cameraPreset: PresetId): void;
  /** Camera control for tools: orbit/pan/zoom without presets. */
  camera: {
    readonly position: Vec3;
    readonly target: Vec3;
    set(position: Vec3, target: Vec3): void;
    project(world: Vec3): readonly [number, number];
  };
  /** Draws editor-only overlays (gizmos, grids, bounds) that never reach the sim. */
  overlay: { show(id: string, shapes: readonly OverlayShape[]): void; hide(id: string): void };
  onFrame(listener: (dtMs: number) => void): Unsubscribe;
}

export type OverlayShape =
  | { readonly type: 'line'; readonly from: Vec3; readonly to: Vec3; readonly color: Color }
  | { readonly type: 'ring'; readonly center: Vec3; readonly normal: Vec3; readonly radius: number; readonly color: Color }
  | { readonly type: 'box'; readonly center: Vec3; readonly half: Vec3; readonly color: Color }
  | { readonly type: 'handle'; readonly id: string; readonly position: Vec3; readonly color: Color; readonly size: number };

/* ───────────── tools & manipulation presets (T7) ───────────── */

/** Manipulation presets are DATA: how a tool snaps, constrains and pivots. Kind 'manipulation'. */
export interface ManipulationSettings {
  readonly snapGrid: number;        // world units; 0 = off
  readonly snapAngle: number;       // degrees; 0 = off
  readonly snapToSurface: boolean;
  readonly alignToNormal: boolean;
  readonly axes: 'free' | 'x' | 'y' | 'z' | 'xy' | 'xz' | 'yz';
  readonly pivot: 'center' | 'first' | 'ground' | 'cursor';
  readonly space: 'world' | 'local';
  readonly mirror: 'none' | 'x' | 'z';
  readonly array: { readonly count: number; readonly offset: Vec3 };
  readonly magnet: { readonly radius: number; readonly strength: number };
}

export interface Selection {
  readonly ids: readonly PresetId[];
  readonly entities: readonly EntityId[];
}

export interface PointerEventData {
  readonly type: 'down' | 'move' | 'up' | 'wheel';
  readonly x: number;
  readonly y: number;
  readonly button: number;
  readonly shift: boolean;
  readonly ctrl: boolean;
  readonly alt: boolean;
  readonly pick: Pick;
  readonly delta?: number;
}

export interface ToolContext {
  readonly store: PresetStore;
  readonly commands: CommandBus;
  readonly vars: VariableSystem;
  readonly world: World;
  readonly render: RenderService;
  readonly manipulation: ManipulationSettings;
  readonly selection: Selection;
  setSelection(selection: Selection): void;
}

/** A tool turns pointer input into Commands. It never mutates anything itself. Kind 'tool' presets name a built-in tool and its settings. */
export interface Tool {
  readonly id: string;
  readonly label: string;
  readonly cursor: string;
  activate?(ctx: ToolContext): void;
  deactivate?(ctx: ToolContext): void;
  onPointer(ctx: ToolContext, event: PointerEventData): readonly Command[];
  onKey?(ctx: ToolContext, key: string): readonly Command[];
  /** Overlay shapes to draw now (gizmo handles, brush ring...). */
  overlay?(ctx: ToolContext): readonly OverlayShape[];
}

export interface ToolRegistry {
  register(tool: Tool): void;
  get(id: string): Tool | undefined;
  list(): readonly Tool[];
}

export type { Params, Ref };
