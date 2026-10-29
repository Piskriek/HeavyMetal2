# Plasma: the first mimic session (29 Oct)

The owner's live session, for Plan 57's bottom-up pass (the owner's and Argon's dispatch, 29 Oct): Plasma's parts, joints and
Sketch logic first, then its interface as `ui:` panels, before ships (KSP, Space Engineers) and settlements (Dwarf Fortress,
Satisfactory). The rules stay as in `MIMIC_GAMES_RESEARCH.md` §0: read-only, the owner's licensed copy, numbers and structure
only. No assets, names or code cross, and Plasma has no anti-cheat on disk.

## What was captured

- **Frames:** the linked window, saved by the drone's eyes every 3 s and kept by a watcher (`shots-run/plasma/`).
  - From the rebuild on 29 Oct, a linked window's frames keep their shared size (up to 720p), so interface text reads.
  - The drone's own view stays at 640×360.
- **The parts library:**
  - tabs: Basic, Structures, Mechanic, Behaviour, Decorative, All, and a search box;
  - 173 distinct parts in 196 cells; some names repeat as variants (four disks, ten hull parts, ten plates);
  - number keys 1–8 assign a highlighted part to the hotbar, and right-clicking shows an info card (mass, an id, what it does).
- **Saving:**
  - aiming at a device, F6 (or Properties → Save Device) saves that device;
  - F8 saves the world.
- **The owner's world** (a Workshop Mars world with a house, plus one of each part placed): 198 devices, 258 parts, 2 Sketch graphs.

## The parts, grouped by what they do (in our own words)

| Group | What is there |
| --- | --- |
| Drives and joints | motor, raw motor, servo, raw servo, raw hinge, single-axis joint, piston, frontal and lateral extenders, shock absorber, slider rail, wheel, ball wheel, gyroscope, gravity controller, magnet, thruster, fan, elevator, conveyor |
| Inputs | button (round, square, triangle), switch, power switch, lever, knob, keypad, keyboard, joystick, gamepad interface, touchscreen, NFC tag and interface |
| Sensors | accelerometer, distance, light, colour, impact, proximity, camera, webcam, GPS tag and tracker |
| Outputs | lamp, LEDs (four shapes), floodlight, spotlight, screens (round, square, wide, LCD, seven-segment, digital gauge, tablet), speaker, emissive label, smoke emitter, colour painter, holo projector |
| Signals and network | antenna, transceiver, communicator, net link, serial port, controller |
| Spawning and special | component spawner, despawner, self-destructor, death ray, plasma cannon, plasma toggler, joiner, separator, docking stations, player connector, drone frame |
| Structure | cube, sphere and its fractions, cylinders, cone, ramps, rods and junctions, flat rods, pipes, plates, panels, adapters, hubs, arches, tubes, wings, doors, rooms, windows, glass parts, wall details |

## The save format (read-only)

- **The files:** saves live in `%USERPROFILE%\AppData\LocalLow\DryLicorice\Plasma\User Data\` (`Worlds\Progress\<id>.world` and
  `.metadata`, `Devices\`). Workshop downloads land in `D:\SteamLibrary\steamapps\workshop\content\1409160\<item>\` in the same
  format.
- **The format** is Odin Serializer's binary layout (open source, Apache 2.0). `scripts/read-odin-save.mjs` reads it into JSON;
  both test files parse to their last byte. `scripts/plasma-save-summary.mjs` summarises a save and dumps a device.
- **A device** holds:
  - its agents, one per part or behaviour: a type id and display name, a port interface (command, property and output ports), and
    its settings as typed values (number, boolean, colour, selection, text, sound);
  - its parts: placement, colours, mass category and multiplier, bounciness, static and dynamic friction, and the attachment tree
    (sockets, offsets, reference frames);
  - its mechanic state: joint articulations with their axes.
- **A Sketch graph** (in a processor agent):
  - nodes, which are parts and logic operators by type id, each at a position on the canvas;
  - connections from an output node and port to an input node and port, with priorities;
  - its mapped variables.
- **Not in the save:** the labels of settings and ports (which number is a motor's speed). They live in the game's code, which we
  do not open. A panel on screen shows them in order, so one frame of a part's Properties panel or of a Sketch canvas pairs them
  with the indices the save holds.

## Next session

1. Open the house's Sketch (aim at it, Open Sketch) and hold on the canvas with each node's port labels readable.
2. Open Properties on the Motor, then the Button; hold on each.
3. Subscribe to 6–10 popular working Workshop devices (a vehicle, a keypad door, an elevator, a drone, a crane or turret, a
   computer or display). They are read from the download folder, with no need to open them.
4. Then map what is read onto our presets (Plan 57 §16): parts with sockets, `logic:` nodes and `wiregraph` connections, and the
   palette, canvas and inspector as `ui:` panels, in FIDELITY's own words and look.
