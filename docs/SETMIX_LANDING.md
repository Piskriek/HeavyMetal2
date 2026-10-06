# SetMix: The Resolution Crafter — landing the Arena drops (audit and plan)

Written 2026-10-06 (Opus 5.5, laptop `C:\MarbleGp`) after reading `docs/CLAUDE_OPUS_HANDOFF.md` and checking its claims against the code. **Nothing is landed yet. This file is the plan.** The owner decisions it needs are in section 6.

Main at the time of writing: typecheck clean, `npm test` 1,743 tests (1,739 pass, 4 skipped, 0 fail).

---

## 1. What the drops are

- 11 zips in `zips/` (`*.zip` is gitignored), extracted to `zips/extracted/winner_plan*` (not ignored: 40 MB). Each is a snapshot of the Arena model's web page project (the Arena react + vite + tailwind template), not a copy of our repo.
- **The snapshots are not cumulative.**
  - The shared files (fidelity, contracts, terrain material, portal, goblin controller, avatar manager, machines, galaxy, audio, Unreal export and importer) are byte-identical in every snapshot after the one they first appear in. The only change: `fidelity.ts` gains `toEvaluateOptions` in the last snapshot.
  - Each phase's **new** files are in that phase's snapshot only:

    | Snapshot | Files that exist only here |
    |---|---|
    | extended4 (phase 6) | `NetBus.ts`, `QuestEngine.ts`, `SetMixPlayable.tsx`, `SetmixHUD.tsx`, `NetLab.tsx` |
    | extended5 (phase 7) | `CartridgeCompiler.ts`, `Ecosystem.ts`, `LogisticsSwarm.ts`, `VolumetricVoxelField.ts`, `VoxelWorker.ts`, `WaterShader.ts` |
    | extended6 (phase 8) | `GoblinRover.ts`, `RaceEngine.ts`, `SetmixWGSL.ts`, `GpuComputePipeline.ts`, `DialogueEngine.ts`, `GoblinTrader.ts`, `SaveEngine.ts`, `desktop.ts` |
    | extended7 (phase 9) | `flora.ts`, `fauna.ts`, `enclaves.ts`, `federation.ts` |
    | extended8 (phase 10) | `MasterRuntime.ts`, `SetMixMaster.tsx`, `verify-all.ts`, `ue5-bridge.ts`, `SetmixLiveLink.py`, `MERGE_MANIFEST.md` |
    | extended9 (phase 11) | `BakeWorkerPool.ts`, `png.ts`, `texgraph-patch.ts`, `M_SetMix_Nanite_Master.usf`, `build_setmix_master.py` |
    | extended910 (phase 12) | `content/presets.ts`, `recipes.ts`, `avatars.ts`, `events.ts`, `PresetVault.tsx` |

    Landing from the last snapshot alone would lose most of the work.
  - **The union** (rebuild it by copying each snapshot's `src/drop` into one folder in phase order; the shared files are identical): 42 TypeScript files in `src/drop` (18,000 lines), 6 in `src/engine` (`setmix/field.ts`, `mesh.ts`, `outliner.ts`, `core.ts`, `library.ts`, and the model's own `texgraph.ts`: 3,300 lines), 1,500 lines of Python and USF for Unreal, 8,300 lines of demo pages, and the design document data `src/data/gdd.ts` (70 KB).
- **The model never imported our packages.** It carries its own `contracts.setmix.ts` and its own texgraph, written from the interface excerpts in our prompts. Some excerpts were wrong (`EvaluateOptions.normal`, the `MachineKind` shape in `arena-setmix-repo-integration.md`), and the phase 3 prompt promised a texgraph `bounds` option we never built.

## 2. The handoff's claims, checked

| Claim (handoff or manifest) | What the code does | Check |
|---|---|---|
| "Fully designed, typed, and mathematically verified" | **Typed: yes.** The union typechecks with 0 errors at the drop's own settings. Under ours (`noUncheckedIndexedAccess`, `noImplicitOverride`) 857 errors, nearly all "possibly undefined" on array reads: mechanical. **Verified: no** (next rows). | `tsc` over the union |
| `fidelity.ts` test suite passes | 29 specs, **2 fail on real bugs**: (1) `adaptGraph` swaps cellular and curl nodes for a noise node with a hard-coded `octaves: 2`, past the device's budget (mobile allows 1); (2) `minPolicy` has no tie-break when two chunks share LOD and mode, so `minPolicy(a, b)` and `minPolicy(b, a)` can differ in chamfer or relax steps and the two neighbours build different seam rings: **cracks**, the very thing the seam scheme exists to prevent. Both are small fixes. A third test only fails because it reads `src/index.ts` (the landing path). | `node --import tsx --test fidelity.test.ts` |
| `verify-all.ts`: "13 checks", "4-client rollback across 24 permutations", the master CI gate | 14 checks, **12 pass**. Both rollback checks fail: "clients diverged — rollback is not deterministic", "diverged at latency 1, loss 0". The file also **re-implements what it claims to test**: its own `.smx` format (magic `SMX\x01`, a different layout from `CartridgeCompiler.ts`'s 64-byte `SMX1` header), its own save format (not `SaveEngine.ts`), its own one-number rollback model (not `NetBus.ts`), and an acyclicity check over a hand-written package list. `NetBus`, `SaveEngine` and `CartridgeCompiler` have no tests at all. | `node --import tsx verify-all.ts` |
| Tests in general | Only `fidelity.ts` has tests. About 95% of the 21,000 lines (field, mesh, machines, galaxy, quests, ecosystem, rover, saves, netcode, cartridge) have none; the demo pages were their only check. | |
| `texgraph-patch.ts`: "6 lines" removing "40 MB/s" of garbage | It patches an `evaluateGraph` we do not have (`bounds`, `normal`, and internals `promote`, `evalNode`, `lum`, `heightToNormal`). Even on a texgraph that had them, it removes only the four output arrays; most of the garbage is the one array per node per call, which it keeps. | read against `packages/texgraph/src/index.ts` |
| 50 cartridges "expand to a genuine @hm/texgraph AST that evaluateGraph() can run right now" | **0 of 50 validate on `packages/texgraph`.** They are written in the model's dialect: `freq` (ours `scale`), `input` (ours `in`), cellular `invert` (ours `mode`), stripes `freq/angle/sharpness` (ours `count/softness/vertical`), checker `freq` (ours `countX/countY`), noise `lacunarity`, ramp `interpolation`, and a `curl` node ours lacks. Same seed, different noise code: they will also look different on ours. | `validateGraph` on every cartridge |
| 100-recipe periodic table | Recipe outputs are a name, a colour and an effect sentence, with no graph. **85 of 100 recipes use an input that is not a vault cartridge.** | resolve every id against the vault |
| Purity: no `Date.now()` / `Math.random()` in the simulation | **Holds.** Those calls appear only in workers, GPU, export, PNG, audio and the Unreal bridge. | grep |
| "Unified 3D first-person playable" (`SetMixPlayable.tsx`), "4-mode master client" (`SetMixMaster.tsx`) | `SetMixPlayable` is its own raw WebGL2 engine with its own matrices; `SetMixMaster` draws on a 2D canvas. Neither uses `@hm/render` (three.js), the graphics tiers, adaptive quality or loading bars. They are design references, not code to mount. | imports |
| `MERGE_MANIFEST.md` marks `render`, `audio`, `machines`, `content` as new packages | All four exist (`@hm/render` is our three.js renderer, 5,500 lines; `@hm/machines` is QL4's, merged 2026-10-05). Following the manifest would overwrite them. It also targets `apps/web/src/routes/setmix/`; the app has no routes folder (screens live in `shell/`). | `ls packages` |

## 3. How we land (rules)

1. **Our gate, not `verify-all.ts`.** Each package passes `npm run verify` (typecheck at our strictness, its tests, the one-file build) and the e2e stays green. `verify-all.ts` is not adopted; its useful checks move into the packages' own tests, pointed at the real code.
2. **Tests before merging** (STATUS rule 4). For every module, acceptance tests are written from its own claims (rollback converges, saves round-trip and reject corruption, readers survive garbage input per the fuzzing rule, the wave inverts exactly). A failing claim gets the code fixed, never the test weakened.
3. **The `arena-gathered` routine** (its README): copy the pick to `packages/<name>/` (`src/index.ts`, `tests/`), `package.json` `@hm/<name>`, the tsconfig path and the vite alias; record the pick and the test numbers in `arena-gathered/README.md`.
4. **No overwriting.** New names where the manifest collides. The drop's types stay inside `@hm/fidelity` until the kernel registers a `setmix.cartridge` preset kind; then they move into `@hm/contracts` in one change (contracts are edited by the integrator only).
5. **One renderer and one texture dialect.** No second engine beside `@hm/render`, no second texgraph. The drop's demo pages are design references.
6. **The minimum spec** (the owner's laptop): every visual piece has a Low and Potato path, measured with `node scripts/perf.mjs low 6`; WebGPU only behind feature detection, off on Low. Loading bars before any heavy screen.
7. **Purity stays load-bearing**: the drop's purity test is kept and applied to every simulation package.

## 4. The waves

### Wave 0: gather (docs and files only; no game change)
- Add `zips/` to `.gitignore`.
- Commit the union to `arena-gathered/setmix/` (`drop/`, `engine/`, `demos/` for the phase pages, `gdd.ts`), with a README holding section 2's table. Reason: the other PC has no `zips/`.
- Commit the side session's docs (the handoff with its audit banner, the 11 phase prompts, OWNER_ASKS).
- Check: `npm run verify` unchanged.

### Wave 1: `@hm/fidelity` (the four floats and everything derived from them)
- `contracts.setmix.ts` becomes `packages/fidelity/src/types.ts`, `fidelity.ts` becomes `src/index.ts`, the spec and test go in `tests/`.
- Fix the two bugs: the substitutes' octaves clamped to `octaveBudget`; `minPolicy` given a total order (mode, then chamfer, then relax steps, then cell size), so both neighbours always pick the same ring.
- Strictness fixes for these files; the purity test reads the package source.
- Check: 29 of 29 specs and the purity test green; `npm run verify` green.

### Wave 2: the texture dialect, then the content vault
- `@hm/texgraph` learns what the vault needs, each addition off by default so `sets/setmix-ground.json` and `sets/setmix-voxel.json` render byte-identical (a golden test on their channel stats, before and after): a `curl` node, stripes at any angle, noise lacunarity, cellular invert, ramp interpolation (constant, linear, smooth: `adaptGraph` quantises palettes with it in the early stages).
- A one-off script translates the 50 cartridges into our dialect and writes `packages/texgraph/sets/setmix-vault.json`, so one dialect lives in the repo.
- 50 of 50 validate. A contact sheet of all 50 (flat and lit), side by side with the model's own evaluator, so drift shows; **I look at every one** and retune by eye where ours differs (art rule).
- New `@hm/vault`: the cartridges' tiers, categories, stats and lore; the recipes (integrity first: every input resolves to a cartridge or a defined base element, outputs built by `fuse` from `@hm/fidelity`); the event calendar; the wardrobe (its sockets mapped to our avatar anchors when it is wired).
- Visible now: the vault surfaces in the surface editor and the Paint palette as a "SetMix vault" set, in the current game.
- Check: unit tests (every recipe resolves, the calendar is the same for the same seed); the owner's eye on the contact sheet.

### Wave 3: the resolution wave on the current island (the core hook)
- `@hm/wavefield` from `engine/setmix/field.ts`, with tests for its claims: radius and time invert exactly, C1 smooth at the band edges, chunks scheduled nearest first, deterministic.
- `@hm/fidelity`'s mesh policy drives our existing meshing per region (voxel blocks to `@hm/smoothvox2` smooth ground), with the fixed seam rule.
- The stage look (palette steps, dither, the swell) goes into the island's own terrain shader in `@hm/render` (we already have the D20 Bayer dither); no second material, no extra shader variants on Low.
- A `fidelity` preset (the four floats) per island, and an Advanced slider for Fi 1 to 6, so the sweep can be seen and measured before machines exist.
- Check: Low holds 50+ fps during a sweep (`perf.mjs`); an e2e step runs a sweep to its end; screenshots before and after.

### Wave 4: machines, cartridges, the portal (joins RELEASE_PLAN Milestones 2 and 3; after decision 1)
- One machine idea: `@hm/machines` (texgraph chains) gains power and output rate from the drop's `machines.ts`; plumes are `@hm/particles` presets; the Fusion Matrix is a machine whose recipe is `fuse(a, b, dominance)`.
- A `setmix.cartridge` preset kind in the kernel (its variables from `VarDecl`); cartridges travel inside our existing bundle and `.setmix` island files. The binary `.smx` waits until size demands it (a whole vault cartridge, graph and all, is about 2 KB of JSON).
- `PortalRenderer` (stencil, oblique near plane) becomes `@hm/render`'s portal for Milestone 2; the far side preloads behind the loading bar so the walk through is seamless.
- `QuestEngine`'s Acts 1 to 4 become questline data for `@hm/questline`; no second quest engine.

### Wave 5: the SetMix game screens (the Lab, the Moon, Studio and Play on the menu)
- A design task (frontend-design skill first). Built with our renderer, the V3 hotbar and loading bars. `SetMixPlayable`, `SetmixHUD`, `SetMixMaster` and `PresetVault` are references for layout and feel.

## 5. Parked (gathered in Wave 0, not landed), and why

| What | Why it waits |
|---|---|
| Unreal: `import_setmix_to_ue5.py`, `exportToUnreal.ts`, `SetmixLiveLink.py`, `ue5-bridge.ts`, `build_setmix_master.py`, `M_SetMix_Nanite_Master.usf` | Horizon 2 (CATCHUP 12ai): needs Unreal on the desktop PC; nothing here can test it. |
| `desktop.ts` (Tauri, Electron) | Not in the 1.0 scope (run.studio, one HTML file). |
| `SetmixWGSL.ts`, `GpuComputePipeline.ts` | WebGPU is optional and off on Low; revisit in Milestone 5. |
| `NetBus.ts` | Online play is 1.1. Untested, and the gate's own model of it diverges. Lands with a real convergence harness. |
| `CartridgeCompiler.ts` (`.smx`), `SaveEngine.ts` | We already have bundles, `.setmix` files, IndexedDB saves and migrations. Land when size demands it, with fuzz tests. |
| `galaxy.ts`, `enclaves.ts`, `federation.ts` | The universe and many authors on one planet: H8 and H11, after 1.0. |
| `GoblinRover.ts`, `RaceEngine.ts` | Overlap Goblin Racing's `kart`, `racing`, `raceflow`. The tyre model may upgrade `@hm/kart`; the ghost replays may serve spectating (E4). |
| `Ecosystem.ts`, `flora.ts`, `fauna.ts`, `WaterShader.ts` | Milestone 4 (the world looks alive, real waves): after Wave 3, each with a Low path. |
| `VolumetricVoxelField.ts`, `VoxelWorker.ts`, `LogisticsSwarm.ts`, `DialogueEngine.ts`, `GoblinTrader.ts` | Overlap `voxelcsg`, `chunkworld`, `smoothvox2`, `market`; later. |
| `GoblinController.ts`, `AvatarFidelityManager.ts` | Overlap `puppet`, `kinematic`, `ragdoll`; for the goblin's look on the Moon (Wave 5). |
| `setmixAudio.ts` | A sound layer per stage; overlaps `soundscape`, `soundlab`, `musicbox`; with the Moon. |
| `BakeWorkerPool.ts`, `png.ts` | May speed `npm run bake:setmix`; low priority. |
| `texgraph-patch.ts` | Does not apply (section 2). If profiling the wave shows garbage, reuse the per-node buffers in our evaluator; that is where the garbage is. |

## 6. Owner decisions

1. **Where SetMix: The Resolution Crafter sits. DECIDED (owner, 2026-10-06 14:05):** "resolution crafter is the new setmix game mode". Added the same day (STATUS SM4 to SM7): from the shared world, players build a ship with engineering and fly it to the goblin planet; players open up the galaxy from the Resolution Crafter; Goblin Racing later becomes standalone on top of SetMix, with its own start and a world where you live as a goblin; and a preview once the landing work is done.
   - So the Resolution Crafter gets its own world (the Lab and the Moon), separate from the island. The preview (SM7) is built as its own SetMix screen and does not touch the island renderer.
2. **Order against Milestone 0.5.** Its remaining items are the e2e suite split, Shift + wheel for tabs, and voxels in the budget. Proceeding as proposed (the owner: "once youe done all you need"): Waves 0 to 2 first, then the preview, then Milestone 0.5 before anything touches the island renderer.
3. **Cartridge format.** Proceeding as proposed: cartridges are presets inside our existing bundle and `.setmix` files, and the binary `.smx` waits.
