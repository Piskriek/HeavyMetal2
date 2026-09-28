/**
 * IF-MATERIAL-SHADING: Material descriptors and pure normalization.
 * Supports PBR lit shading, unlit stylized shading with glow, and biome tinting.
 */

export type ShadingMode = 'lit' | 'unlit';

export interface MaterialDescriptor {
  shadingMode: ShadingMode;
  color: string; // hex #rrggbb
  roughness: number; // 0..1 (lit only)
  metalness: number; // 0..1 (lit only)
  unlitGlow: number; // 0..2 (unlit only, > 1 blooms on High)
  biomeTint: boolean; // linear blend toward biome palette
  biomeTintStrength: number; // 0..1
  doubleSided: boolean;
  castShadow: boolean;
  receiveShadow: boolean;
}

export const BIOME_COLORS: Record<string, [number, number, number]> = {
  ridge: [0.52, 0.64, 0.45], // #85a374 alpine green
  canyon: [0.77, 0.49, 0.29], // #c47d4a canyon terracotta
  stadium: [0.38, 0.65, 0.98], // #60a5fa stadium blue
};

export const DEFAULT_MATERIAL_DESCRIPTOR: MaterialDescriptor = {
  shadingMode: 'lit',
  color: '#ffffff',
  roughness: 0.7,
  metalness: 0.1,
  unlitGlow: 0,
  biomeTint: false,
  biomeTintStrength: 0.5,
  doubleSided: false,
  castShadow: true,
  receiveShadow: true,
};

export function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '').trim();
  if (clean.length !== 6) return [1, 1, 1];
  const r = parseInt(clean.slice(0, 2), 16) / 255;
  const g = parseInt(clean.slice(2, 4), 16) / 255;
  const b = parseInt(clean.slice(4, 6), 16) / 255;
  return [Number.isFinite(r) ? r : 1, Number.isFinite(g) ? g : 1, Number.isFinite(b) ? b : 1];
}

export function rgbToHex(rgb: [number, number, number]): string {
  const clampByte = (v: number) => Math.max(0, Math.min(255, Math.round(v * 255)));
  const r = clampByte(rgb[0]).toString(16).padStart(2, '0');
  const g = clampByte(rgb[1]).toString(16).padStart(2, '0');
  const b = clampByte(rgb[2]).toString(16).padStart(2, '0');
  return `#${r}${g}${b}`;
}

/**
 * Normalizes a partial descriptor into a canonical MaterialDescriptor.
 * Clamps numeric values and validates colors.
 */
export function normalizeDescriptor(d: Partial<MaterialDescriptor>): MaterialDescriptor {
  const shadingMode: ShadingMode = d.shadingMode === 'unlit' ? 'unlit' : 'lit';
  let color = d.color ?? DEFAULT_MATERIAL_DESCRIPTOR.color;
  if (!/^#[0-9a-fA-F]{6}$/.test(color)) {
    color = DEFAULT_MATERIAL_DESCRIPTOR.color;
  }

  const roughness = Math.max(0, Math.min(1, d.roughness ?? DEFAULT_MATERIAL_DESCRIPTOR.roughness));
  const metalness = Math.max(0, Math.min(1, d.metalness ?? DEFAULT_MATERIAL_DESCRIPTOR.metalness));
  const unlitGlow = Math.max(0, Math.min(2, d.unlitGlow ?? DEFAULT_MATERIAL_DESCRIPTOR.unlitGlow));
  const biomeTint = Boolean(d.biomeTint);
  const biomeTintStrength = Math.max(
    0,
    Math.min(1, d.biomeTintStrength ?? DEFAULT_MATERIAL_DESCRIPTOR.biomeTintStrength),
  );
  const doubleSided = Boolean(d.doubleSided);
  const castShadow = d.castShadow !== false;
  const receiveShadow = d.receiveShadow !== false;

  return {
    shadingMode,
    color,
    roughness,
    metalness,
    unlitGlow,
    biomeTint,
    biomeTintStrength,
    doubleSided,
    castShadow,
    receiveShadow,
  };
}

/**
 * Computes the effective RGB color accounting for biome tint and glow.
 */
export function effectiveColor(
  desc: MaterialDescriptor,
  biomeKey: string,
): [number, number, number] {
  const base = hexToRgb(desc.color);
  let [r, g, b] = base;

  if (desc.biomeTint) {
    const biome = BIOME_COLORS[biomeKey] ?? BIOME_COLORS.ridge;
    const s = desc.biomeTintStrength;
    // Linear lerp: (1 - s) * base + s * (base * biome)
    r = (1 - s) * r + s * (r * biome[0]);
    g = (1 - s) * g + s * (g * biome[1]);
    b = (1 - s) * b + s * (b * biome[2]);
  }

  if (desc.shadingMode === 'unlit' && desc.unlitGlow > 0) {
    const glowMult = 1 + desc.unlitGlow;
    r *= glowMult;
    g *= glowMult;
    b *= glowMult;
  }

  return [r, g, b];
}

/**
 * Generates a stable cache key for a descriptor and biome.
 */
export function materialKey(d: MaterialDescriptor, biomeKey: string): string {
  const norm = normalizeDescriptor(d);
  const eff = effectiveColor(norm, biomeKey);
  const rgbStr = eff.map((v) => v.toFixed(3)).join(',');

  if (norm.shadingMode === 'unlit') {
    return `unlit_${rgbStr}_ds${norm.doubleSided ? 1 : 0}`;
  }

  return `lit_${rgbStr}_r${norm.roughness.toFixed(2)}_m${norm.metalness.toFixed(2)}_ds${norm.doubleSided ? 1 : 0}_s${norm.receiveShadow ? 1 : 0}`;
}
