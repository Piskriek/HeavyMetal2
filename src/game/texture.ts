export interface Point { x: number; y: number }
export type Quad = [Point, Point, Point, Point];

export function polygon(context: CanvasRenderingContext2D, points: readonly Point[]) {
  context.beginPath();
  context.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) context.lineTo(points[i].x, points[i].y);
  context.closePath();
}

function triangle(
  context: CanvasRenderingContext2D,
  image: CanvasImageSource,
  source: [Point, Point, Point],
  target: [Point, Point, Point],
) {
  const [s0, s1, s2] = source;
  const [p0, p1, p2] = target;
  const ux = s1.x - s0.x;
  const uy = s1.y - s0.y;
  const vx = s2.x - s0.x;
  const vy = s2.y - s0.y;
  const determinant = ux * vy - uy * vx;
  if (Math.abs(determinant) < 0.001) return;
  if (target.some((point) => !Number.isFinite(point.x) || !Number.isFinite(point.y))) return;
  const a = ((p1.x - p0.x) * vy - (p2.x - p0.x) * uy) / determinant;
  const b = ((p1.y - p0.y) * vy - (p2.y - p0.y) * uy) / determinant;
  const c = ((p2.x - p0.x) * ux - (p1.x - p0.x) * vx) / determinant;
  const d = ((p2.y - p0.y) * ux - (p1.y - p0.y) * vx) / determinant;
  const center = { x: (p0.x + p1.x + p2.x) / 3, y: (p0.y + p1.y + p2.y) / 3 };
  context.save();
  // A subpixel overlap prevents hairline cracks between the two texture triangles.
  polygon(context, target.map((point) => {
    const dx = point.x - center.x;
    const dy = point.y - center.y;
    const length = Math.hypot(dx, dy) || 1;
    return { x: point.x + dx / length * 0.45, y: point.y + dy / length * 0.45 };
  }));
  context.clip();
  context.transform(a, b, c, d, p0.x - a * s0.x - c * s0.y, p0.y - b * s0.x - d * s0.y);
  const minX = Math.min(s0.x, s1.x, s2.x);
  const minY = Math.min(s0.y, s1.y, s2.y);
  const width = Math.max(s0.x, s1.x, s2.x) - minX;
  const height = Math.max(s0.y, s1.y, s2.y) - minY;
  context.drawImage(image, minX, minY, width, height, minX, minY, width, height);
  context.restore();
}

export function texturedQuad(
  context: CanvasRenderingContext2D,
  image: CanvasImageSource,
  source: { x: number; y: number; width: number; height: number },
  target: Quad,
) {
  const { x, y, width, height } = source;
  const uv: Quad = [{ x, y }, { x: x + width, y }, { x: x + width, y: y + height }, { x, y: y + height }];
  triangle(context, image, [uv[0], uv[1], uv[2]], [target[0], target[1], target[2]]);
  triangle(context, image, [uv[0], uv[2], uv[3]], [target[0], target[2], target[3]]);
}