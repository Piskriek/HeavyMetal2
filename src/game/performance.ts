import type { GraphicsMode } from './types';

export class RenderBudget {
  private mode: GraphicsMode = 'auto';
  private quality = 1;
  private average = 12;
  private slowFrames = 0;
  private fastFrames = 0;
  private cooldownUntil = 0;
  private width = 1;
  private height = 1;

  configure(width: number, height: number, mode: GraphicsMode) {
    this.width = width;
    this.height = height;
    if (mode !== this.mode) {
      this.mode = mode;
      this.quality = 1;
      this.slowFrames = this.fastFrames = 0;
      this.average = 12;
      this.cooldownUntil = 0;
    }
  }

  get density() {
    const cap = this.mode === 'quality' ? 1.5 : this.mode === 'performance' ? 1 : 1.15;
    const pixels = this.mode === 'quality' ? 1_850_000 : this.mode === 'performance' ? 720_000 : 1_100_000;
    return Math.min(window.devicePixelRatio || 1, cap, Math.sqrt(pixels / (this.width * this.height))) * this.quality;
  }

  get lowDetail() { return this.mode === 'performance' || this.quality < 0.86; }

  sample(milliseconds: number, now: number, interactive: boolean) {
    if (this.mode !== 'auto' || !interactive) return false;
    this.average += (milliseconds - this.average) * 0.09;
    if (now < this.cooldownUntil) return false;
    this.slowFrames = this.average > 19 ? this.slowFrames + 1 : Math.max(0, this.slowFrames - 2);
    this.fastFrames = this.average < 9 ? this.fastFrames + 1 : 0;
    if (this.slowFrames >= 18 && this.quality > 0.65) {
      this.quality = Math.max(0.65, this.quality - 0.15);
      this.slowFrames = this.fastFrames = 0;
      this.cooldownUntil = now + 2200;
      return true;
    }
    if (this.fastFrames >= 480 && this.quality < 1) {
      this.quality = Math.min(1, this.quality + 0.1);
      this.fastFrames = 0;
      this.cooldownUntil = now + 8000;
      return true;
    }
    return false;
  }
}

export class CanvasLayer {
  readonly canvas = document.createElement('canvas');
  readonly context = this.canvas.getContext('2d')!;
  private key = '';

  draw(
    target: CanvasRenderingContext2D,
    width: number,
    height: number,
    scale: number,
    key: string,
    paint: (context: CanvasRenderingContext2D) => void,
  ) {
    const pixelWidth = Math.max(1, Math.ceil(width * scale));
    const pixelHeight = Math.max(1, Math.ceil(height * scale));
    if (this.canvas.width !== pixelWidth || this.canvas.height !== pixelHeight) {
      this.canvas.width = pixelWidth;
      this.canvas.height = pixelHeight;
      this.key = '';
    }
    if (key !== this.key) {
      this.context.setTransform(scale, 0, 0, scale, 0, 0);
      this.context.clearRect(0, 0, width, height);
      this.context.imageSmoothingQuality = 'medium';
      paint(this.context);
      this.key = key;
    }
    target.drawImage(this.canvas, 0, 0, width, height);
  }

  invalidate() { this.key = ''; }

  destroy() {
    this.canvas.width = this.canvas.height = 1;
    this.invalidate();
  }
}