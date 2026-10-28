# Plan 54: The Excitement Compass. Pre-incarnational purpose, players as catalyst

> Argon's design (his "Plan 53" Google Doc and bundle `argon-plan53-bidirectional-excitement-bundle.json`, 28 Oct). It is renumbered 54 because [Plan 53](53-bridge-stage.md) was taken the same day. Opus cross-checked it ([OPUS_NOTE_46](../notes/OPUS_NOTE_46_plan53_coplay_crosscheck.md)) and the owner's rules decided what was built.

## 1. Built: `packages/harness/src/purpose-excitement-catalyst.ts`
- **Argon's data and loop, kept:**
  - the 21-entry `SQ_DISTORTION_CATALOG`: each SQ preset with its belief, ray, antidote ray and occlusion penalty;
  - the four archetype purpose vectors;
  - the lower-triad starting weights;
  - antidotes transmuting distortion charge into upper-triad weight;
  - occlusion dimming excitement;
  - an outcome-insistence penalty;
  - the ego choosing the highest excitement;
  - Hebbian learning from the chosen action and the player's catalyst.
- **Corrected** (the same flaw as his Plan 52 step):
  - **The purpose stays hidden.** His step took the hidden purpose as an argument and scored each action by its closeness to it. Here, `createPreIncarnationalPurpose` returns the purpose and an opaque Higher Self closure; the ego gets only the closure.
  - **The veil filters every reading.** Every excitement reading passes through Plan 52's stage veil (`veilObserve`). A lost reading falls back on the ego's own learned weights.
  - **The veil is the stage's**, not self-thinning.
  - **The purpose is not in the ego's view.** The ego state has no purpose field. `purposeAlignment` is for the caller (the Higher Self), not the ego.
- **Tests:** 6/6.
  - Every archetype aligns above 0.95 within 40 steps at S6.
  - The antidote beats no antidote.
  - The more insistent twin is chosen less.
  - It is deterministic.
- **Known weakness, from the builder:** S0a still reaches about 0.96 against about 0.99 at S6. The test's candidate stream leans upper-triad, so even a blind ego drifts toward the purpose. A harder stream (opposed candidates, a lower-triad-leaning catalyst) would measure the veil properly. Next.

## 2. Not built: Argon's `bidirectional-preset-skin.ts`, the owner's calls
- **The child-facing skin over a live CS2 match** (CS2 avatars to unicorn, cloud-sprite and wand stand-ins) needs the owner's explicit yes: it puts a child in front of a mature-rated online shooter. Its avatars need art from the art agent, legal art only.
- **Its input relay is superseded** by Plan 53 §2.6, built: the player's own presses only, a ticked box and the typed word RELAY, a token per session, whitelisted lines.
- **The "1:1 phase-locked" claim is dropped.** CS2's GSI sends no position while playing.

## 3. Next
- A harder candidate stream for the veil test.
- Live egos (Plan 52 §4, [Plan 55](55-drone-composite-ego.md)): the drone's own purpose and excitement, its catalyst being the player's play.
