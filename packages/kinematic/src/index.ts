export type Vec3 = [number, number, number];
export type Solid = 'solid' | 'ghost' | 'invisible' | 'ladder'; // ghost: no collision; invisible: collides (drawn by nobody); ladder: collides at its sides, climbable
export interface Box { min: Vec3; max: Vec3; kind: Solid }
export interface Ground { heightAt(x: number, z: number): number }
export interface Capsule { radius: number; height: number } // feet at pos, top at pos.y + height
export interface MoveResult { pos: Vec3; onGround: boolean; climbing: boolean; hitWall: boolean; vy: number }

/** Move from pos by the wanted horizontal motion (dx, dz) plus vertical speed vy over dt seconds (gravity 9.8 applied here). Rules below. */
export function move(
  pos: Vec3,
  dx: number,
  dz: number,
  vy: number,
  dt: number,
  cap: Capsule,
  boxes: readonly Box[],
  ground: Ground,
  stepUp?: number
): MoveResult {
  const su = stepUp !== undefined ? stepUp : 0.3;
  const [posX, posY, posZ] = pos;
  const radius = cap.radius;
  const height = cap.height;

  // Check ladder climbing:
  // When capsule touches a ladder box horizontally and wanted motion points into it
  if (Math.hypot(dx, dz) > 1e-9) {
    for (const b of boxes) {
      if (b.kind !== 'ladder') continue;
      const [bMinX, bMinY, bMinZ] = b.min;
      const [bMaxX, bMaxY, bMaxZ] = b.max;
      const minX = Math.min(bMinX, bMaxX);
      const maxX = Math.max(bMinX, bMaxX);
      const minY = Math.min(bMinY, bMaxY);
      const maxY = Math.max(bMinY, bMaxY);
      const minZ = Math.min(bMinZ, bMaxZ);
      const maxZ = Math.max(bMinZ, bMaxZ);

      // Must overlap vertically with the ladder
      if (posY >= maxY || posY + height <= minY) continue;

      // Distance from capsule horizontal circle to ladder box
      const cx = Math.max(minX, Math.min(maxX, posX));
      const cz = Math.max(minZ, Math.min(maxZ, posZ));
      const dist = Math.hypot(posX - cx, posZ - cz);

      if (dist <= radius + 1e-4) {
        // Wanted motion points into it
        const toX = cx - posX;
        const toZ = cz - posZ;
        const dot = dx * toX + dz * toZ;
        const pointsIn = dist > 1e-6 ? dot > 1e-6 : true;

        if (pointsIn) {
          // Climbing: y rises at 2 m/s instead of moving horizontally, vy = 0, no gravity
          let newY = posY + 2 * dt;
          if (newY >= maxY) {
            // At the top it steps onto the ladder's top
            newY = maxY;
            let stepX = posX;
            let stepZ = posZ;
            if (posX < minX) stepX = Math.min(maxX, minX + radius);
            else if (posX > maxX) stepX = Math.max(minX, maxX - radius);
            if (posZ < minZ) stepZ = Math.min(maxZ, minZ + radius);
            else if (posZ > maxZ) stepZ = Math.max(minZ, maxZ - radius);
            return {
              pos: [stepX, newY, stepZ],
              onGround: true,
              climbing: false,
              hitWall: false,
              vy: 0,
            };
          }
          return {
            pos: [posX, newY, posZ],
            onGround: false,
            climbing: true,
            hitWall: false,
            vy: 0,
          };
        }
      }
    }
  }

  // Horizontal motion:
  // Active obstacle boxes that can block horizontally
  const solidBoxes: Box[] = [];
  for (const b of boxes) {
    if (b.kind === 'ghost') continue;
    const minY = Math.min(b.min[1], b.max[1]);
    const maxY = Math.max(b.min[1], b.max[1]);
    // Overlaps vertical span: feet to top
    // Boxes whose top is at or below feet + stepUp do not block: they are stepped onto
    if (maxY > posY + su && minY < posY + height) {
      solidBoxes.push(b);
    }
  }

  let curX = posX;
  let curZ = posZ;
  let remX = dx;
  let remZ = dz;
  let hitWall = false;

  // Slide iterations: at most 4
  for (let iter = 0; iter < 4; iter++) {
    if (Math.hypot(remX, remZ) < 1e-9) break;

    let earliestT = 1;
    let collisionAxis: 'x' | 'z' | null = null;
    let snapX: number | null = null;
    let snapZ: number | null = null;

    for (const b of solidBoxes) {
      const minX = Math.min(b.min[0], b.max[0]);
      const maxX = Math.max(b.min[0], b.max[0]);
      const minZ = Math.min(b.min[2], b.max[2]);
      const maxZ = Math.max(b.min[2], b.max[2]);

      // Left face (x = minX): contact at curX = minX - radius
      if (remX > 1e-9) {
        const targetX = minX - radius;
        const t = (targetX - curX) / remX;
        if (t >= -1e-6 && t < earliestT) {
          const zAtT = curZ + Math.max(0, t) * remZ;
          if (zAtT >= minZ - 1e-6 && zAtT <= maxZ + 1e-6) {
            earliestT = Math.max(0, t);
            collisionAxis = 'x';
            snapX = targetX;
            snapZ = null;
          }
        }
      }

      // Right face (x = maxX): contact at curX = maxX + radius
      if (remX < -1e-9) {
        const targetX = maxX + radius;
        const t = (targetX - curX) / remX;
        if (t >= -1e-6 && t < earliestT) {
          const zAtT = curZ + Math.max(0, t) * remZ;
          if (zAtT >= minZ - 1e-6 && zAtT <= maxZ + 1e-6) {
            earliestT = Math.max(0, t);
            collisionAxis = 'x';
            snapX = targetX;
            snapZ = null;
          }
        }
      }

      // Bottom face (z = minZ): contact at curZ = minZ - radius
      if (remZ > 1e-9) {
        const targetZ = minZ - radius;
        const t = (targetZ - curZ) / remZ;
        if (t >= -1e-6 && t < earliestT) {
          const xAtT = curX + Math.max(0, t) * remX;
          if (xAtT >= minX - 1e-6 && xAtT <= maxX + 1e-6) {
            earliestT = Math.max(0, t);
            collisionAxis = 'z';
            snapZ = targetZ;
            snapX = null;
          }
        }
      }

      // Top face (z = maxZ): contact at curZ = maxZ + radius
      if (remZ < -1e-9) {
        const targetZ = maxZ + radius;
        const t = (targetZ - curZ) / remZ;
        if (t >= -1e-6 && t < earliestT) {
          const xAtT = curX + Math.max(0, t) * remX;
          if (xAtT >= minX - 1e-6 && xAtT <= maxX + 1e-6) {
            earliestT = Math.max(0, t);
            collisionAxis = 'z';
            snapZ = targetZ;
            snapX = null;
          }
        }
      }

      // 4 corners of the box
      const corners: [number, number][] = [
        [minX, minZ],
        [minX, maxZ],
        [maxX, minZ],
        [maxX, maxZ],
      ];
      for (const [cx, cz] of corners) {
        const fx = curX - cx;
        const fz = curZ - cz;
        const A = remX * remX + remZ * remZ;
        const B = 2 * (fx * remX + fz * remZ);
        const C = fx * fx + fz * fz - radius * radius;
        if (A > 1e-12) {
          const disc = B * B - 4 * A * C;
          if (disc >= 0) {
            const t = (-B - Math.sqrt(disc)) / (2 * A);
            if (t >= -1e-6 && t < earliestT) {
              earliestT = Math.max(0, t);
              const nx = curX + earliestT * remX - cx;
              const nz = curZ + earliestT * remZ - cz;
              collisionAxis = Math.abs(nx) >= Math.abs(nz) ? 'x' : 'z';
              snapX = null;
              snapZ = null;
            }
          }
        }
      }
    }

    if (collisionAxis === null) {
      curX += remX;
      curZ += remZ;
      remX = 0;
      remZ = 0;
      break;
    }

    // Collision occurred
    hitWall = true;
    curX += earliestT * remX;
    curZ += earliestT * remZ;
    if (snapX !== null) curX = snapX;
    if (snapZ !== null) curZ = snapZ;

    const remainingFraction = 1 - earliestT;
    if (collisionAxis === 'x') {
      remX = 0;
      remZ = remZ * remainingFraction;
    } else {
      remZ = 0;
      remX = remX * remainingFraction;
    }
  }

  // Vertical motion:
  // vy -= 9.8 * dt; y += vy * dt;
  let newVy = vy - 9.8 * dt;
  let newY = posY + newVy * dt;

  // Head bump: Hitting a box's underside with the head: vy = 0, y stays below it
  for (const b of boxes) {
    if (b.kind === 'ghost') continue;
    const minX = Math.min(b.min[0], b.max[0]);
    const maxX = Math.max(b.min[0], b.max[0]);
    const minY = Math.min(b.min[1], b.max[1]);
    const minZ = Math.min(b.min[2], b.max[2]);
    const maxZ = Math.max(b.min[2], b.max[2]);

    // Head was below underside before move
    if (posY + height <= minY + 1e-4) {
      const cx = Math.max(minX, Math.min(maxX, curX));
      const cz = Math.max(minZ, Math.min(maxZ, curZ));
      if (Math.hypot(curX - cx, curZ - cz) <= radius) {
        if (newY + height >= minY) {
          newY = minY - height;
          if (newVy > 0) newVy = 0;
        }
      }
    }
  }

  // Floor under the feet: higher of ground.heightAt(x, z) and tops of boxes under circle center
  let floor = ground.heightAt(curX, curZ);
  for (const b of boxes) {
    if (b.kind === 'ghost') continue;
    const minX = Math.min(b.min[0], b.max[0]);
    const maxX = Math.max(b.min[0], b.max[0]);
    const maxY = Math.max(b.min[1], b.max[1]);
    const minZ = Math.min(b.min[2], b.max[2]);
    const maxZ = Math.max(b.min[2], b.max[2]);

    // Under circle's centre and not above feet before move + stepUp
    if (curX >= minX && curX <= maxX && curZ >= minZ && curZ <= maxZ) {
      if (maxY <= posY + su + 1e-4) {
        if (maxY > floor) {
          floor = maxY;
        }
      }
    }
  }

  // Landing on it: y = floor, vy = 0, onGround true
  let onGround = false;
  if (newY <= floor) {
    newY = floor;
    newVy = 0;
    onGround = true;
  }

  return {
    pos: [curX, newY, curZ],
    onGround,
    climbing: false,
    hitWall,
    vy: newVy,
  };
}

/** Boxes near a point (a cheap broad phase for the game): those whose box grown by `margin` contains the point. */
export function near(boxes: readonly Box[], p: Vec3, margin: number): Box[] {
  const res: Box[] = [];
  const [px, py, pz] = p;
  for (const b of boxes) {
    const minX = Math.min(b.min[0], b.max[0]) - margin;
    const maxX = Math.max(b.min[0], b.max[0]) + margin;
    const minY = Math.min(b.min[1], b.max[1]) - margin;
    const maxY = Math.max(b.min[1], b.max[1]) + margin;
    const minZ = Math.min(b.min[2], b.max[2]) - margin;
    const maxZ = Math.max(b.min[2], b.max[2]) + margin;

    if (
      px >= minX && px <= maxX &&
      py >= minY && py <= maxY &&
      pz >= minZ && pz <= maxZ
    ) {
      res.push(b);
    }
  }
  return res;
}