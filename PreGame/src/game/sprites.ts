import type Matter from 'matter-js';

/** Gameplay sprites sliced from the "game graphics kit" sheet (see assets/ui). */
const files = import.meta.glob<string>('../assets/game/*.webp', { eager: true, import: 'default' });
const images = new Map<string, HTMLImageElement>();
if (typeof Image !== 'undefined') {
  for (const [path, url] of Object.entries(files)) {
    const img = new Image();
    img.src = url;
    images.set(path.slice(path.lastIndexOf('/') + 1, -'.webp'.length), img);
  }
}

export function sprite(name: string): HTMLImageElement | null {
  const img = images.get(name);
  return img && img.complete && img.naturalWidth > 0 ? img : null;
}

const BALLS: [string, number, number][] = [
  // name, hue, saturation cut-off (low saturation => steel)
  ['red', 0, 0], ['orange', 28, 0], ['gold', 48, 0], ['green', 110, 0], ['cyan', 190, 0], ['blue', 220, 0], ['purple', 275, 0],
];
const ballCache = new Map<string, string>();
/** Closest-looking kit ball for a livery colour. */
export function ballFor(hex: string): string {
  const cached = ballCache.get(hex);
  if (cached) return cached;
  const n = parseInt(hex.replace('#', ''), 16);
  const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  let name = 'steel';
  if (d > 0.18) {
    let h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h = (h * 60 + 360) % 360;
    // yellow-green liveries (Volt) read best as the lime/green ball
    if (h > 62 && h < 95) h = 110;
    let best = Infinity;
    for (const [candidate, hue] of BALLS) {
      const dist = Math.min(Math.abs(h - hue), 360 - Math.abs(h - hue));
      if (dist < best) { best = dist; name = candidate; }
    }
  }
  const result = `ball-${name}`;
  ballCache.set(hex, result);
  return result;
}

const patterns = new WeakMap<CanvasRenderingContext2D, Map<string, CanvasPattern>>();
function pattern(ctx: CanvasRenderingContext2D, img: HTMLImageElement, name: string): CanvasPattern | null {
  let map = patterns.get(ctx);
  if (!map) { map = new Map(); patterns.set(ctx, map); }
  let p = map.get(name);
  if (!p) {
    p = ctx.createPattern(img, 'repeat') ?? undefined;
    if (!p) return null;
    map.set(name, p);
  }
  return p;
}

/** Local frame of a (possibly chamfered) rectangular body: extents along its angle. */
export function bodyFrame(body: Matter.Body) {
  const a = body.angle;
  const ux = Math.cos(a), uy = Math.sin(a);
  let minU = Infinity, maxU = -Infinity, minV = Infinity, maxV = -Infinity;
  for (const p of body.vertices) {
    const dx = p.x - body.position.x, dy = p.y - body.position.y;
    const u = dx * ux + dy * uy;
    const v = -dx * uy + dy * ux;
    minU = Math.min(minU, u); maxU = Math.max(maxU, u); minV = Math.min(minV, v); maxV = Math.max(maxV, v);
  }
  return { minU, maxU, minV, maxV };
}

/**
 * Fill a body with a tiled strip sprite, scaled so the strip height matches the body thickness.
 * Returns false when the sprite is not loaded yet so callers can fall back to flat drawing.
 */
export function drawStrip(ctx: CanvasRenderingContext2D, body: Matter.Body, name: string, options: { tile?: number } = {}): boolean {
  const img = sprite(name);
  if (!img) return false;
  const p = pattern(ctx, img, name);
  if (!p) return false;
  const { minU, maxU, minV, maxV } = bodyFrame(body);
  const thick = maxV - minV;
  const scale = (options.tile ?? thick) / img.naturalHeight;
  ctx.save();
  ctx.translate(body.position.x, body.position.y);
  ctx.rotate(body.angle);
  p.setTransform(new DOMMatrix().translateSelf(minU, minV).scaleSelf(scale, scale));
  ctx.fillStyle = p;
  ctx.fillRect(minU, minV, maxU - minU, thick);
  ctx.strokeStyle = 'rgba(0,0,0,0.45)';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(minU, minV, maxU - minU, thick);
  ctx.restore();
  return true;
}

export function drawSprite(ctx: CanvasRenderingContext2D, name: string, x: number, y: number, w: number, h: number, angle = 0): boolean {
  const img = sprite(name);
  if (!img) return false;
  if (angle) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.drawImage(img, -w / 2, -h / 2, w, h);
    ctx.restore();
  } else {
    ctx.drawImage(img, x - w / 2, y - h / 2, w, h);
  }
  return true;
}
