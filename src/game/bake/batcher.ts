/**
 * IF-BATCH: Draw-call batching system for static props.
 * Partitions identical props into chunked InstancedMesh instances.
 */

import type { PlacedProp } from '../track-builder-3d';

export interface BatchGroup {
  key: string;
  type: string;
  chunk: number;
  props: PlacedProp[];
  boundingSphere: {
    centerX: number;
    centerY: number;
    centerZ: number;
    radius: number;
  };
}

export interface BatchPlan {
  batches: BatchGroup[];
  unbatched: PlacedProp[];
  totalBatchedProps: number;
  drawCallEstimate: number;
}

export const MIN_INSTANCES_PER_BATCH = 3;
export const CHUNK_SIZE = 3000; // world units along track X

export function planBatches(
  props: readonly PlacedProp[],
  chunkSize = CHUNK_SIZE,
): BatchPlan {
  const groups = new Map<string, PlacedProp[]>();
  const unbatched: PlacedProp[] = [];

  for (const prop of props) {
    // Exclude animated sheets and decals from instancing
    if (prop.animate || prop.isDecal || prop.animated) {
      unbatched.push(prop);
      continue;
    }

    const chunk = Math.floor(prop.x / chunkSize);
    const key = `${prop.type}_c${chunk}`;

    let list = groups.get(key);
    if (!list) {
      list = [];
      groups.set(key, list);
    }
    list.push(prop);
  }

  const batches: BatchGroup[] = [];
  let totalBatchedProps = 0;

  for (const [key, groupProps] of groups.entries()) {
    if (groupProps.length >= MIN_INSTANCES_PER_BATCH) {
      // Calculate chunk bounding sphere
      let minX = Infinity, minY = Infinity, minZ = Infinity;
      let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

      for (const p of groupProps) {
        minX = Math.min(minX, p.x);
        minY = Math.min(minY, p.y);
        minZ = Math.min(minZ, p.z);
        maxX = Math.max(maxX, p.x);
        maxY = Math.max(maxY, p.y);
        maxZ = Math.max(maxZ, p.z);
      }

      const centerX = (minX + maxX) / 2;
      const centerY = (minY + maxY) / 2;
      const centerZ = (minZ + maxZ) / 2;
      const radius = Math.hypot(maxX - minX, maxY - minY, maxZ - minZ) / 2 + 100;

      const chunk = Math.floor(groupProps[0].x / chunkSize);
      batches.push({
        key,
        type: groupProps[0].type,
        chunk,
        props: groupProps,
        boundingSphere: { centerX, centerY, centerZ, radius },
      });
      totalBatchedProps += groupProps.length;
    } else {
      unbatched.push(...groupProps);
    }
  }

  // Draw calls = 1 per batch + 1 per unbatched prop
  const drawCallEstimate = batches.length + unbatched.length;

  return {
    batches,
    unbatched,
    totalBatchedProps,
    drawCallEstimate,
  };
}
