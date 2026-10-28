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

## 2. Wave 2: the drone bridges any game, live (owner, 28 Oct)

"Write modular code: when I ask you to bridge a game from within the game, as the drone you check the game's copyright
live and start streaming the things that aren't copyrighted." Research: [`docs/GAME_BRIDGE_PERMISSIONS_RESEARCH.md`](../../GAME_BRIDGE_PERMISSIONS_RESEARCH.md).

- **One module for every game, `@hm/gamebridge` (pure).** It holds:
  - the **permission profile** (`hm2:bridge-profile:v1`: verdict, allowed observer rungs, allowed stream classes
    `mechanics` / `telemetry` / `entity-kinds`, solo only, sources with quotes, who checked it, setup steps). `assets` is
    never allowed; the validator strips it;
  - the **mechanics floor** (owner and Argon review, 28 Oct). Mechanics are ideas and systems, which copyright does not
    protect, so **no verdict blocks them**: unchecked, limited and refused games all bridge mechanics out of the box.
    - The floor rungs (`FLOOR_CHANNELS`) are the game's own official telemetry, which it sends out to be read, and the
      screen, which the player sees. Every game allows both.
    - A checked profile adds only the deeper rungs (mod SDK, loader, game files): they touch the game's code or data,
      where terms and anti-cheat bind. A refused verdict keeps the floor, solo.
    - Samples are consumed to measure the mechanics and never kept.
    - The game's names for its events cross as anonymous labels (`boss.state:#2`) unless the profile allows
      `entity-kinds`. A rule keeps its shape and timing; the game's words stay behind;
  - the **unchecked profile** (the floor rungs, mechanics, solo);
  - **gating** (assets never; mechanics always; names anonymized; a deeper rung needs a checked profile);
  - **rung choice** (the best allowed rung that is available);
  - **telemetry mapping presets** (data, not code: dotted paths from an official telemetry payload to the observation's
    numbers, so a new game is a new preset);
  - a **share code** (`bridgec:`).
- **The live flow, in play:**
  1. You say "bridge this game", or "bridge <name>".
  2. The drone asks the bridge which processes are running and ranks them (known engine signatures from `bridgekit`
     first).
  3. With no name said, the drone bridges a known engine or the only candidate; otherwise it names what is running and
     asks which game.
  4. The session starts at once on the unchecked profile, so the bridge works with no AI attached. The drone reads out
     what crosses.
  5. It posts a `bridge-request`. A checking AI on the bridge reads that game's terms live and answers with a
     `bridge-profile`: sources quoted, deeper rungs, names, and the game's telemetry mapping when it publishes one. Its
     verdict replaces the unchecked one for everything beyond mechanics. An AI cannot open a bridge by itself: profiles
     only apply to the game the player ordered bridged.
  6. Observations flow through gating:
     - official telemetry posted to `POST :8220/telemetry/<game>`, through the mapping, in batches of 300 samples (about
       10 s of a 30 Hz feed);
     - an AI's `/observe-mechanic` for that game;
     - the screen, last.
     Telemetry that arrives before a mapping is held back with a plain reason.
  7. **The live effect.** "Bridge this game" is the player's word, so every mimic of the bridged game goes straight
     onto play:
     - movement (gravity, jump, walk and run);
     - the weapon's and the drone's fire pattern;
     - the rover's harness while driving.
     Each refinement replaces the last, and all of them share one undo step. "Stop the bridge" (or "unbridge") puts back
     everything as it was before the bridge. A mimic of a game nobody bridged still waits for "apply the mimic".
  8. Trigger rules from events have nothing in FIDELITY to bind to yet. They go on the mimic shelf as `logic:` codes
     (the play slot is §3.3). The fire graph does apply, as the fire pattern.
  9. Proven by `scripts/test-drone-e2e.mjs` §4c:
     - a fake process list;
     - a refused verdict that still bridges;
     - a GSI-style feed whose g = 8 and 5 rounds/s land on the body and the drone's guns within one batch;
     - "stop the bridge" restoring both.

## 2b. Wave 3: every game gives mechanics, and bridged rules drive play (owner and Argon, 28 Oct)

The ask: validate every channel at once (movement, fire rate, state-change rules) on:
- an FPS with official telemetry (CS2's Valve GSI);
- an FPS with none (Quake / LibreQuake);
- a second local FIDELITY instance (`?game=arena-survivor`, `circuit-rally`), so the whole pipe runs with zero installs.

It also closes the two Wave 2 gaps: bridged `logic:` rules sit unused, and a game with no telemetry gives nothing.

**Categories (standing rule 6).**
- CS2 stands for *games that publish official telemetry*.
- Quake stands for *games that publish nothing*: perception only (the screen, the game's own audio, the player's own input).
- FIDELITY stands for *any FIDELITY instance as a bridged game*.
- The event pairs stand for *event classes*:
  - threat: boss, wave, spawn, alarm, horde;
  - mobility: dash, jump, sprint, slide, movement;
  - outcome: round, kill, score, death, match;
  - objective: bomb, flag, capture, checkpoint, lap;
  - harm: health, damage, flashed, burning.

**Decisions.**
1. **Mapping language v2 (`@hm/gamebridge`, data not code).**
   - Selector segments: `player.weapons[state=active].ammo_clip` picks the child whose field matches.
   - Falling counters: `counts: 'down'` makes an ammo clip falling a shot, and a reload rising is not a shot.
   - A counter scope: when the active weapon's name changes, the counter re-bases instead of counting a switch as shots.
   - `eventClasses` overrides beside the keyword classifier `classifyEventField`.
   - **Bridge presets** (`BRIDGE_PRESETS`): checked profiles that ship. `cs2` (Valve GSI: official telemetry, limited: no mods or injection, VAC) and every FIDELITY standalone game, so those bridge with no AI attached. A session keeps one event anonymizer, so labels stay consistent across batches and live events.
2. **The Mimic Reflex Slot**, a live and temporary `logic:` slot on the suit and the drone. No lab blank: it is not a print.
   - While the bridge is live, each external event (a telemetry field change, or an input or audio edge from the sampler) is classified (`bindAnonymousEventToFidelitySlot`) and fed, as it happens, to the reflex preset `mimic-reflex`. That preset is a wiregraph the Studio can edit, with three new actuator kinds:
     - threat → `pulse-shield` and `overclock-fire` (`onLeakSurgeOrWaveEdge`). For 4 s the suit's shield lets only a fifth of each hit through: play does damage the player, through `takeHit`. The health plate takes the bridge's Ray-7 violet. The drone's fire rhythm doubles for the same 4 s;
     - mobility → `reload-weapon`: an instant reload (`onPlayerJumpOrSprintEdge`);
     - outcome → `arc-chain`: the drone chains a zap through up to three monsters near it, through the monsters' own hurt path (`onWeaponFireBurst`);
     - objective and harm → the same overclock (a pressure edge).
   - The bridged game's own rule graphs run in the same slot, with their delays and counters; their `fire-turret` actuators fire the arc.
   - **Not built: the "phase impulse".** Play has no dash yet, so an impulse would be decoration. It waits for a `dash` preset field (§3.4). The mobility edge's instant reload is built.
   - "Stop the bridge" clears the slot and ends any overclock.
3. **The cadence sampler (`scripts/cadence-sampler.ps1`, run by the bridge, Windows).** It starts with the bridge session and stops with it (`--no-sampler` turns it off). At about 200 Hz it reads:
   - which window has focus. It samples only while the bridged game's own window is in front;
   - three input edges as booleans: fire (left mouse), jump (space), dash/sprint (shift). Never any other key, never text;
   - the game's own audio peak from its Windows audio session (`IAudioSessionManager2` → the session whose process is the game → `IAudioMeterInformation`). Music and voice chat in other apps are ignored.
   The bridge turns that into observations on a new floor rung, `input-audio` (the player's own senses, like the screen):
   - fire cadence comes from audio onsets while fire is held, or from input edges for semi-auto;
   - jump and dash edges become events;
   - samples live in memory only and are posted as `mimic` commands for the bridged game, while edges go live to the reflex slot.
   It does not touch the game's process or memory. Gravity still needs telemetry or the screen tracker (§3.5).
4. **The FIDELITY self-bridge.** `?telemetry-out` on any FIDELITY tab posts its own telemetry to `POST :8220/telemetry/fidelity-<game>`: position, shots and ammo, leaks, kills, waves. A second tab says "bridge fidelity arena survivor", and the shipped FIDELITY preset maps it. The e2e runs two tabs: tab A must recover tab B's real gravity and fire rate, and react to B's waves and kills through the reflex slot.
5. **CS2 live** (installing on this PC, 28 Oct). `node scripts/bridge-setup.mjs cs2` writes Valve's `gamestate_integration_fidelity.cfg` into the game's `cfg` folder, pointing at `/telemetry/cs2`. That folder is where Valve documents it.
   - CS2 sends only the local player's data while playing. Position may be spectator-only, so fire cadence and round, bomb and kill events are certain, and gravity is only possible.
   - Verified on a live payload once installed. **Quake/LibreQuake** is not installed here: the sampler covers it, and a demo-file reader (`.dem`, the game-files rung) is §3.6.

**Built and measured (28 Oct).** `scripts/test-gamebridge-e2e.mjs` passes 14/14 on the min-spec laptop.
- **Self-bridge:** tab A recovered tab B's real body gravity, 1.587 against 1.619 m/s².
  - That is B's Moon gravity, because a game preset sets gravity to 9.81 × its `gravityScale`, over the locomotion preset's 9.8. The harness measured what B's body really did.
  - A also recovered B's real fire pace (a round every 0.65 s), live.
  - B's jumps reloaded A's weapon, and B's waves pulsed A's shield and overclocked A's drone.
  - "Stop the bridge" restored everything.
- **Input-audio:** a recorded sampler stream gave the drone 6.06 rounds/s from the audio alone, and its jump presses reloaded the weapon live.
- **Sampler on this PC:** it read a test process's own audio session (peak 0.30, the clip's amplitude) and recovered an 8 Hz click rhythm (gaps of 0.12–0.13 s against 0.125).
- Unit tests:
  - a CS2-shaped GSI stream: the clip falling counts as shots, a reload or a weapon switch does not;
  - classes, the session anonymizer, the cadence analyzer;
  - the reflex slot, with a bridged rule's 1.5 s delay playing out.

**Found and fixed on the way.**
1. **Two FIDELITY tabs on one bridge both drained its command queue.** Each comms instance now has a client id; the bridge routes a bridged game's telemetry, cadence and edges to the tab that opened that bridge.
2. **A background tab's timers run about once a second.** A source tab streams well only in front, and the receiving tab's 1.5 s poll is unaffected.
3. **A batch now also closes after 10 s of game time with a dozen samples in it.** This is for sparse feeds like CS2's GSI, which posts on change.
4. **A failed live mimic now posts a `mimic-error` event.** It used to vanish in the poll loop. `telemetry-batch` and `cadence-window` events show an AI that the pipe is working.
5. **No `-ExecutionPolicy Bypass`.** The sampler runs under the machine's own RemoteSigned policy; the auto-mode classifier rightly refused the flag.

**Cross-check with Argon's Plan 52 doc.** His `bindAnonymousEventToFidelitySlot` keyed on literal prefixes (`boss.state`, `wave.surge`, ...) and bound unknown events to the arc. This one binds classes, so any game's names work, and unknown events bind to nothing. His sampler code guessed gravity from how long Space was held (`-3.71` past 200 ms) and counted clicks per second as the fire rate. Both are untrue for most games, so this sampler measures the game's own audio onsets and reports no gravity.

## 3. Next (in order; ask the owner where marked)

1. **The shorthand**, defined (`OWNER_INTENT_SYNTHESIS.md` §4: typed JSON `hm2:shorthand:v1` + a one-line text form);
   the mimic result becomes one of its frame kinds.
2. **Real observers by rung.** Per-game permission profile; first a game whose rules allow it (owner: which game first).
3. **Play slots for `logic:` and `anim:`** (new print kinds; owner decision, the cartlab union is frozen).
4. **More identification**: air control from in-air steering, the landing spring from post-landing oscillation (log
   decrement), dash as a preset field, SINDy-style sparse identification for anything not closed-form.
5. **The screen rung (last resort)**: a fast tracker over `/frame` (change gating, blob tracking) emitting trajectories.
