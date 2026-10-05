export type Vec3 = [number, number, number];
export type Solid = 'solid' | 'ghost' | 'invisible' | 'ladder';
export interface Box { min: Vec3; max: Vec3; kind: Solid }
export interface Ground { heightAt(x: number, z: number): number }
export interface Capsule { radius: number; height: number }
export interface MoveResult { pos: Vec3; onGround: boolean; climbing: boolean; hitWall: boolean; vy: number }

const EPS = 1e-6;

function closestDistSq(cx: number, cz: number, box: Box): number {
  const closestX = Math.max(box.min[0], Math.min(cx, box.max[0]));
  const closestZ = Math.max(box.min[2], Math.min(cz, box.max[2]));
  return (cx - closestX) * (cx - closestX) + (cz - closestZ) * (cz - closestZ);
}

function overlapsHorizontally(x: number, z: number, r: number, box: Box): boolean {
  return closestDistSq(x, z, box) < r * r + EPS;
}

function overlapsHorizontallyOrTouches(x: number, z: number, r: number, box: Box): boolean {
  return closestDistSq(x, z, box) <= r * r + EPS;
}

function capsuleBlockedHorizontally(x: number, z: number, y: number, r: number, h: number, box: Box, stepUp: number): boolean {
  if (box.kind === 'ghost') return false;
  if (box.max[1] <= y || box.min[1] >= y + h) return false;
  if (box.max[1] <= y + stepUp + EPS) return false;
  return overlapsHorizontally(x, z, r, box);
}

function isUnderCircle(x: number, z: number, r: number, box: Box): boolean {
  return overlapsHorizontallyOrTouches(x, z, r, box);
}

export function near(boxes: readonly Box[], p: Vec3, margin: number): Box[] {
  const [px, py, pz] = p;
  return boxes.filter((box) => {
    return px >= box.min[0] - margin - EPS &&
           px <= box.max[0] + margin + EPS &&
           py >= box.min[1] - margin - EPS &&
           py <= box.max[1] + margin + EPS &&
           pz >= box.min[2] - margin - EPS &&
           pz <= box.max[2] + margin + EPS;
  });
}

function collidesCapsule(x: number, z: number, y: number, r: number, h: number, boxes: readonly Box[], stepUp: number): boolean {
  for (const box of boxes) {
    if (capsuleBlockedHorizontally(x, z, y, r, h, box, stepUp)) return true;
  }
  return false;
}

function findSafeAxisX(startX: number, z: number, y: number, dx: number, r: number, h: number, boxes: readonly Box[], stepUp: number): number {
  let lo = 0; let hi = 1;
  for (let i = 0; i < 10; i++) {
    const mid = (lo + hi) / 2;
    const testX = startX + dx * mid;
    if (collidesCapsule(testX, z, y, r, h, boxes, stepUp)) hi = mid;
    else lo = mid;
  }
  return startX + dx * lo;
}

function findSafeAxisZ(x: number, startZ: number, y: number, dz: number, r: number, h: number, boxes: readonly Box[], stepUp: number): number {
  let lo = 0; let hi = 1;
  for (let i = 0; i < 10; i++) {
    const mid = (lo + hi) / 2;
    const testZ = startZ + dz * mid;
    if (collidesCapsule(x, testZ, y, r, h, boxes, stepUp)) hi = mid;
    else lo = mid;
  }
  return startZ + dz * lo;
}

function slideHorizontal(x: number, z: number, dx: number, dz: number, y: number, r: number, h: number, boxes: readonly Box[], stepUp: number): { x: number; z: number; hitWall: boolean } {
  const blocking = boxes.filter((b) => b.kind !== 'ghost');
  let newX = findSafeAxisX(x, z, y, dx, r, h, blocking, stepUp);
  let newZ = findSafeAxisZ(newX, z, y, dz, r, h, blocking, stepUp);
  for (let iter = 0; iter < 4; iter++) {
    if (!collidesCapsule(newX, newZ, y, r, h, blocking, stepUp)) break;
    const safeZ = findSafeAxisZ(newX, z, y, dz, r, h, blocking, stepUp);
    if (!collidesCapsule(newX, safeZ, y, r, h, blocking, stepUp)) {
      newZ = safeZ;
      break;
    }
    const safeX = findSafeAxisX(x, z, y, dx, r, h, blocking, stepUp);
    newX = safeX;
    newZ = findSafeAxisZ(newX, z, y, dz, r, h, blocking, stepUp);
    break;
  }
  const hitWall = Math.abs(newX - (x + dx)) > EPS || Math.abs(newZ - (z + dz)) > EPS;
  return { x: newX, z: newZ, hitWall };
}

function computeFloor(x: number, z: number, yBefore: number, r: number, boxes: readonly Box[], ground: Ground, stepUp: number): number {
  let floor = ground.heightAt(x, z);
  for (const box of boxes) {
    if (box.kind === 'ghost') continue;
    if (box.max[1] > yBefore + stepUp + EPS) continue;
    if (isUnderCircle(x, z, r, box)) floor = Math.max(floor, box.max[1]);
  }
  return floor;
}

function applyHeadBump(x: number, z: number, y: number, vy: number, r: number, h: number, boxes: readonly Box[]): { y: number; vy: number } {
  let newY = y;
  let newVy = vy;
  for (const box of boxes) {
    if (box.kind === 'ghost') continue;
    if (!overlapsHorizontally(x, z, r, box)) continue;
    if (newY < box.min[1] - EPS && newY + h > box.min[1] + EPS) {
      const cappedY = box.min[1] - h;
      if (cappedY < newY) {
        newY = cappedY;
        newVy = 0;
      }
    }
  }
  return { y: newY, vy: newVy };
}

function checkClimb(x: number, z: number, dx: number, dz: number, y: number, r: number, h: number, ladderBoxes: Box[]): boolean {
  for (const box of ladderBoxes) {
    if (box.max[1] <= y + EPS || box.min[1] >= y + h - EPS) continue;
    const d2 = closestDistSq(x, z, box);
    if (d2 <= r * r + EPS) {
      if (dx === 0 && dz === 0) continue;
      const newX = x + dx;
      const newZ = z + dz;
      const newClosestX = Math.max(box.min[0], Math.min(newX, box.max[0]));
      const newClosestZ = Math.max(box.min[2], Math.min(newZ, box.max[2]));
      const newD2 = (newX - newClosestX) * (newX - newClosestX) + (newZ - newClosestZ) * (newZ - newClosestZ);
      if (newD2 < d2 + EPS) return true;
    }
  }
  return false;
}

function findClimbLadder(x: number, z: number, dx: number, dz: number, y: number, r: number, h: number, ladderBoxes: Box[]): Box | null {
  for (const box of ladderBoxes) {
    if (box.max[1] <= y + EPS || box.min[1] >= y + h - EPS) continue;
    const d2 = closestDistSq(x, z, box);
    if (d2 <= r * r + EPS) {
      if (dx !== 0 || dz !== 0) {
        const newX = x + dx;
        const newZ = z + dz;
        const newClosestX = Math.max(box.min[0], Math.min(newX, box.max[0]));
        const newClosestZ = Math.max(box.min[2], Math.min(newZ, box.max[2]));
        const newD2 = (newX - newClosestX) * (newX - newClosestX) + (newZ - newClosestZ) * (newZ - newClosestZ);
        if (newD2 < d2 + EPS) return box;
      }
    }
  }
  return null;
}

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
  const [x, y, z] = pos;
  const r = cap.radius;
  const h = cap.height;
  const su = stepUp ?? 0.3;
  const blocking = boxes.filter((b) => b.kind !== 'ghost');
  const ladderBoxes = blocking.filter((b) => b.kind === 'ladder');

  if (checkClimb(x, z, dx, dz, y, r, h, ladderBoxes)) {
    const ladder = findClimbLadder(x, z, dx, dz, y, r, h, ladderBoxes);
    if (ladder) {
      let newY = y + 2 * dt;
      let climbing = true;
      if (newY >= ladder.max[1] - EPS) {
        newY = ladder.max[1];
        climbing = false;
      }
      return {
        pos: [x, newY, z],
        onGround: !climbing,
        climbing,
        hitWall: false,
        vy: 0
      };
    }
  }

  const slide = slideHorizontal(x, z, dx, dz, y, r, h, blocking, su);
  const newX = slide.x;
  const newZ = slide.z;
  const hitWall = slide.hitWall;

  let newVy = vy - 9.8 * dt;
  let newY = y + newVy * dt;

  const head = applyHeadBump(newX, newZ, newY, newVy, r, h, blocking);
  newY = head.y;
  newVy = head.vy;

  const floorY = computeFloor(newX, newZ, y, r, blocking, ground, su);
  let onGround = false;
  if (newY < floorY - EPS) {
    newY = floorY;
    newVy = 0;
    onGround = true;
  } else if (Math.abs(newY - floorY) < EPS) {
    newY = floorY;
    newVy = 0;
    onGround = true;
  }

  return {
    pos: [newX, newY, newZ],
    onGround,
    climbing: false,
    hitWall,
    vy: newVy
  };
}