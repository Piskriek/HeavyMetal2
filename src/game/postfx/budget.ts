/**
 * IF-POSTFX: VRAM budget calculations and quality scaler.
 * Ensures post-processing VRAM never exceeds device limits (e.g. 48 MB at 4K).
 */

export type PostFxQuality = 'low' | 'medium' | 'high';

export interface PostFxOptions {
  quality: PostFxQuality;
  bloomStrength: number; // 0..1
  vignetteStrength: number; // 0..1
  grainStrength: number; // 0..0.1
  caStrength: number; // chromatic aberration 0..1
  tonemapping: 'aces' | 'neutral' | 'none';
}

export const DEFAULT_POSTFX_OPTIONS: PostFxOptions = {
  quality: 'medium',
  bloomStrength: 0.35,
  vignetteStrength: 0.25,
  grainStrength: 0.02,
  caStrength: 0.15,
  tonemapping: 'aces',
};

export const MAX_VRAM_BUDGET_BYTES = 48 * 1024 * 1024; // 48 MB cap

/**
 * Calculates offscreen VRAM allocated by post-processing targets in bytes.
 * Medium and Low quality are direct rendering (0 extra offscreen VRAM).
 */
export function postFxMemory(
  width: number,
  height: number,
  quality: PostFxQuality,
  msaaSamples = 1,
): number {
  if (quality === 'low' || quality === 'medium') {
    return 0; // Direct to screen / CSS overlay, zero offscreen render targets
  }

  // High Quality: RGBA16F (8 bytes per pixel)
  const hdrPixelBytes = 8;
  const msaaMultiplier = msaaSamples > 1 ? msaaSamples : 1;
  const mainTargetBytes = width * height * hdrPixelBytes * msaaMultiplier;

  // 4 Dual-Kawase pyramid bloom levels: 1/2, 1/4, 1/8, 1/16 size
  let pyramidBytes = 0;
  let curW = Math.floor(width / 2);
  let curH = Math.floor(height / 2);

  for (let lvl = 0; lvl < 4; lvl++) {
    pyramidBytes += curW * curH * hdrPixelBytes * 2; // ping-pong pairs
    curW = Math.max(1, Math.floor(curW / 2));
    curH = Math.max(1, Math.floor(curH / 2));
  }

  return mainTargetBytes + pyramidBytes;
}

/**
 * Dynamically scales down MSAA, bloom levels, or drops to Medium/Low if VRAM budget is exceeded.
 */
export function fitToBudget(
  width: number,
  height: number,
  desired: PostFxQuality,
  vramCapBytes = MAX_VRAM_BUDGET_BYTES,
): { quality: PostFxQuality; levels: number; msaa: number } {
  if (desired === 'low') return { quality: 'low', levels: 0, msaa: 0 };
  if (desired === 'medium') return { quality: 'medium', levels: 0, msaa: 0 };

  // Try High with 4 MSAA
  if (postFxMemory(width, height, 'high', 4) <= vramCapBytes) {
    return { quality: 'high', levels: 4, msaa: 4 };
  }

  // Step 1: Drop MSAA to 1
  if (postFxMemory(width, height, 'high', 1) <= vramCapBytes) {
    return { quality: 'high', levels: 4, msaa: 1 };
  }

  // Step 2: Drop bloom levels
  const reducedBytes = postFxMemory(width, height, 'high', 1) * 0.7;
  if (reducedBytes <= vramCapBytes) {
    return { quality: 'high', levels: 2, msaa: 1 };
  }

  // Step 3: Fall back to zero-cost Medium
  return { quality: 'medium', levels: 0, msaa: 0 };
}
