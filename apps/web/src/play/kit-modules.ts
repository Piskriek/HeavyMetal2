/**
 * The kit modules the Bench and the plan-41 material work share (TICKET-40).
 *
 * `MATSTACK_TEST_PIECE_KIT` is Argo's material test piece: every shape a layered material has to survive, on one 0.60 m machine — a
 * grounded skid, a bevelled panel with a bolt row, a square-section beam (the sharp convex edges and the one place a brush direction
 * shows), a gusseted bracket (the crease where it meets the skid) and a short can with a hazard lip. It is built from `@hm/partgen`
 * generators on `@hm/kitspec` sockets, so a part cartridge can retune it and a material cartridge can dress it, exactly like the
 * machines in the plot.
 *
 * The kit is typed as `Kit` at the declaration, which is the fix for the strict-typecheck review item (a literal that widens
 * `kind: 'param'` to `string` is not a `PartSource`): the annotation makes the literal check against the contract instead of the
 * contract against the literal.
 *
 * `MAT_PRESET_SKINS` names the `mat:` presets the modules wear by default; `withMaterial` swaps every one of them for a single key, which
 * is how the Bench's material preview dresses the piece in whatever the person is editing.
 */
import type { Kit } from '@hm/kitspec';

/** The `mat:` layered material presets the test modules wear, by the role they play on a machine. */
export const MAT_PRESET_SKINS = Object.freeze({
  khakiBody: 'mat:field-worn-hazard',
  brushedTrim: 'mat:workshop-steel',
  darkHopper: 'mat:rust-bucket',
  hazardStripe: 'mat:hazard-chevron',
  copperBus: 'mat:old-copper',
  rubberSeal: 'mat:rubber-seal',
  slattedGrille: 'mat:slatted-grille-steel',
  crushedOre: 'mat:crushed-ore-bed',
} as const);

/** The assembly that is the whole test piece. */
export const TEST_PIECE_PRESET = 'matstack-test-piece';

/** Its height, the floor to the top of the beam (the review's 0.60 m), in metres — measured in the test, not assumed. */
export const TEST_PIECE_HEIGHT = 0.6;

/**
 * The material test piece (plan 41 §4.6): five `@hm/partgen` parts on sockets, grounded at y = 0, 0.60 m tall.
 *  - `tp-skid`: the grounded skid (an 0.08 m `can` whose 0.02 m plinth takes its top to 0.10 m);
 *  - `tp-bevel-panel`: a bevelled `panel` with a three-bolt row on its far side;
 *  - `tp-square-beam`: a square-section `beam` column, lying along x on its mount — its top lands at exactly 0.60 m;
 *  - `tp-bracket`: a gusseted `bracket` (a real crease and a real edge);
 *  - `tp-short-can`: a short `can` housing with a hazard lip.
 */
export const MATSTACK_TEST_PIECE_KIT: Kit = Object.freeze({
  parts: {
    'tp-skid': {
      source: {
        kind: 'param',
        gen: 'can',
        params: { width: 0.56, depth: 0.48, height: 0.08, bevel: 0.012, plinthHeight: 0.02, plinthInset: 0.01, topLip: 0.01 },
      },
      material: MAT_PRESET_SKINS.darkHopper,
      slotMaterials: { body: MAT_PRESET_SKINS.darkHopper, trim: MAT_PRESET_SKINS.brushedTrim },
      rank: 0,
      sockets: {
        panelMount: { at: [-0.08, 0.28, -0.14], rot: [90, 0, 0] },
        beamMount: { at: [0.22, 0.34, -0.12], rot: [0, 0, 90] },
        bracketMount: { at: [-0.08, 0.08, -0.02] },
        canMount: { at: [0.12, 0.08, 0.1] },
      },
    },
    'tp-bevel-panel': {
      source: {
        kind: 'param',
        gen: 'panel',
        params: { width: 0.34, depth: 0.4, thickness: 0.045, bevel: 0.018, seam: 0.03, boltsPerSide: 3, boltHead: 0.024 },
      },
      material: MAT_PRESET_SKINS.khakiBody,
      slotMaterials: { plate: MAT_PRESET_SKINS.khakiBody, bolts: MAT_PRESET_SKINS.brushedTrim },
      rank: 0,
    },
    'tp-square-beam': {
      source: { kind: 'param', gen: 'beam', params: { length: 0.52, section: 0.12, wall: 0.012 } },
      material: MAT_PRESET_SKINS.khakiBody,
      slotMaterials: { steel: MAT_PRESET_SKINS.khakiBody },
      rank: 0,
    },
    'tp-bracket': {
      source: { kind: 'param', gen: 'bracket', params: { width: 0.12, upright: 0.22, foot: 0.18, thickness: 0.02, gusset: 1 } },
      material: MAT_PRESET_SKINS.khakiBody,
      slotMaterials: { steel: MAT_PRESET_SKINS.khakiBody, bolts: MAT_PRESET_SKINS.brushedTrim },
      rank: 1,
    },
    'tp-short-can': {
      source: {
        kind: 'param',
        gen: 'can',
        params: { width: 0.18, depth: 0.18, height: 0.26, bevel: 0.015, plinthHeight: 0.03, plinthInset: 0.01, topLip: 0.015 },
      },
      material: MAT_PRESET_SKINS.khakiBody,
      slotMaterials: { body: MAT_PRESET_SKINS.khakiBody, trim: MAT_PRESET_SKINS.hazardStripe },
      rank: 1,
    },
  },
  assemblies: {
    [TEST_PIECE_PRESET]: {
      children: [
        { ref: 'tp-skid', key: 'skid' },
        { ref: 'tp-bevel-panel', key: 'bevel-panel', on: { child: 0, socket: 'panelMount' } },
        { ref: 'tp-square-beam', key: 'square-beam', on: { child: 0, socket: 'beamMount' } },
        { ref: 'tp-bracket', key: 'bracket', on: { child: 0, socket: 'bracketMount' } },
        { ref: 'tp-short-can', key: 'short-can', on: { child: 0, socket: 'canMount' } },
      ],
    },
  },
} as Kit);

/**
 * The same kit with every material key (and every slot material) replaced by `name`, for a preview that dresses the whole piece in one
 * material. Generators, sockets and ranks are untouched, so the geometry is identical.
 */
export function withMaterial(kit: Kit, name: string): Kit {
  const parts = Object.fromEntries(
    Object.entries(kit.parts).map(([id, part]) => [
      id,
      {
        ...part,
        material: name,
        ...(part.slotMaterials
          ? { slotMaterials: Object.fromEntries(Object.keys(part.slotMaterials).map((slot) => [slot, name])) }
          : {}),
      },
    ]),
  );
  return { parts, assemblies: kit.assemblies };
}

/** Every material key a kit names (its parts' and their slots'), for a cartridge palette or a validation pass. */
export function kitMaterialKeys(kit: Kit): readonly string[] {
  const out = new Set<string>();
  for (const part of Object.values(kit.parts)) {
    out.add(part.material);
    for (const m of Object.values(part.slotMaterials ?? {})) out.add(m);
  }
  return [...out].sort();
}
