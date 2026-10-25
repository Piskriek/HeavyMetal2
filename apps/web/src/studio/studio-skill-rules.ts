/**
 * The two blocks of canon `studio-skill.md` quotes, in one place so the skill file, a doc test and (later) the Studio's help panel read
 * the same words: the Cardinal Constitution's four floats and the fidelity-stage ladder. Pure strings; no imports, so nothing here can
 * drift from `CLAUDE.md`'s wording by accident without this file being edited.
 */

/** The one formula. There is no fifth metric. */
export const FOUR_FLOATS =
  '`Pxd` pixel density, `Vtx` vertex density, `Lx` light flux, `Aq` aquatic level. A material\'s `Pxd` is its tile resolution, a part\'s ' +
  '`Vtx` is its detail rank\'s mesh, a light preset supplies `Lx`, a plot biome supplies `Aq`.';

/** Stage 0a through 6: what each stage draws, as the studio skill and the stage-look bible say. */
export const STAGE_LADDER: readonly { readonly stage: string; readonly look: string; readonly reads: string }[] = Object.freeze([
  { stage: '0a', look: 'Wireframe on arrival', reads: 'edges only, one line weight' },
  { stage: '0b', look: '1-bit flat-faceted with dither', reads: 'two tones, ordered dither, no gradients' },
  { stage: '1', look: '16-colour EGA', reads: 'palette pairs, hard steps between tones' },
  { stage: '2', look: '256-colour VGA', reads: 'quantised ramps, vertex-keyframe cadence' },
  { stage: '3', look: 'Gouraud', reads: 'smooth shading, 30 Hz cadence, no textures' },
  { stage: '4', look: 'PBR, low detail', reads: 'tiles and roughness at rank 0-1' },
  { stage: '5', look: 'PBR, mid detail', reads: 'full material stack, rank 2 on Medium' },
  { stage: '6', look: 'PBR, full detail', reads: 'every slider, every layer, 60 Hz and up' },
]);

/** The ladder as one sentence, for the skill file. */
export const stageLadder = (): string =>
  STAGE_LADDER.map((s) => `Stage ${s.stage} (${s.look}: ${s.reads})`).join(' -> ') + '.';

/** The stage table as markdown rows (a table the help panel and the skill file both draw). */
export function stageLadderTable(): string {
  return ['| Stage | Look | What it reads as |', '| :--- | :--- | :--- |', ...STAGE_LADDER.map((s) => `| ${s.stage} | ${s.look} | ${s.reads} |`)].join('\n');
}
