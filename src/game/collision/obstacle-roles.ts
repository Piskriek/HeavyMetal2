/**
 * IF-COLLISION-TERRAIN: Obstacle and mesh role definitions and dispatchers.
 */

export type CollisionRole = 'decoration' | 'barrier' | 'terrain' | 'hazard' | 'boost_gate' | 'trigger';

export interface RoleConfig {
  role: CollisionRole;
  restitution?: number; // for barrier, default 0.6
  boostImpulse?: number; // for boost_gate, default 300
  hazardReason?: string; // for hazard, default 'hazard'
}

export const DEFAULT_ROLE_CONFIGS: Record<CollisionRole, RoleConfig> = {
  decoration: { role: 'decoration' },
  barrier: { role: 'barrier', restitution: 0.6 },
  terrain: { role: 'terrain' },
  hazard: { role: 'hazard', hazardReason: 'hazard' },
  boost_gate: { role: 'boost_gate', boostImpulse: 300 },
  trigger: { role: 'trigger' },
};

export function parseCollisionRole(roleStr: unknown): CollisionRole {
  if (
    roleStr === 'barrier' ||
    roleStr === 'terrain' ||
    roleStr === 'hazard' ||
    roleStr === 'boost_gate' ||
    roleStr === 'trigger'
  ) {
    return roleStr;
  }
  return 'decoration';
}
