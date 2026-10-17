# ARGO_NOTE_09: TICKET-06 model brief, the sheet 07 breaker panel and operator console

> Exported by Opus from Argo's Google Doc (Drive ID `1TKI6tEbUJ4BiZLgJ_th89e6_jTkFsyaGDIBJMpleH0w`), 2026-10-17. Argo's words, reformatted as Markdown.

**Author:** Argo (creative lead and PM). **Target:** Opus (the generator batch and the `LAB_GEN_ASSETS` integration). **Reference art:** `docs/concept/setmix/07-sheet-lab-power-and-machines.png` (the upper power chain).

**Hard rules enforced:**
- square box-section geometry (rule 11);
- nothing floats: grounded on legs or a bolted base (rule 10);
- every hard moving or interactive part is its own standalone object, pivoted in code (rule 16);
- zero lettering, numbers or text anywhere on the art (rule 12);
- GTX 950M triangle budgets (low, mid, high).

## 1. Why the current models are replaced (LAB-07 and LAB-08)
- **`breaker-panel` and `breaker-handle` (LAB-07).**
  - **Now:** the generated `breaker-panel.glb` mounts six oversized pale-grey protruding blocks (`BREAKER_HANDLES`) that read like six pet flaps.
  - **Missing, from sheet 07's industrial cabinet:** louvred left and right doors, two circular dial gauges at the upper right, three small sub-breaker toggles at mid-left, and a single yellow-and-black hazard-striped rotary isolator switch on the right.
- **`operator-console` and `console-lever` (LAB-08).**
  - **Now:** the generated `operator-console.glb` is a narrow beige box with a tiny green square and an oversized floating side arm.
  - **Missing, from sheet 07:**
    - the central bolted pedestal;
    - a wide cantilevered lower deck with a yellow-and-black hazard front lip;
    - a sloped three-bay instrument hood (left analog gauges, a centre oscilloscope waveform CRT, a right tactile keypad);
    - three deck push-buttons;
    - the twin-arm red throw lever, mounted cleanly on the right of the lower deck.

## 2. Asset set A: the breaker panel (`breaker-panel` plus two hard-part assets)
All coordinates are in the parent `breaker-panel` frame: +X right, +Y up from the floor (y = 0), +Z forward into the room.

| Asset id (`LAB_GEN_ASSETS`) | Class | Target size [W, H, D] (m) | Triangle budget [low, mid, high] | Role and pivot |
|---|---|---|---|---|
| `breaker-panel` | lab | [1.20, 2.10, 0.55] | [900, 2800, 7500] | The static cabinet body, standing on two square steel channel legs (y = 0 to 0.22 m). Origin at the bottom centre (0, 0, 0). |
| `breaker-handle` | moving part | [0.24, 0.07, 0.08] | [180, 500, 1400] | The main safety-red rotary disconnect blade handle. Pivot at the hub centre (0, 0, 0); placed at socket (0.22, 1.12, 0.295). Rotates −90° to 0° around Z. |
| `breaker-sub-toggle` | moving part | [0.04, 0.09, 0.06] | [120, 320, 800] | A small gunmetal bat-handle sub-breaker toggle, instanced three times at x = −0.38, −0.28 and −0.18 (y = 1.36, z = 0.285). Pivot at the base (0, 0, 0); rotates around X. |

### 2.1 `breaker-panel` geometry and surface (zero lettering)
- **Support legs (y = 0.00 to 0.22 m):**
  - two square-section dark-steel (`#22262a`) box legs (0.10 × 0.22 × 0.48 m) at x = ±0.48 m;
  - bolted floor footplates (0.16 × 0.02 × 0.52 m);
  - a clear 0.84 m under-cabinet pass-through for the ribbed steel floor conduit.
- **Main enclosure (y = 0.22 to 2.04 m):**
  - a square-section painted industrial steel (`#8c949c`) cabinet (1.20 × 1.82 × 0.55 m);
  - a vertical centre seam dividing the left and right door panels;
  - four dark-steel barrel hinges along the outer stiles;
  - a recessed key-latch plate at (−0.52, 1.12, 0.278).
- **Louvre vent banks:** four recessed banks of six horizontal angled louvre slots (0.34 × 0.22 m per bank), at top left (−0.30, 1.74), bottom left (−0.30, 0.56), top right (0.26, 1.74) and bottom right (0.26, 0.56).
- **Upper-right dual analog gauges (y = 1.42 m, z = +0.28 m):**
  - two recessed dark-steel square-rimmed dial bezels (0.16 × 0.16 × 0.025 m), at x = +0.12 m and +0.34 m;
  - pale off-white dial faces, radial tick marks and dark needle pointers, with no numbers or letters.
- **Centre-right hazard rotary isolator bay (x = +0.22 m, y = 1.12 m, z = +0.28 m):**
  - a 0.28 × 0.28 × 0.018 m bevelled square mounting plate painted in diagonal yellow-and-black hazard stripes (`#f2b90c` / `#181a1c`);
  - a central dark-steel octagonal spindle boss (0.08 × 0.08 × 0.02 m) that receives `breaker-handle`.
- **Top cable gland collar (y = 2.04 to 2.10 m):** four copper or gunmetal square-flanged cable glands along the roof (x = −0.36, −0.12, +0.12 and +0.36; z = 0), where the vertical conduit drops from the ceiling tray end.

## 3. Asset set B: the operator console (`operator-console` plus three hard-part assets)
All coordinates are in the parent `operator-console` frame: +X right, +Y up from the floor (y = 0), +Z forward toward the operator.

| Asset id (`LAB_GEN_ASSETS`) | Class | Target size [W, H, D] (m) | Triangle budget [low, mid, high] | Role and pivot |
|---|---|---|---|---|
| `operator-console` | lab | [1.20, 1.32, 0.82] | [1100, 3200, 8500] | The static pedestal, the cantilevered hazard-lip desk and the sloped three-bay upper instrument hood. Origin at the bottom centre (0, 0, 0). |
| `console-lever` | moving part | [0.14, 0.34, 0.12] | [200, 550, 1500] | A twin-arm brushed-steel throw lever with a safety-red horizontal T-grip. Pivot at the bottom axle (0, 0, 0); placed at socket (0.36, 0.96, 0.18). Rotates around X. |
| `console-button` | moving part | [0.055, 0.035, 0.055] | [90, 240, 600] | A square-bezel tactile push-button plunger, instanced three times on the lower deck at x = −0.42, −0.28 and −0.14 (y = 0.94, z = 0.22). |
| `console-keypad` | moving part | [0.18, 0.18, 0.03] | [180, 480, 1200] | A 4 × 4 raised square-keycap tactile pad (no numbers or letters), mounted in the right upper hood bay at (0.36, 1.12, 0.08), tilted −25° on X. |

### 3.1 `operator-console` geometry and surface (zero lettering)
- **Floor base and pedestal column (y = 0.00 to 0.78 m):**
  - a floor flange (0.78 × 0.06 × 0.58 m, `#22262a`) with six corner hex anchor bolts, and a left-side copper cable gland (−0.39, 0.14, 0) receiving the floor conduit cover;
  - a central square-section painted steel pedestal (0.64 × 0.72 × 0.46 m, `#8c949c`) with a recessed front service hatch (0.46 × 0.52 m) and four corner bolts.
- **Cantilevered lower control deck (y = 0.78 to 0.94 m):**
  - a wide horizontal desk (1.20 × 0.16 × 0.82 m), overhanging the pedestal symmetrically by 0.28 m on each side;
  - on the front vertical edge (z = +0.41 m), a continuous yellow-and-black diagonal hazard stripe band (1.18 × 0.05 m);
  - on the right of the deck (x = +0.36 m, y = 0.94 m, z = +0.18 m), a raised dark-steel slotted throw-lever guide box (0.14 × 0.06 × 0.22 m) that receives `console-lever`;
  - on the centre-left of the deck (y = 0.94 m, z = +0.22 m), three recessed socket collars at x = −0.42, −0.28 and −0.14 for `console-button`, plus a recessed green backlit status bar (0.14 × 0.06 m) at x = +0.06 m.
- **Sloped upper instrument hood (y = 0.94 to 1.32 m, tilted −25° on X):**
  - **left bay (x = −0.48 to −0.18 m):** two upper analog dial gauges (Ø 0.11 m) above two lower rotary trim knobs (Ø 0.05 m), with pure tick and needle geometry (no text);
  - **centre bay (x = −0.14 to +0.20 m):** a deeply recessed dark-steel monitor shroud (0.32 × 0.24 × 0.04 m) framing the phosphor-green oscilloscope CRT screen (a `#2bff88` waveform trace over a dark `#061a0e` grid);
  - **right bay (x = +0.24 to +0.48 m):** a recessed mounting pocket (0.20 × 0.20 m) that receives `console-keypad`, flanked on the left by four vertical status LED lenses (green, green, amber, red).
