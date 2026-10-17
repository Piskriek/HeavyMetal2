// ============================================================================
// File: apps/web/src/base/ui/use-item-thumb.ts
// TICKET-04 (OPUS_NOTE_11 Item B):
// - useItemThumb(ref): string | null
//   Wraps studio-thumbs.ts thumbOf(assetId) and falls back to swatchFor(ref),
//   a 64 px canvas data URL drawn from the item's catalog tint or a cartridge's
//   look colours for texture maps.
// ============================================================================

import { useEffect, useState } from 'react';
import { thumbOf } from '../../studio/studio-thumbs';
import { resolveSwatchPalette, thumbAssetFor, type SwatchPalette, type ThumbRef } from './thumb-map';

const SWATCH_SIZE = 64;
const swatchCache = new Map<string, string>();
const resolvedThumbCache = new Map<string, string>();

function parseHexRgb(hex: string): [number, number, number] {
  const clean = hex.trim().replace(/^#/, '');
  if (clean.length === 3) {
    const r = parseInt(clean[0]! + clean[0]!, 16) || 0;
    const g = parseInt(clean[1]! + clean[1]!, 16) || 0;
    const b = parseInt(clean[2]! + clean[2]!, 16) || 0;
    return [r, g, b];
  }
  const n = parseInt(clean.slice(0, 6), 16);
  if (!Number.isFinite(n)) return [56, 189, 248];
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbCss(rgb: readonly [number, number, number], alpha = 1): string {
  return alpha >= 1
    ? `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`
    : `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${alpha})`;
}

function mixRgb(
  a: readonly [number, number, number],
  b: readonly [number, number, number],
  t: number
): [number, number, number] {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ];
}

function cellHash(x: number, y: number, seed: number): number {
  let h = (x * 374761393 + y * 668265263 + seed * 1442695041) | 0;
  h = ((h ^ (h >> 13)) * 1274126177) | 0;
  return ((h ^ (h >> 16)) >>> 0) / 4294967295;
}

function drawCanvasSwatch(palette: SwatchPalette, keySeed: number): string | null {
  if (typeof document === 'undefined' || typeof document.createElement !== 'function') {
    return null;
  }
  const canvas = document.createElement('canvas');
  canvas.width = SWATCH_SIZE;
  canvas.height = SWATCH_SIZE;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const baseRgb = parseHexRgb(palette.base);
  const hiRgb = parseHexRgb(palette.hi);
  const loRgb = parseHexRgb(palette.lo);
  const accRgb = parseHexRgb(palette.accent);

  // Background fill
  ctx.fillStyle = rgbCss(baseRgb);
  ctx.fillRect(0, 0, SWATCH_SIZE, SWATCH_SIZE);

  // Procedural pattern per material family
  const step = palette.pattern === 'pxd' ? 8 : 4;
  for (let y = 0; y < SWATCH_SIZE; y += step) {
    for (let x = 0; x < SWATCH_SIZE; x += step) {
      const h = cellHash(x, y, keySeed);
      if (palette.pattern === 'strata') {
        const wave = Math.sin((y + x * 0.35) * 0.22) * 0.5 + 0.5;
        const c = mixRgb(loRgb, hiRgb, wave * 0.7 + h * 0.3);
        ctx.fillStyle = rgbCss(c);
        ctx.fillRect(x, y, step, step);
      } else if (palette.pattern === 'moss') {
        const tuft = cellHash(x >> 2, y >> 2, keySeed + 7);
        const c = tuft > 0.55 ? mixRgb(baseRgb, hiRgb, (tuft - 0.5) * 1.6) : mixRgb(loRgb, baseRgb, h);
        ctx.fillStyle = rgbCss(c);
        ctx.fillRect(x, y, step, step);
      } else if (palette.pattern === 'facets') {
        const diag = ((x + y) % 16) / 16;
        const c = h > 0.78 ? accRgb : mixRgb(loRgb, hiRgb, diag * 0.75 + h * 0.25);
        ctx.fillStyle = rgbCss(c);
        ctx.fillRect(x, y, step, step);
      } else if (palette.pattern === 'pxd') {
        const c = h > 0.65 ? accRgb : h > 0.3 ? hiRgb : loRgb;
        ctx.fillStyle = rgbCss(c);
        ctx.fillRect(x + 1, y + 1, step - 2, step - 2);
      } else if (palette.pattern === 'vtx') {
        const c = mixRgb(loRgb, baseRgb, h * 0.8);
        ctx.fillStyle = rgbCss(c);
        ctx.fillRect(x, y, step, step);
      } else {
        const c = mixRgb(loRgb, hiRgb, h * 0.85);
        ctx.fillStyle = rgbCss(c);
        ctx.fillRect(x, y, step, step);
      }
    }
  }

  // Wireframe overlay for raw vertices
  if (palette.pattern === 'vtx') {
    ctx.strokeStyle = rgbCss(hiRgb, 0.9);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(32, 10);
    ctx.lineTo(12, 50);
    ctx.lineTo(52, 50);
    ctx.closePath();
    ctx.stroke();
    ctx.fillStyle = rgbCss(accRgb);
    for (const [vx, vy] of [
      [32, 10],
      [12, 50],
      [52, 50],
    ] as const) {
      ctx.beginPath();
      ctx.arc(vx, vy, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Subtle inner telemetry bevel frame
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.28)';
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, SWATCH_SIZE - 2, SWATCH_SIZE - 2);

  return canvas.toDataURL('image/png');
}

function buildFallbackSvgDataUrl(palette: SwatchPalette): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="${palette.hi}"/><stop offset="55%" stop-color="${palette.base}"/><stop offset="100%" stop-color="${palette.lo}"/></linearGradient></defs><rect width="64" height="64" rx="6" fill="url(#g)"/><circle cx="18" cy="18" r="6" fill="${palette.accent}" opacity="0.65"/><rect x="1" y="1" width="62" height="62" rx="5" fill="none" stroke="rgba(255,255,255,0.28)" stroke-width="2"/></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

/**
 * Generates (and caches) a 64x64 procedural swatch data URL drawn from the item's
 * catalog tint or a cartridge/map's look colours.
 */
export function swatchFor(ref: ThumbRef | null | undefined): string | null {
  if (!ref) return null;
  const palette = resolveSwatchPalette(ref);
  if (!palette) return null;

  const cacheKey = `${ref.item ?? ''}|${ref.kind ?? ''}|${ref.machine ?? ''}|${ref.id ?? ''}|${palette.base}|${palette.pattern}`;
  const hit = swatchCache.get(cacheKey);
  if (hit) return hit;

  let seed = 2166136261;
  for (let i = 0; i < cacheKey.length; i++) {
    seed = Math.imul(seed ^ cacheKey.charCodeAt(i), 16777619);
  }

  const url = drawCanvasSwatch(palette, seed) ?? buildFallbackSvgDataUrl(palette);
  swatchCache.set(cacheKey, url);
  return url;
}

/**
 * React hook that returns a 3D offscreen-rendered thumbnail data URL (via studio-thumbs.ts thumbOf)
 * when the item/kind/machine maps to a packed 3D asset, or falls back to swatchFor(ref) for
 * non-mesh items (raw pixels, vertices, texture maps, cartridges).
 */
export function useItemThumb(ref: ThumbRef | null | undefined): string | null {
  const item = ref?.item;
  const kind = ref?.kind;
  const machine = ref?.machine;
  const id = ref?.id;
  const tint = ref?.tint;

  const assetId = ref ? thumbAssetFor({ item: item ?? id, kind, machine }) : null;
  const fallbackSwatch = ref ? swatchFor({ item: item ?? id, kind, machine, id, tint }) : null;

  const [thumb, setThumb] = useState<string | null>(() => {
    if (assetId && resolvedThumbCache.has(assetId)) {
      return resolvedThumbCache.get(assetId)!;
    }
    return fallbackSwatch;
  });

  useEffect(() => {
    if (!ref) {
      setThumb(null);
      return;
    }
    if (!assetId) {
      setThumb(fallbackSwatch);
      return;
    }
    const cached = resolvedThumbCache.get(assetId);
    if (cached) {
      setThumb(cached);
      return;
    }

    let cancelled = false;
    setThumb(fallbackSwatch);

    void thumbOf(assetId).then((url) => {
      if (cancelled) return;
      if (url) {
        resolvedThumbCache.set(assetId, url);
        setThumb(url);
      } else {
        setThumb(fallbackSwatch);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [assetId, fallbackSwatch, item, kind, machine, id, tint]);

  return thumb;
}
