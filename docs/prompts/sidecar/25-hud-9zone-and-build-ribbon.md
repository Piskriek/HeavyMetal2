# TASK-25: the HUD in nine zones, the build ribbon, labels on aim, the hologram lock (Wave B)

After `main` (Wave A). The source is Argo's UI plan, `docs/argo/plans/16-ui-ux.md` (P0-UI-01, P0-UI-02, P0-UI-03, and P2-UI-06, which his reply promotes), plus P0-HOUR-02 from `12-first-hour.md`, with the adjustments in `docs/argo/plans/ARGO_MASTER_PLAN_REPLY.md` §2 and §3 (brief 25). Where they differ, the reply wins. The research behind it (Dead Space's diegetic rig, Satisfactory's build drawer and hologram lock, Subnautica's and The Planet Crafter's corner telemetry) is in the plan's §3.

**Already done in TASK-24:**
- the radio subtitle sits above the hotbar;
- CANNOT PLACE shows only while placing;
- title cards are queued;
- the `data-hud-zone` overlap assertion.

Keep that assertion green and widen it (see Tests).

**Load the frontend-design skill first.** Use the telemetry design system (`docs/UI_DESIGN_SYSTEM_AND_TOKENS.md`: Oxanium and Inter, dark glass, the metric colours #ff3d8a, #7cff4d, #ffc13d, #3dc8ff, #b46bff). No unstyled DOM.

## Where the HUD is today
- **The in-game HUD is `apps/web/src/play/play.tsx`** (about 3,000 lines):
  - the quest panel;
  - the sync bar;
  - the comms and branch chips;
  - the radio subtitle ("DR. HADDY // FIELD RADIO", about line 3150);
  - toasts and title cards (`say()`, about line 346);
  - the ore, power and four-float panel;
  - the beam-mode and ammo pills.
- **`apps/web/src/base/ui/`:**
  - `base-hud.tsx` (the build menu and the build readout gating);
  - `build-readout.tsx`;
  - `hotbar.tsx` (9 slots; leave its design alone);
  - the modal windows.
- **There is no `shell/hud.tsx`** (the plan names one). `@hm/hudlayout` is the old race HUD editor's data model; reuse its `Anchor` type if it helps, nothing more.

## Build
1. **The zones (P0-UI-01):**
   - **A small zone module** (`apps/web/src/base/ui/hud-zones.tsx`, with the pure queue logic in its own `.ts`): nine fixed regions, a way to mount an overlay into one, and a queue for the transient slots (title cards, toasts, prompts): one at a time per slot, and a title card holds the other banners for its 3 s.
   - **Every overlay** carries `data-hud-zone`. First inventory every overlay in `play.tsx` and `base/ui`, with a shot of each state, then move each into its zone.
   - **Modals** (inventory, fabricator, weapon bench, drafting, refinery, lattice, machine picker, journal) stay full-screen: they dim the world and own the screen.

   | Zone | Owner |
   |---|---|
   | Top-left | The quest step: title, one or two sentences, the key hint. Dr. Haddy's portrait slides in only while she speaks. |
   | Top-centre | A compass ribbon: bearing to the gate, and to leaks once TASK-23b-2 has them. Beside it, the sync state word (SYNC: STABLE or DRAINING). Title cards drop below it at top 72 px for 3 s. |
   | Top-right | The four floats as one compact four-bar pill in the metric colours, the stage badge **S0 to S6** (reply O1; never S0 to S4), the branch chip and comms. |
   | Centre | The reticle and its clear zone (48 px), the raycast prompt ("Hold E: gather ore"), and CANNOT PLACE 36 px below the reticle while a ghost shows. |
   | Bottom-centre, upper | The radio subtitle: bottom 108 px, never above 160 px. |
   | Bottom-centre, lower | The hotbar, and the build ribbon above it (item 2). |
   | Bottom-left | The suit's sync gauge (what the top-centre sync bar shows today); hidden at full sync in the lab and inside the gate's safe dome. When driving: speed and drift. |
   | Bottom-right | The tool: beam mode and loaded cartridge, gun ammo, and the resource ticker with linked-bin counts ("Ore 24 (+140)", dirt, power kW), plus pickup toasts. |
   
   - **The DRAWS badge** is debug. It shows only with Show performance stats on, and outside the zones.
2. **The build ribbon (P0-UI-02):**
   - B opens a glass drawer docked above the hotbar: bottom 92 px, at most 136 px tall and 820 px wide.
   - It holds Machines, Structures, Heavy and Plans as card tabs, and a key strip: **[R] rotate, [H] lock the hologram, [F] fill a plan, [X] remove, [RMB or Esc] cancel.** These are the reply's keys: F stays Fill Plan, X stays Remove.
   - Picking a card collapses the drawer to a small header pill, so the centre stays clear while placing. Today's centred build window goes away.
3. **Labels on aim (P0-UI-03):**
   - A machine's floating label shows only within 14 m **and** 8° of the crosshair, or while Alt is held (the tactical view).
   - Otherwise the machine shows its state on a small **square emissive LED on its housing**: green running, amber blinking for no ore or a brownout, red unpowered. It sits on the surface, never floating.
4. **The arrival's order (P0-HOUR-02, in the master plan's §0 for this brief):** on the first Moon arrival, Dr. Haddy's line waits until the "STAGE 0" title card has faded (about 2 s), so the title and the subtitle never compete. The queue in item 1 should give you this for free; test it.
5. **The hologram lock (P2-UI-06, promoted to this brief by the reply):**
   - H freezes the ghost where it is, so you can walk round it.
   - The arrow keys nudge it 0.5 m, and the rotate key still turns it.
   - Left click commits it through the normal placement checks; H again or Esc releases it.
   - H is free today. Check nothing else claims it.

## Tests
- **Unit:** the zone queue (one per slot, a title holds the rest, expiry, order).
- **The overlap assertion,** in `scripts/test-campaign.mjs` and `test-base-building.mjs`: zero overlap between **every pair** of zone boxes at every shot, and no zone element inside the reticle's 48 px clear zone.
- **The ribbon:** B opens it, a card collapses it, and the ghost is visible with the centre 60% of the screen free of HUD boxes.
- **The labels:** hidden at 20 m, shown when aimed within 14 m, all shown with Alt.
- **The lock:** H, then nudge, then commit places the piece at the nudged spot; an invalid spot is refused with the usual reason.
- **Clean shots** (`?cleanShot=1`) of:
  - the Moon arrival (the moment of tour shot 07);
  - the ribbon with a ghost;
  - a machine aimed at and not;
  - the hologram lock;
  - driving;
  - a fight once monsters are in.
  
  Look at every one.
- **The usual green set:** typecheck, `npm test`, build (report the size), e2e, test-base-building, test-campaign.

## Report
On the board:
- the overlay inventory and where each went;
- before and after shots of tour shots 07, 08 and 09;
- the results;
- anything the zones could not hold.

Opus refreshes Argo's tour from your shots.
