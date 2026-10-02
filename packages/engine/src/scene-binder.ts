import type { EntityId, Params, Preset, PresetId, PresetStore, Quat, Ref, Value, World } from '@hm/contracts';
import type { PhysicsEngine } from '@hm/physics';
import { decodeTerrain, toHeightfield, type Terrain } from '@hm/terrain';

/**
 * Binds a scene preset to the simulation world: every 'entity' preset in the scene's `entities` slot becomes a world entity
 * (transform + renderable, plus a physics body when body != 'none'). When any preset changes, the binder diffs and updates
 * the world in place (look and, for decoration, placement) or rebuilds that one entity (shape/physics changes).
 * This is the "everything is a preset" loop: inspector -> command -> preset store -> binder -> world -> renderer.
 */

/** The decoded ground of the bound scene (null when it has none). `version` changes whenever it is rebuilt from its preset. */
export interface TerrainState {
  readonly presetId: PresetId;
  readonly terrain: Terrain;
  readonly version: number;
  readonly look: { readonly soft: number; readonly bump: number };
}

/** One prop placement decoded from the decor preset. */
export interface DecorPlacement { readonly kind: string; readonly x: number; readonly y: number; readonly z: number; readonly yaw: number; readonly scale: number }
export interface DecorState { readonly presetId: PresetId; readonly placements: readonly DecorPlacement[]; readonly version: number }

export interface SceneBinder {
  bind(sceneId: PresetId): void;
  unbind(): void;
  /** Re-read the presets now (called automatically on store changes). */
  refresh(): void;
  entityOf(presetId: PresetId): EntityId | undefined;
  presetOf(entity: EntityId): PresetId | undefined;
  readonly sceneId: PresetId | null;
  terrain(): TerrainState | null;
  decor(): DecorState | null;
  onDecor(listener: (state: DecorState | null) => void): () => void;
  /** Called whenever the ground is (re)built or removed; returns the unsubscribe. */
  onTerrain(listener: (state: TerrainState | null) => void): () => void;
  dispose(): void;
}

const SLOT = 'entities';
const round6 = (n: number): number => Math.round(n * 1e6) / 1e6;
const num = (p: Params, key: string, fallback: number): number => {
  const v = p[key];
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
};
const str = (p: Params, key: string, fallback: string): string => {
  const v = p[key];
  return typeof v === 'string' ? v : fallback;
};
const isRef = (v: Value | undefined): v is Ref => typeof v === 'object' && v !== null && !Array.isArray(v) && typeof (v as { ref?: unknown }).ref === 'string';

/** Rotation about +Y; rounded so every JS engine produces the identical quaternion (replays must match across devices). */
export function yawQuat(deg: number): Quat {
  const h = (deg * Math.PI) / 360;
  return [0, round6(Math.sin(h)), 0, round6(Math.cos(h))];
}

interface Look { color: string; roughness: number; metalness: number; albedo: string; normal: string; orm: string; repeat: number; normalStrength: number }

function lookOf(store: PresetStore, p: Params): { look: Look; key: string } {
  let src: Params = p;
  let key = '';
  const m = p['material'];
  if (isRef(m)) {
    const mat = store.get(m.ref, m.rev);
    if (mat) { src = { ...p, ...store.resolve(m.ref, m.rev).params }; key = `${mat.id}@${mat.hash}`; }
  }
  const look: Look = {
    color: str(src, 'color', '#cccccc'), roughness: num(src, 'roughness', 0.6), metalness: num(src, 'metalness', 0),
    albedo: str(src, 'albedo', ''), normal: str(src, 'normal', ''), orm: str(src, 'orm', ''),
    repeat: num(src, 'repeat', 1), normalStrength: num(src, 'normalStrength', 1),
  };
  return { look, key: key + JSON.stringify(look) };
}

type Shape = 'sphere' | 'box' | 'cylinder' | 'plane';
const SHAPES: readonly string[] = ['sphere', 'box', 'cylinder', 'plane'];

interface Built {
  entity: EntityId;
  structural: string;
  lookKey: string;
  body: 'none' | 'static' | 'dynamic';
}

export function createSceneBinder(opts: { readonly store: PresetStore; readonly world: World; readonly physics?: PhysicsEngine }): SceneBinder {
  const { store, world, physics } = opts;
  const built = new Map<PresetId, Built>();
  const byEntity = new Map<EntityId, PresetId>();
  let scene: PresetId | null = null;
  let unsub: (() => void) | null = null;
  let busy = false;
  let ground: { state: TerrainState; hash: string; entity: EntityId } | null = null;
  let groundVersion = 0;
  const groundListeners = new Set<(s: TerrainState | null) => void>();
  let decorState: { state: DecorState; hash: string } | null = null;
  let decorVersion = 0;
  const decorListeners = new Set<(s: DecorState | null) => void>();
  const syncDecor = (sp: Preset | undefined): void => {
    const ref = sp?.children['decor']?.[0];
    const preset = ref ? store.get(ref.ref, ref.rev) : undefined;
    if (!ref || !preset) {
      if (decorState) { decorState = null; for (const l of decorListeners) l(null); }
      return;
    }
    if (decorState && decorState.state.presetId === preset.id && decorState.hash === preset.hash) return;
    const kinds = (preset.params['kinds'] as unknown as string[] | undefined) ?? [];
    const flat = (preset.params['items'] as unknown as number[] | undefined) ?? [];
    const placements: DecorPlacement[] = [];
    for (let i = 0; i + 5 < flat.length; i += 6) {
      const kind = kinds[flat[i]!];
      if (kind) placements.push({ kind, x: flat[i + 1]!, y: flat[i + 2]!, z: flat[i + 3]!, yaw: flat[i + 4]!, scale: flat[i + 5]! });
    }
    const state: DecorState = { presetId: preset.id, placements, version: ++decorVersion };
    decorState = { state, hash: preset.hash };
    for (const l of decorListeners) l(state);
  };

  const clearGround = (): void => {
    if (!ground) return;
    physics?.removeBody(ground.entity);
    if (world.alive(ground.entity)) world.despawn(ground.entity);
    ground = null;
    for (const l of groundListeners) l(null);
  };

  const syncGround = (sp: Preset | undefined): void => {
    const ref = sp?.children['terrain']?.[0];
    const preset = ref ? store.get(ref.ref, ref.rev) : undefined;
    if (!ref || !preset) { clearGround(); return; }
    if (ground && ground.state.presetId === preset.id && ground.hash === preset.hash) return;
    let terrain: Terrain;
    try {
      terrain = decodeTerrain(preset.params['data'] as never);
    } catch {
      clearGround();
      return;
    }
    const params = store.resolve(preset.id, ref.rev).params;
    if (ground) { physics?.removeBody(ground.entity); if (world.alive(ground.entity)) world.despawn(ground.entity); }
    const entity = world.spawn(ref);
    const hf = toHeightfield(terrain);
    physics?.addBody(entity, {
      kind: 'static', collider: { shape: 'heightfield', cols: hf.cols, rows: hf.rows, cell: hf.cell, heights: hf.heights },
      position: hf.position, friction: num(params, 'friction', 0.8), restitution: num(params, 'restitution', 0), tier: 'racing',
    });
    const state: TerrainState = { presetId: preset.id, terrain, version: ++groundVersion, look: { soft: num(params, 'soft', 0.6), bump: num(params, 'bump', 1) } };
    ground = { state, hash: preset.hash, entity };
    for (const l of groundListeners) l(state);
  };

  const paramsOf = (ref: Ref): { preset: Preset; params: Params } | null => {
    const preset = store.get(ref.ref, ref.rev);
    if (!preset) return null;
    return { preset, params: store.resolve(ref.ref, ref.rev).params };
  };

  const renderable = (p: Params, look: Look): Record<string, Value> => {
    const shape = str(p, 'shape', 'box');
    return {
      shape: SHAPES.includes(shape) ? shape : 'box', size: num(p, 'size', 0.5), color: look.color, roughness: look.roughness,
      metalness: look.metalness, albedo: look.albedo, normal: look.normal, orm: look.orm, repeat: look.repeat,
      normalStrength: look.normalStrength, visible: p['visible'] !== false,
    };
  };

  const transform = (p: Params): Record<string, Value> => {
    const q = yawQuat(num(p, 'yaw', 0));
    return { x: num(p, 'x', 0), y: num(p, 'y', 0), z: num(p, 'z', 0), qx: q[0], qy: q[1], qz: q[2], qw: q[3], sx: num(p, 'scaleX', 1), sy: num(p, 'scaleY', 1), sz: num(p, 'scaleZ', 1) };
  };

  const bodyKind = (p: Params): 'none' | 'static' | 'dynamic' => {
    const b = str(p, 'body', 'none');
    return b === 'static' || b === 'dynamic' ? b : 'none';
  };

  const structuralKey = (p: Params, body: 'none' | 'static' | 'dynamic'): string => {
    const base = [str(p, 'shape', 'box'), num(p, 'size', 0.5), num(p, 'scaleX', 1), num(p, 'scaleY', 1), num(p, 'scaleZ', 1), body, num(p, 'mass', 1), num(p, 'friction', 0.5), num(p, 'restitution', 0)];
    // decoration can be moved in place; physical things are rebuilt when they are moved by the editor
    if (body !== 'none') base.push(num(p, 'x', 0), num(p, 'y', 0), num(p, 'z', 0), num(p, 'yaw', 0));
    return base.join('|');
  };

  const spawn = (id: PresetId, ref: Ref): Built | null => {
    const r = paramsOf(ref);
    if (!r) return null;
    const p = r.params;
    const { look, key } = lookOf(store, p);
    const body = bodyKind(p);
    const t = transform(p);
    const shape = str(p, 'shape', 'box') as Shape;
    const size = num(p, 'size', 0.5);
    const maxScale = Math.max(num(p, 'scaleX', 1), num(p, 'scaleY', 1), num(p, 'scaleZ', 1));
    let entity: EntityId;
    if (body === 'dynamic' && physics) {
      entity = world.spawn(ref);
      physics.addBody(entity, {
        kind: 'dynamic', collider: { shape: 'sphere', radius: size * maxScale }, mass: num(p, 'mass', 1), friction: num(p, 'friction', 0.5),
        restitution: num(p, 'restitution', 0), position: [t['x'] as number, t['y'] as number, t['z'] as number], rotation: [t['qx'] as number, t['qy'] as number, t['qz'] as number, t['qw'] as number], tier: 'racing',
      });
      world.set(entity, 'transform', { sx: t['sx'] as number, sy: t['sy'] as number, sz: t['sz'] as number });
      world.add(entity, 'renderable', renderable(p, look));
    } else {
      entity = world.spawn(ref, { transform: t, renderable: renderable(p, look) });
      if (body === 'static' && physics) {
        const sx = num(p, 'scaleX', 1), sy = num(p, 'scaleY', 1), sz = num(p, 'scaleZ', 1);
        const half: readonly [number, number, number] = shape === 'plane' ? [size * sx, 0.01, size * sz] : shape === 'sphere' ? [size * maxScale, size * maxScale, size * maxScale] : [size * sx, size * sy, size * sz];
        physics.addBody(entity, {
          kind: 'static', collider: { shape: 'box', half }, friction: num(p, 'friction', 0.5), restitution: num(p, 'restitution', 0),
          position: [t['x'] as number, t['y'] as number, t['z'] as number], rotation: [t['qx'] as number, t['qy'] as number, t['qz'] as number, t['qw'] as number], tier: 'racing',
        });
      }
    }
    byEntity.set(entity, id);
    return { entity, structural: structuralKey(p, body), lookKey: key, body };
  };

  const despawn = (b: Built): void => {
    if (b.body === 'static') physics?.removeBody(b.entity);
    if (world.alive(b.entity)) world.despawn(b.entity);
    byEntity.delete(b.entity);
  };

  const refresh = (): void => {
    if (busy || scene === null) return;
    busy = true;
    try {
      const sp = store.get(scene);
      syncGround(sp);
      syncDecor(sp);
      const refs = sp?.children[SLOT] ?? [];
      const wanted = new Set<PresetId>();
      for (const ref of refs) {
        const r = paramsOf(ref);
        if (!r) continue;
        wanted.add(ref.ref);
        const have = built.get(ref.ref);
        const p = r.params;
        const body = bodyKind(p);
        const { look, key } = lookOf(store, p);
        const structural = structuralKey(p, body);
        if (!have) {
          const b = spawn(ref.ref, ref);
          if (b) built.set(ref.ref, b);
          continue;
        }
        if (have.structural !== structural || (have.body !== body)) {
          despawn(have);
          const b = spawn(ref.ref, ref);
          if (b) built.set(ref.ref, b); else built.delete(ref.ref);
          continue;
        }
        if (have.lookKey !== key || body === 'none') {
          // in-place: appearance always, placement only for decoration (physical things belong to the sim)
          world.set(have.entity, 'renderable', renderable(p, look));
          if (body === 'none') world.set(have.entity, 'transform', transform(p));
          have.lookKey = key;
        }
      }
      for (const [id, b] of [...built]) {
        if (!wanted.has(id)) { despawn(b); built.delete(id); }
      }
    } finally {
      busy = false;
    }
  };

  const clear = (): void => {
    clearGround();
    if (decorState) { decorState = null; for (const l of decorListeners) l(null); }
    for (const b of built.values()) despawn(b);
    built.clear();
    byEntity.clear();
  };

  return {
    get sceneId() { return scene; },
    bind(sceneId) {
      this.unbind();
      scene = sceneId;
      unsub = store.subscribe(() => refresh());
      refresh();
    },
    unbind() {
      unsub?.(); unsub = null;
      clear();
      scene = null;
    },
    refresh,
    terrain: () => ground?.state ?? null,
    decor: () => decorState?.state ?? null,
    onDecor(listener) { decorListeners.add(listener); return () => { decorListeners.delete(listener); }; },
    onTerrain(listener) { groundListeners.add(listener); return () => { groundListeners.delete(listener); }; },
    entityOf: (id) => built.get(id)?.entity,
    presetOf: (e) => byEntity.get(e),
    dispose() { this.unbind(); },
  };
}
