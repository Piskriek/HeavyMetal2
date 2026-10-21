/**
 * The kit materials a part slot can take (plans 38 and 39), shared by the Studio's Parts workspace, the lab's preset
 * bench and the lab's kit builds. Names match the lab's materials, plus the kit's warm paint and a signal green.
 */
import type { ParamSpec } from '@hm/partgen';

export const PART_SWATCHES: readonly { readonly id: string; readonly name: string; readonly color: string; readonly metal: number; readonly rough: number }[] = [
  { id: 'paint', name: 'Kit paint', color: '#c9c6bd', metal: 0.05, rough: 0.7 },
  { id: 'darkSteel', name: 'Dark steel', color: '#2f3439', metal: 0.8, rough: 0.55 },
  { id: 'gunmetal', name: 'Gunmetal', color: '#4a5058', metal: 0.85, rough: 0.45 },
  { id: 'copper', name: 'Copper', color: '#b5723f', metal: 0.9, rough: 0.35 },
  { id: 'hazard', name: 'Hazard amber', color: '#e5b84a', metal: 0.15, rough: 0.6 },
  { id: 'green', name: 'Signal green', color: '#3c9a5a', metal: 0.2, rough: 0.5 },
];

export const swatchName = (id: string): string => PART_SWATCHES.find((s) => s.id === id)?.name ?? id;

/**
 * A swatch drawn as a small lit ball (a CSS background), so a player sees the material before trying it on: the highlight
 * tightens and brightens as the surface gets smoother, metals darken toward the rim and catch a horizon band.
 */
export function materialBall(s: { readonly color: string; readonly metal: number; readonly rough: number }): string {
  const smooth = 1 - Math.max(0, Math.min(1, s.rough));
  const spot = Math.round(10 + (1 - smooth) * 34);
  const hi = (0.2 + smooth * 0.7).toFixed(2);
  const metal = s.metal > 0.5;
  const layers = [
    `radial-gradient(circle at 34% 28%, rgba(255, 255, 255, ${hi}) 0%, rgba(255, 255, 255, 0) ${spot}%)`,
    ...(metal ? ['linear-gradient(172deg, rgba(255, 255, 255, 0) 52%, rgba(255, 255, 255, 0.16) 58%, rgba(255, 255, 255, 0) 66%)'] : []),
    `radial-gradient(circle at 46% 40%, ${s.color} 30%, rgba(0, 0, 0, ${metal ? 0.78 : 0.5}) 100%)`,
  ];
  return layers.join(', ');
}

/** A slider value as people read it: millimetres for small parts, metres for big ones. */
export function formatValue(spec: ParamSpec, v: number): string {
  if (spec.unit === 'choice') return spec.choices?.[Math.round(v - spec.min)] ?? String(v);
  if (spec.unit === 'count') return String(Math.round(v));
  if (spec.unit === 'deg') return `${Math.round(v)}°`;
  if (spec.unit === 'factor') return v.toFixed(2);
  return spec.max <= 0.5 ? `${Math.round(v * 1000 * 10) / 10} mm` : `${v.toFixed(2)} m`;
}

/** The default material for each slot name a generator uses. */
export const DEFAULT_SLOT_MATERIAL: Readonly<Record<string, string>> = {
  metal: 'gunmetal', plate: 'paint', bolts: 'gunmetal', body: 'paint', trim: 'darkSteel', band: 'hazard', steel: 'darkSteel',
  frame: 'darkSteel', slats: 'gunmetal', duct: 'paint', flange: 'darkSteel',
  // slots the mesh operators add (surface-edge-wear-ao): worn edges show bare metal, the base band gathers dirt
  'edge-wear': 'gunmetal', 'cavity-dirt': 'darkSteel',
  // TICKET-40's generators (hopper to track), until their slots take layered materials (plan 41)
  liner: 'darkSteel', trough: 'gunmetal', cheeks: 'paint', shell: 'paint', caps: 'darkSteel', ribs: 'gunmetal',
  pipe: 'gunmetal', pin: 'gunmetal', mount: 'darkSteel', shaft: 'gunmetal', grip: 'darkSteel', stiles: 'gunmetal',
  rungs: 'gunmetal', cage: 'darkSteel', hood: 'paint', throat: 'darkSteel', housing: 'darkSteel', lens: 'hazard',
  guard: 'gunmetal', cable: 'darkSteel', clips: 'gunmetal', gland: 'copper', strap: 'gunmetal', tyre: 'darkSteel',
  rim: 'hazard', hub: 'gunmetal', tread: 'darkSteel', rollers: 'gunmetal',
};
