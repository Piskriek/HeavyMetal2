# **ARGO\_NOTE\_12: TICKET-10 Bundle Manifest & play-scene.ts Window A Merge Guide**

**Author:** Gemini Argo (Creative Lead & PM)  
**To:** Claude Opus (Lead Engineer) & Francois (Owner)  
**Date:** 2026-10-18  
**References:** [OPUS\_NOTE\_19\_ticket11\_intake\_and\_ticket10](https://docs.google.com/document/d/16_N5qpNOKfFcPvgn4hA_88vk8-laJCni5jCi8LO4nrU/edit?usp=drivesdk), [ticket10-context.json](https://drive.google.com/file/d/1f967kgJrcHTMaBhdsIR_QFM91H7DzrvJ/view?usp=drivesdk), [argo-ticket10-bundle.json](https://drive.google.com/file/d/1q9dmuyWpvsGPpmgAiucxuv1H7-qCoJ5z/view?usp=drivesdk) (Drive ID: 1q9dmuyWpvsGPpmgAiucxuv1H7-qCoJ5z)

## **1\. Bundle Manifest (18 Files, All Compiled & 11/11 Node Tests Passing)**

> * packages/leaksim/src/wall-pathfinder.ts & packages/leaksim/src/wall-pathfinder.test.ts — Deterministic 8-connected A\* pathfinder with string-pulled line-of-sight smoothing (findPathAroundWalls, nextWaypointAroundWalls, navFromSolids, POL-32) and exact Liang-Barsky slab segment-vs-oriented-box bolt blocker (segmentHitsSolid, boltBlockedBySolids, POL-33).  
> * packages/leaksim/src/index.ts — Integrates nextWaypointAroundWalls into ground monster steering (POL-32) and boltBlockedBySolids into bolt stepping (POL-33).  
> * apps/web/src/avatar/two-bone-ik.ts, apps/web/src/avatar/two-bone-ik.test.ts, & apps/web/src/play/rifle-hold.ts — Analytical Law-of-Cosines two-bone limb IK solver (solveTwoBoneIk, solveLeftArmForegripIk, POL-28) with soft reach clamping and zero external runtime imports.  
> * packages/terrainbrush/src/seam-stitch.ts, packages/terrainbrush/src/seam-stitch.test.ts, & packages/terrainbrush/src/index.ts — Geomipmap border-vertex snapper (snapBorderHeights, stitchChunkBorder, stitchChunkCandidates, POL-29) eliminating cracks between 16 m sculpt-refined chunks and coarse neighbours.  
> * apps/web/src/play/portal-shaders.ts & apps/web/src/play/portal-shaders.test.ts — Adds the 6 m metric-coloured wireframe leading band (uWaveBandColour, stageWaveBandAt, P1-LIGHT-04), the 30 m / 1.0 s local brightening wave on first machine activation (uLocalWaveCentre, uLocalWaveR, uLocalWaveStrength, uLocalWaveColour, localMachineWaveAt), and fades the Stage 0 scan ring out at 350 m (scanRingFadeAt, POL-52).  
> * apps/web/src/play/monster-rules.ts, apps/web/src/play/monster-rules.test.ts, & apps/web/src/play/monsters.ts — Adds setNav(nav) wall pathfinding (POL-32), shot/bolt wall blocking (POL-33), and stage-tuned fight-overlay parameters (fightOverlayParamsForStage: lowering remapStrength to 0.12 and telegraph ring opacity to 0.55 at Stage 1 so monsters never smear pink, while preserving 0.20 at Stage 6, POL-37).  
> * apps/web/src/play/machine-props.ts — Mounts a square emissive status LED mesh (housing-status-led) at each machine's per-kind surface anchor (HOUSING\_LED\_ANCHOR, housingLedState, setStatusLed: green running, 2 Hz blinking amber for no ore/brownout, red unpowered, POL-39).  
> * apps/web/src/play/beam-visuals.ts — Adds slopeLiftAt(heightAt, x, z, baseLift) secant \+ chord clearance lift so the brush ring never reads dashed on steep slopes (POL-30).  
> * apps/web/src/play/lab-vista.ts — Adds a 0.35 s peak-hold envelope on flashLight plus vista.flash.onPeak and vista.flash.triggerPeak so a capture 0.3 s after onFlash catches the lit lab floor (POL-25).  
> * apps/web/src/play/play-scene.ts — Contains the self-contained TICKET-10 WINDOW A block and its 5 call-site hooks listed below.

## **2\. play-scene.ts Window A Merge Table (Self-Contained Section \+ 5 Hooks)**

All 5 helper functions live in one contiguous block (// TICKET-10 WINDOW A (Self-Contained Hooks 1..5 for OPUS\_NOTE\_19)) right after const holdRifleInHand \= (): void \=\> { ... };, untouched by F-09's layout-key section:

> 1. **Hook 1 — syncWaveAndLocalPulseUniforms(now, scan.radius) & noteMachineActivationPulse(v.m.id, v.m.kind, v.m.x, v.m.z, r) (P1-LIGHT-04, POL-52):**  
   * *Context in frame():* Right after postUniforms.uScanCentre.value.set(scanWave.centre.x, scanWave.centre.y, scanWave.centre.z);  
   * *Context in setPlot():* Inside for (const v of views.values()) { const r \= running.get(v.m.id) ?? 0; (together with v.prop.setStatusLed?.(r, connected.has(v.m.id), satisfaction, clock); for POL-39).  
> 2. **Hook 2 — applyVistaFlashFloorPeak(now) (POL-25):**  
   * *Context in frame():* Immediately after room.update(now, dt); — drives the lab window floor spill light (+12 per unit of flash, capped at 0.7, with a 0.35 s peak hold).  
> 3. **Hook 3 — applyThirdPersonForegripIk() (POL-28):**  
   * *Context in frame():* Immediately after holdRifleInHand(); inside if (scientistAnimator && drivingVehicleId \=== null) (with leftUpperArm \= group.getObjectByName('mixamorigLeftArm') ?? null; leftForeArm \= group.getObjectByName('mixamorigLeftForeArm') ?? null; captured alongside leftHand).  
> 4. **Hook 4 — updateSlopeLiftedBeamRing(beamAimed ? { x: beamAimed.x, z: beamAimed.z } : null, STROKE\_RADIUS, ringColourOf(heldMode, beamSealingNow)) (POL-30):**  
   * *Context in frame():* Replaces beamVisuals.setRing(beamAimed ? { x: beamAimed.x, z: beamAimed.z } : null, STROKE\_RADIUS, ringColourOf(heldMode, beamSealingNow), groundAt); right after const beamAimed \= heldBeam.group.visible && where \=== 'planet' ? aimGround(BEAM\_STROKE\_RANGE) : null;.  
> 5. **Hook 5 — syncMonstersNavAndSolids(base) (POL-32, POL-33):**  
   * *Context in setBase(base):* Immediately after monsters.setSafeZones(monsterSafeZones({ x: twin.group.position.x, z: twin.group.position.z }, lifeSupport)); (and in setPlot when if (changed)).