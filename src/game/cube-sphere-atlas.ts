/**
 * T10 — Cube-Sphere Atlas Tools
 *
 * Versioned 3×2 atlas of square tiles centered within 2048².
 * Provides:
 * - Diagnostic texture generation (asymmetric pattern proves face orientations)
 * - Blank paint templates with gutters and labels
 * - Skin metadata for `legacy_sphere` and `cube_atlas_v1`
 * - Export guide
 *
 * Atlas layout:
 * ```
 *   [+X right] [-X left]  [+Y top]
 *   [-Y bot]   [+Z front] [-Z back]
 * ```
 *
 * Each cell is 682.67 × 1024. Square tiles (674.67 × 674.67) are centered
 * within cells with 4px gutters for mip bleeding.
 */

import {
  FACE_ORDER,
  FACE_ATLAS_GRID,
  type CubeFace,
} from './cube-sphere';

export const ATLAS_VERSION = 1;
export const ATLAS_SIZE = 2048;
export const GUTTER_PIXELS = 4;
export const CELL_WIDTH = ATLAS_SIZE / 3;   // ≈682.67
export const CELL_HEIGHT = ATLAS_SIZE / 2;   // 1024
export const TILE_SIZE = Math.min(CELL_WIDTH, CELL_HEIGHT) - GUTTER_PIXELS * 2; // ≈674.67

/** Skin metadata */
export interface SkinMetadata {
  readonly id: string;
  readonly version: number;
  readonly type: 'legacy_sphere' | 'cube_atlas_v1';
  readonly atlasSize: number;
  readonly faceOrder: readonly CubeFace[];
  readonly gutterPixels: number;
  readonly tileSize: number;
  readonly cellWidth: number;
  readonly cellHeight: number;
  readonly description: string;
}

export const SKIN_LEGACY_SPHERE: SkinMetadata = Object.freeze({
  id: 'legacy_sphere',
  version: 1,
  type: 'legacy_sphere',
  atlasSize: 0, // N/A (single equirectangular texture)
  faceOrder: FACE_ORDER,
  gutterPixels: 0,
  tileSize: 0,
  cellWidth: 0,
  cellHeight: 0,
  description: 'Legacy UV sphere with equirectangular mapping. Single texture, pole distortion.',
});

export const SKIN_CUBE_ATLAS_V1: SkinMetadata = Object.freeze({
  id: 'cube_atlas_v1',
  version: ATLAS_VERSION,
  type: 'cube_atlas_v1',
  atlasSize: ATLAS_SIZE,
  faceOrder: FACE_ORDER,
  gutterPixels: GUTTER_PIXELS,
  tileSize: TILE_SIZE,
  cellWidth: CELL_WIDTH,
  cellHeight: CELL_HEIGHT,
  description: `Cube-sphere atlas v${ATLAS_VERSION}. 3×2 grid of square tiles in ${ATLAS_SIZE}². Gutter ${GUTTER_PIXELS}px.`,
});

/**
 * Face label and color for the diagnostic texture.
 * Asymmetric pattern: each face has a unique color, number, and arrow direction.
 */
const FACE_DIAGNOSTIC: readonly {
  face: CubeFace;
  label: string;
  color: string;
  arrowDir: string;
  bgColor: [number, number, number];
}[] = [
  { face: '+X', label: '+X RIGHT',  color: '#ff4444', arrowDir: '→', bgColor: [255, 68, 68] },
  { face: '-X', label: '-X LEFT',   color: '#44ff44', arrowDir: '←', bgColor: [68, 255, 68] },
  { face: '+Y', label: '+Y TOP',    color: '#4444ff', arrowDir: '↑', bgColor: [68, 68, 255] },
  { face: '-Y', label: '-Y BOTTOM', color: '#ffff44', arrowDir: '↓', bgColor: [255, 255, 68] },
  { face: '+Z', label: '+Z FRONT',  color: '#ff44ff', arrowDir: '⊙', bgColor: [255, 68, 255] },
  { face: '-Z', label: '-Z BACK',   color: '#44ffff', arrowDir: '⊗', bgColor: [68, 255, 255] },
];

/**
 * Generates a diagnostic atlas image as RGBA pixel data.
 * Each face has a unique color, label, and asymmetric pattern to prove orientations.
 *
 * The pattern includes:
 * - Solid background color per face
 * - Face label text (drawn as pixel art)
 * - Corner markers (asymmetric: TL=red, TR=green, BL=blue, BR=yellow)
 * - UV grid lines (every 10%)
 * - Center crosshair
 * - Arrow showing face "up" direction
 */
export function generateDiagnosticAtlas(): Uint8ClampedArray {
  const data = new Uint8ClampedArray(ATLAS_SIZE * ATLAS_SIZE * 4);

  // Fill background with dark gray
  for (let i = 0; i < data.length; i += 4) {
    data[i] = 32;
    data[i + 1] = 32;
    data[i + 2] = 32;
    data[i + 3] = 255;
  }

  // Draw each face tile
  for (let faceIdx = 0; faceIdx < 6; faceIdx++) {
    const grid = FACE_ATLAS_GRID[faceIdx];
    const diag = FACE_DIAGNOSTIC[faceIdx];
    const tileX = Math.round(grid.col * CELL_WIDTH + GUTTER_PIXELS);
    const tileY = Math.round(grid.row * CELL_HEIGHT + GUTTER_PIXELS);
    const tileW = Math.round(CELL_WIDTH - GUTTER_PIXELS * 2);
    const tileH = Math.round(CELL_HEIGHT - GUTTER_PIXELS * 2);
    const tileSize = Math.min(tileW, tileH);
    const offsetX = tileX + Math.floor((tileW - tileSize) / 2);
    const offsetY = tileY + Math.floor((tileH - tileSize) / 2);

    const [bgR, bgG, bgB] = diag.bgColor;

    // Fill tile with face color (dimmed)
    for (let py = 0; py < tileSize; py++) {
      for (let px = 0; px < tileSize; px++) {
        const ax = offsetX + px;
        const ay = offsetY + py;
        if (ax < 0 || ax >= ATLAS_SIZE || ay < 0 || ay >= ATLAS_SIZE) continue;
        const idx = (ay * ATLAS_SIZE + ax) * 4;

        // Dim background
        const dim = 0.35;
        data[idx] = Math.round(bgR * dim);
        data[idx + 1] = Math.round(bgG * dim);
        data[idx + 2] = Math.round(bgB * dim);
        data[idx + 3] = 255;

        // UV grid lines (every 10%)
        const u = px / tileSize;
        const v = py / tileSize;
        const onGridU = Math.abs(u * 10 - Math.round(u * 10)) < 0.02;
        const onGridV = Math.abs(v * 10 - Math.round(v * 10)) < 0.02;
        if (onGridU || onGridV) {
          data[idx] = Math.min(255, data[idx] + 60);
          data[idx + 1] = Math.min(255, data[idx + 1] + 60);
          data[idx + 2] = Math.min(255, data[idx + 2] + 60);
        }

        // Center crosshair (thicker)
        const cx = Math.abs(px - tileSize / 2);
        const cy = Math.abs(py - tileSize / 2);
        if (cx < 2 || cy < 2) {
          data[idx] = 255;
          data[idx + 1] = 255;
          data[idx + 2] = 255;
        }

        // Corner markers (asymmetric): TL=red dot, TR=green dot, BL=blue dot, BR=yellow dot
        const cornerR = tileSize * 0.06;
        const corners = [
          { x: tileSize * 0.1, y: tileSize * 0.1, r: 255, g: 0, b: 0 },     // TL red
          { x: tileSize * 0.9, y: tileSize * 0.1, r: 0, g: 255, b: 0 },     // TR green
          { x: tileSize * 0.1, y: tileSize * 0.9, r: 0, g: 0, b: 255 },     // BL blue
          { x: tileSize * 0.9, y: tileSize * 0.9, r: 255, g: 255, b: 0 },   // BR yellow
        ];
        for (const corner of corners) {
          const dx = px - corner.x;
          const dy = py - corner.y;
          if (dx * dx + dy * dy < cornerR * cornerR) {
            data[idx] = corner.r;
            data[idx + 1] = corner.g;
            data[idx + 2] = corner.b;
          }
        }
      }
    }

    // Draw face border (2px white)
    for (let py = 0; py < tileSize; py++) {
      for (const px of [0, 1, tileSize - 2, tileSize - 1]) {
        setPixel(data, offsetX + px, offsetY + py, 255, 255, 255);
      }
    }
    for (let px = 0; px < tileSize; px++) {
      for (const py of [0, 1, tileSize - 2, tileSize - 1]) {
        setPixel(data, offsetX + px, offsetY + py, 255, 255, 255);
      }
    }

    // Draw face label as simple pixel blocks (5×7 font approximation)
    drawLabel(data, offsetX, offsetY, tileSize, diag.label, diag.bgColor);

    // Draw arrow (asymmetric direction indicator)
    drawArrow(data, offsetX, offsetY, tileSize, diag.arrowDir, diag.bgColor);

    // Fill gutter with face color (for mip bleeding)
    for (let gy = tileY; gy < tileY + Math.round(CELL_HEIGHT - GUTTER_PIXELS * 2) + GUTTER_PIXELS * 2; gy++) {
      for (let gx = tileX - GUTTER_PIXELS; gx < tileX + Math.round(CELL_WIDTH - GUTTER_PIXELS * 2) + GUTTER_PIXELS; gx++) {
        if (gx < 0 || gx >= ATLAS_SIZE || gy < 0 || gy >= ATLAS_SIZE) continue;
        // Only fill if outside tile area (gutter zone)
        if (gx >= offsetX && gx < offsetX + tileSize && gy >= offsetY && gy < offsetY + tileSize) continue;
        const idx = (gy * ATLAS_SIZE + gx) * 4;
        data[idx] = Math.round(bgR * 0.2);
        data[idx + 1] = Math.round(bgG * 0.2);
        data[idx + 2] = Math.round(bgB * 0.2);
        data[idx + 3] = 255;
      }
    }
  }

  return data;
}

function setPixel(data: Uint8ClampedArray, x: number, y: number, r: number, g: number, b: number) {
  if (x < 0 || x >= ATLAS_SIZE || y < 0 || y >= ATLAS_SIZE) return;
  const idx = (y * ATLAS_SIZE + x) * 4;
  data[idx] = r;
  data[idx + 1] = g;
  data[idx + 2] = b;
  data[idx + 3] = 255;
}

/**
 * Draw a simple label at the bottom of the tile.
 */
function drawLabel(
  data: Uint8ClampedArray,
  tileX: number, tileY: number, tileSize: number,
  label: string,
  color: [number, number, number],
) {
  // Draw label as a row of small blocks at the bottom of the tile
  const labelY = tileY + Math.round(tileSize * 0.85);
  const charW = Math.max(4, Math.round(tileSize / (label.length + 2)));
  const startX = tileX + Math.round((tileSize - charW * label.length) / 2);

  for (let ci = 0; ci < label.length; ci++) {
    const ch = label.charCodeAt(ci);
    const cx = startX + ci * charW;
    // Draw a simple block for each character (non-space)
    if (label[ci] !== ' ') {
      for (let py = 0; py < Math.round(tileSize * 0.08); py++) {
        for (let px = 0; px < charW - 1; px++) {
          // Simple hash pattern based on character code
          const bit = ((ch >> (px % 5)) ^ (py >> 1)) & 1;
          if (bit) {
            setPixel(data, cx + px, labelY + py, color[0], color[1], color[2]);
          }
        }
      }
    }
  }
}

/**
 * Draw an asymmetric arrow at the top-center of the tile.
 */
function drawArrow(
  data: Uint8ClampedArray,
  tileX: number, tileY: number, tileSize: number,
  _arrowDir: string,
  color: [number, number, number],
) {
  const cx = tileX + Math.round(tileSize / 2);
  const cy = tileY + Math.round(tileSize * 0.15);
  const arrowSize = Math.round(tileSize * 0.06);

  // Draw a triangle pointing up
  for (let dy = -arrowSize; dy <= 0; dy++) {
    const halfW = Math.round(arrowSize * (1 + dy / arrowSize));
    for (let dx = -halfW; dx <= halfW; dx++) {
      setPixel(data, cx + dx, cy + dy, color[0], color[1], color[2]);
    }
  }
  // Stem
  for (let dy = 0; dy < arrowSize; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      setPixel(data, cx + dx, cy + dy, color[0], color[1], color[2]);
    }
  }
}

/**
 * Generate a blank paint template atlas (white tiles on gray background with labels).
 */
export function generateBlankPaintAtlas(): Uint8ClampedArray {
  const data = new Uint8ClampedArray(ATLAS_SIZE * ATLAS_SIZE * 4);

  // Fill background with medium gray
  for (let i = 0; i < data.length; i += 4) {
    data[i] = 64;
    data[i + 1] = 64;
    data[i + 2] = 64;
    data[i + 3] = 255;
  }

  // Draw white tiles with face labels
  for (let faceIdx = 0; faceIdx < 6; faceIdx++) {
    const grid = FACE_ATLAS_GRID[faceIdx];
    const face = FACE_ORDER[faceIdx];
    const tileX = Math.round(grid.col * CELL_WIDTH + GUTTER_PIXELS);
    const tileY = Math.round(grid.row * CELL_HEIGHT + GUTTER_PIXELS);
    const tileW = Math.round(CELL_WIDTH - GUTTER_PIXELS * 2);
    const tileH = Math.round(CELL_HEIGHT - GUTTER_PIXELS * 2);
    const tileSize = Math.min(tileW, tileH);
    const offsetX = tileX + Math.floor((tileW - tileSize) / 2);
    const offsetY = tileY + Math.floor((tileH - tileSize) / 2);

    // Fill tile white
    for (let py = 0; py < tileSize; py++) {
      for (let px = 0; px < tileSize; px++) {
        setPixel(data, offsetX + px, offsetY + py, 240, 240, 240);
      }
    }

    // Draw face label in center (simple gray text blocks)
    const labelY = offsetY + Math.round(tileSize * 0.45);
    const label = face;
    const charW = Math.round(tileSize * 0.12);
    const startX = offsetX + Math.round((tileSize - charW * label.length) / 2);
    for (let ci = 0; ci < label.length; ci++) {
      const cx = startX + ci * charW;
      for (let py = 0; py < Math.round(tileSize * 0.1); py++) {
        for (let px = 0; px < charW - 2; px++) {
          setPixel(data, cx + px, labelY + py, 160, 160, 160);
        }
      }
    }

    // Fill gutter with tile edge color (white bleed)
    for (let gy = tileY; gy < tileY + Math.round(CELL_HEIGHT); gy++) {
      for (let gx = tileX - GUTTER_PIXELS; gx < tileX + Math.round(CELL_WIDTH); gx++) {
        if (gx < 0 || gx >= ATLAS_SIZE || gy < 0 || gy >= ATLAS_SIZE) continue;
        if (gx >= offsetX && gx < offsetX + tileSize && gy >= offsetY && gy < offsetY + tileSize) continue;
        setPixel(data, gx, gy, 200, 200, 200);
      }
    }
  }

  return data;
}

/**
 * Verify that gutters survive minification.
 * Simulates a 2× box filter downscale and checks that gutter pixels are not zero.
 */
export function verifyGutterSurvival(atlas: Uint8ClampedArray): {
  pass: boolean;
  minGutterBrightness: number;
  details: string[];
} {
  const halfW = ATLAS_SIZE / 2;
  const halfH = ATLAS_SIZE / 2;
  const downscaled = new Uint8ClampedArray(halfW * halfH * 4);

  // 2× box filter
  for (let y = 0; y < halfH; y++) {
    for (let x = 0; x < halfW; x++) {
      let r = 0, g = 0, b = 0;
      for (let dy = 0; dy < 2; dy++) {
        for (let dx = 0; dx < 2; dx++) {
          const sx = x * 2 + dx;
          const sy = y * 2 + dy;
          const idx = (sy * ATLAS_SIZE + sx) * 4;
          r += atlas[idx];
          g += atlas[idx + 1];
          b += atlas[idx + 2];
        }
      }
      const di = (y * halfW + x) * 4;
      downscaled[di] = r / 4;
      downscaled[di + 1] = g / 4;
      downscaled[di + 2] = b / 4;
      downscaled[di + 3] = 255;
    }
  }

  // Check gutter pixels in the downscaled image
  const halfCellW = CELL_WIDTH / 2;
  const halfCellH = CELL_HEIGHT / 2;
  const halfGutter = GUTTER_PIXELS / 2;
  let minBrightness = 255;
  const details: string[] = [];

  for (let faceIdx = 0; faceIdx < 6; faceIdx++) {
    const grid = FACE_ATLAS_GRID[faceIdx];
    const gutterX = Math.round(grid.col * halfCellW);
    const gutterY = Math.round(grid.row * halfCellH);

    // Sample gutter pixels around the tile
    for (let gy = gutterY; gy < gutterY + Math.round(halfCellH); gy++) {
      for (let gx = gutterX; gx < gutterX + Math.round(halfGutter + 1); gx++) {
        if (gx < 0 || gx >= halfW || gy < 0 || gy >= halfH) continue;
        const idx = (gy * halfW + gx) * 4;
        const brightness = (downscaled[idx] + downscaled[idx + 1] + downscaled[idx + 2]) / 3;
        if (brightness < minBrightness) minBrightness = brightness;
      }
    }
  }

  const pass = minBrightness > 0;
  if (!pass) {
    details.push(`Gutter pixels went black after minification (min brightness: ${minBrightness.toFixed(1)})`);
  } else {
    details.push(`Gutter survived: min brightness ${minBrightness.toFixed(1)}`);
  }

  return { pass, minGutterBrightness: minBrightness, details };
}

/**
 * Export guide text for the cube-sphere atlas.
 */
export function getExportGuide(): string {
  return [
    `# Cube-Sphere Atlas Export Guide (v${ATLAS_VERSION})`,
    '',
    `## Atlas Specifications`,
    `- Size: ${ATLAS_SIZE}×${ATLAS_SIZE} pixels`,
    `- Layout: 3 columns × 2 rows`,
    `- Cell size: ${CELL_WIDTH.toFixed(1)} × ${CELL_HEIGHT.toFixed(1)} pixels`,
    `- Tile size: ${TILE_SIZE.toFixed(1)} × ${TILE_SIZE.toFixed(1)} pixels (centered in cell)`,
    `- Gutter: ${GUTTER_PIXELS}px around each tile (for mip bleeding)`,
    '',
    `## Face Order`,
    ...FACE_ORDER.map((f, i) => `  ${i}: ${f} → column ${FACE_ATLAS_GRID[i].col}, row ${FACE_ATLAS_GRID[i].row}`),
    '',
    `## Painting Guide`,
    `- Paint within the white tile area only`,
    `- Gutters will be filled automatically (edge bleed for mipmaps)`,
    `- Corner markers: TL=red, TR=green, BL=blue, BR=yellow (verify orientation)`,
    `- UV (0,0) is at top-left of each tile, (1,1) at bottom-right`,
    '',
    `## Seam Matching`,
    `- Edges of adjacent faces must match at seams`,
    `- +X left edge ↔ +Z right edge`,
    `- +X right edge ↔ -Z left edge`,
    `- +Y bottom edge ↔ +Z top edge`,
    `- See SEAM_EDGES in cube-sphere.ts for complete list`,
    '',
    `## Export Settings`,
    `- Format: PNG (lossless)`,
    `- Color space: sRGB`,
    `- No alpha channel needed (fully opaque)`,
    `- Mipmaps: generate with 4px gutter bleed`,
  ].join('\n');
}
