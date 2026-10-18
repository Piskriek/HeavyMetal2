# **ARGO\_NOTE\_14 — TICKET-15 (Harmonic Machine Choir @ 144 BPM, 85.2 MHz Bridge FM Radio & Turbo Bass) \+ POL-141 Ruling**

**From:** Gemini Argo (Creative Lead & PM)  
**To:** Claude Opus (Engineering Lead) & Francois (Owner)  
**Date:** 2026-10-18  
**Subject:** TICKET-15 Code Bundle Delivery (argo-ticket15-bundle.json), Window D Hooks for play-scene.ts, and Call on POL-141 (Lab Plume Gate)

## **1\. Call on POL-141 (What “Operating” Means for a Lab Station’s Plume)**

**Ruling:** A Lab station’s pixel plume (labMachines.setOperating(id, on), gated on power \> 0.25) is **active while its modal UI window is open AND for a 3.5 s post-action tail after a write, combine, catalogue, or print action completes**—never continuously whenever the Lab breaker is thrown.

> * **Why not “always when powered”:** If all 4 East-wall Lab stations (rack, bench, combiner, fabricator) pour plumes continuously after the breaker is thrown, the 8 m × 5.2 m Lab room has 4 permanent rising columns of cubes even while the player is at Dr. Haddy’s desk or looking out the window, cluttering the sightlines and the articulated East-wall bays.  
> * **Why not “only while the modal window is open”:** If the plume cuts off the instant the player closes the modal after clicking \[Write Cartridge\], \[Combine\], or \[Print\], the player never gets to see the physical 3D station vent its celebratory metric plume in the room.  
> * **Exact Rule & Wiring:**  
  1. **While Station UI Modal is Open:** operating \= true for that station (bench, combiner, rack, or fabricator) so its bay and exhaust vent pour live metric pixels behind the UI.  
  2. **For 3.5 s After Any Completed Station Action:** Writing a cartridge on bench, splicing on combiner, slotting/cataloguing on rack, or printing on fabricator sets a 3.5 s hold timer on that station so the player sees the plume burst in 3D after closing the modal.  
  3. **Idle Powered State:** Status LEDs and glass bays stay lit via setPower(p), while setOperating(id, false) keeps idle plumes at zero cubes.  
  4. **Hook in play-scene.ts:** Inside setLabActivity(act: { readonly bench: number; readonly combiner: number; readonly rack: number; readonly fabricator?: number }), call:  
     labMachines.setOperating('bench', act.bench \> 0); labMachines.setOperating('combiner', act.combiner \> 0); labMachines.setOperating('rack', act.rack \> 0); labMachines.setOperating('fabricator', (act.fabricator ?? 0\) \> 0);

## **2\. TICKET-15 Summary & Bundle Manifest (argo-ticket15-bundle.json — 11 Files)**

Per [OPUS\_NOTE\_21\_ticket14\_intake\_and\_ticket15](https://docs.google.com/document/d/1QrXeMobzIbOgZBn96Wux7p9HIKAk62CfMfPDq5gRUc4/edit?usp=drivesdk) and [ticket15-context.json](https://drive.google.com/file/d/1yf3HeV8JZoPl3NrxjLsfEKmgmGNJZ8MT/view?usp=drivesdk), all relay drafts have been adapted, verified with node:test (5/5 tests passing), and packaged into argo-ticket15-bundle.json:

> 1. packages/musicbox/src/harmonic-machine-choir.ts — Sets SETMIX\_SONG\_BPM \= 144.0 and SETMIX\_SONG\_KEY \= 'D Major' (D2=38, A2=45, B2=47, G2=43 matching the v4b stems), computes downbeatPulse0to1, and exports resolveChoirBus(locked) ('world' for \< 4 stems so individual machines pass through the stage bit-depth mirror; 'music' on 4/4 lock; never 'voice').  
> 2. packages/musicbox/src/index.ts — Re-exports ./harmonic-machine-choir from @hm/musicbox.  
> 3. packages/musicbox/src/\_\_tests\_\_/harmonic-radio-and-turbobass.test.ts — Converted from vitest to node:test \+ node:assert/strict; imports only context modules and verifies 144 BPM D Major choir lock, stage-reactive radio arrangements, SSTV Gate decode, wreck tape placement on sites 1..4, plume modulation & swarmer knockback, and T09a bus routing \+ MENTOR\_MIX preservation.  
> 4. packages/content/src/diegetic-radio-and-tapes.ts — Removes the non-existent stage-post.glsl import, updates all 4 tapes (TAPE \#01..TAPE \#04) to 144 BPM, maps them deterministically onto wreck sites 1..4 (WRECK\_TAPE\_BY\_SITE, WRECK\_TAPE\_BY\_TRANSPONDER, tapeForWreckSite, tapeForTransponder), and exports radioBusForContext ('world' for spatial wreck/desk emitters, 'music' for HUD/rover deck).  
> 5. packages/tooljuice/src/beat-synced-plume-and-turbobass.ts — Adds pure beatPulse(timeSec, bpm \= 144\) helper for Window D Hook \#1, exports TURBO\_BASS\_BUS \= 'combatUi', and generalizes applyTurboBassSwarmerKnockback to support both string and numeric mob IDs.  
> 6. packages/audiomix/src/index.ts — Extends busOfSound(id) so synth-radio-\*, tape-\*, and synth-choir-convergence route to 'music', synth-choir-machine-\* routes to 'world', and sfx-turbobass\* / sfx-bass-pulse routes to 'combatUi', leaving BUS\_START (MENTOR\_MIX: voice: 0.8, music: 0.45) untouched and never returning 'voice'.  
> 7. apps/web/src/audio/game-audio.ts — Adds playChoirStep(state, bus) (on 'world' or 'music'), playBridgeFmNote(freqHz, arrangement, bus) (on 'music' or 'world'), and playTurboBassPulse(downbeatPulse0to1) (strictly on 'combatUi'), plus exposes them on window.\_\_audio.  
> 8. apps/web/src/shell/diegetic-radio-tuner-widget.tsx — Displays the 144 BPM Bridge FM tuner, 4-stem convergence matrix, unlocked cassette selector (TAPE \#01..\#04), SSTV decoded banner, T09a bus attributes, and \[V\] Bass Pulse button.  
> 9. apps/web/src/play/wreck-sites.ts — Attaches tape?: string (TAPE \#01..\#04) to wreck sites 1..4 and returns tape in wreckInteract(member).  
> 10. apps/web/src/play/wrecks.ts — Adds collectTape(id): string | null to WreckSystem so interacting with wreck sites 1..4 (as placed by T07a and TRIFT) collects TAPE \#01..\#04 once.  
> 11. apps/web/src/play/monsters.ts — Routes CombatAudio through gameAudio.getCombatBus() (combatUi), replaces Math.random() with deterministic hash32 noise, and adds knockbackSwarmers(origin, radiusM, pushM, downbeatPulse0to1): number to MonstersSystem.

## **3\. Window D — play-scene.ts Hooks (One Labelled Section)**

// \---- Window D (TICKET-15: 144 BPM Plume Beat Pulse & \[V\] Turbo Bass Swarmer Knockback) \----  
// 1\. In frame(now, dt, c) when updating active field machine plume counts (right where plume.setCount(emId, baseCount) is called):  
const choirPulse \= choirLocked ? evaluateBeatSyncedPlumeModulation(beatPulse(now, 144), true).cubeScaleMultiplier : 1.0;  
plume.setCount(emId, Math.round(baseCount \* choirPulse));

// 2\. On PlayScene interface & return object (right after stepMonsters(seconds)):  
triggerTurboBass(radiusM \= 12, pushM \= 4): number {  
  const pos \= this.playerPose();  
  if (\!pos) return 0;  
  return monsters.knockbackSwarmers({ x: pos.x, z: pos.z }, radiusM, pushM, beatPulse(performance.now() / 1000, 144));  
},  
