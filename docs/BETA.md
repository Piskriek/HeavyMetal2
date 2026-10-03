# SetMix beta: how to test it, and how to build the maps

For the owner's beta pass (2026-10-03: "get it all the way to beta test version so i can build the maps, and tweak it a bit"). What works, how to do the main things, what is not built yet. `MASTER_PLAN.md` has the whole map; `STATUS.md` every ask.

## Run it

| How | Command | Open |
|---|---|---|
| While working on it (changes show at once) | `npm run dev` | the address it prints (localhost) |
| The real build, as players get it | `npm run host` | http://localhost:8080, or the PC's address from another machine |

Graphics: Settings, Graphics. **Potato** is the lightest, **Auto** aims for the frame rate you pick (15, 30 or 60). On this laptop Auto starts on Low.

## The main things

**Build the Goblin Racing island (the map everyone races on)**
1. Home, Goblin Racing's window, **Race modes**, **Track editor**, **Open the track editor**. It opens the Goblin Racing island itself.
2. Shape it: the left rail has the tools (track, sculpt, paint, place, dress with plants, lighting); the top bar has Undo/Redo and the lighting looks. It saves itself a moment after every change.
3. **Test drive** races on it straight away; Esc in the race, Quit, comes back to the editor.
4. **Back to Goblin Racing** (top left, or Esc, menu) leaves; the island in Goblin Racing's window on the home is the one you built.
5. **Make it the island everyone starts with**: in the track editor press **Map code** (top bar), then **Copy my map code**, and send me the code (it starts with `HM1.`). It goes into `apps/web/src/maker/official-racing.ts`; every player without a Goblin Racing island of their own starts on yours. Send a new code any time for a new version.

**Your own islands**
- Home, **My planet**: every island drawn from above. **Go in** walks it; **New island** offers Quick setup (ready-made islands), a Setup wizard (size, ground, plants, a race track, a name, the map redrawing as you answer) or Manual (a plain island, opened at once).
- On an island: F1 to F10 pick what you hold (Select, Paint, Sculpt, Animate, Sound, Lights, Activities, Avatar, Things, Camera); 1 to 9 the slot; E every preset with Edit on each; B studio mode (fly, every setting in a window); V first or third person; Esc closes one thing at a time, then the menu.
- **Carry on at ...** under My planet on the home goes straight back to the island you were last on.

**Avatars**
- On an island press **P**: the camera turns to face your avatar. Your characters are in a row (one click swaps), **New avatar** makes one (Quick, Wizard, Manual), and below are this one's Looks, Colours, Wears, Moves. Right-drag turns you round, the wheel zooms, Esc or Done goes back.
- Home, **Avatars** does the same from the menu.
- In Goblin Racing your goblin rides inside your ball; the racer you pick is the ball (its weight, speed and bounce).

**Settings** are the same everywhere (home, Goblin Racing, the island's Esc menu, a paused race): Graphics, Sound, Controls, Racing, You.

## Not built yet (so nobody is surprised)

- Online play: Community and shares stay on this device; Multiplayer comes back when online play exists (until then Goblin Racing has Race modes).
- The weekly island vote (H7): your track-editor island is the official one for now; submitting and voting come later.
- The universe (H8): stars, solar systems, friends moving in, flying a rocket to the goblin world (H9). Planned in `MASTER_PLAN.md`.
- Activities you make are copies of Goblin Racing on the same island.
- The track editor and the race screens still have their older look in places.

## When something is wrong

Tell me the screen, what you pressed, and what happened (a screenshot helps). After any change, `npm run ui-map` (with `E2E_GPU=1 E2E_SLOW=2` on this laptop) presses every button on every screen and writes `ui-map/index.html` with a picture of each; `npm run e2e` walks the main journeys.
