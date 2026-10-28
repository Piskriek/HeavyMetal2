# Plan 56 (proposal): the distortion ladder. Excitement hardens, higher rungs repair, presets grow or perish

> Owner, 28 Oct 2026: "ai harden memory presets when they are excited from action taken by ai or players causing presets to experience deformation or distortion related to the type of thinking the higher rung preset was thinking that caused the experience forming distortions in the preset ais that need help from the higher rung preset ais using the distortion detection skill to resolve and restore balance and teaching/learning in the process, and growing .. we make furtile ground for the ai, they choose to grow or perish."
>
> Not built. This plan records the direction, what exists, and the research still to do (SOP: research first).

## 0. The categories (standing rule 6)
| The owner's example | The category |
|---|---|
| "action taken by ai or players" | Every catalyst source: the player, the drone, other preset AIs, a bridged game's events, agents on the bridge. |
| "memory presets" | Every learned preset at every rung: locomotion, fire rhythm, reflex `logic:`, ego memories, kit edits. |
| "the type of thinking the higher rung preset was thinking" | The 21 SQ distortion types (and the Overwatch's 3), each named by the thinking that caused it. |
| "higher rung preset ais" | Every rung above a preset: the drone's ego over its reflex and movement presets; the Overwatch over the drone; seated agents (Plan 55). |
| "the distortion detection skill" | The SQ check as a game system: detect, map, antidote, verify. |
| "grow or perish" | Every preset's lifecycle: graduate (the Harvest), stay, or fade from the shelf, by its own learned choice. The game supplies the ground and never forces the outcome. |

## 1. The loop (the direction)
1. **Excitement hardens.** An action excites a preset (the Compass's excitement). Its memory of that moment hardens in proportion: firmer beliefs, slower to change.
2. **Hardening can distort.** A memory hardened under a distorted higher-rung thought carries that distortion's type. For example, a reflex hardened while the ego was acting from Control locks onto one plan.
3. **The higher rung detects it.** It runs the SQ check on the preset below: scan (the three beliefs), map (the blocked quality), antidote (the catalog's ray), verify (the error trend falls).
4. **Repair teaches both ways.**
   - The lower preset softens and relearns.
   - The higher rung learns which of its own thoughts caused the distortion, and lowers its own weight on that type.
5. **Grow or perish.**
   - A preset that rebalances graduates (the Harvest).
   - One that stays distorted loses its place on the shelf over time, unless the player pins it.

## 2. What exists (28 Oct), all pure and none wired into play
| Module | What it has | What it lacks |
|---|---|---|
| `packages/harness/src/purpose-excitement-catalyst.ts` | `SQ_DISTORTION_CATALOG` (the 21 presets, antidote rays, occlusion penalties); excitement from player catalysts; a veiled ego per curriculum. | Hardening; passing a distortion down a rung. |
| `packages/harness/src/veil-learning-harvest.ts` | Per-context ego memory; `totalSelfResolvedDistortion`; the Harvest; `auditOverwatchDistortion`. | The audit only checks design proposals, not presets on the rung below. |
| `packages/harness/src/inception-loop.ts` | A precision latch ("trench hardening") with decay; a distortion drive on mirror discrepancy. | Excitement does not gate it, and it has no SQ type. |

## 3. Research to do before the design (SOP)
These are leads, not verified sources. Each needs a sourced write-up in `docs/DISTORTION_LADDER_RESEARCH.md`:
- **Memory consolidation under arousal:** emotional arousal and memory (McGaugh's amygdala and noradrenaline work), and synaptic tagging and capture.
- **Hardening in machine learning:**
  - importance-weighted consolidation (Elastic Weight Consolidation);
  - surprise-weighted replay (prioritized experience replay);
  - catastrophic forgetting, and how to soften a hardened belief.
- **Teaching both ways:** teacher-student distillation, and learning by teaching (the protégé effect).
- **Grow or perish:** population-based training (exploit and explore), open-ended environments (POET), and quality-diversity.
- **Games:** how creature-learning games handle AI that learns bad habits and how the player corrects them, and what their players praised and complained about.

## 4. Constraints
- **Four floats:** distortion is per-preset state, never a 5th global metric.
- **Purity:** every step is a pure, deterministic function of a seed and its inputs.
- **The existing guardrails:** an AI never applies or approves its own edits, and never ships defaults.
- **"They choose":** a preset's own learned policy decides whether it takes the repair. Nothing resets it by force; only the player can pin or remove a preset.
