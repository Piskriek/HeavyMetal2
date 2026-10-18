// ============================================================================
// File: packages/plotsim/src/turret-brain.ts
// TASK-32 / TICKET-13 (Item a): Pure Perimeter Defense Turret Target Selector
// - Targets sappers first, then swarmers (then other hostiles), within 35 m
// - Never fires into the 25 m Twin Gate safe dome or any 15 m Pylon/Beacon dome
// - Never fires at the player or through built base pieces (solids)
// - Draws 2 kW on the 12 kW Gate scale; rate of fire scales with brownout satisfaction
// - Outputs yaw, pitch, #ffc13d laser state, and shot readiness
// - 100% pure & deterministic: no DOM, no Date.now(), no Math.random()
// ============================================================================

export const TURRET_RANGE_M = 35.0;
export const TURRET_POWER_DRAW_KW = 2.0;
export const TURRET_BASE_ROF_HZ = 2.5; // 2.5 shots/s at 100% satisfaction (0.4s cooldown)
export const TURRET_BASE_COOLDOWN_S = 1.0 / TURRET_BASE_ROF_HZ;
export const TURRET_DAMAGE_PER_SHOT = 14.0;
export const TURRET_LASER_HEX = '#ffc13d' as const;

export const GATE_SAFE_DOME_RADIUS_M = 25.0;
export const PYLON_SAFE_DOME_RADIUS_M = 15.0;
export const PLAYER_LINE_OF_FIRE_CLEARANCE_M = 1.25;
export const TURRET_MAX_PITCH_RAD = Math.PI / 3; // +/- 60 deg trunnion elevation limits

/**
 * Named socket constants for the 3-part turret (`turret-base`, `turret-yoke`, `turret-gun`)
 * plus the procedural code-built round barrel & square muzzle shroud (`20-turret-s6.png`).
 * Opus can overwrite these measured offsets once the 3D PC finishes packing the 3 GLBs.
 */
export const TURRET_SOCKET_CONSTANTS = Object.freeze({
  /** The turntable top: the base plate's top, where the yoke's bottom sits (m). Measured on the packed turret-base (0.672 m). */
  YAW_AXIS_HEIGHT_M: 0.672,
  /** Height from the yoke turntable to the gun's trunnion pitch axis (m). Measured on the packed turret-yoke. */
  TRUNNION_HEIGHT_ON_YOKE_M: 0.639,
  /** Total height of the pitch trunnion axis above the mount (m): YAW_AXIS_HEIGHT_M + TRUNNION_HEIGHT_ON_YOKE_M. */
  TOTAL_TRUNNION_HEIGHT_M: 1.311,
  /** The gun mesh's origin, relative to the pitch pivot [x, y, z] (m): its pivot bosses sit on the trunnion axis. */
  GUN_MESH_OFFSET_FROM_PIVOT_M: Object.freeze([0.0, -0.241, -0.091] as const),
  /** The square barrel collar (0.15 m block) on the gun, relative to the pitch pivot [x, y, z] (m). */
  BARREL_COLLAR_OFFSET_M: Object.freeze([0.0, 0.059, 0.359] as const),
  /** The collar block's size [width, height, depth] (m). */
  BARREL_COLLAR_SIZE_M: Object.freeze([0.15, 0.15, 0.1] as const),
  /** Procedural round barrel dimensions: radius and length (m). The radius is kept at 0.045 so it fits the 0.15 m collar. */
  BARREL_CYLINDER_RADIUS_M: 0.045,
  BARREL_CYLINDER_LENGTH_M: 0.52,
  /** Square muzzle shroud dimensions [width, height, depth] (m). It sits on the barrel's front end. */
  MUZZLE_SHROUD_SIZE_M: Object.freeze([0.13, 0.13, 0.16] as const),
  /** The #ffc13d laser emitter (under the collar), relative to the pitch pivot [x, y, z] (m). */
  LASER_EMITTER_OFFSET_M: Object.freeze([0.0, -0.101, 0.359] as const),
  /** Muzzle tip, relative to the pitch pivot [x, y, z] (m): the collar, plus the 0.52 m barrel, plus the 0.16 m shroud. */
  MUZZLE_TIP_OFFSET_M: Object.freeze([0.0, 0.059, 1.039] as const),
});

/**
 * The emitter's place in the mount frame, for the gun's current pose: the pitch is applied first (about X, the trunnions),
 * then the yaw (about the yoke's vertical axis), as the view rotates the yoke and then the gun inside it. Yaw is the angle
 * from +z toward +x (atan2(dx, dz)); pitch is the elevation, positive up.
 */
export function gunPointToMount(
  local: readonly [number, number, number],
  yaw: number,
  pitch: number,
): { readonly x: number; readonly y: number; readonly z: number } {
  const [lx, ly, lz] = local;
  // rotation about X by -pitch (three.js gunPivot.rotation.x = -pitch)
  const a = -pitch;
  const cy = Math.cos(a), sy = Math.sin(a);
  const y1 = ly * cy - lz * sy;
  const z1 = ly * sy + lz * cy;
  // rotation about Y by yaw (three.js yokePivot.rotation.y = yaw)
  const cs = Math.cos(yaw), sn = Math.sin(yaw);
  return { x: lx * cs + z1 * sn, y: y1, z: -lx * sn + z1 * cs };
}

export type TurretMobArchetype = 'sapper' | 'swarmer' | 'charger' | 'spitter' | 'brute' | string;

export interface TurretCandidateMob {
  readonly id: number;
  readonly kind: TurretMobArchetype;
  readonly x: number;
  readonly y?: number;
  readonly z: number;
  readonly hp: number;
  readonly phase?: string;
}

export interface TurretSafeDome {
  readonly x: number;
  readonly z: number;
  readonly r: number;
  readonly kind?: 'gate' | 'pylon' | 'beacon' | 'shelter';
}

export interface TurretSolidBox {
  readonly minX: number;
  readonly maxX: number;
  readonly minZ: number;
  readonly maxZ: number;
}

export interface TurretBrainInput {
  readonly turret: {
    readonly x: number;
    readonly y?: number;
    readonly z: number;
    readonly currentYaw?: number;
    readonly currentPitch?: number;
    readonly cooldownLeftS?: number;
  };
  readonly satisfaction0to1: number;
  readonly dt: number;
  readonly mobs: readonly TurretCandidateMob[];
  readonly gateDome: { readonly x: number; readonly z: number; readonly r?: number };
  readonly extraSafeDomes?: readonly TurretSafeDome[];
  readonly player?: { readonly x: number; readonly z: number } | null;
  readonly solids?: readonly TurretSolidBox[];
}

export interface TurretBrainOutput {
  readonly targetId: number | null;
  readonly targetKind: TurretMobArchetype | null;
  readonly yaw: number;
  readonly pitch: number;
  readonly distanceM: number | null;
  readonly laserActive: boolean;
  readonly laserColour: typeof TURRET_LASER_HEX;
  readonly laserFrom: { readonly x: number; readonly y: number; readonly z: number };
  readonly laserTo: { readonly x: number; readonly y: number; readonly z: number } | null;
  readonly fired: boolean;
  readonly damageDealt: number;
  readonly nextCooldownS: number;
  readonly effectiveRofHz: number;
  readonly powerDrawKw: number;
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

function archetypePriority(kind: TurretMobArchetype): number {
  if (kind === 'sapper') return 0; // Highest priority: protects machines from drain
  if (kind === 'swarmer') return 1; // Second priority: ankle-biter packs
  if (kind === 'spitter') return 2;
  if (kind === 'charger') return 3;
  return 4;
}

/**
 * Returns true if point (px, pz) is strictly inside circle (cx, cz, r) or if the
 * 2D segment from (ax, az) to (bx, bz) passes inside circle (cx, cz, r).
 */
export function segmentHitsCircle2D(
  ax: number,
  az: number,
  bx: number,
  bz: number,
  cx: number,
  cz: number,
  r: number,
): boolean {
  if (r <= 0) return false;
  const rSq = r * r;
  const dbx = bx - cx;
  const dbz = bz - cz;
  if (dbx * dbx + dbz * dbz <= rSq) return true;

  const vx = bx - ax;
  const vz = bz - az;
  const lenSq = vx * vx + vz * vz;
  if (lenSq < 1e-9) {
    return (ax - cx) * (ax - cx) + (az - cz) * (az - cz) <= rSq;
  }
  const t = clamp(((cx - ax) * vx + (cz - az) * vz) / lenSq, 0, 1);
  // If the turret itself is mounted on a wall inside a pylon dome (t === 0), allow firing outward
  // as long as the target is outside the dome and the ray is moving away from the dome center.
  if (t <= 1e-4) {
    const dotOut = (ax - cx) * vx + (az - cz) * vz;
    if (dotOut >= 0) return false;
  }
  const nearX = ax + t * vx;
  const nearZ = az + t * vz;
  const distSq = (nearX - cx) * (nearX - cx) + (nearZ - cz) * (nearZ - cz);
  return distSq < rSq - 1e-6;
}

/**
 * Returns true if the 2D segment from (ax, az) to (bx, bz) intersects an axis-aligned box.
 */
export function segmentHitsBox2D(
  ax: number,
  az: number,
  bx: number,
  bz: number,
  box: TurretSolidBox,
): boolean {
  const dx = bx - ax;
  const dz = bz - az;
  let tmin = 0.02; // ignore tiny overlap at the turret's own mounting wall
  let tmax = 0.99;

  if (Math.abs(dx) < 1e-9) {
    if (ax < box.minX || ax > box.maxX) return false;
  } else {
    const invX = 1 / dx;
    let t1 = (box.minX - ax) * invX;
    let t2 = (box.maxX - ax) * invX;
    if (t1 > t2) {
      const tmp = t1;
      t1 = t2;
      t2 = tmp;
    }
    tmin = Math.max(tmin, t1);
    tmax = Math.min(tmax, t2);
    if (tmin > tmax) return false;
  }

  if (Math.abs(dz) < 1e-9) {
    if (az < box.minZ || az > box.maxZ) return false;
  } else {
    const invZ = 1 / dz;
    let t1 = (box.minZ - az) * invZ;
    let t2 = (box.maxZ - az) * invZ;
    if (t1 > t2) {
      const tmp = t1;
      t1 = t2;
      t2 = tmp;
    }
    tmin = Math.max(tmin, t1);
    tmax = Math.min(tmax, t2);
    if (tmin > tmax) return false;
  }

  return tmin <= tmax;
}

/**
 * Pure per-frame turret brain evaluator.
 */
export function stepTurretBrain(input: TurretBrainInput): TurretBrainOutput {
  const sat = Number.isFinite(input.satisfaction0to1) ? clamp(input.satisfaction0to1, 0, 1) : 0;
  const dt = Number.isFinite(input.dt) ? Math.max(0, input.dt) : 0;
  const tx = input.turret.x;
  const ty = (input.turret.y ?? 0) + TURRET_SOCKET_CONSTANTS.TOTAL_TRUNNION_HEIGHT_M;
  const tz = input.turret.z;
  const prevYaw = input.turret.currentYaw ?? 0;
  const prevPitch = input.turret.currentPitch ?? 0;
  const prevCooldown = Math.max(0, (input.turret.cooldownLeftS ?? 0) - dt);

  const effectiveRofHz = sat > 0 ? Number((TURRET_BASE_ROF_HZ * sat).toFixed(4)) : 0;
  // the emitter follows the gun: its place for the pose it is in (yaw and pitch), not the pivot
  const emitterAt = (yaw: number, pitch: number): { readonly x: number; readonly y: number; readonly z: number } => {
    const p = gunPointToMount(TURRET_SOCKET_CONSTANTS.LASER_EMITTER_OFFSET_M, yaw, pitch);
    return { x: tx + p.x, y: ty + p.y, z: tz + p.z };
  };

  if (sat <= 0) {
    return {
      targetId: null,
      targetKind: null,
      yaw: prevYaw,
      pitch: prevPitch,
      distanceM: null,
      laserActive: false,
      laserColour: TURRET_LASER_HEX,
      laserFrom: emitterAt(prevYaw, prevPitch),
      laserTo: null,
      fired: false,
      damageDealt: 0,
      nextCooldownS: prevCooldown,
      effectiveRofHz: 0,
      powerDrawKw: 0,
    };
  }

  const gateR = input.gateDome.r ?? GATE_SAFE_DOME_RADIUS_M;
  const allDomes: TurretSafeDome[] = [
    { x: input.gateDome.x, z: input.gateDome.z, r: gateR, kind: 'gate' },
    ...(input.extraSafeDomes ?? []).map((d) => ({
      x: d.x,
      z: d.z,
      r: d.r > 0 ? d.r : PYLON_SAFE_DOME_RADIUS_M,
      kind: d.kind ?? 'pylon',
    })),
  ];

  const valid: Array<{ readonly mob: TurretCandidateMob; readonly distM: number; readonly prio: number }> = [];

  for (const mob of input.mobs) {
    if (mob.hp <= 0 || mob.phase === 'dead') continue;
    const dx = mob.x - tx;
    const dz = mob.z - tz;
    const dist2D = Math.hypot(dx, dz);
    if (dist2D > TURRET_RANGE_M || dist2D < 0.25) continue;

    // 1. Never target inside or fire into any safe dome (25m Gate dome or 15m Pylon/Beacon dome)
    let hitsDome = false;
    for (const dome of allDomes) {
      const mobDistToDome = Math.hypot(mob.x - dome.x, mob.z - dome.z);
      if (mobDistToDome <= dome.r) {
        hitsDome = true;
        break;
      }
      if (segmentHitsCircle2D(tx, tz, mob.x, mob.z, dome.x, dome.z, dome.r)) {
        hitsDome = true;
        break;
      }
    }
    if (hitsDome) continue;

    // 2. Never fire at or through the player
    if (input.player) {
      if (segmentHitsCircle2D(tx, tz, mob.x, mob.z, input.player.x, input.player.z, PLAYER_LINE_OF_FIRE_CLEARANCE_M)) {
        continue;
      }
    }

    // 3. Never fire through built base pieces (solids)
    if (input.solids && input.solids.length > 0) {
      let hitsSolid = false;
      for (const box of input.solids) {
        if (segmentHitsBox2D(tx, tz, mob.x, mob.z, box)) {
          hitsSolid = true;
          break;
        }
      }
      if (hitsSolid) continue;
    }

    valid.push({
      mob,
      distM: dist2D,
      prio: archetypePriority(mob.kind),
    });
  }

  valid.sort((a, b) => a.prio - b.prio || a.distM - b.distM || a.mob.id - b.mob.id);
  const best = valid[0];

  if (!best) {
    return {
      targetId: null,
      targetKind: null,
      yaw: prevYaw,
      pitch: 0,
      distanceM: null,
      laserActive: false,
      laserColour: TURRET_LASER_HEX,
      laserFrom: emitterAt(prevYaw, 0),
      laserTo: null,
      fired: false,
      damageDealt: 0,
      nextCooldownS: prevCooldown,
      effectiveRofHz,
      powerDrawKw: TURRET_POWER_DRAW_KW,
    };
  }

  const targetY = (best.mob.y ?? 0) + 0.65; // center mass of mob
  const dx = best.mob.x - tx;
  const dy = targetY - ty;
  const dz = best.mob.z - tz;
  const horizDist = Math.max(1e-4, Math.hypot(dx, dz));

  const yaw = Number(Math.atan2(dx, dz).toFixed(4));
  const pitch = Number(clamp(Math.atan2(dy, horizDist), -TURRET_MAX_PITCH_RAD, TURRET_MAX_PITCH_RAD).toFixed(4));

  const canFireNow = prevCooldown <= 1e-6;
  const shotIntervalS = 1.0 / effectiveRofHz;
  const nextCooldownS = canFireNow ? Number(shotIntervalS.toFixed(4)) : Number(prevCooldown.toFixed(4));

  return {
    targetId: best.mob.id,
    targetKind: best.mob.kind,
    yaw,
    pitch,
    distanceM: Number(best.distM.toFixed(3)),
    laserActive: true,
    laserColour: TURRET_LASER_HEX,
    laserFrom: emitterAt(yaw, pitch),
    laserTo: { x: best.mob.x, y: targetY, z: best.mob.z },
    fired: canFireNow,
    damageDealt: canFireNow ? TURRET_DAMAGE_PER_SHOT : 0,
    nextCooldownS,
    effectiveRofHz,
    powerDrawKw: TURRET_POWER_DRAW_KW,
  };
}
