/**
 * @file apps/web/src/studio/viewport/raycast-picker.ts
 * STUDIO-44B (Opus Core): O(log N) Triangle-to-PlacedPart & Material-Slot Raycast Picker.
 *
 * Maps any 3D viewport raycast hit (`triangleIndex` / `faceIndex` on a built Kit or parametric Part)
 * directly to its `PlacedPart` path, `partId`, `slotName`, and currently bound `@hm/matstack` or `lx:` material ID.
 * Pure TypeScript, zero DOM globals, deterministic.
 */

import type { Box3, DetailRank, Kit, Overrides, PlacedPart } from '@hm/kitspec';
import { flatten, sourceBounds, transformBox } from '@hm/kitspec';
import type { Rank } from '@hm/partgen';
import { buildPart, GENERATORS } from '@hm/partgen';

export interface TriangleSlotRange {
  /** Inclusive start triangle index (indexOffset / 3). */
  readonly triStart: number;
  /** Exclusive end triangle index ((indexOffset + indexCount) / 3). */
  readonly triEnd: number;
  /** PlacedPart hierarchical path (e.g. 'carcass#0' or 'left-door#12/lamp#3'). */
  readonly path: string;
  /** Top-level child index in the root assembly's `children` array. */
  readonly rootChildIndex: number;
  /** Kit part definition ID. */
  readonly partId: string;
  /** Material slot name on the part (e.g. 'body', 'trim', 'band', 'bolts', 'plate'). */
  readonly slotName: string;
  /** Resolved material ID bound to this slot (e.g. 'mat:field-worn-hazard' or 'lx:6500:1.2:steady'). */
  readonly materialId: string;
  /** Detail rank of this placed part (0, 1, or 2). */
  readonly rank: DetailRank;
  /** World/preset-space AABB of this placed part. */
  readonly bounds: Box3;
}

export interface KitPickTable {
  readonly presetId: string;
  readonly rank: DetailRank;
  readonly totalTriangles: number;
  readonly ranges: readonly TriangleSlotRange[];
  readonly placedParts: readonly PlacedPart[];
}

export interface PickHitResult {
  readonly path: string;
  readonly rootChildIndex: number;
  readonly partId: string;
  readonly slotName: string;
  readonly materialId: string;
  readonly rank: DetailRank;
  readonly bounds: Box3;
}

/** Extracts the root child index in `AssemblyDef.children` from a flattened `PlacedPart.path`. */
export function parseRootChildIndex(kit: Kit, presetId: string, path: string): number {
  const asm = kit.assemblies[presetId];
  if (!asm) return -1;
  const firstSeg = (path.split('/')[0] ?? path).replace(/\[\d+\]$/, '');
  const idx = asm.children.findIndex((c, i) => (c.key ?? `${c.ref}#${i}`) === firstSeg);
  return idx;
}

/**
 * Builds a deterministic cumulative triangle table for `flatten(kit, presetId, overrides)` at `maxRank`.
 * Used by both merged kit meshes and per-part meshes in the Studio viewport to resolve raycast hits in O(log N).
 */
export function buildKitPickTable(
  kit: Kit,
  presetId: string,
  maxRank: DetailRank = 2,
  overrides?: Overrides,
): KitPickTable {
  const placed = flatten(kit, presetId, overrides);
  const ranges: TriangleSlotRange[] = [];
  let cursor = 0;

  for (const p of placed) {
    if (p.rank > maxRank) continue;
    const rootChildIndex = parseRootChildIndex(kit, presetId, p.path);
    const bounds = transformBox(sourceBounds(p.source), p.matrix);

    if (p.source.kind === 'param') {
      const md = buildPart(p.source.gen, p.source.params, maxRank as Rank);
      if (md && md.slots.length > 0) {
        for (const s of md.slots) {
          const triCount = Math.floor(s.count / 3);
          if (triCount <= 0) continue;
          const matId = p.slotMaterials?.[s.name] ?? p.material;
          ranges.push({
            triStart: cursor,
            triEnd: cursor + triCount,
            path: p.path,
            rootChildIndex,
            partId: p.part,
            slotName: s.name,
            materialId: matId,
            rank: p.rank,
            bounds,
          });
          cursor += triCount;
        }
        continue;
      }
    }

    // Box or Gen fallback (12 triangles for a standard box)
    const fallbackTris = 12;
    ranges.push({
      triStart: cursor,
      triEnd: cursor + fallbackTris,
      path: p.path,
      rootChildIndex,
      partId: p.part,
      slotName: 'default',
      materialId: p.material,
      rank: p.rank,
      bounds,
    });
    cursor += fallbackTris;
  }

  return {
    presetId,
    rank: maxRank,
    totalTriangles: cursor,
    ranges,
    placedParts: placed,
  };
}

/**
 * Binary-searches `table.ranges` in O(log N) to resolve a Three.js `Intersection.faceIndex` (triangle index)
 * to its exact `PlacedPart` path, `partId`, `slotName`, and bound `materialId`.
 */
export function pickPartAndSlotAtTriangle(
  table: KitPickTable,
  triangleIndex: number,
): PickHitResult | null {
  if (!Number.isInteger(triangleIndex) || triangleIndex < 0 || triangleIndex >= table.totalTriangles) {
    return null;
  }
  let lo = 0;
  let hi = table.ranges.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >>> 1;
    const r = table.ranges[mid]!;
    if (triangleIndex < r.triStart) {
      hi = mid - 1;
    } else if (triangleIndex >= r.triEnd) {
      lo = mid + 1;
    } else {
      return {
        path: r.path,
        rootChildIndex: r.rootChildIndex,
        partId: r.partId,
        slotName: r.slotName,
        materialId: r.materialId,
        rank: r.rank,
        bounds: r.bounds,
      };
    }
  }
  return null;
}

/**
 * Resolves a raycast hit on a single standalone `@hm/partgen` preview mesh (when editing a PartDef directly)
 * from `triangleIndex` to its `slotName`.
 */
export function pickSlotOnStandalonePart(
  genId: string,
  params: Readonly<Record<string, number>>,
  rank: Rank,
  triangleIndex: number,
): string | null {
  const md = buildPart(genId, params, rank);
  if (!md || triangleIndex < 0) return null;
  const idxOffset = triangleIndex * 3;
  for (const s of md.slots) {
    if (idxOffset >= s.start && idxOffset < s.start + s.count) {
      return s.name;
    }
  }
  return null;
}

/**
 * Enumerates all distinct material slots present on a Kit preset (or standalone part) for `material-slot-strip.tsx`.
 */
export interface DiscoveredMaterialSlot {
  /** Slot key: either a named slot ('body', 'trim', 'bolts', 'band', 'plate') or the part's primary role. */
  readonly slotName: string;
  /** Currently assigned material ID (e.g. 'mat:field-worn-hazard' or 'lx:...'). */
  readonly materialId: string;
  /** Number of placed part instances sharing this slot in the assembly. */
  readonly partCount: number;
  /** Paths of placed parts that expose this slot. */
  readonly partPaths: readonly string[];
  /** True if this slot is an emissive Lx lamp/indicator slot ('lx:...'). */
  readonly isLamp: boolean;
}

export function extractMaterialSlots(
  kit: Kit,
  presetId: string,
  overrides?: Overrides,
): DiscoveredMaterialSlot[] {
  const placed = flatten(kit, presetId, overrides);
  const bySlot = new Map<string, { materialId: string; paths: Set<string> }>();

  const record = (slotKey: string, matId: string, path: string): void => {
    const existing = bySlot.get(slotKey);
    if (existing) {
      existing.paths.add(path);
    } else {
      bySlot.set(slotKey, { materialId: matId, paths: new Set([path]) });
    }
  };

  for (const p of placed) {
    if (p.slotMaterials && Object.keys(p.slotMaterials).length > 0) {
      for (const [slotName, matId] of Object.entries(p.slotMaterials)) {
        record(`${p.part}:${slotName}`, matId, p.path);
      }
    } else if (p.source.kind === 'param') {
      const gen = GENERATORS[p.source.gen];
      if (gen && gen.slots.length > 0) {
        for (const sName of gen.slots) {
          record(`${p.part}:${sName}`, p.material, p.path);
        }
      } else {
        record(`${p.part}:default`, p.material, p.path);
      }
    } else {
      record(`${p.part}:default`, p.material, p.path);
    }
  }

  return [...bySlot.entries()].map(([slotName, info]) => ({
    slotName,
    materialId: info.materialId,
    partCount: info.paths.size,
    partPaths: [...info.paths],
    isLamp: info.materialId.startsWith('lx:'),
  }));
}
