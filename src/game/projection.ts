import { FINISH, GROUND, START_X, START_Y } from './scene';
import type { Vec3 } from './geometry';

export interface ScreenPoint {
  x: number;
  y: number;
  scale: number;
  depth: number;
}

/** World units of rendered track kept beyond the camera clamp at each end of the course. */
export const CAMERA_HEADROOM = 350;

/** Soft boundary clamp: the camera may never expose unrendered void past the launch pad or the stadium. */
export const clampCameraTarget = (target: number) => Math.max(0, Math.min(FINISH - CAMERA_HEADROOM, target));

/** Frame-rate independent form of `lerp(current, target, dt * rate)`. */
export const chaseLerp = (current: number, target: number, rate: number, dt: number) =>
  current + (target - current) * (1 - Math.exp(-rate * Math.max(0, dt)));

export interface EdgeAnchor {
  x: number;
  y: number;
  /** Angle from the clamped anchor back toward the real point. */
  angle: number;
  /** -1 when the point left the view on the left, 1 on the right, 0 when it stayed inside horizontally. */
  side: -1 | 0 | 1;
  /** True when the point left the view across the top edge. */
  above: boolean;
}

/** Clamps an off-screen point to the viewport rim, keeping the direction toward the real position. */
export function edgeAnchor(px: number, py: number, width: number, height: number, margin: number): EdgeAnchor {
  const x = Math.max(margin, Math.min(width - margin, px));
  const y = Math.max(margin, Math.min(height - margin, py));
  return { x, y, angle: Math.atan2(py - y, px - x), side: px < 0 ? -1 : px > width ? 1 : 0, above: py < margin };
}

export interface CameraStageState {
  stage: 'alpine' | 'lip_swing' | 'waterfall_cliff' | 'cavern_maw' | 'mine_coaster' | 'stadium';
  yaw: number;
  swingProgress: number; // 0 to 1 during 90° swing
  verticalBias: number;  // 1 when fully head-on/vertical in Section 2
  originX: number;
  originY: number;
  elevation: number;
}

export interface FreeFlyCamera {
  active: boolean;
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
  speed: number;
}

export class RangeCamera {
  width = 1440;
  offset = 0;
  heightOffset = 0;
  readonly zoom = 0.86;
  cameraMode: 'third_person' | 'follow_ball' | 'fixed' = 'third_person';
  ballPos = { x: START_X, y: START_Y, z: 0 };
  freeFly: FreeFlyCamera = {
    active: false,
    x: 2000,
    y: 350,
    z: 0,
    yaw: 0,
    pitch: 0.18,
    speed: 700,
  };
  private focal = 2880;
  private originX = 209;
  private originY = 447;
  private elevation = 0.32;
  private yaw = 20 * Math.PI / 180;
  private sine = Math.sin(20 * Math.PI / 180);
  private cosine = Math.cos(20 * Math.PI / 180);
  private cameraX = START_X - 2880 * Math.sin(20 * Math.PI / 180);
  private cameraY = GROUND - 2880 * 0.32;
  private cameraZ = -2880 * Math.cos(20 * Math.PI / 180);
  private swingProgress = 0;
  private verticalBias = 0;
  private currentStage: CameraStageState['stage'] = 'alpine';
  revision = 0;

  get stageState(): CameraStageState {
    return {
      stage: this.currentStage,
      yaw: this.yaw,
      swingProgress: this.swingProgress,
      verticalBias: this.verticalBias,
      originX: this.originX,
      originY: this.originY,
      elevation: this.elevation,
    };
  }

  configure(
    width: number,
    offset: number,
    downrange = true,
    heightOffset = this.heightOffset,
    cameraMode: 'third_person' | 'follow_ball' | 'fixed' = this.cameraMode,
    ballPos: { x: number; y: number; z: number } = this.ballPos
  ) {
    this.width = width;
    this.offset = offset;
    this.heightOffset = heightOffset;
    this.cameraMode = cameraMode;
    this.ballPos = ballPos;
    this.focal = Math.max(2400, width * 2);

    // Compute stage-aware camera angles for theatrical stage production:
    // Section 1 (Alpine Downhill 0..24000): 20° side-follow view or third-person chase
    // Transition 1->2 (Canyon Lip 24000..25600): camera smoothly swings 90° right
    // Section 2 (Waterfall Cliff 25600..48000): head-on vertical drop stage, marbles drop down screen
    // Transition 2->3 (Cavern Maw 48000..50400): plunge into darkness, swings to 22° coaster angle
    // Section 3 (Mine Coaster 50400..68400): subterranean spaghetti coaster over lava
    // Stadium Climax (68400+): breakthrough daylight finish
    if (offset < 24000) {
      this.currentStage = 'alpine';
      this.swingProgress = 0;
      this.verticalBias = 0;
      this.yaw = downrange ? 20 * Math.PI / 180 : 0;
      this.originX = Math.max(143, Math.min(250, width * 0.155));
      this.originY = 447;
      this.elevation = 0.32;
    } else if (offset < 25600) {
      this.currentStage = 'lip_swing';
      const t = (offset - 24000) / 1600;
      const ease = t * t * (3 - 2 * t);
      this.swingProgress = ease;
      this.verticalBias = ease;
      this.yaw = (20 + 70 * ease) * Math.PI / 180;
      this.originX = width * 0.155 * (1 - ease) + (width * 0.5) * ease;
      this.originY = 447 * (1 - ease) + 320 * ease;
      this.elevation = 0.32 * (1 - ease) + 0.70 * ease;
    } else if (offset < 48000) {
      this.currentStage = 'waterfall_cliff';
      this.swingProgress = 1;
      this.verticalBias = 1;
      this.yaw = 90 * Math.PI / 180;
      this.originX = width * 0.5;
      this.originY = 320;
      this.elevation = 0.70;
    } else if (offset < 50400) {
      this.currentStage = 'cavern_maw';
      const t = (offset - 48000) / 2400;
      const ease = t * t * (3 - 2 * t);
      this.swingProgress = 1 - ease;
      this.verticalBias = 1 - ease;
      this.yaw = (90 - 68 * ease) * Math.PI / 180;
      this.originX = (width * 0.5) * (1 - ease) + (width * 0.20) * ease;
      this.originY = 320 * (1 - ease) + 430 * ease;
      this.elevation = 0.70 * (1 - ease) + 0.32 * ease;
    } else if (offset < 68400) {
      this.currentStage = 'mine_coaster';
      this.swingProgress = 0;
      this.verticalBias = 0;
      this.yaw = 22 * Math.PI / 180;
      this.originX = width * 0.20;
      this.originY = 430;
      this.elevation = 0.32;
    } else {
      this.currentStage = 'stadium';
      this.swingProgress = 0;
      this.verticalBias = 0;
      this.yaw = 20 * Math.PI / 180;
      this.originX = width * 0.155;
      this.originY = 447;
      this.elevation = 0.32;
    }

    this.sine = Math.sin(this.yaw);
    this.cosine = Math.cos(this.yaw);
    this.cameraY = GROUND + heightOffset - this.focal * this.elevation;
    this.cameraX = offset + START_X - this.focal * this.sine;
    this.cameraZ = -this.focal * this.cosine;
    this.revision++;
  }

  // Physics stays in its original plane; only rendering gains range and lateral depth.
  project(x: number, y = GROUND, lateral = 0, parallax = 1): ScreenPoint {
    return this.projectInto(x, y, lateral, { x: 0, y: 0, scale: 1, depth: 0 }, parallax);
  }

  projectInto(x: number, y: number, lateral: number, target: ScreenPoint, parallax = 1) {
    // 0. Free-Fly Camera in Map Building Debug Mode
    if (this.freeFly.active) {
      const dx = x - this.freeFly.x;
      const dy = y - this.freeFly.y;
      const dz = lateral - this.freeFly.z;
      const cosY = Math.cos(this.freeFly.yaw);
      const sinY = Math.sin(this.freeFly.yaw);
      const cosP = Math.cos(this.freeFly.pitch);
      const sinP = Math.sin(this.freeFly.pitch);

      // Rotate around Y axis (yaw)
      const rx = dx * cosY - dz * sinY;
      const rz = dx * sinY + dz * cosY;

      // Rotate around X axis (pitch)
      const ry = dy * cosP - rz * sinP;
      const depth = dy * sinP + rz * cosP;

      if (depth <= 5) {
        target.x = -9999; target.y = -9999; target.scale = 0; target.depth = -1;
        return target;
      }
      const scale = (this.focal * 0.55) / depth;
      target.x = this.width / 2 + rx * scale;
      target.y = this.originY + ry * scale;
      target.scale = scale;
      target.depth = depth;
      return target;
    }

    // 1. Standard Horizontal Side-Follow Projection (Section 1, Section 3, Stadium)
    const rangeH = x - this.offset * parallax - START_X;
    const depthH = rangeH * this.sine + lateral * this.cosine;
    const scaleH = this.zoom * this.focal / Math.max(this.focal * 0.2, this.focal + depthH);
    let hX = this.originX + (rangeH * this.cosine - lateral * this.sine) * scaleH;
    let hY = this.originY + (y - GROUND - this.heightOffset - depthH * this.elevation) * scaleH;

    // In third-person mode, center the player and chase forward
    if (this.cameraMode === 'third_person' && this.verticalBias <= 0) {
      const tpDepth = (x - (this.ballPos.x - 360));
      const tpScale = this.zoom * this.focal / Math.max(this.focal * 0.15, this.focal + tpDepth);
      const tpX = this.width * 0.5 + (lateral - this.ballPos.z) * 1.35 * tpScale + (x - this.ballPos.x) * 0.28 * tpScale;
      const tpY = this.originY + 60 + (y - GROUND - this.heightOffset - tpDepth * 0.22) * tpScale;
      hX = tpX;
      hY = tpY;
    }

    // 2. Head-On Vertical Drop Projection (Section 2: Waterfall Cliff)
    // Camera looks directly at cliff face: lateral (z in [-480, 480]) maps comfortably across
    // the central 60% of screen (864px), and track distance x maps DOWNWARDS vertically!
    const vScale = 0.88;
    const vX = this.originX + lateral * 0.90;
    const vY = this.originY + (x - this.offset) * 0.55;
    const vDepth = x - this.offset;

    if (this.verticalBias <= 0) {
      target.x = hX;
      target.y = hY;
      target.scale = scaleH;
      target.depth = depthH;
    } else if (this.verticalBias >= 1) {
      target.x = vX;
      target.y = vY;
      target.scale = vScale;
      target.depth = vDepth;
    } else {
      const b = this.verticalBias;
      target.x = hX * (1 - b) + vX * b;
      target.y = hY * (1 - b) + vY * b;
      target.scale = scaleH * (1 - b) + vScale * b;
      target.depth = depthH * (1 - b) + vDepth * b;
    }

    return target;
  }

  depthAt(x: number, z: number) { return (x - this.offset - START_X) * this.sine + z * this.cosine; }

  unproject(screenX: number, screenY: number, lateral = 0, parallax = 1) {
    if (this.verticalBias > 0.5) {
      return {
        x: this.offset + (screenY - this.originY) / 0.55,
        y: GROUND + this.heightOffset,
      };
    }
    const u = (screenX - this.originX) / this.zoom;
    const rawDenom = this.focal * this.cosine - u * this.sine;
    const denominator = Math.abs(rawDenom) < 1 ? (rawDenom < 0 ? -1 : 1) : rawDenom;
    const range = (u * (this.focal + lateral * this.cosine) + this.focal * lateral * this.sine) / denominator;
    const depth = range * this.sine + lateral * this.cosine;
    const scale = this.zoom * this.focal / Math.max(this.focal * 0.2, this.focal + depth);
    return {
      x: this.offset * parallax + START_X + range,
      y: GROUND + this.heightOffset + (screenY - this.originY) / scale + depth * this.elevation,
    };
  }

  visibleRange(lateral = 0, padding = 160, parallax = 1) {
    if (this.verticalBias > 0.5) {
      return {
        start: Math.max(0, this.offset - 800),
        end: this.offset + 1600,
      };
    }
    return {
      start: this.unproject(-padding, GROUND, lateral, parallax).x,
      end: this.unproject(this.width + padding, GROUND, lateral, parallax).x,
    };
  }

  visibleSpan(near: number, far: number, padding = 220) {
    if (this.verticalBias > 0.5) {
      return {
        start: Math.max(0, this.offset - 800),
        end: this.offset + 1600,
      };
    }
    const a = this.visibleRange(near, padding);
    const b = this.visibleRange(far, padding);
    return { start: Math.min(a.start, b.start) - 256, end: Math.max(a.end, b.end) + 512 };
  }

  followOffset(x: number, z = 0) {
    if (x >= 25600 && x <= 48000) {
      return x;
    }
    if (x >= 24000 && x < 25600) {
      const t = (x - 24000) / 1600;
      const ease = t * t * (3 - 2 * t);
      const focusX = Math.max(this.originX, this.width * 0.3);
      const relative = this.unproject(focusX, GROUND, z).x - this.offset;
      const side = Math.max(0, x - relative);
      return side * (1 - ease) + x * ease;
    }
    if (x >= 48000 && x < 50400) {
      const t = (x - 48000) / 2400;
      const ease = t * t * (3 - 2 * t);
      const focusX = Math.max(this.originX, this.width * 0.3);
      const relative = this.unproject(focusX, GROUND, z).x - this.offset;
      const side = Math.max(0, x - relative);
      return x * (1 - ease) + side * ease;
    }
    const focusX = Math.max(this.originX, this.width * 0.3);
    const relative = this.unproject(focusX, GROUND, z).x - this.offset;
    return Math.max(0, x - relative);
  }

  facing(point: Vec3, normal: Vec3) {
    const dx = this.cameraX - point.x;
    const dy = this.cameraY - point.y;
    const dz = this.cameraZ - point.z;
    return dx * normal.x + dy * normal.y + dz * normal.z > 0.001;
  }
}