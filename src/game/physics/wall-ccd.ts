/**
 * T09 — Wall Continuous Collision Detection
 *
 * Swept sphere/OBB contact detection for static barriers. Supports:
 * - Face contacts (sphere hits flat surface)
 * - Edge contacts (sphere hits box edge)
 * - Corner contacts (sphere hits box corner)
 * - Rotated boxes (arbitrary rotY/rotX/rotZ)
 * - Starting overlap depenetration
 * - Remaining-timestep integration with bounded multiple contacts
 * - Stable simultaneous-contact ordering
 *
 * Convention: all coordinates are world-space (x=distance, y=altitude, z=lateral).
 */

export interface OBB {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly halfWidth: number;  // x-extent
  readonly halfHeight: number; // y-extent
  readonly halfDepth: number;  // z-extent
  readonly rotY: number;       // yaw (around y-axis)
  readonly rotX: number;       // pitch (around x-axis)
  readonly rotZ: number;       // roll (around z-axis)
  readonly generation: number;
}

export interface SweptSphere {
  readonly startX: number;
  readonly startY: number;
  readonly startZ: number;
  readonly endX: number;
  readonly endY: number;
  readonly endZ: number;
  readonly radius: number;
}

export type ContactKind = 'face' | 'edge' | 'corner';

export interface WallContact {
  readonly obb: OBB;
  readonly kind: ContactKind;
  readonly time: number;           // [0, 1] fraction of swept motion
  readonly normalX: number;        // contact normal (world-space)
  readonly normalY: number;
  readonly normalZ: number;
  readonly penetration: number;    // depth of overlap at contact
  readonly contactX: number;       // contact point (world-space)
  readonly contactY: number;
  readonly contactZ: number;
}

/**
 * Transform a point from world-space to OBB local-space.
 */
function worldToOBB(
  px: number, py: number, pz: number,
  obb: OBB,
): { x: number; y: number; z: number } {
  // Translate to OBB origin
  let dx = px - obb.x;
  let dy = py - obb.y;
  let dz = pz - obb.z;

  // Inverse rotation: ZYX order (apply inverse Z, then Y, then X)
  if (obb.rotZ !== 0) {
    const c = Math.cos(-obb.rotZ);
    const s = Math.sin(-obb.rotZ);
    const nx = dx * c - dy * s;
    const ny = dx * s + dy * c;
    dx = nx;
    dy = ny;
  }
  if (obb.rotY !== 0) {
    const c = Math.cos(-obb.rotY);
    const s = Math.sin(-obb.rotY);
    const nx = dx * c + dz * s;
    const nz = -dx * s + dz * c;
    dx = nx;
    dz = nz;
  }
  if (obb.rotX !== 0) {
    const c = Math.cos(-obb.rotX);
    const s = Math.sin(-obb.rotX);
    const ny = dy * c - dz * s;
    const nz = dy * s + dz * c;
    dy = ny;
    dz = nz;
  }

  return { x: dx, y: dy, z: dz };
}

/**
 * Transform a vector from OBB local-space to world-space.
 */
function obbToWorld(
  lx: number, ly: number, lz: number,
  obb: OBB,
): { x: number; y: number; z: number } {
  let dx = lx;
  let dy = ly;
  let dz = lz;

  // Forward rotation: XYZ order
  if (obb.rotX !== 0) {
    const c = Math.cos(obb.rotX);
    const s = Math.sin(obb.rotX);
    const ny = dy * c - dz * s;
    const nz = dy * s + dz * c;
    dy = ny;
    dz = nz;
  }
  if (obb.rotY !== 0) {
    const c = Math.cos(obb.rotY);
    const s = Math.sin(obb.rotY);
    const nx = dx * c + dz * s;
    const nz = -dx * s + dz * c;
    dx = nx;
    dz = nz;
  }
  if (obb.rotZ !== 0) {
    const c = Math.cos(obb.rotZ);
    const s = Math.sin(obb.rotZ);
    const nx = dx * c - dy * s;
    const ny = dx * s + dy * c;
    dx = nx;
    dy = ny;
  }

  return { x: dx, y: dy, z: dz };
}

/**
 * Clamp a value to a range.
 */
function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

/**
 * Test if a sphere at `start` overlaps an OBB at time 0 (before motion).
 * Returns the penetration depth and push-out normal, or null if no overlap.
 */
export function testInitialOverlap(
  startX: number, startY: number, startZ: number,
  radius: number,
  obb: OBB,
): { penetration: number; normalX: number; normalY: number; normalZ: number } | null {
  const local = worldToOBB(startX, startY, startZ, obb);

  // Find closest point on OBB to sphere center
  const closestX = clamp(local.x, -obb.halfWidth, obb.halfWidth);
  const closestY = clamp(local.y, -obb.halfHeight, obb.halfHeight);
  const closestZ = clamp(local.z, -obb.halfDepth, obb.halfDepth);

  const dx = local.x - closestX;
  const dy = local.y - closestY;
  const dz = local.z - closestZ;
  const distSq = dx * dx + dy * dy + dz * dz;

  if (distSq >= radius * radius) return null;

  const dist = Math.sqrt(distSq);
  const penetration = radius - dist;

  // Normal: from closest point to sphere center (local-space)
  let nx: number, ny: number, nz: number;
  if (dist > 1e-6) {
    nx = dx / dist;
    ny = dy / dist;
    nz = dz / dist;
  } else {
    // Sphere center is inside OBB; push out along smallest extent
    const dxw = obb.halfWidth - Math.abs(local.x);
    const dyh = obb.halfHeight - Math.abs(local.y);
    const dzd = obb.halfDepth - Math.abs(local.z);
    if (dxw <= dyh && dxw <= dzd) {
      nx = local.x >= 0 ? 1 : -1;
      ny = 0;
      nz = 0;
    } else if (dyh <= dzd) {
      nx = 0;
      ny = local.y >= 0 ? 1 : -1;
      nz = 0;
    } else {
      nx = 0;
      ny = 0;
      nz = local.z >= 0 ? 1 : -1;
    }
  }

  // Transform normal to world-space
  const worldNormal = obbToWorld(nx, ny, nz, obb);
  return {
    penetration,
    normalX: worldNormal.x,
    normalY: worldNormal.y,
    normalZ: worldNormal.z,
  };
}

/**
 * Swept sphere vs OBB contact detection.
 * Returns the earliest contact (if any) as the sphere moves from start to end.
 */
export function testSweptSphereOBB(
  sphere: SweptSphere,
  obb: OBB,
): WallContact | null {
  // Check initial overlap first
  const initialOverlap = testInitialOverlap(
    sphere.startX, sphere.startY, sphere.startZ,
    sphere.radius, obb,
  );
  if (initialOverlap) {
    return {
      obb,
      kind: 'face',
      time: 0,
      normalX: initialOverlap.normalX,
      normalY: initialOverlap.normalY,
      normalZ: initialOverlap.normalZ,
      penetration: initialOverlap.penetration,
      contactX: sphere.startX,
      contactY: sphere.startY,
      contactZ: sphere.startZ,
    };
  }

  // Motion vector
  const vx = sphere.endX - sphere.startX;
  const vy = sphere.endY - sphere.startY;
  const vz = sphere.endZ - sphere.startZ;
  const motionLen = Math.sqrt(vx * vx + vy * vy + vz * vz);
  if (motionLen < 1e-6) return null; // No motion

  // Transform start and motion to OBB local-space
  const localStart = worldToOBB(sphere.startX, sphere.startY, sphere.startZ, obb);
  const localMotion = worldToOBB(vx, vy, vz, { ...obb, x: 0, y: 0, z: 0 });

  // Expanded OBB (Minkowski sum with sphere)
  const expW = obb.halfWidth + sphere.radius;
  const expH = obb.halfHeight + sphere.radius;
  const expD = obb.halfDepth + sphere.radius;

  // Ray vs expanded OBB (slab method)
  let tmin = 0;
  let tmax = 1;
  let normalLocal = { x: 0, y: 0, z: 0 };

  // X slab
  if (Math.abs(localMotion.x) < 1e-6) {
    if (localStart.x < -expW || localStart.x > expW) return null;
  } else {
    const invD = 1 / localMotion.x;
    let t1 = (-expW - localStart.x) * invD;
    let t2 = (expW - localStart.x) * invD;
    let n = -1;
    if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; n = 1; }
    if (t1 > tmin) { tmin = t1; normalLocal = { x: n, y: 0, z: 0 }; }
    tmax = Math.min(tmax, t2);
    if (tmin > tmax) return null;
  }

  // Y slab
  if (Math.abs(localMotion.y) < 1e-6) {
    if (localStart.y < -expH || localStart.y > expH) return null;
  } else {
    const invD = 1 / localMotion.y;
    let t1 = (-expH - localStart.y) * invD;
    let t2 = (expH - localStart.y) * invD;
    let n = -1;
    if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; n = 1; }
    if (t1 > tmin) { tmin = t1; normalLocal = { x: 0, y: n, z: 0 }; }
    tmax = Math.min(tmax, t2);
    if (tmin > tmax) return null;
  }

  // Z slab
  if (Math.abs(localMotion.z) < 1e-6) {
    if (localStart.z < -expD || localStart.z > expD) return null;
  } else {
    const invD = 1 / localMotion.z;
    let t1 = (-expD - localStart.z) * invD;
    let t2 = (expD - localStart.z) * invD;
    let n = -1;
    if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; n = 1; }
    if (t1 > tmin) { tmin = t1; normalLocal = { x: 0, y: 0, z: n }; }
    tmax = Math.min(tmax, t2);
    if (tmin > tmax) return null;
  }

  if (tmin < 0 || tmin > 1) return null;

  // Contact point in local-space (on expanded OBB surface)
  const contactLocalX = localStart.x + localMotion.x * tmin;
  const contactLocalY = localStart.y + localMotion.y * tmin;
  const contactLocalZ = localStart.z + localMotion.z * tmin;

  // Determine contact kind (face/edge/corner)
  const onX = Math.abs(Math.abs(contactLocalX) - expW) < 1e-3;
  const onY = Math.abs(Math.abs(contactLocalY) - expH) < 1e-3;
  const onZ = Math.abs(Math.abs(contactLocalZ) - expD) < 1e-3;
  const onCount = (onX ? 1 : 0) + (onY ? 1 : 0) + (onZ ? 1 : 0);
  const kind: ContactKind = onCount >= 3 ? 'corner' : onCount === 2 ? 'edge' : 'face';

  // Transform contact point and normal to world-space
  const contactWorld = obbToWorld(contactLocalX, contactLocalY, contactLocalZ, obb);
  const normalWorld = obbToWorld(normalLocal.x, normalLocal.y, normalLocal.z, obb);

  // Penetration depth (negative means gap)
  const penetration = 0;

  return {
    obb,
    kind,
    time: tmin,
    normalX: normalWorld.x,
    normalY: normalWorld.y,
    normalZ: normalWorld.z,
    penetration,
    contactX: contactWorld.x + obb.x,
    contactY: contactWorld.y + obb.y,
    contactZ: contactWorld.z + obb.z,
  };
}

/**
 * Resolve a racer's motion against multiple walls with remaining-timestep integration.
 * Returns the final position after all collisions.
 *
 * Algorithm:
 * 1. Test swept sphere against all walls
 * 2. Find earliest contact
 * 3. Move to contact point
 * 4. Reflect velocity (or slide)
 * 5. Repeat with remaining time (bounded iterations)
 */
export interface WallResolutionResult {
  readonly finalX: number;
  readonly finalY: number;
  readonly finalZ: number;
  readonly contacts: readonly WallContact[];
  readonly stopped: boolean; // true if velocity was fully absorbed
}

export function resolveWallCollisions(
  startX: number, startY: number, startZ: number,
  endX: number, endY: number, endZ: number,
  radius: number,
  walls: readonly OBB[],
  maxIterations = 4,
): WallResolutionResult {
  let curX = startX;
  let curY = startY;
  let curZ = startZ;
  let targetX = endX;
  let targetY = endY;
  let targetZ = endZ;
  const contacts: WallContact[] = [];
  let stopped = false;

  for (let iter = 0; iter < maxIterations; iter++) {
    const sphere: SweptSphere = {
      startX: curX, startY: curY, startZ: curZ,
      endX: targetX, endY: targetY, endZ: targetZ,
      radius,
    };

    let earliest: WallContact | null = null;
    for (const wall of walls) {
      const contact = testSweptSphereOBB(sphere, wall);
      if (contact && (!earliest || contact.time < earliest.time)) {
        earliest = contact;
      }
    }

    if (!earliest) {
      // No collision; move to target
      curX = targetX;
      curY = targetY;
      curZ = targetZ;
      break;
    }

    contacts.push(earliest);

    // Move to contact point (with small epsilon to avoid re-collision)
    const epsilon = 0.01;
    const contactTime = Math.max(0, earliest.time - epsilon);
    curX = curX + (targetX - curX) * contactTime;
    curY = curY + (targetY - curY) * contactTime;
    curZ = curZ + (targetZ - curZ) * contactTime;

    // Remaining motion
    const remainX = targetX - curX;
    const remainY = targetY - curY;
    const remainZ = targetZ - curZ;

    // Slide along wall (project remaining motion onto wall plane)
    const dot = remainX * earliest.normalX + remainY * earliest.normalY + remainZ * earliest.normalZ;
    if (dot < 0) {
      // Reflect or slide
      const slideX = remainX - dot * earliest.normalX;
      const slideY = remainY - dot * earliest.normalY;
      const slideZ = remainZ - dot * earliest.normalZ;
      const slideLen = Math.sqrt(slideX * slideX + slideY * slideY + slideZ * slideZ);
      if (slideLen < 1e-6) {
        stopped = true;
        break;
      }
      targetX = curX + slideX;
      targetY = curY + slideY;
      targetZ = curZ + slideZ;
    } else {
      // Moving away from wall; continue
      break;
    }
  }

  return {
    finalX: curX,
    finalY: curY,
    finalZ: curZ,
    contacts,
    stopped,
  };
}

/**
 * Sort contacts by time, then by OBB ID for deterministic ordering.
 */
export function sortContacts(contacts: WallContact[]): WallContact[] {
  return contacts.slice().sort((a, b) => {
    if (a.time !== b.time) return a.time - b.time;
    return a.obb.id.localeCompare(b.obb.id);
  });
}
