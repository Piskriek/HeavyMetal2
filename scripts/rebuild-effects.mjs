import { decodePng, encodePng } from './edge-magenta-lib.mjs';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

// PRNG for deterministic, reproducible particle generation
function makePrng(seed = 123456789) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 2D Software canvas on raw RGBA Buffer
class SoftwareCanvas {
  constructor(w, h) {
    this.w = w;
    this.h = h;
    this.data = Buffer.alloc(w * h * 4);
  }

  getPixel(x, y) {
    if (x < 0 || x >= this.w || y < 0 || y >= this.h) return [0, 0, 0, 0];
    const idx = (y * this.w + x) * 4;
    return [this.data[idx], this.data[idx + 1], this.data[idx + 2], this.data[idx + 3]];
  }

  setPixel(x, y, r, g, b, a) {
    if (x < 0 || x >= this.w || y < 0 || y >= this.h || a <= 0) return;
    const idx = (y * this.w + x) * 4;
    const dstA = this.data[idx + 3] / 255;
    const srcA = a / 255;
    const outA = srcA + dstA * (1 - srcA);
    if (outA <= 0) return;

    const outR = Math.round((r * srcA + this.data[idx] * dstA * (1 - srcA)) / outA);
    const outG = Math.round((g * srcA + this.data[idx + 1] * dstA * (1 - srcA)) / outA);
    const outB = Math.round((b * srcA + this.data[idx + 2] * dstA * (1 - srcA)) / outA);

    this.data[idx] = Math.min(255, Math.max(0, outR));
    this.data[idx + 1] = Math.min(255, Math.max(0, outG));
    this.data[idx + 2] = Math.min(255, Math.max(0, outB));
    this.data[idx + 3] = Math.min(255, Math.max(0, Math.round(outA * 255)));
  }

  // Draw soft radial puff/particle
  drawSoftBlob(cx, cy, radius, r, g, b, maxAlpha, falloffPower = 1.8) {
    const minX = Math.max(0, Math.floor(cx - radius));
    const maxX = Math.min(this.w - 1, Math.ceil(cx + radius));
    const minY = Math.max(0, Math.floor(cy - radius));
    const maxY = Math.min(this.h - 1, Math.ceil(cy + radius));

    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const dx = x - cx;
        const dy = y - cy;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d >= radius) continue;
        const t = 1 - d / radius;
        const alpha = Math.round(maxAlpha * Math.pow(t, falloffPower));
        if (alpha > 0) {
          this.setPixel(x, y, r, g, b, alpha);
        }
      }
    }
  }

  // Draw soft ellipse (e.g. for ground shockwave)
  drawSoftEllipse(cx, cy, rx, ry, r, g, b, maxAlpha, ringThickness = 0, falloffPower = 1.5) {
    const minX = Math.max(0, Math.floor(cx - rx - 2));
    const maxX = Math.min(this.w - 1, Math.ceil(cx + rx + 2));
    const minY = Math.max(0, Math.floor(cy - ry - 2));
    const maxY = Math.min(this.h - 1, Math.ceil(cy + ry + 2));

    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const dx = (x - cx) / rx;
        const dy = (y - cy) / ry;
        const d = Math.sqrt(dx * dx + dy * dy);
        let alpha = 0;
        if (ringThickness > 0) {
          const ringDist = Math.abs(d - 1.0);
          if (ringDist < ringThickness) {
            const t = 1 - ringDist / ringThickness;
            alpha = Math.round(maxAlpha * Math.pow(t, falloffPower));
          }
        } else if (d < 1.0) {
          alpha = Math.round(maxAlpha * Math.pow(1 - d, falloffPower));
        }
        if (alpha > 0) {
          this.setPixel(x, y, r, g, b, alpha);
        }
      }
    }
  }

  // Draw glowing line / comet spark
  drawGlowLine(x0, y0, x1, y1, r, g, b, headAlpha, tailAlpha, thickness = 2) {
    const dx = x1 - x0;
    const dy = y1 - y0;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len === 0) {
      this.drawSoftBlob(x0, y0, thickness, r, g, b, headAlpha);
      return;
    }
    const steps = Math.ceil(len * 2);
    for (let i = 0; i <= steps; i++) {
      const frac = i / steps;
      const px = x0 + dx * frac;
      const py = y0 + dy * frac;
      const a = tailAlpha + (headAlpha - tailAlpha) * frac;
      const rad = thickness * (0.4 + 0.6 * frac);
      this.drawSoftBlob(px, py, rad, r, g, b, a);
    }
  }

  // Blit a sub-quadrant onto this canvas
  blit(srcCanvas, destX, destY) {
    for (let y = 0; y < srcCanvas.h; y++) {
      for (let x = 0; x < srcCanvas.w; x++) {
        const idx = (y * srcCanvas.w + x) * 4;
        const a = srcCanvas.data[idx + 3];
        if (a > 0) {
          this.setPixel(
            destX + x, destY + y,
            srcCanvas.data[idx],
            srcCanvas.data[idx + 1],
            srcCanvas.data[idx + 2],
            a
          );
        }
      }
    }
  }
}

// -----------------------------------------------------------------------------
// 1. GENERATE anim-45-smoke-puff (928x884, frame 464x442)
// -----------------------------------------------------------------------------
function generateSmokePuff() {
  const fw = 464, fh = 442;
  const sheet = new SoftwareCanvas(fw * 2, fh * 2);

  // Smoke billows rising from bottom-center
  const frames = [0, 1, 2, 3];
  for (const f of frames) {
    const fCanvas = new SoftwareCanvas(fw, fh);
    const rng = makePrng(777 + f * 99);
    const cx = fw * 0.5;
    const cy = fh * 0.62 - f * 35; // rises as it ages

    // Alpha multipliers per frame: 0: 0.72, 1: 0.58, 2: 0.32, 3: 0.12 -> 0
    const frameAlphaScale = [0.72, 0.58, 0.32, 0.12][f];
    const basePuffCount = [14, 22, 28, 20][f];
    const expansion = [1.0, 1.45, 1.9, 2.3][f];

    for (let p = 0; p < basePuffCount; p++) {
      const angle = rng() * Math.PI * 2;
      const dist = (rng() * 75 + 15) * expansion;
      const px = cx + Math.cos(angle) * dist * 1.1;
      const py = cy + Math.sin(angle) * dist * 0.85 - (f * 18);
      const rad = (rng() * 45 + 35) * expansion;

      // Stylized goblin smoke palette: charcoal, ash, subtle warm soot
      const tone = Math.round(95 + rng() * 45);
      const r = tone + 4;
      const g = tone;
      const b = tone - 4;
      const alpha = Math.round((140 + rng() * 60) * frameAlphaScale);

      fCanvas.drawSoftBlob(px, py, rad, r, g, b, alpha, 1.6);
    }

    // Dense core lobe in earlier frames, breaking up in later frames
    if (f < 2) {
      const coreAlpha = Math.round(180 * frameAlphaScale);
      fCanvas.drawSoftBlob(cx, cy, 70 * expansion, 105, 100, 95, coreAlpha, 2.0);
    }

    const col = f % 2;
    const row = Math.floor(f / 2);
    sheet.blit(fCanvas, col * fw, row * fh);
  }

  return { w: fw * 2, h: fh * 2, data: sheet.data };
}

// -----------------------------------------------------------------------------
// 2. GENERATE anim-48-ground-impact (1008x1008, frame 504x504)
// -----------------------------------------------------------------------------
function generateGroundImpact() {
  const fw = 504, fh = 504;
  const sheet = new SoftwareCanvas(fw * 2, fh * 2);

  for (let f = 0; f < 4; f++) {
    const fCanvas = new SoftwareCanvas(fw, fh);
    const rng = makePrng(4848 + f * 137);
    const cx = fw * 0.5;
    const cy = fh * 0.65; // ground strike point

    // Progression:
    // Frame 0: Strike & sharp central blast ring, rocks ejecting
    // Frame 1: Expanding shockwave ring, flying stones, rising dust plumes
    // Frame 2: Wide dust ring thinning out, debris arcs, dissipating dust
    // Frame 3: Dissolving dust wisps fading to 0
    const ringRadius = [55, 135, 195, 235][f];
    const ringAlpha = [210, 160, 80, 22][f];
    const dustAlpha = [170, 140, 75, 18][f];

    // Ground shockwave ellipse (flattened perspective)
    if (f < 3) {
      fCanvas.drawSoftEllipse(cx, cy, ringRadius * 1.3, ringRadius * 0.45, 190, 150, 100, ringAlpha, 0.35);
      // Secondary inner dust ripple
      fCanvas.drawSoftEllipse(cx, cy, ringRadius * 0.9, ringRadius * 0.3, 160, 125, 80, ringAlpha * 0.7, 0.4);
    } else {
      // Frame 3 faint residual dust ring
      fCanvas.drawSoftEllipse(cx, cy, ringRadius * 1.3, ringRadius * 0.45, 150, 120, 85, ringAlpha, 0.45);
    }

    // Central impact flash on frame 0 & 1
    if (f === 0) {
      fCanvas.drawSoftBlob(cx, cy, 55, 255, 235, 180, 240, 1.4);
      fCanvas.drawSoftBlob(cx, cy, 25, 255, 255, 230, 255, 1.2);
    } else if (f === 1) {
      fCanvas.drawSoftBlob(cx, cy, 75, 230, 180, 110, 140, 1.8);
    }

    // Ejected rock & dirt debris particles
    const debrisCount = [18, 30, 24, 10][f];
    const debrisSpeed = [70, 160, 210, 240][f];
    const debrisAlpha = [240, 200, 110, 25][f];

    for (let i = 0; i < debrisCount; i++) {
      const angle = -Math.PI * (0.08 + rng() * 0.84); // shoot upwards and sideways
      const speed = debrisSpeed * (0.4 + rng() * 0.7);
      const px = cx + Math.cos(angle) * speed * 1.1;
      const py = cy + Math.sin(angle) * speed * 0.75 + (f >= 2 ? (f - 1) * 35 : 0); // gravity drop
      const size = (rng() * 4 + 2) * (1 - f * 0.18);

      // Dirt / stone colors
      const r = Math.round(110 + rng() * 60);
      const g = Math.round(85 + rng() * 45);
      const b = Math.round(65 + rng() * 35);
      fCanvas.drawSoftBlob(px, py, size, r, g, b, debrisAlpha, 1.2);

      // Trailing dust puffs behind rocks
      if (f > 0 && f < 3) {
        fCanvas.drawSoftBlob(px - Math.cos(angle) * 12, py - Math.sin(angle) * 8, size * 2.5, 150, 125, 95, dustAlpha * 0.6);
      }
    }

    // Billowing dust clouds along the perimeter
    const puffCount = [8, 16, 20, 14][f];
    for (let p = 0; p < puffCount; p++) {
      const pAngle = (p / puffCount) * Math.PI * 2;
      const prx = cx + Math.cos(pAngle) * ringRadius * 1.15 * (0.8 + rng() * 0.35);
      const pry = cy + Math.sin(pAngle) * ringRadius * 0.42 * (0.8 + rng() * 0.35) - (f * 12);
      const pRad = (25 + rng() * 25) * (1 + f * 0.3);
      fCanvas.drawSoftBlob(prx, pry, pRad, 140, 115, 85, Math.round(dustAlpha * (0.6 + rng() * 0.4)));
    }

    const col = f % 2;
    const row = Math.floor(f / 2);
    sheet.blit(fCanvas, col * fw, row * fh);
  }

  return { w: fw * 2, h: fh * 2, data: sheet.data };
}

// -----------------------------------------------------------------------------
// 3. GENERATE anim-51-firework-blue (908x908, frame 454x454)
// -----------------------------------------------------------------------------
function generateFireworkBlue() {
  const fw = 454, fh = 454;
  const sheet = new SoftwareCanvas(fw * 2, fh * 2);

  const starCount = 28;
  const starDirections = [];
  const dirRng = makePrng(5151);
  for (let i = 0; i < starCount; i++) {
    const angle = (i / starCount) * Math.PI * 2 + (dirRng() - 0.5) * 0.25;
    const speed = 0.65 + dirRng() * 0.45;
    starDirections.push({ angle, speed });
  }

  for (let f = 0; f < 4; f++) {
    const fCanvas = new SoftwareCanvas(fw, fh);
    const rng = makePrng(5100 + f * 83);
    const cx = fw * 0.5;
    const cy = fh * 0.5;

    // Burst radius per frame: 0: 45, 1: 130, 2: 185, 3: 215 (with gravity sag)
    const baseDist = [45, 130, 185, 215][f];
    const headAlpha = [255, 220, 130, 30][f];
    const tailAlpha = [180, 140, 60, 10][f];
    const glowAlpha = [210, 150, 70, 15][f];

    // Core flash in frame 0 & 1
    if (f === 0) {
      fCanvas.drawSoftBlob(cx, cy, 55, 180, 240, 255, 240, 1.3);
      fCanvas.drawSoftBlob(cx, cy, 25, 255, 255, 255, 255, 1.1);
    } else if (f === 1) {
      fCanvas.drawSoftBlob(cx, cy, 75, 100, 200, 255, 120, 1.7);
    }

    for (let i = 0; i < starCount; i++) {
      const { angle, speed } = starDirections[i];
      const dist = baseDist * speed;
      const gravity = f >= 2 ? (f - 1) * 22 : 0;
      const hx = cx + Math.cos(angle) * dist;
      const hy = cy + Math.sin(angle) * dist + gravity;

      const trailLen = [25, 55, 45, 25][f];
      const tx = hx - Math.cos(angle) * trailLen;
      const ty = hy - Math.sin(angle) * trailLen;

      // Electric blue & azure tones with cyan core
      const r = Math.round(50 + rng() * 50);
      const g = Math.round(180 + rng() * 65);
      const b = 255;

      // Trail
      if (f < 3) {
        fCanvas.drawGlowLine(tx, ty, hx, hy, r, g, b, headAlpha * 0.85, tailAlpha * 0.5, [3, 4, 3, 2][f]);
      }

      // Star head
      fCanvas.drawSoftBlob(hx, hy, [6, 7, 5, 3][f], 220, 245, 255, headAlpha, 1.2);
      fCanvas.drawSoftBlob(hx, hy, [14, 16, 11, 7][f], r, g, b, glowAlpha, 1.5);

      // Secondary micro-sparkles on frames 1, 2, 3
      if (f >= 1) {
        const microCount = [0, 3, 4, 2][f];
        for (let m = 0; m < microCount; m++) {
          const mDist = rng() * 25 + 5;
          const mAng = angle + (rng() - 0.5) * 1.2;
          const mx = hx + Math.cos(mAng) * mDist;
          const my = hy + Math.sin(mAng) * mDist;
          fCanvas.drawSoftBlob(mx, my, 2.5, 200, 240, 255, Math.round(headAlpha * 0.7));
        }
      }
    }

    const col = f % 2;
    const row = Math.floor(f / 2);
    sheet.blit(fCanvas, col * fw, row * fh);
  }

  return { w: fw * 2, h: fh * 2, data: sheet.data };
}

// -----------------------------------------------------------------------------
// 4. GENERATE anim-52-firework-green (908x908, frame 454x454)
// -----------------------------------------------------------------------------
function generateFireworkGreen() {
  const fw = 454, fh = 454;
  const sheet = new SoftwareCanvas(fw * 2, fh * 2);

  const starCount = 28;
  const starDirections = [];
  const dirRng = makePrng(5252);
  for (let i = 0; i < starCount; i++) {
    const angle = (i / starCount) * Math.PI * 2 + (dirRng() - 0.5) * 0.25;
    const speed = 0.65 + dirRng() * 0.45;
    starDirections.push({ angle, speed });
  }

  for (let f = 0; f < 4; f++) {
    const fCanvas = new SoftwareCanvas(fw, fh);
    const rng = makePrng(5200 + f * 91);
    const cx = fw * 0.5;
    const cy = fh * 0.5;

    const baseDist = [45, 130, 185, 215][f];
    const headAlpha = [255, 220, 130, 30][f];
    const tailAlpha = [180, 140, 60, 10][f];
    const glowAlpha = [210, 150, 70, 15][f];

    // Core flash in frame 0 & 1
    if (f === 0) {
      fCanvas.drawSoftBlob(cx, cy, 55, 210, 255, 190, 240, 1.3);
      fCanvas.drawSoftBlob(cx, cy, 25, 255, 255, 240, 255, 1.1);
    } else if (f === 1) {
      fCanvas.drawSoftBlob(cx, cy, 75, 140, 255, 120, 120, 1.7);
    }

    for (let i = 0; i < starCount; i++) {
      const { angle, speed } = starDirections[i];
      const dist = baseDist * speed;
      const gravity = f >= 2 ? (f - 1) * 22 : 0;
      const hx = cx + Math.cos(angle) * dist;
      const hy = cy + Math.sin(angle) * dist + gravity;

      const trailLen = [25, 55, 45, 25][f];
      const tx = hx - Math.cos(angle) * trailLen;
      const ty = hy - Math.sin(angle) * trailLen;

      // Vivid emerald & mint green with gold sparkle accents
      const r = Math.round(40 + rng() * 60);
      const g = 255;
      const b = Math.round(90 + rng() * 80);

      // Trail
      if (f < 3) {
        fCanvas.drawGlowLine(tx, ty, hx, hy, r, g, b, headAlpha * 0.85, tailAlpha * 0.5, [3, 4, 3, 2][f]);
      }

      // Star head
      fCanvas.drawSoftBlob(hx, hy, [6, 7, 5, 3][f], 230, 255, 220, headAlpha, 1.2);
      fCanvas.drawSoftBlob(hx, hy, [14, 16, 11, 7][f], r, g, b, glowAlpha, 1.5);

      // Secondary micro-sparkles
      if (f >= 1) {
        const microCount = [0, 3, 4, 2][f];
        for (let m = 0; m < microCount; m++) {
          const mDist = rng() * 25 + 5;
          const mAng = angle + (rng() - 0.5) * 1.2;
          const mx = hx + Math.cos(mAng) * mDist;
          const my = hy + Math.sin(mAng) * mDist;
          // Gold / lime sparkles
          fCanvas.drawSoftBlob(mx, my, 2.5, 220, 255, 140, Math.round(headAlpha * 0.7));
        }
      }
    }

    const col = f % 2;
    const row = Math.floor(f / 2);
    sheet.blit(fCanvas, col * fw, row * fh);
  }

  return { w: fw * 2, h: fh * 2, data: sheet.data };
}

// -----------------------------------------------------------------------------
// 5. CLEAN UP & FADE EXISTING GOOD SHEETS (anim-43, 44, 46, 47, 49, 50)
// -----------------------------------------------------------------------------
function cleanAndFadeSheet(filePath) {
  const { w, h, data } = decodePng(filePath);
  const out = Buffer.from(data);
  const halfW = w / 2;
  const halfH = h / 2;

  // Frame alpha multipliers to ensure progressive dissipation to full transparency
  // Frame 0: 0.92, Frame 1: 0.82, Frame 2: 0.50, Frame 3: 0.16 (with edge feathering to 0)
  const frameAlphaScale = [0.92, 0.82, 0.50, 0.16];

  for (let f = 0; f < 4; f++) {
    const col = f % 2;
    const row = Math.floor(f / 2);
    const startX = col * halfW;
    const startY = row * halfH;
    const scale = frameAlphaScale[f];

    const cx = startX + halfW * 0.5;
    const cy = startY + halfH * 0.5;
    const maxR = Math.min(halfW, halfH) * 0.5;

    for (let y = 0; y < halfH; y++) {
      for (let x = 0; x < halfW; x++) {
        const px = startX + x;
        const py = startY + y;
        const idx = (py * w + px) * 4;
        let a = out[idx + 3];
        if (a === 0) continue;

        let r = out[idx];
        let g = out[idx + 1];
        let b = out[idx + 2];

        // Despill any magenta matte residue
        if (r > 130 && b > 130 && (r - g) > 70 && (b - g) > 70 && Math.abs(r - b) < 55) {
          // Despill towards grey/warmth
          const lum = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
          r = lum;
          b = lum;
        }

        // Apply soft radial falloff and frame dissipation
        const dx = px - cx;
        const dy = py - cy;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const normDist = Math.min(1.0, dist / maxR);

        // Frame 3 tapers aggressively towards the edges to guarantee 100% transparent fade
        let radialFactor = 1.0;
        if (f === 3) {
          radialFactor = Math.max(0, 1.0 - Math.pow(normDist, 1.5));
        }

        let newA = Math.round(a * scale * radialFactor);

        // Volumetric semi-transparency: ensure even solid centers have a natural translucency (max 230)
        newA = Math.min(newA, Math.round(230 * (scale / 0.92)));

        out[idx] = r;
        out[idx + 1] = g;
        out[idx + 2] = b;
        out[idx + 3] = newA;
      }
    }
  }

  return { w, h, data: out };
}

// -----------------------------------------------------------------------------
// MAIN EXECUTION
// -----------------------------------------------------------------------------
const alphaDir = 'public/art/animated/alpha';

const redoneSheets = {
  'anim-45-smoke-puff.png': generateSmokePuff,
  'anim-48-ground-impact.png': generateGroundImpact,
  'anim-51-firework-blue.png': generateFireworkBlue,
  'anim-52-firework-green.png': generateFireworkGreen,
};

const preservedSheets = [
  'anim-43-explosion-fire.png',
  'anim-44-spark-burst.png',
  'anim-46-gore-burst.png',
  'anim-47-gore-green-burst.png',
  'anim-49-dust-puff.png',
  'anim-50-firework-red.png',
];

console.log('--- Redoing bad sheets ---');
for (const [name, generator] of Object.entries(redoneSheets)) {
  console.log(`Generating ${name}...`);
  const result = generator();
  const filePath = join(alphaDir, name);
  encodePng(filePath, result.w, result.h, result.data);
  console.log(`Wrote ${name} (${result.w}x${result.h})`);
}

console.log('\n--- Cleaning & fading preserved sheets ---');
for (const name of preservedSheets) {
  console.log(`Processing ${name}...`);
  const filePath = join(alphaDir, name);
  const result = cleanAndFadeSheet(filePath);
  encodePng(filePath, result.w, result.h, result.data);
  console.log(`Wrote ${name} (${result.w}x${result.h})`);
}

console.log('\nAll 10 effect sheets updated successfully!');
