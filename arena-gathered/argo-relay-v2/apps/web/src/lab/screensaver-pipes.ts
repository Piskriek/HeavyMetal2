// ============================================================================
// File: apps/web/src/lab/screensaver-pipes.ts
// Fix: Replaced Math.random with seeded mulberry32 RNG + guarded all index reads
// ============================================================================

import * as THREE from 'three';

export const SCREENSAVER_IDLE_TRIGGER_SEC = 45.0;
export const PIPE_PALETTE_HEX: readonly number[] = [
  0xff3d8a, 0x7cff4d, 0xffc13d, 0x3dc8ff, 0xb46bff,
];

const DIRS: ReadonlyArray<readonly [number, number, number]> = [
  [1, 0, 0],
  [-1, 0, 0],
  [0, 1, 0],
  [0, -1, 0],
  [0, 0, 1],
  [0, 0, -1],
];

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function next(): number {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class RetroPipesScreensaver {
  public readonly group = new THREE.Group();
  private idleSec = 0;
  private stepAccumSec = 0;
  private head: [number, number, number] = [0, 0, 0];
  private dirIndex = 0;
  private colorIndex = 0;
  private segmentCount = 0;
  private readonly maxSegments = 64;
  private readonly rng: () => number;

  constructor(seed = 0x5e731a) {
    this.group.name = 'retro-3d-pipes-screensaver';
    this.group.visible = false;
    this.rng = mulberry32(seed);
  }

  public notifyPlayerActivity(): void {
    if (this.idleSec >= SCREENSAVER_IDLE_TRIGGER_SEC) {
      this.resetPipes();
    }
    this.idleSec = 0;
    this.group.visible = false;
  }

  public tick(dtSec: number): boolean {
    this.idleSec += dtSec;
    if (this.idleSec < SCREENSAVER_IDLE_TRIGGER_SEC) {
      return false;
    }

    this.group.visible = true;
    this.stepAccumSec += dtSec;
    if (this.stepAccumSec >= 0.12) {
      this.stepAccumSec = 0;
      this.advancePipeSegment();
    }
    return true;
  }

  private advancePipeSegment(): void {
    if (this.segmentCount >= this.maxSegments) {
      this.resetPipes();
    }

    if (this.segmentCount % 3 === 0) {
      this.dirIndex = (this.dirIndex + 1 + Math.floor(this.rng() * 4)) % DIRS.length;
    }

    const dir = DIRS[this.dirIndex] ?? [1, 0, 0];
    const stepLen = 0.08;
    const next: [number, number, number] = [
      Math.max(-0.28, Math.min(0.28, this.head[0] + dir[0] * stepLen)),
      Math.max(-0.18, Math.min(0.18, this.head[1] + dir[1] * stepLen)),
      Math.max(-0.12, Math.min(0.12, this.head[2] + dir[2] * stepLen)),
    ];

    const color = PIPE_PALETTE_HEX[this.colorIndex % PIPE_PALETTE_HEX.length] ?? 0xff3d8a;
    const mat = new THREE.MeshBasicMaterial({ color });

    const joint = new THREE.Mesh(new THREE.SphereGeometry(0.018, 8, 8), mat);
    joint.position.set(next[0], next[1], next[2]);
    this.group.add(joint);

    this.head = next;
    this.segmentCount++;
    if (this.segmentCount % 12 === 0) {
      this.colorIndex++;
    }
  }

  private resetPipes(): void {
    while (this.group.children.length > 0) {
      const child = this.group.children[0];
      if (!child) break;
      this.group.remove(child);
    }
    this.head = [0, 0, 0];
    this.segmentCount = 0;
  }
}
