// ============================================================================
// File: apps/web/src/play/screensaver-pipes.ts
// Plan: Plan 29 §2.3 ("SUIT TELEMETRY IDLE // 1993" 3D Pipes & Bouncing S-Logo)
// ============================================================================

export const IDLE_SCREENSAVER_TIMEOUT_SEC = 45.0;

const METRIC_PIPE_COLORS = ['#ff3d8a', '#7cff4d', '#ffc13d', '#3dc8ff', '#b46bff'] as const;

interface PipeHead {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  stepsRemaining: number;
}

export class SuitPipesScreensaver {
  private idleSec = 0;
  private isActive = false;
  private pipes: PipeHead[] = [];

  // Bouncing DVD-style S = (Pxd, Vtx, Lx, Aq) badge state
  private badgeX = 120;
  private badgeY = 90;
  private badgeVx = 110;
  private badgeVy = 85;
  private badgeW = 210;
  private badgeH = 44;
  private cornerFlashTimer = 0;

  public notifyUserInput(): void {
    this.idleSec = 0;
    this.isActive = false;
  }

  public step(
    dtSec: number,
    ctx: CanvasRenderingContext2D | null,
    width: number,
    height: number,
    onCornerHitBeep?: () => void
  ): boolean {
    this.idleSec += dtSec;
    if (this.idleSec < IDLE_SCREENSAVER_TIMEOUT_SEC) {
      this.isActive = false;
      return false;
    }

    if (!this.isActive) {
      this.isActive = true;
      this.resetPipes(width, height);
      if (ctx) {
        ctx.fillStyle = 'rgba(5, 6, 8, 0.92)';
        ctx.fillRect(0, 0, width, height);
      }
    }

    if (!ctx) return true;

    // 1. Step 1993 right-angle colored pipes
    for (const p of this.pipes) {
      const nextX = p.x + p.vx * dtSec * 160;
      const nextY = p.y + p.vy * dtSec * 160;

      ctx.strokeStyle = p.color;
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(nextX, nextY);
      ctx.stroke();

      p.x = nextX;
      p.y = nextY;
      p.stepsRemaining -= 1;

      if (p.stepsRemaining <= 0 || p.x < 16 || p.x > width - 16 || p.y < 16 || p.y > height - 16) {
        // Draw ball joint at 90-degree elbow turn
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
        ctx.fill();

        if (Math.abs(p.vx) > 0) {
          p.vx = 0;
          p.vy = Math.random() > 0.5 ? 1 : -1;
        } else {
          p.vy = 0;
          p.vx = Math.random() > 0.5 ? 1 : -1;
        }
        p.stepsRemaining = 12 + Math.floor(Math.random() * 24);

        // Respawn pipe if out of bounds
        if (p.x < 8 || p.x > width - 8 || p.y < 8 || p.y > height - 8) {
          p.x = width * (0.2 + Math.random() * 0.6);
          p.y = height * (0.2 + Math.random() * 0.6);
          p.color = METRIC_PIPE_COLORS[Math.floor(Math.random() * METRIC_PIPE_COLORS.length)];
        }
      }
    }

    // 2. Step Bouncing Four-Float Badge & Check Exact Corner Hit
    this.badgeX += this.badgeVx * dtSec;
    this.badgeY += this.badgeVy * dtSec;

    let hitX = false;
    let hitY = false;

    if (this.badgeX <= 0) {
      this.badgeX = 0;
      this.badgeVx = Math.abs(this.badgeVx);
      hitX = true;
    } else if (this.badgeX + this.badgeW >= width) {
      this.badgeX = width - this.badgeW;
      this.badgeVx = -Math.abs(this.badgeVx);
      hitX = true;
    }

    if (this.badgeY <= 0) {
      this.badgeY = 0;
      this.badgeVy = Math.abs(this.badgeVy);
      hitY = true;
    } else if (this.badgeY + this.badgeH >= height) {
      this.badgeY = height - this.badgeH;
      this.badgeVy = -Math.abs(this.badgeVy);
      hitY = true;
    }

    if (hitX && hitY) {
      this.cornerFlashTimer = 1.0;
      if (onCornerHitBeep) onCornerHitBeep();
    }
    this.cornerFlashTimer = Math.max(0, this.cornerFlashTimer - dtSec);

    // Draw Bouncing Badge
    ctx.fillStyle = this.cornerFlashTimer > 0 ? '#ffc13d' : '#0b101a';
    ctx.strokeStyle = '#3dc8ff';
    ctx.lineWidth = 2;
    ctx.fillRect(this.badgeX, this.badgeY, this.badgeW, this.badgeH);
    ctx.strokeRect(this.badgeX, this.badgeY, this.badgeW, this.badgeH);

    ctx.fillStyle = this.cornerFlashTimer > 0 ? '#050608' : '#e8eef5';
    ctx.font = 'bold 12px "Share Tech Mono", monospace';
    ctx.fillText('SUIT TELEMETRY IDLE // 1993', this.badgeX + 12, this.badgeY + 18);
    ctx.fillText('S = (Pxd, Vtx, Lx, Aq)', this.badgeX + 12, this.badgeY + 34);

    return true;
  }

  private resetPipes(width: number, height: number): void {
    this.pipes = METRIC_PIPE_COLORS.map((color, idx) => ({
      x: width * (0.25 + idx * 0.12),
      y: height * 0.5,
      vx: idx % 2 === 0 ? 1 : 0,
      vy: idx % 2 === 0 ? 0 : 1,
      color,
      stepsRemaining: 15 + idx * 5,
    }));
  }
}
