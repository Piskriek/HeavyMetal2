# A screenshot tour of the game as it is (13 October 2026)

These are taken by the automated tests, so some show test overlays: the "Click to look around" pointer-lock prompt, the radio subtitles and the hotbar. They show the real current state, rough spots included. Older reviewed shots are in [`docs/shots/`](../shots/) (window, base, lab, rovers, assets, monsters). The concept art they aim at is in [`docs/concept/setmix/`](../concept/setmix/).

| Shot | What it shows | Notes from Opus |
|---|---|---|
| [01 main menu](tour/01-main-menu.jpg) | The title screen: Expedition, Planetary Grid, The Studio, The Workshop, Community Nexus, Settings, beside a telemetry column. | A list of text. No hero image or mood, and odd copy ("Growing the trees"). |
| [02 the lab, Act I wake](tour/02-lab-act1-wake.jpg) | You wake in the shielded lab. The alert title shows, and Dr. Haddy's first line. | The lab redesign (concept sheet 21) is only partly realised. |
| [03 the power wall](tour/03-lab-power-wall.jpg) | Capacitors, breaker and relays: "power runs left to right". | It reads as a row of cabinets, with no drama or light. |
| [04 power on](tour/04-lab-power-on.jpg) | The lab after power-up. | The lighting change is modest. |
| [05 the window view](tour/05-window-view-storm-and-breach.jpg) | The wasteland outside: the Breach (a cyan glitch-sliced column), floating fidelity pockets, ruins. | Built as a 3D scene drawn through the window; it costs 1.5 ms on the GTX 950M. |
| [06 the gate opens](tour/06-gate-open.jpg) | The gate, with the stage-0 Moon in 1-bit dither through it. | The gate's opening should be a set piece. |
| [07 the Moon at stage 0](tour/07-moon-stage0.jpg) | Arrival: the 1-bit world, "I've dropped you a shelter". | The HUD fights itself: a big title, a "CANNOT PLACE" build readout and a subtitle overlap. |
| [08 the first machine](tour/08-first-machine.jpg) | The first texture mill, its pink pixel plume rising. | The plume reads. The machine and the readout clutter don't. |
| [09 the build menu](tour/09-build-menu.jpg) | B opens Machines, Structures, Heavy and Plans; the foundation ghost shows. | The design language is decent, but it covers the view. |
| [10 a foundation placed](tour/10-foundation-placed.jpg) | A placed foundation at a later stage. | A flat red slab with blue rings: a prototype look. |
| [11 the inventory](tour/11-inventory.jpg) | The suit rig, the weapon loadout and the cargo grid. | Clean, but generic. |
| [12 driving the rover](tour/12-rover-driving.jpg) | The scout in motion. | The camera clips into geometry, and the vehicle camera needs work. |
| [13 the beam, first person](tour/13-beam-first-person-apply-paint.jpg) | The rifle-shaped extraction beam in Apply mode, with a painted patch of ground. | The prop reads, but it is dark. |
| [14 the beam, third person](tour/14-beam-third-person.jpg) | The player character holding the beam. | Fixed on 13 October: the suit reads (it takes the lab's reflection, metal capped), and the rifle clips are retargeted onto Astro's rig. Still open: the left hand aims at the foregrip but isn't IK-placed. |
| [15 the Studio](tour/15-studio-editor.jpg) | The owner's editor: the content browser, gizmo viewport, details, and Changes with Accept. | The shell and asset bench were finished on 13 October. |
| [16 the Studio's asset bench](tour/16-studio-asset-levels.jpg) | One model at Low, Mid and High side by side, with the redo panel. | Used to touch up and redo the generated models. |
| [17 monsters, batch 1](tour/17-monsters-batch1.jpg) | Freedoom sprites and Quaternius 3D monsters, packed by archetype. | Not in the game yet (TASK-23b). The tonal clash between gory Doom-era sprites and cute low-poly is open for your direction. |
| [18 monsters, batch 3](tour/18-monsters-batch3.jpg) | Blasphemer, Freedoom and LibreQuake monsters. | Three eras: sprite, early 3D, modern. |
