export type Vec3 = [number, number, number];

export interface PhysMaterial {
  id: string;
  name: string;
  bounce: number;
  friction: number;
  density: number;
  drag: number;
  lift: number;
}

export type Solidity = 'ghost' | 'solid' | 'barrier' | 'ladder';

export interface Body {
  shape: 'box' | 'sphere';
  half: Vec3;
  radius: number;
  mass: number;
  material: string;
  solidity: Solidity;
  dynamic: boolean;
}

export interface Motion {
  pos: Vec3;
  vel: Vec3;
}

export const PHYS_MATERIALS: readonly PhysMaterial[] = [
  { id: 'wood', name: 'Wood', bounce: 0.3, friction: 0.6, density: 600, drag: 0.02, lift: 0 },
  { id: 'rubber', name: 'Rubber', bounce: 0.9, friction: 0.8, density: 1100, drag: 0, lift: 0 },
  { id: 'ice', name: 'Ice', bounce: 0.08, friction: 0.02, density: 917, drag: 0.01, lift: 0 },
  { id: 'metal', name: 'Metal', bounce: 0.2, friction: 0.5, density: 7800, drag: 0.01, lift: 0 },
  { id: 'anvil', name: 'Anvil', bounce: 0.05, friction: 0.7, density: 10000, drag: 0, lift: 0 },
  { id: 'balloon', name: 'Balloon', bounce: 0.2, friction: 0.1, density: 1, drag: 0.2, lift: 1.2 },
  { id: 'cork', name: 'Cork', bounce: 0.5, friction: 0.4, density: 240, drag: 0.04, lift: 0.1 },
  { id: 'stone', name: 'Stone', bounce: 0.15, friction: 0.75, density: 2500, drag: 0.01, lift: 0 },
  { id: 'jelly', name: 'Jelly', bounce: 0.6, friction: 0.9, density: 1100, drag: 0.08, lift: 0 },
];

export function materialById(id: string): PhysMaterial {
  for (const material of PHYS_MATERIALS) {
    if (material.id === id) return material;
  }
  return PHYS_MATERIALS[0]!;
}

export function bodyFor(
  min: Vec3,
  max: Vec3,
  materialId: string,
  solidity: Solidity,
  dynamic: boolean,
): Body {
  const half: Vec3 = [
    Math.abs(max[0] - min[0]) / 2,
    Math.abs(max[1] - min[1]) / 2,
    Math.abs(max[2] - min[2]) / 2,
  ];
  const smallest = Math.min(half[0], half[1], half[2]);
  const largest = Math.max(half[0], half[1], half[2]);
  const isSphere = smallest > 0 && largest / smallest <= 1.2;
  const radius = isSphere ? (half[0] + half[1] + half[2]) / 3 : 0;
  const material = materialById(materialId);
  const volume = isSphere
    ? (4 / 3) * Math.PI * radius * radius * radius
    : 8 * half[0] * half[1] * half[2];

  return {
    shape: isSphere ? 'sphere' : 'box',
    half,
    radius,
    mass: material.density * volume,
    material: material.id,
    solidity,
    dynamic,
  };
}

export function stepBody(b: Body, m: Motion, dt: number, groundY: number): Motion {
  if (!b.dynamic || b.solidity === 'ghost') {
    return { pos: [m.pos[0], m.pos[1], m.pos[2]], vel: [m.vel[0], m.vel[1], m.vel[2]] };
  }

  const material = materialById(b.material);
  const dragFactor = 1 - material.drag * dt;
  const restingY = groundY + (b.shape === 'sphere' ? b.radius : b.half[1]);
  let vx = m.vel[0] * dragFactor;
  let vy = (m.vel[1] - 9.81 * (1 - material.lift) * dt) * dragFactor;
  let vz = m.vel[2] * dragFactor;
  const px = m.pos[0] + vx * dt;
  let py = m.pos[1] + vy * dt;
  const pz = m.pos[2] + vz * dt;
  let onGround = false;

  if (py <= restingY) {
    py = restingY;
    onGround = true;
    if (vy < 0) {
      vy = -vy * material.bounce;
      if (vy < 0.05) vy = 0;
    }
  }

  if (onGround) {
    const horizontalSpeed = Math.hypot(vx, vz);
    const speedLoss = material.friction * 9.81 * dt;
    if (horizontalSpeed <= speedLoss) {
      vx = 0;
      vz = 0;
    } else if (horizontalSpeed > 0) {
      const scale = (horizontalSpeed - speedLoss) / horizontalSpeed;
      vx *= scale;
      vz *= scale;
    }
  }

  return { pos: [px, py, pz], vel: [vx, vy, vz] };
}

export function hammer(
  centre: Vec3,
  radius: number,
  strength: number,
  bodies: readonly { body: Body; motion: Motion }[],
): Vec3[] {
  return bodies.map(({ body, motion }): Vec3 => {
    if (!body.dynamic || body.mass <= 0 || radius <= 0) {
      return [motion.vel[0], motion.vel[1], motion.vel[2]];
    }

    const dx = motion.pos[0] - centre[0];
    const dy = motion.pos[1] - centre[1];
    const dz = motion.pos[2] - centre[2];
    const distance = Math.hypot(dx, dy, dz);
    const horizontalDistance = Math.hypot(dx, dz);
    if (distance === 0 || distance >= radius || horizontalDistance === 0) {
      return [motion.vel[0], motion.vel[1], motion.vel[2]];
    }

    const impulse = (strength * (1 - distance / radius) * 1000) / body.mass;
    return [
      motion.vel[0] + (dx / horizontalDistance) * impulse,
      motion.vel[1] + impulse * 0.3,
      motion.vel[2] + (dz / horizontalDistance) * impulse,
    ];
  });
}