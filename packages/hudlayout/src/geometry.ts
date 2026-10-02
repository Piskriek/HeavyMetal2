import type { Anchor, HudElement, HudKind } from './types';

export const SIZES: Record<HudKind, { w: number; h: number }> = {
  speed: { w: 120, h: 56 },
  lap: { w: 70, h: 40 },
  position: { w: 90, h: 44 },
  time: { w: 100, h: 40 },
  item: { w: 56, h: 56 },
  minimap: { w: 150, h: 150 },
  message: { w: 260, h: 48 },
  boost: { w: 160, h: 14 }
};

export function elementRect(
  e: HudElement,
  viewport: { width: number; height: number }
): { x: number; y: number; w: number; h: number } {
  const baseSize = SIZES[e.kind] ?? { w: 0, h: 0 };
  const w = baseSize.w * e.scale;
  const h = baseSize.h * e.scale;

  let x: number;
  if (e.anchor === 'top-left' || e.anchor === 'middle-left' || e.anchor === 'bottom-left') {
    x = e.offsetX;
  } else if (e.anchor === 'top-right' || e.anchor === 'middle-right' || e.anchor === 'bottom-right') {
    x = viewport.width - w - e.offsetX;
  } else {
    x = (viewport.width - w) / 2 + e.offsetX;
  }

  let y: number;
  if (e.anchor === 'top-left' || e.anchor === 'top-center' || e.anchor === 'top-right') {
    y = e.offsetY;
  } else if (e.anchor === 'bottom-left' || e.anchor === 'bottom-center' || e.anchor === 'bottom-right') {
    y = viewport.height - h - e.offsetY;
  } else {
    y = (viewport.height - h) / 2 + e.offsetY;
  }

  return { x, y, w, h };
}

const TRANSFORM_ORIGINS: Record<Anchor, string> = {
  'top-left': 'top left',
  'top-center': 'top center',
  'top-right': 'top right',
  'middle-left': 'center left',
  'center': 'center center',
  'middle-right': 'center right',
  'bottom-left': 'bottom left',
  'bottom-center': 'bottom center',
  'bottom-right': 'bottom right'
};

export function cssFor(e: HudElement): Record<string, string> {
  const styles: Record<string, string> = {};

  if (!e.visible) {
    styles['display'] = 'none';
  }

  styles['position'] = 'absolute';

  const isLeft = e.anchor === 'top-left' || e.anchor === 'middle-left' || e.anchor === 'bottom-left';
  const isRight = e.anchor === 'top-right' || e.anchor === 'middle-right' || e.anchor === 'bottom-right';
  const isTop = e.anchor === 'top-left' || e.anchor === 'top-center' || e.anchor === 'top-right';
  const isBottom = e.anchor === 'bottom-left' || e.anchor === 'bottom-center' || e.anchor === 'bottom-right';

  const isHorizCenter = !isLeft && !isRight;
  const isVertCenter = !isTop && !isBottom;

  if (isLeft) {
    styles['left'] = `${e.offsetX}px`;
  } else if (isRight) {
    styles['right'] = `${e.offsetX}px`;
  } else {
    styles['left'] = '50%';
  }

  if (isTop) {
    styles['top'] = `${e.offsetY}px`;
  } else if (isBottom) {
    styles['bottom'] = `${e.offsetY}px`;
  } else {
    styles['top'] = '50%';
  }

  styles['transformOrigin'] = TRANSFORM_ORIGINS[e.anchor] ?? 'top left';

  const transforms: string[] = [];
  if (isHorizCenter || isVertCenter) {
    const tx = isHorizCenter ? `calc(-50% + ${e.offsetX}px)` : '0px';
    const ty = isVertCenter ? `calc(-50% + ${e.offsetY}px)` : '0px';
    transforms.push(`translate(${tx}, ${ty})`);
  }
  transforms.push(`scale(${e.scale})`);

  styles['transform'] = transforms.join(' ');
  styles['opacity'] = String(e.opacity);

  return styles;
}
