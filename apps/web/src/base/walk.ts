import type { Kind } from '@hm/structure';
import type { Box } from './kit-pieces';

export interface PlacedPiece {
  readonly id: number;
  readonly kind: Kind;
  readonly pos: { readonly x: number; readonly y: number; readonly z: number };
  readonly yaw: number;
  readonly colliders: readonly Box[];
}

export class WalkWorld {
  private pieces: PlacedPiece[] = [];
  private grid = new Map<string, PlacedPiece[]>();
  private readonly cellSize = 4;

  setPieces(pieces: readonly PlacedPiece[]): void {
    this.pieces = pieces.slice();
    this.grid.clear();
    for (const p of this.pieces) {
      const radius = p.kind === 'hardpoint' ? 4.5 : 2.5;
      const minCx = Math.floor((p.pos.x - radius) / this.cellSize);
      const maxCx = Math.floor((p.pos.x + radius) / this.cellSize);
      const minCz = Math.floor((p.pos.z - radius) / this.cellSize);
      const maxCz = Math.floor((p.pos.z + radius) / this.cellSize);
      for (let cx = minCx; cx <= maxCx; cx++) {
        for (let cz = minCz; cz <= maxCz; cz++) {
          const key = `${cx},${cz}`;
          let list = this.grid.get(key);
          if (!list) {
            list = [];
            this.grid.set(key, list);
          }
          list.push(p);
        }
      }
    }
  }

  getNearby(x: number, z: number, range = 3.5): PlacedPiece[] {
    const minCx = Math.floor((x - range) / this.cellSize);
    const maxCx = Math.floor((x + range) / this.cellSize);
    const minCz = Math.floor((z - range) / this.cellSize);
    const maxCz = Math.floor((z + range) / this.cellSize);
    const set = new Set<PlacedPiece>();
    for (let cx = minCx; cx <= maxCx; cx++) {
      for (let cz = minCz; cz <= maxCz; cz++) {
        const list = this.grid.get(`${cx},${cz}`);
        if (list) {
          for (const p of list) set.add(p);
        }
      }
    }
    return Array.from(set);
  }

  /**
   * Returns the highest walkable top under (x, z) within a 0.6 m step-up, else groundY.
   */
  standAt(x: number, z: number, feetY: number, groundY: number): number {
    const nearby = this.getNearby(x, z, 3.5);
    let bestY = groundY;
    const maxStepUp = feetY + 0.6;

    for (const p of nearby) {
      const dx = x - p.pos.x;
      const dz = z - p.pos.z;
      const cos = Math.cos(p.yaw);
      const sin = Math.sin(p.yaw);
      const lx = dx * cos - dz * sin;
      const lz = dx * sin + dz * cos;

      if (p.kind === 'ramp') {
        if (lx >= -2 && lx <= 2 && lz >= -2 && lz <= 2) {
          // Analytic ramp top: in ramp frame across 4m run (-2..2 in z), y = 3 * (z + 2) / 4
          const ly = (3 * (lz + 2)) / 4;
          const candY = p.pos.y + ly;
          if (candY <= maxStepUp && candY > bestY) {
            bestY = candY;
          }
        }
      } else if (p.kind === 'foundation' || p.kind === 'floor') {
        if (lx >= -2 && lx <= 2 && lz >= -2 && lz <= 2) {
          const candY = p.pos.y;
          if (candY <= maxStepUp && candY > bestY) {
            bestY = candY;
          }
        }
      } else if (p.kind === 'hardpoint') {
        if (lx >= -4 && lx <= 4 && lz >= -4 && lz <= 4) {
          // Ring mount top is at +0.78, base concrete pad at +0.16
          const distFromCenter = Math.hypot(lx, lz);
          const ly = distFromCenter <= 1.55 ? 0.78 : 0.16;
          const candY = p.pos.y + ly;
          if (candY <= maxStepUp && candY > bestY) {
            bestY = candY;
          }
        }
      } else {
        // Other structures / fixtures (check colliders)
        for (const c of p.colliders) {
          if (lx >= c.min[0] && lx <= c.max[0] && lz >= c.min[2] && lz <= c.max[2]) {
            const candY = p.pos.y + c.max[1];
            if (candY <= maxStepUp && candY > bestY) {
              bestY = candY;
            }
          }
        }
      }
    }

    return bestY;
  }

  /**
   * Resolves horizontal collision against piece colliders whose height span covers
   * the body (feetY + 0.1 .. feetY + 1.8), pushing player out along minimum penetration.
   */
  push(x: number, z: number, feetY: number, radius = 0.35): { x: number; z: number } {
    let curX = x;
    let curZ = z;
    const bodyLow = feetY + 0.1;
    const bodyHigh = feetY + 1.8;

    // Up to 2 passes for corner/edge convergence
    for (let pass = 0; pass < 2; pass++) {
      const nearby = this.getNearby(curX, curZ, 3.5);
      for (const p of nearby) {
        for (const c of p.colliders) {
          const cMinY = p.pos.y + c.min[1];
          const cMaxY = p.pos.y + c.max[1];

          // Check if height span covers the body
          if (cMaxY <= bodyLow || cMinY >= bodyHigh) continue;

          // For ramps, the deck boxes follow the slope for standing/raycasting,
          // but do not act as horizontal barrier walls. Only the side handrails push.
          if (p.kind === 'ramp' && (c.max[0] - c.min[0]) > 1.0) continue;

          // Transform curX, curZ into piece local frame
          const dx = curX - p.pos.x;
          const dz = curZ - p.pos.z;
          const cos = Math.cos(p.yaw);
          const sin = Math.sin(p.yaw);
          let lx = dx * cos - dz * sin;
          let lz = dx * sin + dz * cos;

          const minX = c.min[0] - radius;
          const maxX = c.max[0] + radius;
          const minZ = c.min[2] - radius;
          const maxZ = c.max[2] + radius;

          if (lx > minX && lx < maxX && lz > minZ && lz < maxZ) {
            const dLeft = lx - minX;
            const dRight = maxX - lx;
            const dBottom = lz - minZ;
            const dTop = maxZ - lz;

            const minPen = Math.min(dLeft, dRight, dBottom, dTop);
            if (minPen === dLeft) lx = minX;
            else if (minPen === dRight) lx = maxX;
            else if (minPen === dBottom) lz = minZ;
            else lz = maxZ;

            // Transform pushed local point back to world
            curX = p.pos.x + lx * cos + lz * sin;
            curZ = p.pos.z - lx * sin + lz * cos;
          }
        }
      }
    }

    return { x: curX, z: curZ };
  }
}
