// ============================================================================
// File: packages/hudmath/src/ega-palette-and-degauss.ts
// TICKET-24 (POL-01, POL-64, POL-41, POL-42, POL-67, POL-71, POL-83, POL-85):
// Pure deterministic math & lookup module for:
// 1. POL-42: Canonical 16-colour IBM EGA hardware palette quantizer for Skin 1
//    metric bars + 40 ms CRT skin-transition degauss coil pulse envelope on
//    `combatUi` bus.
// 2. POL-67: 3.5 s rising capacitor-charge pitch sweep (68 Hz -> 640 Hz) +
//    amber arc crackle envelope for Quantum Gate ignition.
// 3. POL-01 & POL-64: Main Menu hero vista state solver (Stage-0/1 glitching
//    wasteland window + Stage-4 lush portal doorway preview + glass blade).
// 4. POL-71: Canonical FIDELITY loader stage strings replacing legacy goblin/animal labels.
// Zero DOM, zero Three.js, zero Date/Math.random.
// ============================================================================

export interface EgaColourEntry {
  readonly index: number;
  readonly name: string;
  readonly hex: string;
  readonly rgb: readonly [number, number, number];
}

/** Canonical 16-colour IBM EGA hardware palette (POL-42). */
export const EGA_16_PALETTE: readonly EgaColourEntry[] = [
  { index: 0,  name: 'Black',         hex: '#000000', rgb: [0, 0, 0] },
  { index: 1,  name: 'Blue',          hex: '#0000aa', rgb: [0, 0, 170] },
  { index: 2,  name: 'Green',         hex: '#00aa00', rgb: [0, 170, 0] },
  { index: 3,  name: 'Cyan',          hex: '#00aaaa', rgb: [0, 170, 170] },
  { index: 4,  name: 'Red',           hex: '#aa0000', rgb: [170, 0, 0] },
  { index: 5,  name: 'Magenta',       hex: '#aa00aa', rgb: [170, 0, 170] },
  { index: 6,  name: 'Brown',         hex: '#aa5500', rgb: [170, 85, 0] },
  { index: 7,  name: 'Light Gray',    hex: '#aaaaaa', rgb: [170, 170, 170] },
  { index: 8,  name: 'Dark Gray',     hex: '#555555', rgb: [85, 85, 85] },
  { index: 9,  name: 'Bright Blue',   hex: '#5555ff', rgb: [85, 85, 255] },
  { index: 10, name: 'Bright Green',  hex: '#55ff55', rgb: [85, 255, 85] },
  { index: 11, name: 'Bright Cyan',   hex: '#55ffff', rgb: [85, 255, 255] },
  { index: 12, name: 'Bright Red',    hex: '#ff5555', rgb: [255, 85, 85] },
  { index: 13, name: 'Bright Magenta',hex: '#ff55ff', rgb: [255, 85, 255] },
  { index: 14, name: 'Bright Yellow', hex: '#ffff55', rgb: [255, 255, 85] },
  { index: 15, name: 'Bright White',  hex: '#ffffff', rgb: [255, 255, 255] },
];

function parseHexRgb(hex: string): readonly [number, number, number] {
  const clean = hex.trim().replace(/^#/, '');
  if (!/^[0-9a-fA-F]{6}$/.test(clean)) return [255, 255, 255];
  const n = parseInt(clean, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/**
 * POL-42: Quantizes any CSS hex colour (e.g. `#ff3d8a` Pxd, `#7cff4d` Vtx,
 * `#ffc13d` Lx, `#3dc8ff` Aq) to its closest perceptual EGA 16-colour entry
 * when HUD Skin 1 (`stage === 1`) is active.
 */
export function quantizeHexToEga16(hex: string): EgaColourEntry {
  const [r, g, b] = parseHexRgb(hex);
  let best = EGA_16_PALETTE[15]!;
  let bestDist = Infinity;
  for (const entry of EGA_16_PALETTE) {
    const dr = r - entry.rgb[0];
    const dg = g - entry.rgb[1];
    const db = b - entry.rgb[2];
    // Perceptual luma-weighted RGB distance
    const dist = dr * dr * 0.30 + dg * dg * 0.59 + db * db * 0.11;
    if (dist < bestDist) {
      bestDist = dist;
      best = entry;
    }
  }
  return best;
}

export const DEGAUSS_DURATION_MS = 40;

export interface DegaussPulseSample {
  readonly active: boolean;
  readonly coilFreqHz: number;
  readonly chirpFreqHz: number;
  readonly gain: number;
  readonly screenShearPx: number;
}

/**
 * POL-42: Computes the 40 ms CRT degauss coil acoustic & visual pulse when the HUD
 * fidelity skin steps up or down (`combatUi` bus).
 */
export function computeSkinDegaussEnvelope(elapsedMs: number): DegaussPulseSample {
  if (!Number.isFinite(elapsedMs) || elapsedMs < 0 || elapsedMs > DEGAUSS_DURATION_MS) {
    return { active: false, coilFreqHz: 0, chirpFreqHz: 0, gain: 0, screenShearPx: 0 };
  }
  const u = elapsedMs / DEGAUSS_DURATION_MS; // 0..1
  const env = Math.sin(Math.PI * u) * Math.exp(-u * 1.8);
  const coilFreqHz = 115 - 73 * u;
  const chirpFreqHz = 2400 * (1 - 0.65 * u);
  const screenShearPx = Math.round(Math.sin(u * Math.PI * 4) * 3 * (1 - u) * 100) / 100;
  return {
    active: true,
    coilFreqHz: Math.round(coilFreqHz * 10) / 10,
    chirpFreqHz: Math.round(chirpFreqHz),
    gain: Number((0.28 * env).toFixed(4)),
    screenShearPx,
  };
}

/**
 * POL-67: Computes the rising capacitor-charge frequency (Hz) and amber portal arc
 * crackle gain across the 3.5 s Quantum Gate ignition sequence (`progress01` in `0..1`).
 */
export function computeGateCapacitorChargeCurve(progress01: number): {
  readonly chargeFreqHz: number;
  readonly chargeGain: number;
  readonly arcCrackleGain: number;
} {
  const p = Math.max(0, Math.min(1, Number.isFinite(progress01) ? progress01 : 0));
  if (p <= 0) {
    return { chargeFreqHz: 68, chargeGain: 0, arcCrackleGain: 0 };
  }
  // Exponential pitch rise from 68 Hz hum to 640 Hz turbine whine
  const chargeFreqHz = Math.round(68 * Math.pow(640 / 68, p) * 10) / 10;
  const chargeGain = Number((Math.sin(Math.min(1, p * 1.2) * (Math.PI / 2)) * 0.34).toFixed(4));
  // Amber arc crackle peaks in the final 35% of ignition (p = 0.65..1.0)
  const arcPhase = Math.max(0, (p - 0.65) / 0.35);
  const arcCrackleGain = Number((Math.sin(arcPhase * Math.PI) * 0.42).toFixed(4));
  return {
    chargeFreqHz,
    chargeGain,
    arcCrackleGain,
  };
}

/**
 * POL-71: Canonical FIDELITY loading bar stages, replacing legacy "Waking the goblin"
 * and "Waking the animals" strings.
 */
export const FIDELITY_LOADER_LABELS: readonly string[] = [
  'Loading the lab models',
  'Calibrating the bridge array',
  'Indexing substrate sectors',
  'Synchronizing field resonators',
];

/**
 * POL-01 & POL-64: Computes the Main Menu backdrop state:
 * - Left panel sits on a frosted glass blade (`glassBladeBlurPx = 14`).
 * - Lab observation window shows the Stage-0/1 desolate wasteland with periodic out-of-sync glitch bursts.
 * - Right-hand Quantum Gate archway shows the Stage-4 lush terraformed hero vista (`portalHeroStage = 4`).
 */
export function computeMenuHeroVistaState(timeSec: number): {
  readonly windowWastelandStage: 0 | 1;
  readonly windowGlitchIntensity: number;
  readonly portalHeroStage: 4;
  readonly glassBladeBlurPx: number;
} {
  const t = Number.isFinite(timeSec) && timeSec >= 0 ? timeSec : 0;
  // Deterministic periodic out-of-sync glitch burst every ~4.5 seconds
  const wave = Math.sin(t * 1.4) * Math.cos(t * 3.7);
  const burst = wave > 0.62 ? (wave - 0.62) / 0.38 : 0;
  const windowGlitchIntensity = Number((0.12 + 0.78 * burst).toFixed(3));
  return {
    windowWastelandStage: burst > 0.4 ? 0 : 1,
    windowGlitchIntensity,
    portalHeroStage: 4,
    glassBladeBlurPx: 14,
  };
}
