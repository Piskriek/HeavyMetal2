# Plan 51: The Harness Reads Other Games: Mechanic Mimicry into Presets
> **Authors**: Piskriek and Argon (Overwatch) directive, 27 Oct; built by Claude Opus. Argon co-authors the next waves.
> **Status**: WAVE 1 BUILT (the transducer, the live loop through `:8220`, RULES 8a hidden parts).
> **Sources**: [`docs/prompts/ARGON_REALITY_HARNESS_RESEARCH_DIRECTIVE.md`](../../prompts/ARGON_REALITY_HARNESS_RESEARCH_DIRECTIVE.md):16-22 (the "Artificial Ego"), [Plan 46](46-reality-harness-spectral-ai-ego.md), [Plan 47](47-harness-consumer-integration-blueprint.md), [`docs/agents/OWNER_INTENT_SYNTHESIS.md`](../../agents/OWNER_INTENT_SYNTHESIS.md), the owner's 27 Oct words in RESUME.

## 0. What the owner asked

A game running on the PC is observed; the harness decompiles its mechanics into FIDELITY's own presets, live, so the player
or the drone can wear them. Each game shares only what its terms allow; the observer climbs a ladder, best channel first
(official telemetry/API, mod SDK, permitted mod loader, the game's own files) and uses the **screen only as the last
resort**. No other game's assets are copied: its feel is re-expressed in FIDELITY's parameters.

## 1. Built (Wave 1)

- **`packages/harness/src/mechanic-mimicry.ts`**: `transduceMechanic(observation)` takes numbers only (a trajectory, shot
  times with recoil, a named event log) tagged with its ladder rung, and returns:
  - `loc:` (`@hm/kinematic` `LocomotionPreset`, code `loc:v1:...`): gravity and jump impulse IDENTIFIED from a
    least-squares parabola per airborne arc (g = −2c, v₀ = √(2gh)); walk and run IDENTIFIED from the ground-speed split;
    a dash spike reported; fields the trajectory cannot show inherited from the nearest shelf preset;
  - `logic:` (`@hm/wiregraph`, code `logicc:...`): a burst-fire graph (trigger, one delay per round, a fire each) or a
    latched full-auto fire; trigger → effect rules from steady event delays (delay nodes) and every-Nth effects
    (counters); validated by `validateWireGraph`;
  - `anim:` (`KitMotionSpec`, code `anim:kind:axis:Hz:amp:phase`): a recoil reciprocation at the round rate, or the
    strongest structural rhythm the **Rissanen MDL sieve** (`runMdlSpectralSieve`) finds in the body's height;
  - `harness:` (`IHarnessCartridgeSpec` sliders, `harnessc:` via cartlab): A_relative, Π₀, α, R_syntropic, MAPPED (not
    identified): richness, structure/noise, rhythm, air control. The result's `notes` say which is which.
- **`packages/harness/src/vsa-item-memory.ts`**: a similarity-preserving VSA-4096 item memory (role ⊕ level binding,
  majority bundling; Kanerva). The kernel's `computeVsaSignature4096` is an integrity checksum (avalanche by design), so
  matching needs this. Unobserved features are marginalized when matching.
- **Oracles** (`packages/harness/tests/mechanic-mimicry.test.ts`): movement simulated with FIDELITY's own
  `stepVerticalJump` and a known preset is recovered within 5% (gravity, jump, walk, run) for three presets, and the VSA
  match names the right one; burst and rule graphs recovered exactly; codes round-trip; deterministic.
- **Live loop**: `POST :8220/observe-mechanic` (any permitted observer; `scripts/observe-mechanic.mjs` posts a file or a
  `--demo`) → the game's harness transduces it → the drone reads the result out and posts `mimic-result` (codes, nearest,
  confidence, notes) → **the player's words "apply the mimic"** put it on the body (custom `loc:` slot, kept on this PC),
  the held weapon's fire pattern, the drone's own fire rhythm, and a driven rover's harness → "undo" takes it off. An AI
  cannot apply a mimic by itself. `logic:` and `anim:` codes wait on the mimic shelf (`hm.setmix.mimics`): play has no
  slot for them yet.
- **RULES 8a fix of Plan 49**: "remove the chevrons" no longer paints trim over. `PartOverride.hidden` (kitspec) and
  `hiddenParts` (kit-build) take parts out of the build: no mesh, nothing to hit, still listed so they can come back.

## 2. Next (in order; ask the owner where marked)

1. **The shorthand**, defined (`OWNER_INTENT_SYNTHESIS.md` §4: typed JSON `hm2:shorthand:v1` + a one-line text form);
   the mimic result becomes one of its frame kinds.
2. **Real observers by rung.** Per-game permission profile; first a game whose rules allow it (owner: which game first).
3. **Play slots for `logic:` and `anim:`** (new print kinds; owner decision, the cartlab union is frozen).
4. **More identification**: air control from in-air steering, the landing spring from post-landing oscillation (log
   decrement), dash as a preset field, SINDy-style sparse identification for anything not closed-form.
5. **The screen rung (last resort)**: a fast tracker over `/frame` (change gating, blob tracking) emitting trajectories.
