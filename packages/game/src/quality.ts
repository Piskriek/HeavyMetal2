/**
 * Picks and adapts the render quality tier so the game holds its frame rate, from phones to the owner's minimum-spec laptop.
 * Pure (no DOM): the shell feeds it the device facts and the frame times, and applies whatever it answers.
 */

export type Quality = 'low' | 'medium' | 'high' | 'ultra';

const ORDER: readonly Quality[] = ['low', 'medium', 'high', 'ultra'];

export interface DeviceFacts {
  readonly touch: boolean;
  readonly cores: number;
  readonly dpr: number;
  readonly width: number;
  /** The graphics chip's name as the browser reports it (WebGL `UNMASKED_RENDERER_WEBGL`), when known. It decides speed far more than the CPU. */
  readonly gpu?: string | null;
}

export type GpuClass = 'software' | 'weak' | 'mid' | 'strong';

/** A chip name for people: "ANGLE (Intel, Intel(R) HD Graphics 530 (0x0000191B) Direct3D11 vs_5_0 ps_5_0, D3D11)" becomes "Intel HD Graphics 530". */
export function tidyGpuName(name: string): string {
  const m = /^ANGLE \([^,]*,\s*(.+?)(?:\s+\(0x[0-9a-f]+\))?(?:\s+(?:Direct3D|OpenGL|Vulkan)\S*.*)?,\s*[^,]*\)$/i.exec(name.trim());
  return (m?.[1] ?? name).replace(/^ANGLE \w+ Renderer:\s*/i, '').replace(/\((R|TM)\)/gi, '').replace(/\s+/g, ' ').trim();
}

/**
 * What a graphics chip's name says about its speed, or null when the name is unknown. Integrated chips (Intel HD/UHD/Iris, AMD's
 * laptop Radeon Graphics/Vega) and older laptop GeForces are 'weak': the owner's laptop (Intel HD 530 + GTX 950M) runs only the low tier smoothly.
 */
export function gpuClass(name: string | null | undefined): GpuClass | null {
  if (!name) return null;
  const n = name.toLowerCase();
  if (/swiftshader|llvmpipe|softpipe|software|basic render/.test(n)) return 'software';
  if (/rtx|titan|radeon rx [5-9]\d{3}|rx [6-9]\d{3}|apple m[1-9] (pro|max|ultra)/.test(n)) return 'strong';
  if (/gtx 1[0-6][5-8]0(?! ?mx)|gtx 9[6-8]0(?!m)|radeon rx|arc\(?|apple m[1-9]|radeon pro/.test(n)) return 'mid';
  if (/intel|hd graphics|uhd graphics|iris|\bmx ?\d{3}|gtx \d{3}m|geforce \d{3}m|radeon\(tm\) graphics|radeon graphics|vega \d|radeon r[2-7]|mali|adreno|powervr|apple gpu/.test(n)) return 'weak';
  return null;
}

/**
 * A first guess before any frame has been drawn. The graphics chip leads: weak and software chips start on low, mid ones on medium,
 * strong desktops on ultra. Without a chip name, phones go by cores and screen, desktops start on medium and the adapting decides.
 * Starting too high means a choppy start (owner rule: never start a screen choppy), so unknown machines start in the middle.
 */
export function guessQuality(d: DeviceFacts): Quality {
  const g = gpuClass(d.gpu);
  if (g === 'software' || g === 'weak') return 'low';
  if (!d.touch) {
    if (g === 'mid') return 'medium';
    if (g === 'strong') return d.cores >= 8 ? 'ultra' : 'high';
    return d.cores > 0 && d.cores <= 2 ? 'low' : 'medium';
  }
  if (d.cores > 0 && d.cores <= 4) return 'low';
  const phone: Quality = d.dpr >= 3 || d.width < 420 ? 'medium' : 'high';
  return g === 'mid' && phone === 'high' ? 'medium' : phone;
}

export function parseQuality(v: unknown): Quality | null {
  return v === 'low' || v === 'medium' || v === 'high' || v === 'ultra' ? v : null;
}

export interface AdaptiveQuality {
  readonly current: Quality;
  /** Feed every frame's duration (ms). Returns the new tier when it should drop, otherwise null. */
  frame(dtMs: number): Quality | null;
}

export interface AdaptiveOptions {
  /** Frames per judging window (default 90), or `windowMs` of frames (default 1500 ms), whichever comes first. */
  readonly window?: number;
  readonly windowMs?: number;
  /** Frames ignored at the start and after each drop (default 120), or `warmupMs` (default 2500 ms), whichever comes first. */
  readonly warmup?: number;
  readonly warmupMs?: number;
  /** Average frame time above which the tier drops (default 24 ms, about 42 fps). */
  readonly slowMs?: number;
  readonly locked?: boolean;
}

/**
 * Drops a tier when the average frame time over a window stays above `slowMs`, after a warmup (shader compiles and texture uploads are
 * slow and do not count). Very slow frames (over 2.5x `slowMs`) drop two tiers at once. Windows and warmups end by frame count or by
 * time, whichever comes first, so a slow machine is rescued in seconds rather than after hundreds of slow frames. Never rises on its own:
 * a tier that was too heavy once is not tried again this session. A manual choice (`locked`) disables adapting.
 */
export function createAdaptiveQuality(start: Quality, o: AdaptiveOptions = {}): AdaptiveQuality {
  const window = o.window ?? 90, warmup = o.warmup ?? 120, slowMs = o.slowMs ?? 24;
  const windowMs = o.windowMs ?? 1500, warmupMs = o.warmupMs ?? 2500;
  let current = start, seen = 0, seenMs = 0, sum = 0, n = 0;
  return {
    get current() { return current; },
    frame(dtMs) {
      if (o.locked || !Number.isFinite(dtMs) || dtMs <= 0 || dtMs > 1000) return null;
      if (seen < warmup && seenMs < warmupMs) { seen++; seenMs += dtMs; return null; }
      sum += dtMs; n++;
      if (n < window && sum < windowMs) return null;
      const avg = sum / n;
      sum = 0; n = 0;
      const i = ORDER.indexOf(current);
      if (avg > slowMs && i > 0) {
        current = ORDER[Math.max(0, i - (avg > slowMs * 2.5 ? 2 : 1))]!;
        seen = 0; seenMs = 0;
        return current;
      }
      return null;
    },
  };
}
