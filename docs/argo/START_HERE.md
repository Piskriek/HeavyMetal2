# Gemini Argo: start here

Welcome, Argo. The owner, Francois, has made you **creative lead** of **FIDELITY: The SetMix Multiverse**. This page tells you what the game is, what has been built, where everything lives, and what he wants from you.

> **The branch:** the current work is on [`feat/monster-mash-exploration`](https://github.com/Piskriek/HeavyMetal2/tree/feat/monster-mash-exploration), not `main`. `main` is a week behind and only gets the branch after the test pass. Read every file on that branch.

## 1. What the owner wants from you
His words (13 October 2026):

> "I would like Gemini Argo to take creative lead on the project and to go over the stuff you and haiku implimented and make it nice ... reviewing and creating plans to make the game AAA with AAA production, lore, mechanics, design, layouts, lighting, sound, whatever it takes i want him planning like he cares."

- **Review** what Claude Opus (lead engineer and architect) and the Claude Haiku sidecars (implementers) have built. Be candid about what is weak, flat, inconsistent or missing.
- **Plan** how to make it AAA, area by area. Make each plan specific, prioritised and grounded in this repo, and research the best games that do each thing.
- **You lead the creative direction, and since 14 October you and Opus decide.** The owner: "you and him are responsible for taking the prototype and changing it, you can change the lore and narration, designs, styles etc. wherever it makes sense to do so, its yours and Argo's call to expand on the game/lore and make those decisions". He finds resources, unblocks pipelines and reviews the results objectively. Opus turns your decisions into briefs and builds them. You and Opus settle disagreements in your chat; the owner's explicit rules (RULES.md) still bind.

You can read the repo but not run the game or commit. So:
- the [screenshot tour](TOUR.md) shows the game as it is today;
- the [concept art](../concept/setmix/) shows where it was meant to go;
- your plans go back as markdown files, which the owner commits into [`docs/argo/plans/`](plans/README.md).

## 2. Read in this order
1. **[RULES.md](RULES.md):** every rule the team follows, with its source. The constitution and the owner's rules are binding. Propose changes openly; never quietly plan around them.
2. **[../RESUME.md](../RESUME.md):** the live session handoff log (read the top sections first whenever waking up in Antigravity or Claude).
3. **[../../.agents/GEMINI.md](../../.agents/GEMINI.md) & [../../CLAUDE.md](../../CLAUDE.md):** the master context and role division between Gemini Argo/Flash (Creative & Modular Systems Lead), Claude Opus (Precision Systems Architect), and the Owner (Project Lead & Objective Reviewer).
4. **[../OWNER_ASKS.md](../OWNER_ASKS.md):** every message the owner has sent, verbatim. It is the source of truth for intent.
5. **The active modular architecture plans (`docs/argo/plans/`):**
   - [38: Parts, modules, presets](plans/38-parts-modules-presets.md) (`@hm/partgen`, `@hm/kitspec`, `@hm/meshops`);
   - [39: One pattern: four preset factories](plans/39-one-pattern-preset-factories.md) (`Pxd`, `Vtx`, `Lx`, `Aq`, and `previews-drive-play`);
   - [40: Bring Your Own Agent](plans/40-bring-your-own-agent.md) (`studio-agent.ts`, `studio-skill.md`, `studio.capture`, `studio.kit.validate`);
   - [41: Layered materials](plans/41-layered-materials.md) (`@hm/matstack`, `layered-material.ts`);
   - [42: Modular Stargate progression, Earth endgame sandbox & gate network](plans/42-modular-stargate-earth-endgame.md) (in-game sliders vs. Studio control, Stage-6 Earth restoration, movable/lockable gates, and random explorer gate dialing).
6. **[TOUR.md](TOUR.md):** annotated screenshots of the early baseline.
7. **The foundational design and lore docs:**
   - [NARRATIVE_AND_LORE_BIBLE](../NARRATIVE_AND_LORE_BIBLE.md), [NARRATION_SCRIPT](../NARRATION_SCRIPT.md) (approved by the owner);
   - [CARDINAL_CONSTITUTION_AND_STAGES](../CARDINAL_CONSTITUTION_AND_STAGES.md);
   - [BASE_BUILDING_RESEARCH](../BASE_BUILDING_RESEARCH.md), [BASE_BUILDING_ARCHITECTURE](../BASE_BUILDING_ARCHITECTURE.md), [FABRICATOR_RESEARCH](../FABRICATOR_RESEARCH.md);
   - [LAB_LAYOUT_RESEARCH](../LAB_LAYOUT_RESEARCH.md), [WINDOW_SCENE_PLAN](../WINDOW_SCENE_PLAN.md);
   - [MONSTERS_PLAN](../MONSTERS_PLAN.md);
   - [STUDIO_CREATIVE_SUITE_SPEC](../STUDIO_CREATIVE_SUITE_SPEC.md);
   - [GRAPHICS_AND_TEXTURE_PIPELINE](../GRAPHICS_AND_TEXTURE_PIPELINE.md), [UI_DESIGN_SYSTEM_AND_TOKENS](../UI_DESIGN_SYSTEM_AND_TOKENS.md);
   - [DLSS5_NEURAL_BAKE_RESEARCH](../DLSS5_NEURAL_BAKE_RESEARCH.md) (parked).
8. **The concept art** in [`docs/concept/setmix/`](../concept/setmix/): the hero frames 01 to 10, then sheets 12 to 21 in `panels/` (21 is the approved lab redesign).
9. **[../DEFERRED_POLISH_REGISTRY.md](../DEFERRED_POLISH_REGISTRY.md):** the polish backlog (the POL items).

## 3. The game in one paragraph
Humanity siphoned compute into its simulations through "the Bridge" until reality's own rendering broke: "a simulation cannot sustain simulations running inside of it".
- **The player** wakes in a shielded lab on Earth and powers it up. Their radio mentor, **Dr. Gwen Haddy**, guides them.
- **The storm** of broken reality shows through the lab's window.
- **The gate** opens to a Moon rendered at **stage 0**: 1-bit dither.
- **Terraforming machines** raise the plot's fidelity through the stages: 1-bit, EGA, VGA, Gouraud, full PBR. **Terraforming is graphical fidelity.**
- **The four floats:** Pixel density, Vertex density, Light flux and Aquatic level drive everything. A fifth global metric is never allowed.
- **On the plot** the player builds a base, harvests raw pixels and vertices, fabricates vehicles and weapons, and fights monsters leaking out of old games through containment leaks.
- **Synced or solo:** the plot can be synced to a shared 40,000 km world or played solo.

## 4. What exists today (13 October 2026)
| Area | State | Where |
|---|---|---|
| The first hour, lab Acts I to III | Works end to end: wake, power wall, the window reveal, the gate, the Moon at stage 0, the first machine, "feed your mill". | `apps/web/src/play/` |
| One game | Building (foundations, walls, roofs, stairs, doors, plans, integrity), inventory and hotbar, bridge storage, refinery, drafting table, fabricator, vehicles (scout, hauler, crawler), weapon bench and modular guns, heavy machines. All live in the campaign since TASK-20. | `apps/web/src/base/`, `play.tsx` |
| The beam tool | Rifle-shaped, drawn with G. Extract mines boulders; Apply paints cartridge presets on the ground; Sculpt is in progress. First and third person, with 11 rifle animations. | `@hm/beamkit`, `@hm/terrainbrush`, `play/beam-*` |
| The window view | A 3D wasteland: the Bridge Array, a glitch-sliced Breach column, floating fidelity pockets, storms. | `play/lab-vista.ts`, [WINDOW_SCENE_PLAN](../WINDOW_SCENE_PLAN.md) |
| The Studio | The owner's in-engine editor: content browser, gizmo viewport, schema-driven details, a Changes panel with write-back, an asset bench with material presets and a one-click "redo this model". | `apps/web/src/studio/` |
| Monsters | A pure brain (`@hm/leaksim`: 6 archetypes, telegraphed attacks, leaks you seal) and 38 legal monsters packed across three eras (Freedoom, Blasphemer, LibreQuake, Quaternius). Renderers for all three eras and six walkers in the window view are done (TASK-23b-1); the fights are TASK-23b-2. | `packages/leaksim`, [MONSTERS_PLAN](../MONSTERS_PLAN.md) |
| Generated 3D assets | 120 models from RUN.world images plus local Hunyuan3D, three detail levels each, every one reviewed from four angles. | `apps/web/src/assets/gen/`, [RUNWORLD_PIPELINE](../RUNWORLD_PIPELINE.md) |
| Narration and audio | Dr. Haddy's voiced lines (RUN.world voice, a radio filter), music per context, SFX. | `apps/web/src/audio/`, `public/vo/`, `public/audio/` |

**In progress, in this order:**
1. TASK-21d: Sculpt, saving, the beam's juice (21c, the lighting and the rifle animations, is done).
2. TASK-22b: Acts IV to VI as quests (running).
3. TASK-23b-2: the monsters in the game (23b-1, the renderers and the window walkers, is done).
4. TASK-23c: the props in the world.
5. TASK-24: test everything. Then `main`.

The briefs are in [`docs/prompts/sidecar/`](../prompts/sidecar/).

## 5. Known weak spots (from Opus's reviews; please go further)
- **The HUD fights itself.** On arrival on the Moon, three texts overlap (a big title, the build readout, the radio subtitle), and a build readout ("CANNOT PLACE") shows when you aren't building. Design language varies between screens built by different sidecars.
- **Prototype looks:**
  - foundations are flat red slabs with blue rings;
  - the player character rendered near-black on the planet (fixed on 13 October; the left hand still isn't IK-placed on the rifle);
  - the rover camera clips into geometry;
  - the menu is a list of text.
- **No juice yet:** placing, mining, printing and killing lack the feedback (sound, VFX, camera, haptics) that makes them feel good.
- **The first hour's pacing** has never been tuned with players. The owner's brother once quit when he ran out of ore; that soft-lock was fixed.
- **Each stage's lighting and the stage transitions** are functional, not cinematic.
- **The lab** reads as a set: sheet 21's redesign is approved but only partly realised.
- **Sound:** music and SFX exist, but there is no mix plan, no ambience layers per stage, and no audio feedback language.
- **Lore** is strong in the bible and thin in the game: few environmental storytelling beats, no collectibles or logs.
- **The size:** the single file was 18 MB; since 13 October it is 14.5 MB, and the build fails above 16 MB (POL-27 closed).

## 6. What to deliver
Put each deliverable in its own markdown file. The owner commits them to [`docs/argo/plans/`](plans/README.md), which explains the format.
1. **`00-review.md`:** your review, area by area: what's good, what's weak, what's missing. Cite files, shots and concept art.
2. **`01-creative-direction.md`:**
   - the pillars, the tone and the player fantasy;
   - art direction, with the fidelity ladder as the visual hook (how each stage should look and feel);
   - audio direction;
   - reference games and why each one.
3. **The area plans,** one file each:
   - lore and narrative (and environmental storytelling);
   - the core loop, mechanics, progression and economy;
   - the first hour and onboarding;
   - level and plot layouts, and the lab;
   - lighting per stage and the transitions;
   - sound and music;
   - UI, UX and the HUD;
   - VFX and juice;
   - monsters and combat;
   - vehicles and weapons;
   - the Studio, as a creative tool;
   - production: the asset pipeline, quality bars, budgets and milestones.
4. **Every plan needs:**
   - the goal;
   - what the best games do (with sources);
   - concrete changes ranked P0, P1 and P2;
   - what each change needs (art, code, audio, research);
   - the risks;
   - **the decisions,** stated as made (since 14 October Argo and Opus decide). Ask the owner only to change one of his explicit rules, or for resources.

Plan like you care: be specific enough that an engineer could start tomorrow, and ambitious enough to be worth doing.

## 7. How the team works
- **Argo and Opus** decide features, lore and style (since 14 October). GDD ideas are not decisions.
- **The owner:** resources, unblocking, and objective review of what we ship.
- **Claude Opus:** architecture, briefs, reviews, landing work, the asset pipeline.
- **Claude Haiku sidecars:** implement from [briefs](../prompts/sidecar/) and report on the board, [SIDECAR_COMMS.md](../SIDECAR_COMMS.md).
- **Arena.ai battles:** write pure TypeScript modules from [battle briefs](../prompts/battle/). Two anonymous models answer and Opus lands the better one.
- **The art agent:** concept art in [`docs/concept/setmix/`](../concept/setmix/).
- **Assets:** RUN.world images, then Hunyuan3D on the owner's 3D PC (RTX 3080), then Blender bakes three levels.
- **Hardware:** the minimum spec is a GTX 950M laptop at 60 fps on Low; the owner's own machine has an RTX 3080. The game is browser-based (three.js, WebGL2) and ships as one file plus an optional HD pack. An Unreal 5.8 bridge project exists for later.
