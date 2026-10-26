/**
 * @file apps/web/src/studio/viewport/socket-gizmos.ts
 * STUDIO-44D & ARGO_STUDIO_CLEANUP_DIRECTIVE.md (Q5):
 * 3D Triad Socket Pin Enumeration (Red = Input, Blue = Output, Gold = Power, Green = Mount),
 * Surface-Normal Raycast Socket Authoring, and Auto-Snap Grounding Solver for `@hm/kitspec`.
 *
 * Pure TypeScript, zero DOM globals, deterministic.
 */

import type { Kit, Mat4, Overrides, Placement, SocketDef, Vec3 } from '@hm/kitspec';
import {
  flatten,
  IDENTITY,
  multiply,
  rotation,
  sourceBounds,
  transformBox,
  transformPoint,
  translation,
  validate,
} from '@hm/kitspec';

export type SocketPinCategory = 'structural-open' | 'structural-occupied' | 'gameplay';
/** Q5 Triad Socket Semantic Role: Red = Input, Blue = Output, Gold = Power, Green = Mount */
export type TriadSocketRole = 'input' | 'output' | 'power' | 'mount';

export interface SocketPin {
  /** Unique identifier in the viewport: `${ownerPath}::${socketName}` */
  readonly pinId: string;
  /** Path of the placed part or root assembly that owns this socket ('' for root assembly). */
  readonly ownerPath: string;
  /** Index in root AssemblyDef.children (-1 for root assembly sockets). */
  readonly childIndex: number;
  /** Copy index when owner is a repeated placement (default 0). */
  readonly copyIndex: number;
  /** Name of the socket on the owner part/assembly. */
  readonly socketName: string;
  /** World/preset-space position [x, y, z] in metres. */
  readonly worldPos: Vec3;
  /** World/preset-space unit direction of the socket's local +Y (up/outward) axis. */
  readonly worldUpDir: Vec3;
  /** Local SocketDef on the owner. */
  readonly localSocket: SocketDef;
  /** Paths of child placements currently snapped to this socket. */
  readonly occupiedBy: readonly string[];
  /** Visual category for occupancy/gameplay filtering. */
  readonly category: SocketPinCategory;
  /** Q5 Semantic Triad Role: 'input' (Red), 'output' (Blue), 'power' (Gold), 'mount' (Green). */
  readonly triadRole: TriadSocketRole;
  /** Canonical hex color for the 3D triad pin (#ff3d8a Red, #3dc8ff Blue, #ffc13d Gold, #7cff4d Green). */
  readonly colorHex: string;
}

const INPUT_SOCKET_RE = /(hopper|feed|inlet|intake|input|cartridge|slot)/i;
const OUTPUT_SOCKET_RE = /(vent|exhaust|plume|stack|out|output|chute|discharge|portal)/i;
const POWER_SOCKET_RE = /(power|cable|bus|terminal|hv|coil|beacon|led|lamp|console|line)/i;
const GAMEPLAY_SOCKET_RE = /(hopper|feed|vent|exhaust|plume|power|cable|cartridge|slot|wheel|lamp|door|portal|bus)/i;

export function classifyTriadSocketRole(socketName: string): {
  readonly role: TriadSocketRole;
  readonly colorHex: string;
} {
  if (POWER_SOCKET_RE.test(socketName)) return { role: 'power', colorHex: '#ffc13d' };
  if (OUTPUT_SOCKET_RE.test(socketName)) return { role: 'output', colorHex: '#3dc8ff' };
  if (INPUT_SOCKET_RE.test(socketName)) return { role: 'input', colorHex: '#ff3d8a' };
  return { role: 'mount', colorHex: '#7cff4d' };
}

const frameOfSocket = (s: SocketDef): Mat4 =>
  multiply(translation(s.at), rotation(s.rot ?? [0, 0, 0]));

const transformDir = (m: Mat4, d: Vec3): Vec3 => {
  const x = (m[0] as number) * d[0] + (m[4] as number) * d[1] + (m[8] as number) * d[2];
  const y = (m[1] as number) * d[0] + (m[5] as number) * d[1] + (m[9] as number) * d[2];
  const z = (m[2] as number) * d[0] + (m[6] as number) * d[1] + (m[10] as number) * d[2];
  const len = Math.hypot(x, y, z) || 1;
  return [x / len, y / len, z / len];
};

/**
 * Enumerates all 3D socket pins on a `Kit` preset (`AssemblyDef` exposed sockets + every child `PartDef`'s sockets),
 * computing their exact preset-space coordinates, orientations, occupancy, and Q5 Triad Role color codes.
 */
export function enumerateAssemblySockets(
  kit: Kit,
  presetId: string,
  overrides?: Overrides,
): SocketPin[] {
  const asm = kit.assemblies[presetId];
  if (!asm) return [];

  const placed = flatten(kit, presetId, overrides);
  const pins: SocketPin[] = [];

  const occupiedMap = new Map<string, string[]>();
  asm.children.forEach((c, idx) => {
    if (c.on) {
      const k = `${c.on.child}:${c.on.copy ?? 0}:${c.on.socket}`;
      const label = c.key ?? `${c.ref}#${idx}`;
      const list = occupiedMap.get(k);
      if (list) list.push(label);
      else occupiedMap.set(k, [label]);
    }
  });

  // 1. Root assembly exposed sockets
  if (asm.sockets) {
    for (const [sName, sDef] of Object.entries(asm.sockets)) {
      const m = frameOfSocket(sDef);
      const isGameplay = GAMEPLAY_SOCKET_RE.test(sName);
      const triad = classifyTriadSocketRole(sName);
      pins.push({
        pinId: `<root>::${sName}`,
        ownerPath: '',
        childIndex: -1,
        copyIndex: 0,
        socketName: sName,
        worldPos: transformPoint(m, [0, 0, 0]),
        worldUpDir: transformDir(m, [0, 1, 0]),
        localSocket: sDef,
        occupiedBy: [],
        category: isGameplay ? 'gameplay' : 'structural-open',
        triadRole: triad.role,
        colorHex: triad.colorHex,
      });
    }
  }

  // 2. Child part & sub-assembly sockets
  placed.forEach((p) => {
    const partDef = kit.parts[p.part];
    if (!partDef?.sockets) return;

    const firstSeg = p.path.split('/')[0] ?? p.path;
    const copyMatch = /\[(\d+)\]$/.exec(firstSeg);
    const copyIndex = copyMatch ? Number(copyMatch[1]) : 0;
    const baseKey = firstSeg.replace(/\[\d+\]$/, '');
    const childIndex = asm.children.findIndex((c, i) => (c.key ?? `${c.ref}#${i}`) === baseKey);

    for (const [sName, sDef] of Object.entries(partDef.sockets)) {
      const worldMat = multiply(p.matrix, frameOfSocket(sDef));
      const occKey = `${childIndex}:${copyIndex}:${sName}`;
      const occ = occupiedMap.get(occKey) ?? [];
      const isGameplay = GAMEPLAY_SOCKET_RE.test(sName);
      const category: SocketPinCategory =
        occ.length > 0 ? 'structural-occupied' : isGameplay ? 'gameplay' : 'structural-open';
      const triad = classifyTriadSocketRole(sName);

      pins.push({
        pinId: `${p.path}::${sName}`,
        ownerPath: p.path,
        childIndex,
        copyIndex,
        socketName: sName,
        worldPos: transformPoint(worldMat, [0, 0, 0]),
        worldUpDir: transformDir(worldMat, [0, 1, 0]),
        localSocket: sDef,
        occupiedBy: occ,
        category,
        triadRole: triad.role,
        colorHex: triad.colorHex,
      });
    }
  });

  return pins;
}

export function invertMat4(m: Mat4): Mat4 {
  const g = (i: number): number => m[i] as number;
  const m00 = g(0), m10 = g(1), m20 = g(2);
  const m01 = g(4), m11 = g(5), m21 = g(6);
  const m02 = g(8), m12 = g(9), m22 = g(10);
  const tx = g(12), ty = g(13), tz = g(14);

  const c00 = m11 * m22 - m12 * m21;
  const c10 = m12 * m20 - m10 * m22;
  const c20 = m10 * m21 - m11 * m20;
  const det = m00 * c00 + m01 * c10 + m02 * c20;
  if (Math.abs(det) < 1e-12) return IDENTITY;
  const invDet = 1 / det;

  const i00 = c00 * invDet;
  const i01 = (m02 * m21 - m01 * m22) * invDet;
  const i02 = (m01 * m12 - m02 * m11) * invDet;
  const i10 = c10 * invDet;
  const i11 = (m00 * m22 - m02 * m20) * invDet;
  const i12 = (m02 * m10 - m00 * m12) * invDet;
  const i20 = c20 * invDet;
  const i21 = (m01 * m20 - m00 * m21) * invDet;
  const i22 = (m00 * m11 - m01 * m10) * invDet;

  const itx = -(i00 * tx + i01 * ty + i02 * tz);
  const ity = -(i10 * tx + i11 * ty + i12 * tz);
  const itz = -(i20 * tx + i21 * ty + i22 * tz);

  return [
    i00, i10, i20, 0,
    i01, i11, i21, 0,
    i02, i12, i22, 0,
    itx, ity, itz, 1,
  ];
}

const snapScalar = (v: number, step: number): number => {
  if (step <= 0) return Number(v.toFixed(6));
  const snapped = Math.round(v / step) * step;
  return Object.is(snapped, -0) ? 0 : Number(snapped.toFixed(6));
};

const RAD_TO_DEG = 180 / Math.PI;

export function surfaceHitToSocketDef(
  hitPointWorld: Vec3,
  hitNormalWorld: Vec3,
  parentWorldMatrix: Mat4 = IDENTITY,
  snapStepM = 0.005,
): SocketDef {
  const invParent = invertMat4(parentWorldMatrix);
  const localPt = transformPoint(invParent, hitPointWorld);
  const localN = transformDir(invParent, hitNormalWorld);

  const at: Vec3 = [
    snapScalar(localPt[0], snapStepM),
    snapScalar(localPt[1], snapStepM),
    snapScalar(localPt[2], snapStepM),
  ];

  const [nx, ny, nz] = localN;
  if (ny > 0.98) return { at };
  if (ny < -0.98) return { at, rot: [180, 0, 0] };
  if (nz > 0.98) return { at, rot: [90, 0, 0] };
  if (nz < -0.98) return { at, rot: [-90, 0, 0] };
  if (nx > 0.98) return { at, rot: [0, 0, -90] };
  if (nx < -0.98) return { at, rot: [0, 0, 90] };

  const upRef: Vec3 = Math.abs(ny) < 0.9 ? [0, 1, 0] : [0, 0, 1];
  let xx = upRef[1] * nz - upRef[2] * ny;
  let xy = upRef[2] * nx - upRef[0] * nz;
  let xz = upRef[0] * ny - upRef[1] * nx;
  const xLen = Math.hypot(xx, xy, xz) || 1;
  xx /= xLen; xy /= xLen; xz /= xLen;
  const zx = xy * nz - xz * ny;
  const zy = xz * nx - xx * nz;
  const zz = xx * ny - xy * nx;

  const sinRy = Math.max(-1, Math.min(1, zx));
  const ry = Math.asin(sinRy) * RAD_TO_DEG;
  let rx = 0;
  let rz = 0;
  if (Math.abs(sinRy) < 0.9999) {
    rx = Math.atan2(-zy, zz) * RAD_TO_DEG;
    rz = Math.atan2(-ny, xx) * RAD_TO_DEG;
  } else {
    rx = Math.atan2(xy, ny || 1) * RAD_TO_DEG;
  }

  return {
    at,
    rot: [snapScalar(rx, 1), snapScalar(ry, 1), snapScalar(rz, 1)],
  };
}

export function autoSnapFloatingPlacements(kit: Kit, presetId: string): Kit {
  const asm = kit.assemblies[presetId];
  if (!asm) return kit;

  const issues = validate(kit, presetId);
  if (issues.length === 0) return kit;

  const placed = flatten(kit, presetId);
  const boxes = placed.map((p) => ({
    path: p.path,
    rootIdx: parseRootIndex(asm.children, p.path),
    box: transformBox(sourceBounds(p.source), p.matrix),
  }));

  const updatedChildren: Placement[] = asm.children.map((c, idx) => {
    const childBoxes = boxes.filter((b) => b.rootIdx === idx);
    if (childBoxes.length === 0) return c;

    let minY = Infinity;
    for (const cb of childBoxes) {
      if (cb.box.min[1] < minY) minY = cb.box.min[1];
    }

    const hasBelow = issues.some((iss) => iss.code === 'below-ground' && parseRootIndex(asm.children, iss.at) === idx);
    const hasFloat = issues.some((iss) => iss.code === 'floating' && parseRootIndex(asm.children, iss.at) === idx);

    if (!hasBelow && !hasFloat) return c;

    const curAt: Vec3 = c.at ?? [0, 0, 0];
    if (hasBelow && minY < 0) {
      const dy = -minY;
      return {
        ...c,
        at: [curAt[0], snapScalar(curAt[1] + dy, 0.001), curAt[2]],
      };
    }

    if (hasFloat && !c.on) {
      let targetY = 0;
      const myBox = childBoxes[0]!.box;
      for (const other of boxes) {
        if (other.rootIdx === idx || other.rootIdx < 0) continue;
        const overlapsXZ =
          myBox.min[0] <= other.box.max[0] + 0.01 &&
          other.box.min[0] <= myBox.max[0] + 0.01 &&
          myBox.min[2] <= other.box.max[2] + 0.01 &&
          other.box.min[2] <= myBox.max[2] + 0.01;
        if (overlapsXZ && other.box.max[1] <= minY + 0.05 && other.box.max[1] > targetY) {
          targetY = other.box.max[1];
        }
      }
      const dy = targetY - minY;
      return {
        ...c,
        at: [curAt[0], snapScalar(curAt[1] + dy, 0.001), curAt[2]],
      };
    }

    return c;
  });

  return {
    ...kit,
    assemblies: {
      ...kit.assemblies,
      [presetId]: {
        ...asm,
        children: updatedChildren,
      },
    },
  };
}

function parseRootIndex(children: readonly Placement[], path: string): number {
  const first = (path.split('/')[0] ?? path).replace(/\[\d+\]$/, '');
  return children.findIndex((c, i) => (c.key ?? `${c.ref}#${i}`) === first);
}
