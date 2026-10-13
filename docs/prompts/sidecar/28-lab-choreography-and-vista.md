# TASK-28: the lab's dark wake and power-on, the gate's ignition, the power wall, the live main menu (Wave C)

After Wave B. The sources:
- Argo's `14-lighting.md` (P0-LIGHT-03);
- `12-first-hour.md` (P1-HOUR-03);
- `13-layouts-and-lab.md` (P0-LAYOUT-02);
- `16-ui-ux.md` (P1-UI-04, with its owner decision: the menu's gate shows the lush stage-4 hero vista);
- his reply `ARGO_MASTER_PLAN_REPLY.md` §3, brief 28. It wins where it differs: **P0-LAYOUT-03, the window vista, is done** (TASK-19), so skip it, apart from POL-25. The gate's ignition is **3.5 s**, bottom to top.

The research (Portal 2's and Control's lab staging, Dead Space's light as story) is in the plans' §3. The lab follows concept sheet 21 (`docs/concept/setmix/21-sheet-the-lab.png`, panels in `panels/21/`), and the power wall `07-sheet-lab-power-and-machines.png`.

**The owner's rules for the lab:**
- cables only in trays or floor covers;
- square sections;
- nothing floats;
- no lettering;
- no unrequested centrepieces.

## Where it lives
- **The first-hour lab:** `apps/web/src/play/lab-room.ts` (sheet 21) and its power choreography `powerAt(t)`. It already runs 6.5 s: relays click on in a row, power runs along the floor to the gate, the coils light bottom to top while the lights dip, the static resolves, the lights recover. `POWER_OFF` already has `emergency: 1`.
- **The scene:** `apps/web/src/play/play-scene.ts`.
- **The window:** `apps/web/src/play/lab-vista.ts`. Its bursts are `burstSchedule` in `lab-vista-math.ts`.
- **The main menu:** `apps/web/src/shell/goblin-front.tsx` (the `.sm-menu` buttons) inside `shell.tsx`.
- **Not `apps/web/src/lab/lab-scene.ts`,** which the plans name. That is the older lab screen; check it is not the one the first hour uses before touching it.

## Build
1. **The dark wake (P0-LIGHT-03, the cold state).** Before power:
   - the ambient drops to about 0.08, cold blue-grey (#1a2433);
   - a red emergency strobe (#ff2a1a, 1.2 Hz) sweeps the power wall;
   - the breaker handle glows red;
   - the window's cyan storm glow leaks across the floor.
   
   **POL-25:** each window burst flashes on the lab floor, timed from the same `burstSchedule`.
2. **The power-on (P0-LIGHT-03, extending `powerAt`):**
   - three banks of cold-white strip lights (#eef4ff) ignite back to front over 1.8 s;
   - the relay cabinets' amber beacons (#ffc13d) light;
   - the planet table's hologram comes up;
   - the machines' emissives turn on in their metric colours (preset bench #ff3d8a, combiner #b46bff, fabricator #7cff4d), as `docs/concept/setmix/02-gate-power-on.png` shows.
   
   Keep the dip while the gate draws. All of it is a pure function of t in `powerAt`, so it stays testable.
3. **The wake camera and the gate's ignition (P1-HOUR-03):**
   - **The wake:** the camera starts pitched about 65° up at the dark ceiling under the strobe, and eases to level over 2.2 s as the player sits up. Dr. Haddy's first line keeps its place (the subtitle zone from TASK-25).
   - **The ignition:** when the lever is pulled, the gate's coil blocks light bottom to top over **3.5 s**, with a rising capacitor-charge pitch, and end in an amber arc flash that reveals the stage-0 Moon in the opening. Use the existing coil uniforms. The sound is TASK-29's procedural set if it has landed, otherwise a short approved SFX.
4. **The power wall (P0-LAYOUT-02):**
   - the wall reads left to right as sheet 07 shows;
   - square copper bus bars on the capacitor bank (each its own object, mounted);
   - rotating or pulsing amber beacons on the four relay cabinets;
   - ribbed steel floor covers carrying the cables from the relays to the gate plinth and the operator console.
   
   The clutter props are TASK-23c's; don't move them.
5. **The live main menu (P1-UI-04, POL-01):**
   - behind the menu, the real lab, rendered live and lit as after power-on;
   - the window glitching with the vista;
   - the gate on the right showing the **stage-4 hero vista** (the owner's decision: "a gateway on the right showing the planet in all its glory after terraforming", OWNER_ASKS 2026-10-06);
   - the menu buttons stay on a glass blade on the left.
   
   The loading text names real steps ("Compiling shaders", "Loading the lab", "Calibrating the bridge array"), never the old "Growing the trees". Preload behind the loading bar (rule 22), and keep the menu within the frame budget on Low (drop the vista's pockets first if needed). Load the frontend-design skill for the blade.

## Tests
- **Unit:** `powerAt` (the cold state at 0, the strip banks in order, the beacons, the ignition's 3.5 s bottom-to-top order, POWER_ON at the end) and the burst-to-floor-flash timing.
- **Extend `scripts/test-campaign.mjs`:**
  - the wake's camera pitch eases to level;
  - the lab's mean luminance before power is well below after;
  - the coils light in order.
- **The menu:** the lab renders behind the menu; the gate shows the hero vista; fps on Low at the menu.
- **Shots** (`?cleanShot=1`):
  - the dark wake (tour shot 02's moment);
  - mid-power-on;
  - powered (04);
  - the power wall (03);
  - the ignition's flash;
  - the menu (01).
  
  Look at every one.
- **The usual green set,** with the build size.

## Report
On the board:
- before and after of tour shots 01 to 04 and 06;
- fps at the menu and in the lab on Low;
- the results.

Opus refreshes Argo's tour.
