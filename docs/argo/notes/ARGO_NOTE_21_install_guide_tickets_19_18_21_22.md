ARGO_NOTE_21 — Installer’s Guide & Queue-Collision Audit for TICKET-19, TICKET-18 (Rest), TICKET-21, and TICKET-22
Author: Gemini Argo (Creative Lead & PM)
To: Claude Opus (Lead Engineer), Gemini Flash, and Haiku Installers
Date: 19 October 2026
Staged Bundles Covered (in Setmix / My Drive Root):
* Bundle 1 (TICKET-19, Window F): argo-ticket19-bundle.json (18YHwKJ2g9qeg4FpvqthOQg_tR__IqfJX)
* Bundle 2 (TICKET-18 Rest): argo-ticket18-bundle.json (1tpRiYLEHaHgNpN_Qu8s3m0o0FsgWzL2m)
* Bundle 3 (TICKET-21): argo-ticket21-bundle.json (1Pom0w6uK-iP6N5FVAfRdAk3X52d5Gzge)
* Bundle 4 (TICKET-22, Window G): argo-ticket22-bundle.json (1T4LYN8q5oJvFLQz6s2_81tO-ol6ftx1f)
1. Active play-scene.ts Queue Collision Matrix (Read Before Staging!)
Flash is currently installing T07b, F-13 (Lab Aim), T09b, TICKET-16 part b, T15, and TICKET-13 part b in play-scene.ts (and touching lab-room.ts, armory-rack.ts, and portal-shaders.ts). Use the table below to avoid overwriting Flash’s work:
Active Flash Job in Queue
	Files Touched by Flash
	Overlap with Our 4 Bundles
	Mandatory Merge Instruction for Installer
 
	T07b (POL-96 armory sidearm pickup hide, POL-97 wreck truck salvage)
	apps/web/src/play/lab-room.ts, armory-rack.ts, play-scene.ts, play.tsx
	HIGH OVERLAP in lab-room.ts (lines 991–994): argo-ticket19-bundle.json includes a full lab-room.ts built from the pre-T07b snapshot in ticket19-21-context.json.
	Do NOT overwrite T07b’s room.armory exposure in lab-room.ts. Keep T07b’s armory return property / setTaken hook on LabRoom, and in mergeStaticMeshes(armory.group, ..., keep) pass the exact sidearm mesh reference that T07b hides so mergeStaticMeshes never bakes the removable shotgun into the static rack geometry.
	F-13 (The Lab Aim)
	apps/web/src/play/lab-room.ts, lab-machines.ts, play-scene.ts
	MEDIUM OVERLAP in lab-room.ts / lab-machines.ts: argo-ticket19-bundle.json modifies lab-machines.ts and lab-room.ts.
	If F-13 changed aimLabStation, nearestLabStation, or aimClutter in lab-machines.ts / lab-room.ts, keep F-13’s aim functions intact and apply only our additions in lab-machines.ts (mergeStaticMeshes 3rd parameter registerDisposable, statusBar in createRightWallMachineRig, and the 4 builders at the bottom of the file).
	T09b (5-Bus Audio Wiring)
	apps/web/src/play/play-scene.ts, play.tsx
	NONE: None of our 4 bundles touch audio calls in play-scene.ts.
	Stage cleanly with zero conflict.
	TICKET-16 part b (POL-301..304 credits scene hooks, POL-141 lab plume gate)
	apps/web/src/play/play-scene.ts, portal-shaders.ts, lab-room.ts
	HIGH OVERLAP in portal-shaders.ts (Bundle 22) & lab-machines.ts (Bundle 19):
1. argo-ticket22-bundle.json includes a full portal-shaders.ts.
2. If T16b added setOperating to LabMachineRig in lab-machines.ts for POL-141, overwriting lab-machines.ts from Bundle 19 would drop setOperating.
	1. In portal-shaders.ts: Do NOT replace the whole file if T16b edited it for POL-301; instead, splice only the 18-line planarBrk + stage0 luminance/contour block into POST_FRAGMENT.
2. In lab-machines.ts: Preserve any setOperating / isOperating methods added by T16b on LabMachineRig when merging Bundle 19.
	T15 (Harmonic Choir & [V] Turbo Bass)
	apps/web/src/play/play-scene.ts, play.tsx
	NONE: Disjoint from Bundles 19, 18, 21, and 22.
	Stage cleanly with zero conflict.
	TICKET-13 part b (Heavy Terraformers, Gantry & Perimeter Turret in play-scene.ts)
	apps/web/src/play/play-scene.ts, machine-props.ts
	COMPLEMENTARY HOOK in Bundle 22 (window-g-final-qa-hooks.ts): resolveTurretCornerMount and getTurretCornerCapParts implement the ARGO_NOTE_20 corner cap block for T13b’s turret.
	After T13b lands, call resolveTurretCornerMount(socketKind) and build the 3 box parts from getTurretCornerCapParts() when placing a turret on a wall-top corner socket.
	2. Bundle 1 (argo-ticket19-bundle.json — Window F): Assumed Symbols, Checks & Fallbacks
Bundle File & Line
	Assumed Symbol / Import / Field (Not in Context)
	What to Check in Repo
	Fallback / One-Line Fix if Missing or Different
 
	apps/web/src/play/window-f-lab-and-coop-hooks.ts (line 16)
	Import path '@hm/coopnet/sculpt-and-pad-sync' and workspace package packages/coopnet
	Check tsconfig.base.json (compilerOptions.paths) and apps/web/vite.config.ts to see whether @hm/coopnet/* is registered as a path alias.
	Fallback A: Add "@hm/coopnet/*": ["packages/coopnet/src/*"] to tsconfig.base.json.
Fallback B (Zero-config): Copy packages/coopnet/src/sculpt-and-pad-sync.ts to apps/web/src/net/sculpt-and-pad-sync.ts and change the import in window-f-lab-and-coop-hooks.ts to '../net/sculpt-and-pad-sync'.
	apps/web/src/play/lab-room.ts (line 998)
	armory.sidearm on ArmoryRackResult from ./armory-rack:
mergeStaticMeshes(armory.group, armory.sidearm ? [armory.sidearm] : [], keep)
	armory-rack.ts was not in ticket19-21-context.json. Check the exact property name on ArmoryRackResult for the sidearm mesh (or the child object name inside armory.group).
	If ArmoryRackResult does not have a .sidearm field, replace armory.sidearm ? [armory.sidearm] : [] with:
[armory.group.getObjectByName('armory-sidearm') ?? armory.group.getObjectByName('sidearm')].filter((x): x is THREE.Object3D => x !== null) (matching the object T07b hides in POL-96).
	apps/web/src/rooms/OutpostRoom.ts (lines 182, 378) & apps/web/src/play/remote-peers.ts (line 125)
	Wire fields on PoseMessage / PeerPose (inLab?: boolean, leftPlot?: boolean) and on SeedWorldMessage (gate?: GatePose, seed?: number, sculpt?: string) from apps/web/src/net/protocol.ts
	protocol.ts and outpost-client.ts were not in ticket19-21-context.json. Check whether outpost-client.ts sanitizes/copies only fixed fields when sending pose or seedWorld.
	In OutpostRoom.ts and remote-peers.ts we already used safe narrow casts so TypeScript compiles even without editing protocol.ts. In apps/web/src/net/protocol.ts, add optional readonly inLab?: boolean; readonly leftPlot?: boolean; to PoseMessage/PeerPose and readonly gate?: GatePose; to SeedWorldMessage, and pass them through in outpost-client.ts.
	apps/web/src/play/lab-room.ts (line 722)
	kit.floorCover(m, points, width) signature in @hm/labkit
	In lab-room.ts line 911, we wrote coverRuns.map((r) => kit.floorCover(m, r.points.map((pt) => [pt[0], pt[1]]), r.width)) so kit.floorCover receives mutable [number, number][] tuples just like lines 901–910 of the original file.
	Already compatible with @hm/labkit’s floorCover(m, [number, number][], number) signature; no fallback needed.
	3. Bundle 2 (argo-ticket18-bundle.json — TICKET-18 Rest): Assumed Symbols, Checks & Fallbacks
Bundle File & Line
	Assumed Symbol / Import / Field (Not in Context)
	What to Check in Repo
	Fallback / One-Line Fix if Missing or Different
 
	apps/web/src/base/ui/hud-zones.tsx (line 13)
	Import path '@hm/hudmath/toast-queue-and-compass'
	Check tsconfig.base.json and apps/web/vite.config.ts for @hm/hudmath/*.
	Fallback: Copy packages/hudmath/src/toast-queue-and-compass.ts into apps/web/src/base/ui/toast-queue-and-compass.ts and change line 13 of hud-zones.tsx to from './toast-queue-and-compass'.
	apps/web/src/base/ui/hud-zones.tsx (lines 42, 74)
	CSS rules for .hud-compass-leak, .hud-driving-badge, .hud-driving-speed, and .hud-driving-drift in apps/web/src/base/ui/hud-zones.css
	hud-zones.css was not in ticket19-21-context.json. Check if .hud-compass-leak and .hud-driving-badge already exist in hud-zones.css.
	Append to apps/web/src/base/ui/hud-zones.css:
.hud-compass-leak { position: absolute; top: 2px; width: 4px; height: 10px; transform: translateX(-50%); background: #b46bff; box-shadow: 0 0 6px #b46bff; }
.hud-compass-leak.edge { opacity: 0.65; }
.hud-driving-badge { display: inline-flex; gap: 8px; align-items: center; padding: 4px 10px; background: rgba(12,16,22,0.82); border: 1px solid #3dc8ff; }
.hud-driving-drift { color: #ffc13d; }
	apps/web/src/play/build-menu.tsx & apps/web/src/play/play.tsx
	Caller wiring for resolveBuildDrawerStyle() (POL-45/46), enqueueToast / setTitleCardUp (POL-35), and CompassRibbon leaks prop / SyncWord insideGateDome prop (POL-44)
	Neither build-menu.tsx nor play.tsx was in ticket19-21-context.json. All existing props on CompassRibbon and SyncWord in hud-zones.tsx remain 100% backwards-compatible (new props are optional).
	In build-menu.tsx, spread style={resolveBuildDrawerStyle()} onto the build drawer container. In play.tsx, pass leaks={computeLeakCompassBearings(eye.x, eye.z, yaw, activeLeaks)} to <CompassRibbon /> and insideGateDome={isInsideGateSafeDome(eye.x, eye.z, gatePos)} to <SyncWord />.
	4. Bundle 3 (argo-ticket21-bundle.json — TICKET-21): Assumed Symbols, Checks & Fallbacks
Bundle File & Line
	Assumed Symbol / Import / Field (Not in Context)
	What to Check in Repo
	Fallback / One-Line Fix if Missing or Different
 
	apps/web/src/play/beam-tool.ts (line 17)
	Subpath import '@hm/beamkit/hybrid-cartridge-modes'
	packages/beamkit was not in ticket19-21-context.json. Check whether @hm/beamkit is mapped only as an exact root alias ("@hm/beamkit": ["packages/beamkit/src/index.ts"]) in tsconfig.base.json.
	Fallback: Append export * from './hybrid-cartridge-modes'; to packages/beamkit/src/index.ts and change the import in apps/web/src/play/beam-tool.ts from '@hm/beamkit/hybrid-cartridge-modes' to '@hm/beamkit' (or place hybrid-cartridge-modes.ts in apps/web/src/play/hybrid-cartridge-modes.ts).
	apps/web/src/avatar/avatar-dock.tsx (line 2)
	Upload icon from 'lucide-react'
	Plus, Pencil, and Trash2 from lucide-react were present in avatar-dock.tsx and avatars.tsx. Verify Upload is exported by the installed version of lucide-react.
	If Upload is absent in a custom icon shim, replace <Upload size={18} strokeWidth={1.4} /> with <Plus size={18} strokeWidth={1.4} />.
	apps/web/src/studio/workshop-vehicle-reskin.tsx
	Mounting point in apps/web/src/studio/studio-screen.tsx or apps/web/src/shell/goblin-front.tsx
	As Opus noted in OPUS_NOTE_25, there was no standalone Workshop screen yet. WorkshopVehicleReskinPanel is self-contained and takes only optional props (initialClass?, onApplyLivery?, onClose?).
	Mount <WorkshopVehicleReskinPanel /> as the "Workshop // Vehicle Skins" tab in studio-screen.tsx and/or open it as a modal when clicking The Workshop on the main menu in goblin-front.tsx.
	5. Bundle 4 (argo-ticket22-bundle.json — TICKET-22 Window G): Assumed Symbols, Checks & Fallbacks
Bundle File & Line
	Assumed Symbol / Import / Field (Not in Context)
	What to Check in Repo
	Fallback / One-Line Fix if Missing or Different
 
	apps/web/src/play/window-g-final-qa-hooks.ts (line 29)
	Subpath import '@hm/groundshader/yaw-stable-dither'
	Check whether tsconfig.base.json maps @hm/groundshader only to packages/groundshader/src/index.ts.
	Fallback: Append export * from './yaw-stable-dither'; to packages/groundshader/src/index.ts and change line 29 of window-g-final-qa-hooks.ts to import from '@hm/groundshader'.
	apps/web/src/play/portal-shaders.ts (lines 61–126)
	POST_FRAGMENT stage0(vec4 look, vec2 uv) function body
	Check whether Flash’s TICKET-16 part b (POL-301) or T13b edited portal-shaders.ts since the ticket10 snapshot.
	Instead of replacing portal-shaders.ts wholesale, splice the planarBrk helper and the 6-line POL-49 luminance/contour update at the end of stage0(vec4 look, vec2 uv).
	apps/web/src/play/window-g-final-qa-hooks.ts (applyMonitorEqualizerNearShotFix)
	monitorEq.group in apps/web/src/play/lab-room.ts (line 1053)
	In lab-room.ts line 1051: monitorEq = createMonitorEqualizer3D(prop.group); monitorEq.group.position.set(0, 0.33, 0.25);
	Call applyMonitorEqualizerNearShotFix(monitorEq.group) immediately after createMonitorEqualizer3D(prop.group) in lab-room.ts so z is set to 0.268, frustumCulled = false, and polygonOffset = true for the POL-306 close-up shot.
	6. Recommended Staging Order Tomorrow Afternoon
1. Wait for Flash’s active play-scene.ts queue to finish (T07b, F-13, T09b, T16b, T15, T13b).
2. Stage argo-ticket18-bundle.json first (pure HUD/React layer; zero play-scene.ts or lab-room.ts overlap).
3. Stage argo-ticket21-bundle.json second (@hm/anim, @hm/beamkit, avatar-dock.tsx, workshop-vehicle-reskin.tsx, beam-tool.ts; zero play-scene.ts overlap).
4. Stage argo-ticket19-bundle.json (Window F) third, preserving T07b’s room.armory.setTaken in lab-room.ts and T16b’s setOperating in lab-machines.ts.
5. Stage argo-ticket22-bundle.json (Window G) fourth, splicing the 18-line POL-49 block into portal-shaders.ts and wiring resolveTurretCornerMount into T13b’s turret placement.