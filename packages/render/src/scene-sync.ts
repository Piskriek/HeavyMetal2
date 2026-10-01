import type { ComponentDef, EntityId, Quat, Value, ValueType, Vec3, World } from '@hm/contracts';
import type { PickItem } from './pick-math';

const transformDefaults = {
  x: 0, y: 0, z: 0,
  qx: 0, qy: 0, qz: 0, qw: 1,
  sx: 1, sy: 1, sz: 1,
} satisfies Record<string, Value>;

const renderableDefaults = {
  shape: 'box', size: 0.5, color: '#ffffff', roughness: 0.6, metalness: 0,
  albedo: '', normal: '', orm: '', repeat: 1, normalStrength: 1, visible: true,
} satisfies Record<string, Value>;

type FieldOptions = {
  readonly tier?: 'play' | 'build' | 'pro';
  readonly min?: number;
  readonly max?: number;
  readonly step?: number;
  readonly options?: readonly string[];
};

const field = (key: string, type: ValueType, label: string, doc: string, defaultValue: Value, options: FieldOptions = {}) => ({
  key, type, label, doc, default: defaultValue, tier: options.tier ?? 'build' as const,
  ...(options.min === undefined ? {} : { min: options.min }),
  ...(options.max === undefined ? {} : { max: options.max }),
  ...(options.step === undefined ? {} : { step: options.step }),
  ...(options.options === undefined ? {} : { options: options.options }),
});

const transformDef: ComponentDef = {
  name: 'transform', defaults: transformDefaults,
  fields: [
    field('x', 'number', 'X', 'World position on the X axis.', 0, { step: 0.01 }),
    field('y', 'number', 'Y', 'World position on the Y axis.', 0, { step: 0.01 }),
    field('z', 'number', 'Z', 'World position on the Z axis.', 0, { step: 0.01 }),
    field('qx', 'number', 'Quaternion X', 'X component of the local rotation.', 0, { min: -1, max: 1, step: 0.001 }),
    field('qy', 'number', 'Quaternion Y', 'Y component of the local rotation.', 0, { min: -1, max: 1, step: 0.001 }),
    field('qz', 'number', 'Quaternion Z', 'Z component of the local rotation.', 0, { min: -1, max: 1, step: 0.001 }),
    field('qw', 'number', 'Quaternion W', 'W component of the local rotation.', 1, { min: -1, max: 1, step: 0.001 }),
    field('sx', 'number', 'Scale X', 'Local scale on the X axis.', 1, { min: 0, max: 1000, step: 0.01 }),
    field('sy', 'number', 'Scale Y', 'Local scale on the Y axis.', 1, { min: 0, max: 1000, step: 0.01 }),
    field('sz', 'number', 'Scale Z', 'Local scale on the Z axis.', 1, { min: 0, max: 1000, step: 0.01 }),
  ],
};

const renderableDef: ComponentDef = {
  name: 'renderable', defaults: renderableDefaults,
  fields: [
    field('shape', 'enum', 'Shape', 'Primitive geometry to render.', 'box', { tier: 'play', options: ['sphere', 'box', 'cylinder', 'plane'] }),
    field('size', 'number', 'Size', 'Base radius or half extent.', 0.5, { tier: 'play', min: 0.001, max: 1000, step: 0.01 }),
    field('color', 'color', 'Color', 'Base material color.', '#ffffff', { tier: 'play' }),
    field('roughness', 'number', 'Roughness', 'Surface microsurface roughness.', 0.6, { tier: 'pro', min: 0, max: 1, step: 0.01 }),
    field('metalness', 'number', 'Metalness', 'Surface metallic response.', 0, { tier: 'pro', min: 0, max: 1, step: 0.01 }),
    field('albedo', 'asset', 'Albedo Map', 'Color texture asset path.', '', { tier: 'pro' }),
    field('normal', 'asset', 'Normal Map', 'Normal texture asset path.', '', { tier: 'pro' }),
    field('orm', 'asset', 'ORM Map', 'Occlusion, roughness and metalness texture path.', '', { tier: 'pro' }),
    field('repeat', 'number', 'Texture Repeat', 'Texture tiling in each direction.', 1, { tier: 'pro', min: 0.01, max: 100, step: 0.01 }),
    field('normalStrength', 'number', 'Normal Strength', 'Strength of the normal map.', 1, { tier: 'pro', min: 0, max: 4, step: 0.01 }),
    field('visible', 'boolean', 'Visible', 'Whether the entity is rendered.', true),
  ],
};

/** The slice of the sim World the render package needs. */
export type RenderWorld = Pick<World, 'tick' | 'defineComponent' | 'components' | 'alive' | 'has' | 'get' | 'query' | 'drainChanges'>;

export function defineRenderComponents(world: RenderWorld): void {
  const have = new Set(world.components().map((c) => c.name));
  if (!have.has('transform')) world.defineComponent(transformDef);
  if (!have.has('renderable')) world.defineComponent(renderableDef);
}

export interface RenderDesc {
  readonly shape: 'sphere' | 'box' | 'cylinder' | 'plane';
  readonly size: number;
  readonly color: string;
  readonly roughness: number;
  readonly metalness: number;
  readonly albedo: string;
  readonly normal: string;
  readonly orm: string;
  readonly repeat: number;
  readonly normalStrength: number;
  readonly visible: boolean;
  readonly position: Vec3;
  readonly rotation: Quat;
  readonly scale: Vec3;
}

export interface SceneAdapter {
  create(id: EntityId, desc: RenderDesc): void;
  update(id: EntityId, desc: RenderDesc): void;
  remove(id: EntityId): void;
}

export interface SceneSync {
  step(): void;
  present(alpha: number): void;
  dispose(): void;
  items(): readonly PickItem[];
}

const numberValue = (value: Value | undefined, fallback: number): number => typeof value === 'number' && Number.isFinite(value) ? value : fallback;
const stringValue = (value: Value | undefined, fallback: string): string => typeof value === 'string' ? value : fallback;
const boolValue = (value: Value | undefined, fallback: boolean): boolean => typeof value === 'boolean' ? value : fallback;
const shapes = new Set<RenderDesc['shape']>(['sphere', 'box', 'cylinder', 'plane']);

const readDesc = (world: RenderWorld, id: EntityId): RenderDesc => {
  const t = { ...transformDefaults, ...world.get(id, 'transform') };
  const r = { ...renderableDefaults, ...world.get(id, 'renderable') };
  const shapeValue = stringValue(r.shape, 'box');
  return {
    shape: shapes.has(shapeValue as RenderDesc['shape']) ? shapeValue as RenderDesc['shape'] : 'box',
    size: numberValue(r.size, 0.5), color: stringValue(r.color, '#ffffff'),
    roughness: numberValue(r.roughness, 0.6), metalness: numberValue(r.metalness, 0),
    albedo: stringValue(r.albedo, ''), normal: stringValue(r.normal, ''), orm: stringValue(r.orm, ''),
    repeat: numberValue(r.repeat, 1), normalStrength: numberValue(r.normalStrength, 1), visible: boolValue(r.visible, true),
    position: [numberValue(t.x, 0), numberValue(t.y, 0), numberValue(t.z, 0)],
    rotation: [numberValue(t.qx, 0), numberValue(t.qy, 0), numberValue(t.qz, 0), numberValue(t.qw, 1)],
    scale: [numberValue(t.sx, 1), numberValue(t.sy, 1), numberValue(t.sz, 1)],
  };
};

const equal = (a: RenderDesc, b: RenderDesc): boolean =>
  a.shape === b.shape && a.size === b.size && a.color === b.color && a.roughness === b.roughness &&
  a.metalness === b.metalness && a.albedo === b.albedo && a.normal === b.normal && a.orm === b.orm &&
  a.repeat === b.repeat && a.normalStrength === b.normalStrength && a.visible === b.visible &&
  a.position.every((v, i) => v === b.position[i]) && a.rotation.every((v, i) => v === b.rotation[i]) &&
  a.scale.every((v, i) => v === b.scale[i]);

const mix3 = (a: Vec3, b: Vec3, t: number): Vec3 => [
  a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t,
];

const nlerp = (a: Quat, b: Quat, t: number): Quat => {
  const sign = a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3] < 0 ? -1 : 1;
  const q: [number, number, number, number] = [
    a[0] + (sign * b[0] - a[0]) * t, a[1] + (sign * b[1] - a[1]) * t,
    a[2] + (sign * b[2] - a[2]) * t, a[3] + (sign * b[3] - a[3]) * t,
  ];
  const length = Math.hypot(...q);
  return length > 1e-12 ? [q[0] / length, q[1] / length, q[2] / length, q[3] / length] : [0, 0, 0, 1];
};

type Node = { prev: RenderDesc; curr: RenderDesc; last: RenderDesc };

export function createSceneSync(world: RenderWorld, adapter: SceneAdapter): SceneSync {
  const nodes = new Map<EntityId, Node>();
  return {
    step(): void {
      world.drainChanges();
      const currentIds = new Set(world.query('transform', 'renderable'));
      for (const [id] of nodes) {
        if (!currentIds.has(id)) {
          adapter.remove(id);
          nodes.delete(id);
        }
      }
      for (const id of currentIds) {
        const next = readDesc(world, id);
        const node = nodes.get(id);
        if (!node) {
          adapter.create(id, next);
          nodes.set(id, { prev: next, curr: next, last: next });
        } else if (!equal(node.curr, next)) {
          node.prev = node.curr;
          node.curr = next;
        }
      }
    },
    present(alpha: number): void {
      const t = Math.min(1, Math.max(0, alpha));
      for (const [id, node] of nodes) {
        const shown: RenderDesc = { ...node.curr, position: mix3(node.prev.position, node.curr.position, t), rotation: nlerp(node.prev.rotation, node.curr.rotation, t), scale: mix3(node.prev.scale, node.curr.scale, t) };
        if (!equal(shown, node.last)) {
          adapter.update(id, shown);
          node.last = shown;
        }
      }
    },
    dispose(): void {
      for (const id of nodes.keys()) adapter.remove(id);
      nodes.clear();
    },
    items(): readonly PickItem[] {
      return [...nodes].flatMap(([entity, node]) => node.curr.visible ? [{ entity, shape: node.curr.shape, center: node.curr.position, size: node.curr.size }] : []);
    },
  };
}