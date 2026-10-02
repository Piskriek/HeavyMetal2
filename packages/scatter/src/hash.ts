export interface Located {
  readonly x: number;
  readonly z: number;
}

/** Uniform-grid spatial hash answering "is there anything near (x, z)?" without scanning every item. */
export class PointHash<T extends Located> {
  private readonly cells = new Map<string, T[]>();
  private readonly size: number;

  constructor(cellSize: number) {
    this.size = cellSize;
  }

  add(item: T): void {
    const key = this.key(Math.floor(item.x / this.size), Math.floor(item.z / this.size));
    const bucket = this.cells.get(key);
    if (bucket) bucket.push(item);
    else this.cells.set(key, [item]);
  }

  /** True when `test` holds for some stored item in a cell overlapping the square of half-side `radius` around (x, z). */
  some(x: number, z: number, radius: number, test: (item: T) => boolean): boolean {
    const i0 = Math.floor((x - radius) / this.size);
    const i1 = Math.floor((x + radius) / this.size);
    const j0 = Math.floor((z - radius) / this.size);
    const j1 = Math.floor((z + radius) / this.size);
    for (let j = j0; j <= j1; j++) {
      for (let i = i0; i <= i1; i++) {
        const bucket = this.cells.get(this.key(i, j));
        if (!bucket) continue;
        for (const item of bucket) if (test(item)) return true;
      }
    }
    return false;
  }

  private key(i: number, j: number): string {
    return `${i},${j}`;
  }
}
