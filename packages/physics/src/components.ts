import type { ComponentDef, EntityId, Value, VariableDef, Vec3 } from '@hm/contracts';
import type { PhysWorld } from './physics';
import type { Q4, V3 } from './math';

const velocityDefaults = { vx: 0, vy: 0, vz: 0, wx: 0, wy: 0, wz: 0 };
const bodyDefaults = {
  mass: 1, radius: 0.5, friction: 0.5, restitution: 0,
  linearDamping: 0.02, angularDamping: 0.05, tier: 'racing',
};
const positionKeys = ['x', 'y', 'z'];
const velocityKeys = ['vx', 'vy', 'vz'];
const spinKeys = ['wx', 'wy', 'wz'];
const rotationKeys = ['qx', 'qy', 'qz', 'qw'];
const field = (key: string, label: string, doc: string, def: Value, tier: 'build' | 'pro', options: Partial<VariableDef> = {}): VariableDef =>
  ({ key, type: 'number', label, doc, default: def, tier, ...options });

export const velocityDef: ComponentDef = {
  name: 'velocity', defaults: velocityDefaults,
  fields: [
    field('vx', 'X speed', 'World-space horizontal speed.', 0, 'pro', { step: 0.01, unit: 'm/s' }),
    field('vy', 'Y speed', 'World-space vertical speed.', 0, 'pro', { step: 0.01, unit: 'm/s' }),
    field('vz', 'Z speed', 'World-space depth speed.', 0, 'pro', { step: 0.01, unit: 'm/s' }),
    field('wx', 'X spin', 'Angular speed around the world X axis.', 0, 'pro', { step: 0.01, unit: 'rad/s' }),
    field('wy', 'Y spin', 'Angular speed around the world Y axis.', 0, 'pro', { step: 0.01, unit: 'rad/s' }),
    field('wz', 'Z spin', 'Angular speed around the world Z axis.', 0, 'pro', { step: 0.01, unit: 'rad/s' }),
  ],
};
export const bodyDef: ComponentDef = {
  name: 'body', defaults: bodyDefaults,
  fields: [
    field('mass', 'Mass', 'Mass of the sphere; zero is treated as one.', 1, 'build', { min: 0, step: 0.1, unit: 'kg' }),
    field('radius', 'Radius', 'Collision radius of the sphere.', 0.5, 'build', { min: 0.001, step: 0.01, unit: 'm' }),
    field('friction', 'Friction', 'Coefficient of contact friction.', 0.5, 'build', { min: 0, step: 0.01 }),
    field('restitution', 'Restitution', 'Bounce coefficient at impact.', 0, 'build', { min: 0, max: 1, step: 0.01 }),
    field('linearDamping', 'Linear damping', 'Drag applied to linear velocity each step.', 0.02, 'pro', { min: 0, step: 0.01, unit: '1/s' }),
    field('angularDamping', 'Angular damping', 'Drag applied to angular velocity each step.', 0.05, 'pro', { min: 0, step: 0.01, unit: '1/s' }),
    field('tier', 'Collision tier', 'Selects which surfaces and bodies can collide.', 'racing', 'pro', { type: 'enum', options: ['racing', 'decor', 'trigger'] }),
  ],
};

export function definePhysicsComponents(world: PhysWorld): void {
  const names = world.components().map((def) => def.name);
  if (!names.includes('transform')) throw new Error("Physics requires the 'transform' component to be defined by the renderer first");
  if (!names.includes('velocity')) world.defineComponent(velocityDef);
  if (!names.includes('body')) world.defineComponent(bodyDef);
}

export function numberField(entity: EntityId, data: Readonly<Record<string, Value>>, fieldName: string): number {
  const value = data[fieldName];
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`Physics entity ${entity}: invalid ${fieldName}`);
  return value;
}

export interface BallState {
  id: EntityId;
  p: V3;
  v: V3;
  w: V3;
  q: Q4;
  mass: number;
  invMass: number;
  radius: number;
  friction: number;
  restitution: number;
  linearDamping: number;
  angularDamping: number;
  tier: 'racing' | 'decor' | 'trigger';
}

export function readBall(world: PhysWorld, id: EntityId): BallState | null {
  const t = world.get(id, 'transform'), v = world.get(id, 'velocity'), b = world.get(id, 'body');
  if (!t || !v || !b) return null;
  const n = (data: Readonly<Record<string, Value>>, key: string): number => numberField(id, data, key);
  const tier = b.tier;
  if (tier !== 'racing' && tier !== 'decor' && tier !== 'trigger') throw new Error(`Physics entity ${id}: invalid tier`);
  const rawMass = n(b, 'mass');
  const mass = rawMass === 0 ? 1 : rawMass;
  const radius = n(b, 'radius');
  if (mass < 0 || radius <= 0) throw new Error(`Physics entity ${id}: mass and radius must be positive`);
  const friction = n(b, 'friction'), restitution = n(b, 'restitution');
  const linearDamping = n(b, 'linearDamping'), angularDamping = n(b, 'angularDamping');
  if (friction < 0) throw new Error(`Physics entity ${id}: invalid friction`);
  if (restitution < 0 || restitution > 1) throw new Error(`Physics entity ${id}: invalid restitution`);
  if (linearDamping < 0) throw new Error(`Physics entity ${id}: invalid linearDamping`);
  if (angularDamping < 0) throw new Error(`Physics entity ${id}: invalid angularDamping`);
  return {
    id, p: [n(t, 'x'), n(t, 'y'), n(t, 'z')],
    q: [n(t, 'qx'), n(t, 'qy'), n(t, 'qz'), n(t, 'qw')],
    v: [n(v, 'vx'), n(v, 'vy'), n(v, 'vz')],
    w: [n(v, 'wx'), n(v, 'wy'), n(v, 'wz')],
    mass, invMass: 1 / mass, radius,
    friction, restitution, linearDamping, angularDamping, tier,
  };
}

export function writeBall(world: PhysWorld, b: BallState): void {
  for (let i = 0; i < 3; i++) {
    if (!Number.isFinite(b.p[i])) throw new Error(`Physics entity ${b.id}: invalid ${positionKeys[i]}`);
    if (!Number.isFinite(b.v[i])) throw new Error(`Physics entity ${b.id}: invalid ${velocityKeys[i]}`);
    if (!Number.isFinite(b.w[i])) throw new Error(`Physics entity ${b.id}: invalid ${spinKeys[i]}`);
  }
  for (let i = 0; i < 4; i++) {
    if (!Number.isFinite(b.q[i])) throw new Error(`Physics entity ${b.id}: invalid ${rotationKeys[i]}`);
  }
  world.set(b.id, 'transform', { x: b.p[0], y: b.p[1], z: b.p[2], qx: b.q[0], qy: b.q[1], qz: b.q[2], qw: b.q[3] });
  world.set(b.id, 'velocity', { vx: b.v[0], vy: b.v[1], vz: b.v[2], wx: b.w[0], wy: b.w[1], wz: b.w[2] });
}

export function vecField(entity: EntityId, data: Readonly<Record<string, Value>>, names: readonly [string, string, string]): Vec3 {
  return [numberField(entity, data, names[0]), numberField(entity, data, names[1]), numberField(entity, data, names[2])];
}