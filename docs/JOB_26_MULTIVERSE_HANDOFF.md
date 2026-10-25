# JOB-26 / Plan 45 — Multiverse presets and PNG Spore Cards

**Implemented:** 2026-10-25
**Branch:** `arena/44905b50-heavymetal2`
**Base:** `016864b6212bca84d1c6c383e41cecefa891b815` (`feat/monster-mash-exploration`)
**Plan:** [Plan 45](argo/plans/PLAN_45_MULTIVERSE_GAME_PRESETS_AND_SPORE_CARDS.md)

## Runtime and entry points

`@hm/gamepreset` owns the closure-free, deeply frozen `MultiverseGamePresetSpec`, strict `parse`/`safeParse` schema, canonical JSON helpers, and four canonical presets. The app binds these IDs to the existing machine, vehicle and creature registries:

| Link | World / seed | Camera / player | Objective |
| --- | --- | --- | --- |
| `/?game=circuit-rally` | Stage-6 Earth / 42069 | Vehicle chase / Scout | Three laps through five ordered checkpoints, 180-second limit |
| `/?game=arena-survivor` | Moon / 26010 | First person / Astro suit | Ten waves, three-second intermissions; death resets the assault |
| `/?game=eco-observer` | Earth biosphere / 45006 | Third-person orbit / Astro suit | Observe eight individual theropod/avian creatures; peaceful freeplay afterwards |
| `/?game=sandbox-builder` | Moon / 45014 | Isometric / Astro suit | Open building with all eleven machines and three vehicles unlocked |

`&world=77&rig=theropod` overrides the seed and player rig. Unknown registries, invalid seeds and invalid schemas are refused. Without `game`, the normal campaign gateway is unchanged. Studio's **Spore Cards** shelf exports creations and launches presets; the play HUD switches/restarts presets and exports the active game.

All modes configure the existing `PlayScreen`/`createPlayScene` canvas, renderer, physics, matstack, monsters, audio and kit targeter. There is no additional engine, genre bundle or competing render loop. Gravity and stage animation cadence come from the preset; health and objective timers use the simulation clock, including pause. Preset switches remount/dispose the shared scene. Late avatar loads, reflection render targets and cached environment ownership are guarded during teardown.

Standalone sessions do not read/write campaign play, base, props or beam saves, do not import URL checkpoints, and do not overwrite the ending flag. Active campaign Earth/Moon endgame horizons call the same preset gateway with the campaign seed. First-time Earth credits finish (or are skipped) before the sandbox handoff; returning visitors switch directly.

## Portable Spore Cards

- Browser encoder: `apps/web/src/studio/spore-card.ts`; portable codec/schemas: `@hm/cartlab`.
- Beauty: shared offscreen WebGL renderer, **512 × 512**, art-window perspective framing, title/author, seed (or N/A), audit and six-zone maximum material-layer coverage. Kit, creature and material portraits use the existing kit builder/material pipeline, not replacement meshes.
- Envelope: `hm2:spore-card:v1`; creation discriminants: `material`, `kit`, `creature`, `game`.
- Canonical JSON preserves numeric precision, including negative zero. `fflate.zlibSync` level 9 is stored in standard PNG **zTXt**, keyword **`hm2:preset:v1`**, compression method 0, with IEEE CRC-32. Existing image chunks are preserved byte-for-byte.
- Decoder accepts Blob, ArrayBuffer and Uint8Array inputs. It scans chunks without executing/rendering the PNG, checks signature/order/lengths/CRCs, limits file/chunk counts, and inflates in bounded increments with a strict **256 KiB** decompressed cap. Invalid/trailing/nonfinal DEFLATE data, bad Adler checksums, invalid UTF-8 and malformed JSON are refused.
- Deserialization is **JSON.parse only**, followed by strict, deeply frozen schemas. Executable values, custom prototypes/accessors/toJSON, unsafe keys, sparse/non-index arrays, cycles, nonfinite numbers and unknown fields are rejected.
- Embedded kits/creatures must pass the real shared `studio.kit.audit` implementation. The audit was relocated to `@hm/kitspec/audit`, with a Studio re-export; its algorithm is unchanged. Creature datum rigs exclude only legacy ground-contact `floating` diagnostics, not any anatomical collision, hinge or orbit checks.
- Resource bounds include assembly depth, expanded parts, repeats and skeleton size. Only `uv-box-triplanar` and `uv-cylindrical-unwrap` mesh operators are accepted: the current source-bounds/anatomy audit precedes geometry operators, so deformers, CAD, cleanup, cloning and triangle-expanding wear cannot safely be certified. Such cards are explicitly refused, not silently stripped or approximated.
- Canvas/Studio drop handlers validate and audit before touching state. Corrupt drops have no world/undo effect. Disposed/superseded asynchronous drops cannot mutate a later scene. Generated assets are loaded only through the registered asset cache, never arbitrary card-supplied URLs. Scene-owned imported geometry/materials are disposed on exit.

The missing-Moon-audio retry loop exposed by headless testing is also fixed: seven null/successful buffer outcomes terminate loading, and late completion cannot restart playback after leaving play.

## Executed validation

Linux uses `npm` in place of the brief's Windows `npm.cmd`.

| Command / check | Result |
| --- | --- |
| `npm run typecheck` | PASS, zero errors |
| `npm run build` | PASS; single HTML **5.68 MB / 16 MB cap** (5,953.67 kB, gzip 1,922.54 kB) |
| `node --import tsx apps/web/src/studio/spore-card.test.ts` | **63/63 PASS** |
| Combined game-preset / missing-audio / Spore regression run | **76/76 PASS** (10 preset + 3 audio + 63 Spore) |
| `npm test`, regular suite | **3,574 total: 3,568 pass, 2 baseline failures, 4 skip** |
| `npm test`, sequential speed suite | **23/23 PASS** |
| Chromium shared-engine/drop/save-isolation smoke | PASS, zero page errors, 135 seconds |
| Chromium final beauty/custom-rig/observer-objective check | PASS, zero page errors, 93 seconds |
| `git diff --check` | PASS |

The only full-suite failures are unchanged from the clean base checkout: the generated-lattice registry-bounds test and the normalized-Int16 batching test try to parse Git LFS pointers as GLB data. Git LFS and the actual binary objects are absent in this sandbox. Tests were not disabled or weakened; `npm test` correctly exits 1. Build warnings about lucide directives, `images/orbit-workspace.webp` and externalized Node animation-loader imports remain visible.

The new tests exercise all sixteen material presets, fourteen machine/vehicle kits, seven archetype genomes and four games; exact PNG/zlib/CRC behavior; bombs, malformed chunks and stale drops; strict schema rejection; full anatomical refusal for a schema-valid interpenetrating creature; camera bounds for wide/tall/deep/large kits; UV roundtrips and rejection of all unsafe mesh operators; pure objectives, registry bindings and audio teardown.

### Browser coverage and remaining manual checks

Executed browser checks cover all four direct boots; correct world, seed, camera, HUD, weapon and roster; rover movement; paused objective/health clocks; arena wave spawning/clearing/death reset; an observation-quota completion; URL seed/custom-creature rig selection; corrupt imports with unchanged state; valid material/kit/creature/game drops; Studio material selection; actual PNG download and independent decode; and byte-identical campaign-save sentinels across standalone launches and switches.

Actual exported beauty PNG was inspected after the art-window framing fix. Ignored local QA artifacts are under `shots-run/multiverse/`; reproducible local Chromium scripts are under ignored `scratch/job26-{verify,visual}.mjs`. Browser tooling is local cache, not a new application dependency.

**Not claimed:** live completion of the entire ten-wave assault, live campaign credits/horizon handoff, or min-spec/RTX hardware frame-budget acceptance. Objective/handoff helpers have unit coverage; headless software rendering is not a hardware performance signoff.

Do **not** commit `apps/web/dist/index.html` or QA binaries/caches. Build output is restored before staging, per the existing RESUME instruction.
