export type Value = number | boolean | string | null | readonly Value[] | { readonly [k: string]: Value };
export type Vec2 = readonly [number, number];
export type Vec3 = readonly [number, number, number];
export interface VariableDef { readonly key: string; readonly type: 'number' | 'int' | 'boolean' | 'string' | 'enum'; readonly label: string; readonly doc: string; readonly tier: 'play' | 'build' | 'pro'; readonly default: Value; readonly min?: number; readonly max?: number; readonly step?: number; readonly options?: readonly string[] }
export interface ComponentDef { readonly name: string; readonly defaults: Record<string, Value>; readonly fields: readonly VariableDef[] }
export interface RacerWorld {   // the slice of the simulation World this system uses
  defineComponent(def: ComponentDef): void; components(): readonly ComponentDef[];
  alive(id: number): boolean; has(id: number, component: string): boolean;
  get(id: number, component: string): Readonly<Record<string, Value>> | undefined;
  set(id: number, component: string, values: Readonly<Record<string, Value>>): void;
  query(...components: string[]): readonly number[];   // ascending entity ids
}
export interface StepContext { readonly dt: number; readonly tick: number; readonly rng: { next(): number }; readonly input: { readonly tick: number; readonly actors: Readonly<Record<string, Readonly<Record<string, number | boolean>>>> }; readonly events: { emit(name: string, payload: unknown): void } }
export interface System { readonly name: string; readonly order: number; update(world: RacerWorld, ctx: StepContext): void }
export interface PhysicsLike { applyForce(entity: number, force: Vec3): void; applyImpulse(entity: number, impulse: Vec3): void }
export interface Track { points: readonly Vec2[]; width: number }
export interface LapState { lap: number; progress: number; finished: boolean; lapCompleted: boolean }
export interface LapTrackerLike { update(p: Vec2): LapState; reset(): void; readonly state: LapState }
export interface RacerDeps {
  physics: PhysicsLike; track: Track; laps: number;
  derivePhysics(s: { weight: number; speed: number; bounce: number }): { mass: number; maxSpeed: number; acceleration: number; restitution: number; grip: number };
  aiControl(track: Track, s: { x: number; z: number; hx: number; hz: number; speed: number }, skill: { lookahead: number; cornerCare: number; noise: number }, rng: () => number): { steer: number; throttle: number };
  rubberBand(position: number, racers: number): number;
  createLapTracker(track: Track, laps: number): LapTrackerLike;
  rankRacers(states: readonly { id: string; progress: number }[]): { id: string; position: number }[];
  itemById(id: string): { id: string; kind: 'self' | 'drop' | 'area'; durationMs: number; /** what it does (defaults to the id); 'anchor' and 'mass' are the same */ effect?: string; power?: number; radius?: number } | undefined;
}
