/**
 * The Material presets of the asset bench: one-click looks taken from @hm/vault's MATERIAL cartridges, each mapped to
 * the three values a generated model takes (tint, metal and rough) and named the same as the cartridge. Pure: no DOM,
 * no three.js. The tint is the cartridge's own tint (its palette's middle stop, as the vault builds it); metal is set
 * by the cartridge's `metallic` tag; rough is the middle of its authored roughness range.
 */
export interface MaterialPreset {
  readonly id: string;
  readonly name: string;
  readonly tint: string;
  readonly metalness: number;
  readonly roughness: number;
}

/** The minimum a vault spec carries for this mapping (a structural subset, so this file needs no vault import). */
export interface PresetSource {
  readonly id: string;
  readonly name: string;
  readonly cls: string;
  readonly pal: readonly string[];
  readonly tags: readonly string[];
  readonly p?: { readonly roughLo?: number; readonly roughHi?: number };
}

const DEFAULT_ROUGH = 0.6;
const METAL = 0.85;

const r2 = (n: number): number => Math.round(n * 100) / 100;

/** The MATERIAL cartridges as presets, in the vault's own order. Other classes (biomes, rules) are left out. */
export function presetsFrom(specs: readonly PresetSource[]): MaterialPreset[] {
  const out: MaterialPreset[] = [];
  for (const s of specs) {
    if (s.cls !== 'MATERIAL' || s.pal.length === 0) continue;
    const tint = s.pal[Math.min(2, s.pal.length - 1)] ?? s.pal[0] ?? '#808080';
    const lo = s.p?.roughLo;
    const hi = s.p?.roughHi;
    const rough = typeof lo === 'number' && typeof hi === 'number' ? r2((lo + hi) / 2) : DEFAULT_ROUGH;
    const metalness = s.tags.includes('metallic') ? METAL : 0;
    out.push({ id: s.id, name: s.name, tint, metalness, roughness: rough });
  }
  return out;
}
