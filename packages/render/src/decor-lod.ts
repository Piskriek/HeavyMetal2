import type { VoxelModel } from '@hm/voxel';

/**
 * A distant plant does not need every voxel: halve the model (each 2x2x2 group becomes one voxel of the group's most common colour) and
 * draw it at twice the block size. The pivot halves too, so the coarse copy stands exactly where the full one does.
 * A group with any voxel in it stays filled, so thin fronds and stems keep their silhouette from afar.
 */
export function halveModel(m: VoxelModel): VoxelModel {
  const [sx, sy, sz] = m.size;
  const hx = Math.ceil(sx / 2), hy = Math.ceil(sy / 2), hz = Math.ceil(sz / 2);
  const cells = new Uint8Array(hx * hy * hz);
  const seen = new Uint8Array(8), count = new Uint8Array(8);
  for (let z = 0; z < hz; z++) for (let y = 0; y < hy; y++) for (let x = 0; x < hx; x++) {
    let n = 0;
    for (let dz = 0; dz < 2; dz++) for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) {
      const ox = x * 2 + dx, oy = y * 2 + dy, oz = z * 2 + dz;
      if (ox >= sx || oy >= sy || oz >= sz) continue;
      const v = m.cells[ox + sx * (oy + sy * oz)]!;
      if (v === 0) continue;
      let j = 0;
      while (j < n && seen[j] !== v) j++;
      if (j < n) count[j]!++;
      else { seen[n] = v; count[n] = 1; n++; }
    }
    if (n === 0) continue;
    let best = 0;
    for (let j = 1; j < n; j++) if (count[j]! > count[best]!) best = j;
    cells[x + hx * (y + hy * z)] = seen[best]!;
  }
  return { ...m, id: `${m.id}@half`, size: [hx, hy, hz], pivot: [m.pivot[0] / 2, m.pivot[1] / 2, m.pivot[2] / 2], cells };
}

/** How near a plant must be to the camera to show every voxel, per quality tier (metres). Beyond it the halved model shows. */
export const DECOR_DETAIL_RADIUS: Readonly<Record<'low' | 'medium' | 'high' | 'ultra', number>> = { low: 18, medium: 35, high: 70, ultra: Infinity };
