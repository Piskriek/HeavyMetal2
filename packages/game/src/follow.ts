import type { ComponentDef, System, Value, World } from '@hm/contracts';
import { quatFromYaw, quatMul, rotateVec, type Quat, type Vec3 } from '@hm/goblins';

/**
 * 'attach': an entity glued to a parent: it keeps a local offset and orientation and follows the parent's POSITION and
 * its heading (yaw) only, never its rolling. This is how a goblin sits upright inside a ball that spins under it.
 */

export const attachDef: ComponentDef = {
  name: 'attach',
  defaults: { parent: 0, lx: 0, ly: 0, lz: 0, qx: 0, qy: 0, qz: 0, qw: 1 },
  fields: [
    { key: 'parent', type: 'int', label: 'Parent', doc: 'The entity this one follows.', tier: 'pro', default: 0 },
    ...(['lx', 'ly', 'lz'] as const).map((key) => ({ key, type: 'number' as const, label: `Offset ${key.slice(1)}`, doc: 'Position relative to the parent.', tier: 'pro' as const, default: 0, step: 0.01 })),
    ...(['qx', 'qy', 'qz', 'qw'] as const).map((key) => ({ key, type: 'number' as const, label: `Rotation ${key.slice(1)}`, doc: 'Local rotation (quaternion).', tier: 'pro' as const, default: key === 'qw' ? 1 : 0, step: 0.001 })),
  ],
};

export function defineAttachComponent(world: Pick<World, 'components' | 'defineComponent'>): void {
  if (!world.components().some((c) => c.name === 'attach')) world.defineComponent(attachDef);
}

const num = (v: Value | undefined, fallback = 0): number => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);

/** Runs after physics (order 100): moves every attached entity to its parent's place. */
export const FOLLOW_SYSTEM_ORDER = 110;
export function createFollowSystem(): System {
  return {
    name: 'follow',
    order: FOLLOW_SYSTEM_ORDER,
    update(world) {
      for (const id of world.query('attach', 'transform')) {
        const a = world.get(id, 'attach')!;
        const parent = num(a['parent']);
        if (!world.alive(parent)) continue;
        const pt = world.get(parent, 'transform');
        if (!pt) continue;
        const racer = world.get(parent, 'racer');
        const yaw = racer ? Math.atan2(num(racer['hz']), num(racer['hx'], 1)) : 0;
        const qYaw = quatFromYaw(yaw);
        const local: Vec3 = [num(a['lx']), num(a['ly']), num(a['lz'])];
        const p = rotateVec(qYaw, local);
        const q: Quat = quatMul(qYaw, [num(a['qx']), num(a['qy']), num(a['qz']), num(a['qw'], 1)]);
        world.set(id, 'transform', { x: num(pt['x']) + p[0], y: num(pt['y']) + p[1], z: num(pt['z']) + p[2], qx: q[0], qy: q[1], qz: q[2], qw: q[3] });
      }
    },
  };
}
