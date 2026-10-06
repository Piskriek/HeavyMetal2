# SetMix: The Resolution Crafter — the Arena drops, gathered

Twelve Arena phases (11 zips, `Winner_Plan*.zip`, 2026-10-06) from the side session that designed *SetMix: The Resolution Crafter*. The zips stay on the laptop in `zips/` (gitignored); this folder is their source, so the other PC has it too.

**Read `docs/SETMIX_LANDING.md` first**: the audit of what this code really does (section 2), the landing waves (section 4) and what is parked (section 5).

## What is here

- `site/` is the **union** of the 11 snapshots' source. Each zip is a snapshot of the model's web page project (the Arena react + vite + tailwind template), and the snapshots are **not cumulative**: a phase's new files exist only in that phase's zip. The snapshots were copied over each other in phase order. Shared files are identical in every snapshot except `src/engine/setmix/{core,library}.ts` and `src/engine/texgraph.ts` (changed once, in phase 3) and `src/drop/fidelity.ts` (phase 12 adds `toEvaluateOptions`). `PROVENANCE.tsv` lists the snapshot each file first appeared in.
- Images (`src/assets/*.jpg`) and the lockfile are left out. To run the site: `npm install` and `npx vite` inside `site/` (it needs its own template dependencies, not ours).
- What matters for landing:
  - `site/src/drop/`: the "production" modules the model wrote for our monorepo (42 TypeScript files, Unreal Python and shader, `MERGE_MANIFEST.md`).
  - `site/src/engine/setmix/`: `field.ts` (the resolution wave), `mesh.ts` (mesh policy and seams), `outliner.ts` (the nested preset tree), `core.ts` and `library.ts` (the first phases' model).
  - `site/src/engine/texgraph.ts`: the model's **own** texgraph, a different dialect from `packages/texgraph` (`freq`, `input`, `curl`, ramp `interpolation`). The vault presets are written in it.
  - `site/src/components/p*` and `site/src/sections/p*`: the demo pages (design references only: `SetMixPlayable` is its own raw WebGL2 engine, `SetMixMaster` a 2D canvas).
  - `site/src/data/gdd.ts`: the model's design document as data (70 KB).

## Landed

| Wave | What | Where | Tests |
|---|---|---|---|
| 0 | This folder | `arena-gathered/setmix/` | none (source only) |
| 1 | `drop/fidelity.ts` + `drop/contracts.setmix.ts` + `drop/fidelity.spec.ts`, on our texgraph dialect, five tiers (potato to ultra) instead of the drop's four imaginary GPUs. **Two bugs fixed** that the drop's own tests caught: the octave clamp skipped the noise that stands in for cellular; `minPolicy` had no total order, so neighbours could build different seams (cracks). New: every adapted graph and every fusion must validate on `@hm/texgraph`; certify checks that too; fused knobs keep pointing at their nodes. | `packages/fidelity` | 38 |
| 2 | `@hm/texgraph` learns three opt-in options the vault needs (stripes `tilt`, warp `curl`, ramp `interpolation`; the 112 existing graphs evaluate byte-identical). The 50 cartridges: the 8 template builders rewritten for our texgraph, the 50 specs copied verbatim. Art fixes after looking at every one: crystal was round shiny domes (the owner's "christmas balls") and is now faceted cells; columnar was dimples and is now joints between columns; flow was aliasing zebra noise and is now at most 20 smooth strands; tile counts are even (an odd checkerboard cannot tile). Recipes copied as authored, with the gap pinned by a test (9 missing ingredients, 17 recipes, 50 of 100 outputs makeable). | `packages/texgraph`, `packages/vault` | 6 + 14 |
| preview | The Resolution Crafter's first look, built in the app on the landed packages (not the drop's `SetMixPlayable`, which is its own WebGL engine): the moon, the chimney, the wave, the stage ladder, the cartridge strip. | `apps/web/src/crafter` | 7 + e2e |
| later | `content/avatars.ts` (wardrobe) and `content/events.ts` (weather calendar): pure data, land when avatars and weather are wired. | | |
