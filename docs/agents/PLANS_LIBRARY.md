# PLANS LIBRARY: map of FIDELITY's plans, presets and agent ideas
Read 2026-10-27 at HEAD `96708283` on `feat/studio-polish-claude-cloud`, plus the dirty tree (Plan 50 Wave 1 is uncommitted). Status words: **built** = code in `packages/` or `apps/web/src/` that is wired into the game; **engine** = pure code and tests exist, nothing in the game calls it; **spec** = documents only. Authority order: `docs/OWNER_ASKS.md` > `docs/argo/RULES.md` > plans > research. Names: Argo and Argon are both Gemini in the `ARCHITECT` role (docs mix them; Argo was the browser-chat lead, Argon works in Antigravity); Overwatch = Antigravity Flash (`OVERSEER`); Opus = Claude (`ENGINEER`). Standing rule (owner 10-27): examples mean categories.

## 1. The preset system as it stands
**Ladder** (Plan 43 §0, JOB_BOARD §0): Rung 1 atoms -> 2 stacks/curves -> 3 part/clip/stem -> 4 kit/assembly -> 5 cartridge/world. Rule: preset = plain JSON + pure engine + slider schema + stage-ranked detail (drawn = min(stage rank, tier rank)) + cartridge + live preview with hover try-on (Plan 39 §1). Two tiers: sliders in game, full graph in the Studio.

| Domain | Code / prefix | Packages | Applied where | Status |
|---|---|---|---|---|
| Vtx parts, kits | `SMX-PRT-`, kit overrides `path -> {gen,params,material}` | partgen (about 20 generators), meshops (27 ops), kitspec | Bench Parts page, planet Drafting Table, Beam Rifle Apply via `kit-target.ts` two-level AABB ray, `kit-build.ts` | built |
| Vtx machines | kit ids; `machine:<kind>`; `SMX-KIT-GATE-01` | kitspec + `kit-machines.ts` (11 machines, 3 vehicles, 43-part Stargate, drone, gate dais) | lab and plot; `kit-defaults.json` | built |
| Pxd materials | `mat:<id>` (about 20 on shelf), `matc:<code>`, `SMX-MAT-`, `vault:<id>` (50 ground) | texgraph (20 tiles), matstack (5 levels), `layered-material.ts` | Bench Materials, rifle on parts and ground | built |
| Pxd sprites | `pxdc:`, `SMX-PXD-` | shareware (8-angle, S0-S2), skin | Bench Sprites | built |
| Lx | `lx:<kelvin>:<intensity>:<pattern>`, `SMX-LGT-` | cartlab, `light-presets` | Bench Lights, lamps | built; plot sky/sun not built |
| Aq | cartridge kind `species`, `SMX-SPC-` (JOB_BOARD says `aq:`, Plan 43 `spc:`) | treegen, flora, plotbiome | Bench Species, plot variant slots (max 6) | built; water preset not built |
| Audio | `sndc:`, `SMX-SND-` | soundlab `STEM_SHELF`, musicbox | Bench Sounds | built |
| Locomotion | `loc:` (4 ids) | kinematic | `locomotion.ts` by world, debug menu | partial: no cartridge |
| Motion | `mot:<id>`, 6 shelf entries | kinematic `motion-presets.ts` | nothing in `apps/` calls it | engine |
| Anim cadence | `anim:`, `stageAnimRateHz` 8..60 | anim, kinematic | game-preset anim time; `KitMotionSpec` on kits | built |
| Logic | `logic:<id>`, 7 graphs | wiregraph, triggers | only gate iris lock + Studio panel | partial: no cartridge |
| Creatures | `CreatureGenomeSpec` | creature (Astro + 37-38 monsters) | roster, player suit | built |
| Rung 5 game | `MultiverseGamePresetSpec`; `?game=&world=&rig=` | gamepreset; `main.tsx:22` | standalone modes (4 games) | built |
| Spore card | PNG zTXt `hm2:spore-card:v1`, `hm2:preset:v1`, `SG-XXXX-XX` | cartlab, studio | Studio export/drop | built |
| Planet | `SMX-PLN-XXXX-NAME` | Planet Forge | profile activities | built (older lineage) |
| Harness soul | `harness:`, `harnessc:`, `SMX-HRN-` | cartlab, harness | Souls bench tab, rover boarding | built |
| Entity packet | `hm2:entity-packet:v1`, `hm2:cross-game-buffer:v1` | `apps/web/src/play/cross-game-stream.ts` | imported by its test only | engine |
| Memory kernel | `hm2:memory-kernel:v1` | harness `memory-kernel.ts` | tests only | engine |

Other surfaces: the Studio (`/?studio`: Creative Suite, Look & Lighting, Scene Layout, Audio Lab), the lab Bench (blank cartridge, print, load into rifle with R or the X radial), Planet Forge, voice and bridge commands.
Rifle `PRINT_KINDS` (`packages/cartlab/src/index.ts:334`): part, species, light, material, sprite, sound, harness. No motion, logic, locomotion or entity kind exists, though JOB_BOARD §0 lists those cartridges.
Gaps: shelves are small (6 motion, 7 logic, about 20 materials) against the "Wikipedia-scale" ask.

## 2. Plans and research, one line each
| Id | What | Author, date | Status | Decisions that matter / conflicts |
|---|---|---|---|---|
| Master plan + 00-21 | Argo's 14 area plans, Opus review (8 objections), Argo reply | Argo/Opus, 10-13 | mostly built | Reply wins on conflicts: stages 0-6 with 5 looks, rifle real size, monsters keep colours (`remapStrength` .20). Owner approved |
| 22-32 | Lore micrologs, Acts VII-IX, camera realism, ending song (26b = Opus v2), stage look bible, HUD skins, charm, voice manifest, credits video | Argo, 10-14 | built | 27 is canonical for stage looks (0a wireframe, 0b 1-bit, 1 EGA, 2 VGA, 3 Gouraud, 4-6 PBR) |
| ARGO_GRAND_MASTER_REPORT | 10-system QA audit, 45 findings | Argo, 10-25 | remediated (JOB-QA-01..05) | none |
| 36 | Planetary Grid on RUN.world co-op | Opus, 10-17 | proposal; `OutpostRoom` and net client exist, live backend unverified | "Phase 0 needs the owner's go" |
| 37 | Part split vs kits | Opus, 10-20 | decided | retrofit split dropped, kits instead (overrules Argo TICKET-29) |
| 38 | Parts, modules, presets, detail ranks | Opus, 10-20 | built | no per-LOD meshes; Blender-scripted parts; parametric parts via Shape Press |
| 39 | Four preset factories (Pxd/Vtx/Lx/Aq) | Opus, 10-20/21 | built steps 1-4, 7 | previews drive play; Lx sky and Aq water pending |
| 40 | Bring Your Own Agent | Opus, 10-21 | built (JOB-06) | document is the API; proposals then review; one skill file |
| 41 | Layered materials | Opus, 10-21 | built | 5 levels; Age slider; weathering by the world |
| 42 | Stargate onboarding, Earth endgame, movable/random gates | Argo, 10-22 | built (JOB-07/09) | Stage 6 unlocks Earth plot; `gateAccess` open/code-only/closed |
| 43 | Motion, sprites, audio, logic presets | Argon/Overwatch, 10-22 | partial (above) | 5-rung law for every domain |
| 44a | Studio realization, retire legacy GLBs | Argo, 10-26 | built (v44.3) | Real WebGL viewports, 4 workspaces |
| 44b | `@hm/creature` kits, 37 monsters | Argon, 10-25 | built (JOB-24/25) | purge astro and monster GLBs. Duplicate number with 44a |
| 45a | Claude Cloud Studio polish (JOB-CLOUD-01..07) | Overwatch, 10-26 | not started; board still OPEN | superseded in practice by Plans 46-50 |
| 45b | Game presets, `?game=` gateway, Spore cards | Argon, 10-25 | built (JOB-26) | duplicate number |
| 46a | Sovereign Reality Harness | Argon+Overwatch, 10-27 | built waves 1-3 | souls bound to vessels; copy at `StudioPlans/46_*.md` |
| 46b | Cross-game streaming, entity packet | Argon, 10-25 | engine only | `docs/argo/plans/PLAN_46_*` is canonical text; `46-cross-game-*.md` is a stub |
| 47 | Harness consumers (self-titled "Plan 46 Phase 2") | Argon+Overwatch, 10-27 | built (closed `d56414ae`) | rover escort, `harness:` print, Zone 8 HUD |
| 48 | In-game companion + Neural Bridge `:8220` | Overwatch/Argo, 10-27 | built, reworked on owner test | hold-to-talk `T`, comms panel `Enter` |
| 49 | Live ping + kit mutation | Opus, 10-27 | wave 1 built `4d88366e` | wave 2 (open in Studio, wall carving, ping wheel) open |
| 50 | Drone, combat brain, external-game bridge | Opus, 10-27 | wave 1 in progress, uncommitted | `/external/*` protocol, `external-reflex-host.mjs` not yet present |
| Older specs | HOTBAR_V3, MAIN_MENU, BASE_BUILDING (arch D1-D16 + research R1-R13), FABRICATOR, LAB_LAYOUT, WINDOW_SCENE, MONSTERS_PLAN, ONE_GAME_PLAN, RUNWORLD_PIPELINE | owner/Opus, 10-04..14 | built | MONSTER_MASH_AND_ASSETS_SPEC (10-09) predates dropping the name |
| Research | BYOA, MATERIAL_LAYERS, PRESET_FACTORIES, MULTIPLAYER, COMPANION_AI_COOP, COMBAT_DRONE, GAME_IN_GAME_STREAMING, GUNFIRE_REBORN_BRIDGE, DLSS5 (left alone, owner has a 3080), UNIVERSAL_SIMULATION_ONTOLOGY, COSMOLOGY_OF_ONE | Opus/Overseer | research | the last two are framing, not build specs |

## 3. The AI and agent vision
- **Plan 40 BYOA, built.** `apps/web/src/studio/studio-agent.ts` (tools `studio.doc.propose`, `.capture`, `.kit.validate`, `.kit.audit`, `.material.coverage`), `window.studioAgent`, `window.__studioNav/__studioBridge` (`studio-ai-bridge.ts`), `scripts/studio-agent-bridge.mjs` (MCP stdio relay), `apps/web/public/studio-skill.md`.
- **Plan 46 harness, built but narrow.** `packages/harness`: MDL sieve, Cayley-Pade port-Hamiltonian resolvent, inception loop, memory kernel. Consumers: rover escort binding (`mobsim`), `harness:` cartridge, Souls bench, Zone 8 HUD, plot-save binding. "Agents as presets" and the personas (`preset:agent-sovereign`, `persona-*`) exist as prompt text and types only. VSA ego transducer, heat-kernel segmentation, meshops tape compiler and point-cloud crystallizer exist only as spikes in `scripts/test-plan-46-spikes.mjs`. `runMdlSpectralSieve` has no caller outside tests.
- **Cross-game (owner 10-25 "stream assets and mechanics between games"), engine only.** `cross-game-stream.ts` (packet, audit, `adaptEntityToGenre`, 12-slot buffer) is not imported by the game; no Beam Rifle sample/apply for entities; `packages/crossgame` and `@hm/multiverse` do not exist though JOB-21 lists them and is marked DONE.
- **Companion 48/49/50.** Built: violet companion, comms HUD, bridge (`/poll /event /events /command /status`, loopback only), `companion-agent.mjs`, ping with kit/part/material target, voice and bridge kit mutation, `save-kit-default`. Dirty tree: drone body, combat and scout brains, `/frame` JPEG route, game-screen kit.
- **Inter-game bridge (owner 10-07), mostly spec.** `packages/bridgekit/game-detector.ts` maps process names to canned `bridge:*` cartridges. The pill `running-game-bridge-pill.tsx` is mounted nowhere and fetches `/__studio/bridge/running-games`, which no server implements. `SetmixBridgeDaemon`, port 5196, UE5 live link (`ue5-bridge.ts` only in `arena-gathered/` and `zips/`) are not wired. POL-13 is still "deferred".
- **Encyclopedic ontology (owner 10-25), spec.** Domain list and fleet prompts exist; the only landed batch is creatures. `packages/kitspec/src/taxonomy` does not exist.

### 3b. Argon's "AI reads another world and re-expresses it as presets"
- **Origin:** `docs/prompts/ARGON_REALITY_HARNESS_RESEARCH_DIRECTIVE.md:14-22` (owner and Overwatch thesis, addressed to Argon): an "Artificial Ego" that takes "ANY incoming digital world" (Unreal, Unity, USD, point clouds, external physics) and translates it into `S` and the 5-rung presets, a fast System-1 model relaying shorthand to Opus, a user "dial" for style, genre and stage, and a Studio co-pilot "looking through the same harness". Lines 79-81 ask for the translation lexicon, shared viewport telemetry and collaborative flow.
- **Argon's answer:** `docs/OVERWATCH_TECH_AND_AI_RADAR.md:76-84` (JEPA compatibility check against the 5 anatomy groups, HKS segmentation of incoming meshes, VSA style transfer) and the spikes. The committed Plan 46 and the six initiation deliverables (`ARGON_SOVEREIGN_INITIATION.md:127-`) then turned to vessels and souls; ingestion of external worlds is not among them.
- **Older relatives:** `ENGINE_OPTIMIZATION_AND_BRIDGING_SPEC.md:133-164` (texture-to-texgraph decompilation, memory-sampled telemetry, process scanner), Argo's TICKET-27/POL-13 (`docs/argo/notes/ARGO_NOTE_22_next_batch_ticket23_onward.md:22-24`, `ARGO_NOTE_27_ticket27.md`), and Opus's Plan 50 §6 with the two 10-27 research docs (screen mirror plus spotter, telemetry adapters).
- **"Universal Preset Shorthand" is never defined.** The only concrete forms are VSA-4096 hypervectors and a meshops bytecode tape (`docs/agents/RECURSIVE_MEMORY_KERNEL.md:294`, `scripts/test-plan-46-spikes.mjs:506-577`), not a readable schema. A translator needs this defined first.
- **Plan 50 and its three 10-27 research docs do not cite** the Reality Harness directive, `bridgekit`/POL-13 or OWNER_ASKS 10-07; `/external/*` (port 8220) would sit beside the older detector concept (port 5196).
- **Missing everywhere:** any code that watches a running game and emits a preset (mechanics, behaviours or materials).

## 4. Open owner decisions and contradictions
1. **External games.** Owner 10-07/10-25 want other games' assets and mechanics usable; Rule 18 and Plan 50 §6 allow telemetry only, never extracted assets; Gunfire Tier 1/2 breaches the EULA and needs his explicit yes. Asking Duoyi for consent is his call.
2. **Plan numbers collide**: two each of 44, 45, 46; 47 calls itself "46 Phase 2". Pick canonical names.
3. **JOB_BOARD drift**: JOB-21 DONE but its paths missing; STUDIO-44E/F OPEN while RESUME says 44E landed; JOB-CLOUD-01..07 OPEN and abandoned; the board and `CLAUDE.md` still name `feat/monster-mash-exploration`.
4. **Prefix drift**: `aq:`/`spc:`/species, `part:`/`SMX-PRT-`, `mot:`/`logic:` cartridges claimed but not in `PRINT_KINDS`.
5. **Cross-game package names** in OWNER_ASKS (`@hm/crossgame`) differ from the code location.
6. **"Monster Mash"**: dropped 10-13, then re-defined as Cross-Game 10-25; `CLAUDE.md` §5 and a test script still use the old name.
7. **`apps/web/dist/index.html` is tracked** against the never-commit rule; untrack is his call.
8. **Harness vs "never a 5th metric"**: it adds a 24-float entity state (awareness, precision, coherence). Per entity, not global, but unconfirmed by the owner. `CHECKPOINT_SOVEREIGN_HARNESS_EGO.md` rule 7 records wording chosen to avoid model refusals; treat the cosmology docs as framing and trust code and tests.
9. **Plan 36 co-op** needs his go; Plan 49 wave 2 and Plan 50 waves 2-4 are unscheduled.
10. **Scale**: dispatching the Codex ontology fleet (UNIVERSAL_ONTOLOGY_CODEX_FLEET) is undecided; shelves stay small until then.
11. **Verification hygiene**: RESUME records a false "exit 0" from a piped test run (`tail`); gates must be quoted from direct exit codes. Fresh clones need `git lfs pull`.
