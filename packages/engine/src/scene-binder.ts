import type { EntityId, Params, Preset, PresetId, PresetStore, Quat, Ref, Value, World } from '@hm/contracts';
import type { PhysicsEngine } from '@hm/physics';

/**
 * Binds a scene preset to the simulation world: every 'entity' preset in the scene's `entities` slot becomes a world entity
 * (transform + renderable, plus a physics body when body != 'none'). When any preset changes, the binder diffs and updates
 * the world in place (look and, for decoration, placement) or rebuilds that one entity (shape/physics changes).
 * This is the "everything is a preset" loop: inspector -> command -> preset store -> binder -> world -> renderer.
 */

export interface SceneBinder {
  bind(sceneId: PresetId): void;
  unbind(): void;
  /** Re-read the presets now (called automatically on store changes). */
  refresh(): void;
  entityOf(presetId: PresetId): EntityId | undefined;
  presetOf(entity: EntityId): PresetId | undefined;
  readonly sceneId: PresetId | null;
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
    entityOf: (id) => built.get(id)?.entity,
    presetOf: (e) => byEntity.get(e),
    dispose() { this.unbind(); },
  };
}
