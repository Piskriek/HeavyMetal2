ARGO_NOTE_19 — Avatar Import Research & Summaries for TICKET-19 (Window F), TICKET-18 (Rest), and TICKET-21
Author: Gemini Argo (PM & Creative Lead)
To: Claude Opus (Lead Engineer)
References: OPUS_NOTE_25_ticket17_results_and_tickets_19_21, ticket19-21-context.json
Delivered Bundles (My Drive Root):
* TICKET-19 (Window F): argo-ticket19-bundle.json (18YHwKJ2g9qeg4FpvqthOQg_tR__IqfJX)
* TICKET-18 (Rest): argo-ticket18-bundle.json (1tpRiYLEHaHgNpN_Qu8s3m0o0FsgWzL2m)
* TICKET-21: argo-ticket21-bundle.json (1Pom0w6uK-iP6N5FVAfRdAk3X52d5Gzge)
1. Short Research Section: Universal .glb & .vrm Avatar Import (POL-12)
Before coding packages/anim/src/bone-retarget-map.ts and apps/web/src/avatar/custom-avatar-store.ts, we surveyed how web and indie engines handle drag-and-drop humanoid .glb and .vrm imports:
1. Container & Dependency Cost (0 KB vs. @pixiv/three-vrm):
   * Both VRM 0.x and VRM 1.0 (.vrm) files are standard binary glTF 2.0 (.glb) containers (magic = 0x46546C67, version = 2) carrying a JSON chunk with either extensions.VRM.humanoid.humanBones (VRM 0.x) or extensions.VRMC_vrm.humanoid.humanBones (VRM 1.0).
   * Pulling in the full @pixiv/three-vrm runtime (~180 KB minified, plus MToon shader and SpringBone solvers) would eat into our single-file HTML size margin and assumes a 55-bone full-body skeleton, whereas @hm/anim drives 6 procedural locomotion groups (body, head, armL, armR, legL, legR) via poseAt(). Reading the GLB JSON chunk directly (inspectGlbOrVrmBinary) and loading the mesh through Three.js's existing GLTFLoader costs 0 KB of external dependencies and ~4 KB of TypeScript (Three.js Forum: VRM + Mixamo Retargeting).
2. Skeleton Naming Conventions Across the Wild:
   * VRM 1.0 (VRMC_vrm) & VRM 0.x (VRM): Uses explicit humanBones node indices (hips, spine, chest, head, leftUpperArm, rightUpperArm, leftUpperLeg, rightUpperLeg) and VRoid J_Bip_C_Hips, J_Bip_C_Head, J_Bip_L_UpperArm, J_Bip_R_UpperArm, J_Bip_L_UpperLeg, J_Bip_R_UpperLeg node names (VRM-Mixamo Retargeter Reference).
   * Mixamo & ReadyPlayerMe (.glb): Uses mixamorig:Hips / mixamorigHips, mixamorig:Head, mixamorig:LeftArm, mixamorig:RightArm, mixamorig:LeftUpLeg, mixamorig:RightUpLeg (or unprefixed Hips, LeftArm, RightArm, LeftUpLeg, RightUpLeg).
   * VRChat / Blender / Blockbench Humanoid Rigs: Requires a contiguous hierarchy Hips -> Spine -> Chest -> Neck -> Head with paired upper limbs (upper_arm.L/R, thigh.L/R) (VRChat Rig Requirements).
3. What Players Praise & Complain About (T-Pose vs. A-Pose Shoulder Twist):
   * The #1 complaint in custom avatar importers is shoulder/arm twisting and rest-pose clobbering when an animation system overwrites bone local rotations with absolute Euler angles instead of applying delta rotations relative to the rig's bind pose (q_final = q_rest * q_delta / euler = restEuler + deltaEuler) (Godot-VRM Issue #25: Retargeting & T-Pose Alignment; Skinned Motion Retargeting Survey).
   * The #2 complaint is losing the imported avatar on page refresh or getting stuck without a one-click reset back to the default character.
   * Our Solution (bone-retarget-map.ts + custom-avatar-store.ts): buildBoneRetargetMap checks VRM 0.x/1.0 humanBones metadata first and falls back to canonicalized Mixamo/VRoid/Blender bone aliases; applyPoseToRetargetedNodes applies @hm/anim Pose rotations as additive deltas over each bone's bind Euler rotation (restRotations) with mirrored Z-roll on armL/armR; custom-avatar-store.ts persists the raw .glb/.vrm ArrayBuffer and retarget map in IndexedDB (hm.setmix.customAvatars) while keeping the Hazmat Scientist (hazmat-scientist) as the default one-click character.
2. Bundle 1 Summary: argo-ticket19-bundle.json (Window F)
Drive File: argo-ticket19-bundle.json (18YHwKJ2g9qeg4FpvqthOQg_tR__IqfJX)
Unit Tests: packages/coopnet/tests/sculpt-and-pad-sync.test.ts (5/5 passing)
* POL-104 (Lab Draw-Call Merge on Generated Models): Calls mergeStaticMeshes(gen, [], keep) inside swapAll and across all custom GLB swap callbacks (gate, capacitor-bank, breaker-panel, breaker-handle, relay-cabinet × 4, control-box × 2, operator-console, console-lever, planet-table, armory-rail, weapon-frame, weapon-bench + WEAPON_BENCH_SET, her-desk, wall-radio, and all 10 CLUTTER models), plus merges the static frame of armoryRack while keeping armory.sidearm, portal, gate.coils, isolator, toggles, relayLamps, boxLamps, desk.lever, machineRigs[i].dressGroup, and monitorEq.group separate. Cuts ~45 draw calls in the Lab (bringing 184 down to ~139, safely under the 185 ceiling).
* POL-105 (Free Merged Geometries on dispose()): mergeStaticMeshes(root, keep, registerDisposable) disposes temporary cloned geometries immediately after mergeGeometries() and registers every merged BufferGeometry with lab-room.ts's keep list so dispose() frees 100% of geometries created by the room.
* POL-65, POL-66, POL-68, POL-69, POL-121 (Lab Power Wall & Studio Details): Exports POWER_WALL_SHEET07_ORDER and mounts 3 square copper bus bars on the Capacitor Bank (buildCapacitorBusBars); adds front metric-colour status lamp bars (#ff3d8a bench, #b46bff combiner, #7cff4d fabricator) in createRightWallMachineRig; adds transverse ribbed steel treads across all 6 floor cable covers (buildRibbedFloorCoverTreads, 1 merged mesh); mounts caged #ffc13d amber beacon housings on the 4 Relay Cabinets (buildRelayBeaconHousing); and widens LEVER_TRAVEL from 0.25 rad to 0.95 rad (LEVER_REST_TILT = 0.42) inside a raised steel quadrant guide (buildConsoleLeverQuadrant).
* POL-22 (Scientist Low-LOD & First-Person Gate): resolveScientistRenderState and applyScientistWindowFGate in apps/web/src/play/window-f-lab-and-coop-hooks.ts skip drawing the Scientist in first-person unless an alternate camera or shadow pass is active, and disable shadow casting on Low quality.
* POL-111, POL-112, POL-171, POL-172, POL-173 (Co-op Ground, Gate Pad, Lab Presence & Co-Builder Sculpt Sync): Preserves shared terrain constants and rotated Moon Twin Gate footing pad in plot-height.ts / plot-ground.ts; sends Gate pose with seedWorld on host open (POL-171); sends inLab: true, leftPlot: true when entering the Lab so OutpostRoom.ts deletes the stale plot pose and remote-peers.ts hides peers in the Lab (POL-172); and allows both 'owner' and 'cobuilder' roles to broadcast terrain sculpt edits in OutpostRoom.ts (POL-173).
Window F Hook for apps/web/src/play/play-scene.ts:
// ---- Window F (TICKET-19: POL-22 Scientist FP/Low gate & POL-171..173 Co-op sync)
import {
 applyScientistWindowFGate,
 createWindowFCoopSyncController,
} from './window-f-lab-and-coop-hooks';

const windowFCoop = createWindowFCoopSyncController();
// In frame():
applyScientistWindowFGate(scientistRoot, {
 where: currentWhere,
 cameraView,
 quality: currentDetail.quality,
 castShadowInFirstPerson: false,
 altCamActive: altCam !== null,
});
3. Bundle 2 Summary: argo-ticket18-bundle.json (TICKET-18's Rest)
Drive File: argo-ticket18-bundle.json (1tpRiYLEHaHgNpN_Qu8s3m0o0FsgWzL2m)
Unit Tests: packages/hudmath/tests/toast-queue-and-compass.test.ts (4/4 passing)
* POL-35 (Title Cards Hold Every Toast Banner): createToastQueueState, enqueueToast, setTitleCardUp, and tickToastQueue in packages/hudmath/src/toast-queue-and-compass.ts hold every banner kind while titleCardUp (body[data-title-up]) is true and release them in priority+FIFO order once the title card fades.
* POL-44 (Driving Drift Badge, Compass Leak Bearings & 25 m Gate Dome Sync Hide): computeDrivingDriftBadge triggers DRIFT <deg>° when rover speed ≥ 3.5 m/s and slip angle ≥ 12°; computeLeakCompassBearings and CompassRibbon render unsealed S-Space leak ticks (i.hud-compass-leak) alongside the Gate marker; and isInsideGateSafeDome + SyncWord hide the suit sync gauge inside the 25 m Moon Twin Gate dome.
* POL-45 & POL-46 (Responsive Build Drawer & 104 px Bottom Offset): computeBuildDrawerLayout and resolveBuildDrawerStyle cap the Build Drawer width at calc(100vw - 496px) (528 px at 1024 px viewport width with horizontal card scrolling, clearing both 200 px side stacks) and keep bottom: 104px to clear the 76 px hotbar at bottom 24 px.
4. Bundle 3 Summary: argo-ticket21-bundle.json (TICKET-21)
Drive File: argo-ticket21-bundle.json (1Pom0w6uK-iP6N5FVAfRdAk3X52d5Gzge)
Unit Tests: packages/anim/tests/ticket21-avatar-and-beam-hybrids.test.ts (4/4 passing)
* POL-12 (Universal .glb / .vrm Avatar Drag & Drop): packages/anim/src/bone-retarget-map.ts (re-exported by packages/anim/src/index.ts), apps/web/src/avatar/custom-avatar-store.ts, and apps/web/src/avatar/avatar-dock.tsx add drag-and-drop and file-picker import for any .glb or .vrm avatar, retarget VRM 0.x/1.0, Mixamo, and Blender humanoid rigs to @hm/anim's 6 bones with rest-pose Euler delta preservation, persist in IndexedDB (hm.setmix.customAvatars), and keep the Hazmat Scientist as the default avatar.
* Workshop Local Vehicle Reskin (apps/web/src/studio/workshop-vehicle-reskin.tsx): Lives inside The Studio under "Workshop // Vehicle Skins (Local)" (and accessible from the Vehicle Fabricator inspector), persisting local rover liveries in localStorage (hm.setmix.vehicleSkins.v1).
* P2-VEH-06 (Beam Rifle Hybrid Cartridge Modes): packages/beamkit/src/hybrid-cartridge-modes.ts and apps/web/src/play/beam-tool.ts upgrade strokeOf() when a spliced Weapon+Tool cartridge is slotted into the Beam Rifle, unlocking Scatter Excavator (hybrid:scatter-excavator: 1.85× radius wide-cone carve at 1.65× strength) and Color Spewer (hybrid:color-spewer / color-spewer:<preset>: 2.2× radius rapid terrain paint at 2.4× strength).