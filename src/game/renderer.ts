/* =============================================================================
   HEAVY METAL GP 2 — GAME RENDERER
   Delegates directly to Renderer3D (Three.js WebGL base) while maintaining
   full API compatibility with GameEngine and RangeCamera projection.
   ============================================================================= */
import type { GameAssets } from './assets';
import { RangeCamera } from './projection';
import { HEIGHT, loopGeometry, type Obstacle, type SceneFrame } from './scene';
import type { CourseId } from './types';
import { Renderer3D } from './renderer-3d';

export class RangeRenderer {
  readonly view = new RangeCamera();
  private readonly renderer3d: Renderer3D;

  constructor(canvas: HTMLCanvasElement, assets: GameAssets, _course: CourseId = 'ridge') {
    this.renderer3d = new Renderer3D(canvas, assets);
  }

  resize(width: number, height: number) {
    this.renderer3d.resize(width, height);
    this.view.configure(width / height * HEIGHT, this.view.offset, true);
  }

  get lowDetail() {
    return false;
  }

  loopExitPosition(obstacle: Obstacle) {
    const loop = loopGeometry(obstacle, 'ridge');
    return { x: loop.x, y: loop.y + loop.ballRadius };
  }

  get trackBuilder() {
    return this.renderer3d.trackBuilder;
  }

  get renderer3D() {
    return this.renderer3d;
  }

  render(frame: SceneFrame, intervalMs = 16.67) {
    this.renderer3d.render(frame, intervalMs);
  }

  destroy() {
    this.renderer3d.destroy();
  }
}