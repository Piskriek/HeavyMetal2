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
