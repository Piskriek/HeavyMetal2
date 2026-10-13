# 15 — Sound, Music & Acoustic Progression Plan: The Bit-Depth Mirror of Reality

## 1. The Goal: An Acoustic Landscape That Upgrades Its Resolution Alongside the Graphics

In **FIDELITY: The SetMix Multiverse**, sound has a once-in-a-generation creative hook: just as `S = (Pxd, Vtx, Lx, Aq)` upgrades the visual rendering pipeline from 1-bit dither to full PBR, **the audio engine upgrades the acoustic resolution of the world**. Right now ([`docs/argo/START_HERE.md`](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/argo/START_HERE.md) §5), music, Dr. Haddy's voiceover, and basic SFX exist in [`apps/web/src/audio/`](https://github.com/Piskriek/HeavyMetal2/tree/feat/monster-mash-exploration/apps/web/src/audio), [`packages/audio/`](https://github.com/Piskriek/HeavyMetal2/tree/feat/monster-mash-exploration/packages/audio), [`packages/soundpack/`](https://github.com/Piskriek/HeavyMetal2/tree/feat/monster-mash-exploration/packages/soundpack), [`packages/soundscape/`](https://github.com/Piskriek/HeavyMetal2/tree/feat/monster-mash-exploration/packages/soundscape), and [`packages/musicbox/`](https://github.com/Piskriek/HeavyMetal2/tree/feat/monster-mash-exploration/packages/musicbox), but there is **no master mix plan, no stage-linked ambience layering, and no cohesive audio feedback language**. Our goal is to make every click, beam pulse, machine hum, and stage bloom sound unmistakably tactile while adding zero megabytes to the single-file `index.html` budget (`POL-27`) via procedural Web Audio synthesis.

## 2. Where It Stands Today

- **What Exists:**
  - [`apps/web/src/audio/`](https://github.com/Piskriek/HeavyMetal2/tree/feat/monster-mash-exploration/apps/web/src/audio) plays Dr. Haddy's voiced narration (`public/vo/`) through a band-pass radio filter (`1c081bc0` audio fixes logged in [`docs/RESUME.md`](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/RESUME.md)).
  - Pure Web Audio synthesis packages: [`packages/audio/`](https://github.com/Piskriek/HeavyMetal2/tree/feat/monster-mash-exploration/packages/audio), [`packages/soundpack/`](https://github.com/Piskriek/HeavyMetal2/tree/feat/monster-mash-exploration/packages/soundpack), [`packages/soundscape/`](https://github.com/Piskriek/HeavyMetal2/tree/feat/monster-mash-exploration/packages/soundscape), [`packages/soundlab/`](https://github.com/Piskriek/HeavyMetal2/tree/feat/monster-mash-exploration/packages/soundlab), and [`packages/musicbox/`](https://github.com/Piskriek/HeavyMetal2/tree/feat/monster-mash-exploration/packages/musicbox), plus authentic 8-bit PCM lump decoding (`DSSHOTGN`, monster barks) in [`packages/shareware/src/wad.ts`](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/packages/shareware/src/wad.ts).
- **What Is Weak or Missing:**
  - **No Master Bus Architecture or Ducking:** When Dr. Haddy speaks over a running Texture Mill, Extraction Beam, and music track, frequencies collide in the `400 Hz–2.5 kHz` midrange because there is no sidechain ducking bus.
  - **Silence Between Actions on the Moon:** Stepping through the Gate onto the Moon lacks a continuous stage-reactive environmental bed (suit respirator + low-frequency lunar rumble in Stage 0 $	o$ wind and water in Stage 3–4).
  - **Silent or Flat Machine & UI Interactions:** Placing foundations, snapping cables, slotting cartridges, and dry-firing the Extraction Beam lack distinct mechanical transient layers.

## 3. What the Best Games Do (Research & Sources)

| Reference Game | Audio & Mix Technique | Player Praise & Design Lesson |
| :--- | :--- | :--- |
| [***Subnautica***](https://store.steampowered.com/app/264710/Subnautica/) | **Diegetic Suit/Habitat Threshold Filtering & Musical Stingers:** Crossing an airlock immediately shifts the acoustic space from muffled underwater hydrophone + suit breathing to crisp indoor room reverb, and every major biome/depth milestone fires a deep synthesizer stinger ([Subnautica Steam](https://store.steampowered.com/app/264710/Subnautica/)). | Stepping through the freestanding Gate between the Earth Lab and the Moon should immediately swap the acoustic impulse response (warm reflective concrete room $\leftrightarrow$ airless low-bit lunar suit feed). |
| [***Factorio***](https://store.steampowered.com/app/427520/Factorio/) | **Distance-Attenuated Machine Loops & Alert Priority:** Each machine class has a signature rhythmic loop that only plays within a strict camera proximity radius (`< 25 m`) with max-instance voice stealing so 20 machines never turn into white noise ([Factorio Store](https://store.steampowered.com/app/427520/Factorio/)). | Essential for our field machines: cap active 3D positional machine loops to the 4 nearest machines and blend distant machines into a warm harmonic drone. |
| [***Outer Wilds***](https://store.steampowered.com/app/753640/Outer_Wilds/) | **Signalscope Positional Audio Layers:** Every anomaly, beacon, and planet has a distinct harmonic signature that grows clearer as you aim toward it ([Outer Wilds Store](https://store.steampowered.com/app/753640/Outer_Wilds/)). | Reality Leaks (`@hm/leaksim`) and the Twin Gate should emit distinct spatialized harmonic signatures so players can locate leaks and their portal by ear even in Stage 0. |
| [***Prodeus***](https://store.steampowered.com/app/964800/Prodeus/) | **Hybrid Retro PCM + Modern Sub-Bass Layering:** Classic 8-bit `11 kHz` shareware sound effects (`DSSHOTGN`) sound thin on modern speakers unless paired with a clean procedural `55–80 Hz` sub-bass transient punch ([Prodeus Store](https://store.steampowered.com/app/964800/Prodeus/)). | Keeps `@hm/shareware` weapons and monster audio authentic to their retro roots while giving them AAA physical weight. |

## 4. Concrete Changes Ranked P0, P1, and P2

### Master Web Audio Bus & Ducking Architecture

| Bus Channel | Default Gain | Ducking Behavior When `VO_Bus` (Dr. Haddy) Is Active | High/Low Pass & Stage Processing |
| :--- | :--- | :--- | :--- |
| **`Master_Bus`** | `0.0 dBFS` | Limiter ceiling at `-1.0 dBFS` (`DynamicsCompressorNode`, ratio `12:1`, attack `3 ms`) to prevent Web Audio clipping. | Global user volume slider (`0–100%`). |
| **`VO_Bus` (Dr. Haddy)** | `-2.0 dBFS` | Primary sidechain trigger (`attack = 80 ms`, `release = 450 ms`). | Band-pass `320 Hz–3.4 kHz` + subtle asymmetric waveshaper warmth + `60 ms` PTT squelch click at start/end. |
| **`Combat_UI_Bus`** | `-4.0 dBFS` | Ducks by `-2.0 dB` during VO. | Always full-bandwidth (`48 kHz`) so UI clicks, warnings, and weapon impacts stay crisp at every stage. |
| **`World_SFX_Bus`** | `-6.0 dBFS` | Ducks by `-6.5 dB` + low-pass cut at `1.8 kHz` during VO so machines never mask speech. | **Bit-Depth Mirror Node (`AudioWorklet` / `WaveShaper`):** Stage 0 = `8 kHz` 4-bit crush; Stage 1 = `11 kHz` 8-bit; Stage 2 = `22 kHz` 12-bit; Stage 3–4 = `48 kHz` full stereo + convolution reverb. |
| **`Ambience_Bus`** | `-12.0 dBFS` | Ducks by `-5.0 dB` during VO. | Crossfades 5 procedural stems tied directly to `(Pxd, Vtx, Lx, Aq)`. |
| **`Music_Bus` (`@hm/musicbox`)** | `-11.0 dBFS` | Ducks by `-8.0 dB` during VO; fades out during active leak combat (`@hm/leaksim` chase/attack) in favor of tension pulse. | Stage 0 = sparse monophonic square-wave arpeggio; Stage 2 = 4-op FM synth pad; Stage 4 = lush polyphonic ambient chords. |

### P0 — Must Fix Before First Public Test

1. **P0-SOUND-01: Implement the 5-Bus Web Audio Mixer with Automatic VO Sidechain Ducking (`apps/web/src/audio/`)**
   - **What to build:** Route all audio sources in [`apps/web/src/audio/`](https://github.com/Piskriek/HeavyMetal2/tree/feat/monster-mash-exploration/apps/web/src/audio) through the 5-bus graph above (`VO_Bus`, `Combat_UI_Bus`, `World_SFX_Bus`, `Ambience_Bus`, `Music_Bus`). Whenever a Dr. Haddy voice file (`public/vo/`) plays, automatically ramp `World_SFX_Bus.gain` by `-6.5 dB` and `Music_Bus.gain` by `-8.0 dB` over `80 ms`, restoring `450 ms` after the line finishes.
   - **Needs:** **Code** (`apps/web/src/audio/`, `packages/audio/`).

2. **P0-SOUND-02: Build the Tactile Action Feedback Vocabulary (12 Procedural Synth SFX in `@hm/soundpack`)**
   - **What to build:** Ensure every core player verb has a 3-layer procedural sound (`transient click + tonal body + mechanical tail`) in [`packages/soundpack/`](https://github.com/Piskriek/HeavyMetal2/tree/feat/monster-mash-exploration/packages/soundpack):
     1. **Breaker Throw (Act I):** Heavy steel clunk (`90 Hz` impulse) + rising capacitor sine sweep (`60 Hz -> 420 Hz` over `1.8 s`) + overhead relay latch clicks.
     2. **Gate Ignition (Act II):** 8 stepped transformer thrums (`+2 semitones` per coil block) + electrostatic aperture tear + deep `45 Hz` sub-hum loop within `8 m` of the doorway.
     3. **Beam Rifle Dry Fire:** Hollow mechanical solenoid clack + low buzz (`"brrt"` per [`docs/V1_1_ONBOARDING_PLAN.md`](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/V1_1_ONBOARDING_PLAN.md)).
     4. **Beam Extract (Dirt/Ore):** Continuous harmonic carrier beam (`220 Hz + FM wobble`) + granular crystalline crackle as chunks detach + rising pitch chime on each inventory pickup (`+1 semitone` per consecutive chunk, resetting after `1.2 s`).
     5. **Beam Apply / Sculpt / Seal:** Distinct carrier chord per mode (`#ff3d8a` Apply = warm major 3rd spray; `#7cff4d` Sculpt = low resonant filter sweep; `#ffc13d` Seal = high phase-locked harmonic lock).
     6. **Cartridge Slot / Eject:** Cassette plastic snap + brass contact ping + metric-chord arpeggio.
     7. **Foundation & Machine Placement:** Hologram lock beep + pneumatic hydraulic thud (`65 Hz`) + bolt ratchet whir.
   - **Needs:** **Code** (`packages/soundpack/`, `apps/web/src/play/`).

### P1 — Makes It Feel AAA

3. **P1-SOUND-03: Stage-Linked Acoustic Resolution & Ambience Layering (`@hm/soundscape`)**
   - **What to build:** Wire the `S = (Pxd, Vtx, Lx, Aq)` floats directly into [`packages/soundscape/`](https://github.com/Piskriek/HeavyMetal2/tree/feat/monster-mash-exploration/packages/soundscape):
     - **Lab Interior:** Constant `50 Hz` electrical hum, quiet ventilation air, and distant muffled thunder from the Window Breach.
     - **Moon Stage 0–1:** Muffled helmet-interior respirator breath + dry sample-crushed footstep crunches on regolith + eerie low-bit solar wind whistle.
     - **Moon Stage 2 (`Lx >= 0.35`):** Helmet filter opens to external atmosphere; crisp gravel/rock footsteps; atmospheric wind sweep across crater rims.
     - **Moon Stage 3 (`Aq >= 0.40`):** Gentle water lapping near hydro basins (`@hm/hydro`) and wet footstep splashes along shorelines.
     - **Moon Stage 4 (`Lx >= 0.85`, `Aq >= 0.75`):** Rustling conifer needles/grass in wind, distant alien bird/strider calls (`@hm/fauna`), and warm stereo reverb.
   - **Needs:** **Code** (`packages/soundscape/`, `apps/web/src/crafter/world.ts`).

4. **P1-SOUND-04: Machine Signature Loops with 4-Voice Proximity Culling**
   - **What to build:** Give each field machine on [`12-sheet-field-machines.png`](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/concept/setmix/12-sheet-field-machines.png) a distinct procedural loop (`Rock Drill` = rhythmic percussive thumper; `Texture Mill` = granular pink-noise grinder + sparkling pixel chime; `Shape Press` = hydraulic cyclic stamp every `2.5 s`; `Light Projector` = warm arc-lamp hum; `Water Maker` = condenser bubble & hiss). Cull active `PannerNode` instances to the 4 closest machines within `30 m`.
   - **Needs:** **Code** (`packages/soundpack/`, `apps/web/src/base/`).

5. **P1-SOUND-05: Sub-Bass Reinforcement Layer for `@hm/shareware` 8-Bit Combat Audio**
   - **What to build:** Whenever `@hm/shareware` plays an 8-bit `11 kHz` WAD lump (`DSSHOTGN`, monster pain/attack barks), trigger a synchronous procedural Web Audio sub-punch (`60 Hz -> 32 Hz` exponential sine drop over `110 ms` + stereo cabinet slapback) so retro shareware weapons feel punchy without altering the legal WAD lump data.
   - **Needs:** **Code** (`packages/shareware/`, `packages/audio/`).

### P2 — Stretch Goals

6. **P2-SOUND-06: Generative Stage-Transition Harmonic Swell (`@hm/musicbox`)**
   - **What to build:** When the radial stage-upgrade wave (`P1-LIGHT-04`) sweeps across the plot, trigger a 6-second Shepard-tone / lush pad crescendo in `@hm/musicbox` synchronized to the wave radius passing the player's position.
   - **Needs:** **Code** (`packages/musicbox/`).

## 5. Rules Touched (`docs/argo/RULES.md`)

- **Rule 1 (Four floats, one formula) & Rule 4 (Terraforming is graphical fidelity):** Acoustic resolution and environmental stems derive strictly from `(Pxd, Vtx, Lx, Aq)`.
- **Rule 3 (Single-file distribution, `POL-27` 18 MB watch):** 100% of the new SFX, machine loops, and stage ambiences are procedural Web Audio graphs (`< 15 KB` of TypeScript code), adding **zero MB** of audio bloat to `dist/index.html`.
- **Rule 18 (Legal assets only):** Shareware PCM audio comes exclusively from BSD-licensed *Freedoom* / *Blasphemer* / *LibreQuake* lumps or local user files.

## 6. Owner Decisions Needed

1. **Stage 0 Audio Bit-Crush Intensity:**
   - *Question:* When the player first steps onto the Stage 0 Moon, should external world sounds (footsteps, boulders, machine hums) have an audible retro `8 kHz` sample-rate crunch that clears up smoothly as `Pxd` and `Lx` rise to Stage 2, while keeping Dr. Haddy's voice and HUD clicks crisp?
   - *Recommendation:* **Yes—apply the sample-rate reducer only to `World_SFX_Bus` in Stage 0 (`8 kHz` $	o$ `48 kHz` by Stage 2)** and never to `VO_Bus` or `Combat_UI_Bus`. It sells the "low-resolution reality" fantasy within half a second of stepping through the Gate without ever making voiceover hard to understand.
