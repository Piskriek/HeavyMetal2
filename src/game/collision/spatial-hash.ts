/**
 * T07 — swept spatial hash for broad-phase collision detection
 *
 * Divides space into cells and only tests racer pairs that share a cell or
 * adjacent cells. For a track-oriented game, we use anisotropic cells:
 * wider in x (the primary travel direction) and narrower in z (lanes).
 *
 * The hash is rebuilt each frame. Swept AABB expansion ensures fast-moving
 * racers are tested against cells they'll enter during the frame.
 */

import type { Racer } from '../racers';
import { RADIUS } from '../scene';
import type { CandidatePair } from './types';

/** Cell dimensions: 3x racer diameter in x, 1.5x in z */
const CELL_SIZE_X = RADIUS * 6;
const CELL_SIZE_Z = RADIUS * 3;

/** Maximum sweep distance: one frame at max speed (1200 units/s at 120Hz = 10 units) */
const MAX_SWEEP = 12;

export class SpatialHash {
  private cells = new Map<string, number[]>();
  private occupiedCells = 0;

  /**
   * Build the spatial hash from the current racer positions.
   * Each racer is inserted into its cell and swept forward by velocity.
   */
  build(racers: readonly Racer[]): void {
    this.cells.clear();
    this.occupiedCells = 0;

    for (let i = 0; i < racers.length; i++) {
      const racer = racers[i];
      if (racer.finished || racer.falling) continue;

      // Current cell
      const cx = Math.floor(racer.x / CELL_SIZE_X);
      const cz = Math.floor(racer.z / CELL_SIZE_Z);
      this.insert(cx, cz, i);

      // Sweep forward: if moving fast, also insert into the next cell(s)
      const sweepX = Math.min(Math.abs(racer.vx) * 0.01, MAX_SWEEP);
      const sweepZ = Math.min(Math.abs(racer.vz) * 0.01, MAX_SWEEP);

      if (sweepX > CELL_SIZE_X * 0.5) {
        const nextCx = Math.floor((racer.x + Math.sign(racer.vx) * sweepX) / CELL_SIZE_X);
        if (nextCx !== cx) this.insert(nextCx, cz, i);
      }

      if (sweepZ > CELL_SIZE_Z * 0.5) {
        const nextCz = Math.floor((racer.z + Math.sign(racer.vz) * sweepZ) / CELL_SIZE_Z);
        if (nextCz !== cz) this.insert(cx, nextCz, i);
      }
    }

    this.occupiedCells = this.cells.size;
  }

  /**
   * Generate candidate pairs from the spatial hash.
   * Racers in the same cell and adjacent cells are tested.
   * Pairs are deduplicated and sorted (a < b) for stable ordering.
   */
  generateCandidates(racers: readonly Racer[]): CandidatePair[] {
    const candidates: CandidatePair[] = [];
    const seen = new Set<string>();
    const diameter = RADIUS * 2 + 4;

    // For each cell, test pairs within the cell and with adjacent cells
    for (const [key, cellRacers] of this.cells) {
      const [cxStr, czStr] = key.split(',');
      const cx = parseInt(cxStr, 10);
      const cz = parseInt(czStr, 10);

      // Collect all racers in this cell and adjacent cells
      const nearbyRacers: number[] = [...cellRacers];

      // Check adjacent cells (right, below, and diagonals to avoid double-counting)
      const neighbors = [
        [cx + 1, cz],
        [cx, cz + 1],
        [cx + 1, cz + 1],
        [cx - 1, cz + 1],
      ];
      for (const [nx, nz] of neighbors) {
        const neighborKey = `${nx},${nz}`;
        const neighborCell = this.cells.get(neighborKey);
        if (neighborCell) {
          nearbyRacers.push(...neighborCell);
        }
      }

      // Test all pairs between cell racers and nearby racers
      for (let i = 0; i < cellRacers.length; i++) {
        for (let j = i + 1; j < nearbyRacers.length; j++) {
          const a = Math.min(cellRacers[i], nearbyRacers[j]);
          const b = Math.max(cellRacers[i], nearbyRacers[j]);

          // Skip self-pairs (when a racer appears in both cell and neighbor)
          if (a === b) continue;

          const pairKey = `${a}-${b}`;
          if (seen.has(pairKey)) continue;
          seen.add(pairKey);

          const racerA = racers[a];
          const racerB = racers[b];

          // Skip if either is finished, falling, or in a loop
          if (racerA.finished || racerB.finished) continue;
          if (racerA.falling || racerB.falling) continue;
          if (racerA.loopRide || racerB.loopRide) continue;

          const dx = racerB.x - racerA.x;
          const dy = racerB.y - racerA.y;
          const dz = racerB.z - racerA.z;
          const distance = Math.hypot(dx, dy, dz);

          // Broad phase: only keep if within 2x collision diameter
          if (distance < diameter * 2) {
            candidates.push({ a, b, dx, dy, dz, distance });
          }
        }
      }
    }

    // Sort by distance (closest first) for deterministic processing
    candidates.sort((p1, p2) => p1.distance - p2.distance);

    return candidates;
  }

  /**
   * Get statistics about the spatial hash for profiling.
   */
  getStats(racers: readonly Racer[], candidates: readonly CandidatePair[]): {
    racerCount: number;
    candidateCount: number;
    occupancy: number;
    cellCount: number;
  } {
    const activeRacers = racers.filter(r => !r.finished && !r.falling).length;
    const occupancy = this.occupiedCells > 0 ? activeRacers / this.occupiedCells : 0;

    return {
      racerCount: activeRacers,
      candidateCount: candidates.length,
      occupancy,
      cellCount: this.occupiedCells,
    };
  }

  private insert(cx: number, cz: number, racerIndex: number): void {
    const key = `${cx},${cz}`;
    let cell = this.cells.get(key);
    if (!cell) {
      cell = [];
      this.cells.set(key, cell);
    }
    cell.push(racerIndex);
  }
}
