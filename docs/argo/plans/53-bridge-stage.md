# Plan 53: The Bridge Stage. Bridge everything that can cross, stand in FIDELITY presets for the rest

> Owner, 28 Oct 2026: "let's have the game take you into an empty scene when you bridge without saying what you want to bridge, and in the empty scene it bridges everything it can bridge and replaces what it can't with presets from fidelity."

## 0. The category (standing rule 6)
- **"Bridge" with nothing named** means any bare bridge order ("bridge", "bridge this game", "hook into the game I'm playing"). It takes the player to a staging space and bridges the game running on the PC. A named game ("bridge counter strike") still bridges in place.
- **"Everything it can bridge"** means every stream class and rung the game's profile allows:
  - its mechanics: movement, fire, trigger rules, motion, the harness;
  - its live state as numbers on FIDELITY's HUD (health, ammo, round);
  - its own picture, streamed onto a screen in the scene. That is local and never saved, so it is streaming, not copying.
- **"Replaces what it can't"** means every aspect that cannot cross, or that nobody has measured yet. Each gets a FIDELITY preset stand-in:
  - the game's models, weapons, enemies, map, sound and names (its assets: Rule 18);
  - mechanics no rung measured (CS2 sends no position, so no gravity is measured).

## 1. Research
- **Freedoom** is the precedent. It is free, BSD-licensed replacement data for the Doom engine, so Doom-engine games run with no original IWAD: the rules run and the assets are stand-ins ([doomwiki](https://doomwiki.org/wiki/FreeDoom), [SlackBuilds](https://slackbuilds.org/repository/15.0/games/freedoom/)). LibreQuake does the same for Quake. Both are already allowed by Rule 18.
- **Documented mechanics are a third source** besides measured and stand-in: published constants are facts.
  - CS2's `sv_gravity` defaults to 800 units/s² ([csdb](https://csdb.gg/commands/sv_gravity), [totalcsgo](https://totalcsgo.com/commands/svgravity)). That is 20.3 m/s² at the engine's inch scale.
  - `sv_maxspeed` 320 is only a cap: real speed depends on the weapon ([csdb](https://csdb.gg/command/sv-maxspeed/)).
  - No source confirmed the jump impulse, so it is not used.
- **The live CS2 run on this PC** (28 Oct):
  - GSI sends weapons, `ammo_clip`, `state: active`, `round.phase`, health, flashed and kills while you play.
  - It sends **no `player.position`**.
  - Its round, bomb, death and health events drove FIDELITY's reflex slot live.

## 2. Decisions
1. **The stage is a pad on an empty stretch of the Moon**, 260 m from the gate.
   - Not the lab: the drone's combat, the arc reflex and FIDELITY's monsters (the enemy stand-ins) run on the planet.
   - The pad is a kit (`BRIDGE_PAD_KIT`): a square deck, square rim beams, and corner posts down into the ground. It is grounded, with nothing floating and no lettering. The bridge's Ray-7 violet trims it.
   - A linked window's screen stands on it.
2. **A pure manifest** (`bridgeManifest` in `@hm/gamebridge`) says, per aspect, how it is served:
   - `live` (measured or streamed now);
   - `documented` (a published constant);
   - `stand-in` (which FIDELITY preset);
   - `waiting` (bridgeable, nothing has come in yet).
   The aspects are movement, fire, rules, state, picture, sound, weapon, characters, world and names. The drone reads it out on arrival, the bridge gets it as `bridge-manifest`, and it updates as measurements arrive.
3. **Stand-ins are FIDELITY presets, chosen from what the game says:**
   - **Weapon:** by the game's weapon class (CS2's `type`: Rifle, SMG, Pistol, Shotgun, SniperRifle...) to the nearest Weapon Bench parts (core, barrel, sight, cell).
   - **Movement:** the documented constants over the nearest locomotion preset, `earth-standard` when there are none.
   - **Characters:** FIDELITY monsters stand in for the game's opponents. They are respawned on the game's own outcome and threat edges (a new round or wave is a new set).
   - **World:** the pad on the Moon at the plot's own Fidelity Stage.
   - **Sound:** the game's own audio keeps playing on the PC (never copied); FIDELITY's rifle sounds play for the stand-in weapon.
   - **Names:** labels unless the profile allows entity kinds.
4. **Leaving:** "stop the bridge" puts back everything the stage changed (the weapon, movement, the stand-ins) and returns the player to where they stood.

5. **Anti-cheat: the player is told before anything crosses** (owner, 28 Oct: "if there is a vac ban risk the user must be notified and we can suggest offline, self hosted, cheats switched on games and modes").
   - **The category** is every anti-cheat: VAC, Easy Anti-Cheat, BattlEye, Riot Vanguard, FACEIT, PunkBuster and the like. The safe modes are every mode where none watches or the server allows it: offline bot practice, a private or LAN server you host, `sv_cheats 1`, and launch options that turn the anti-cheat off.
   - **Where it comes from:** a game's profile names its anti-cheat (CS2: VAC, online scope). For games nobody has checked, the bridge detects one by its running process (`detectAntiCheat`):
     - BattlEye's `BEService`;
     - Riot Vanguard's `vgc`;
     - Easy Anti-Cheat's service;
     - FACEIT;
     - PunkBuster's `PnkBstrA`/`B`.
     VAC has no process of its own.
   - **The risk by rung (`banRisk`):**
     - none known: its official telemetry and the screen;
     - low: the cadence sampler's three keys and the audio meter, and an official mod SDK;
     - high: loaders, the game's files, and **sending input into the game**.
   - **What the drone says:** on bridging such a game it names the system, says that what it uses never touches the game, and names the safe modes for anything deeper. The bridge gets the same line as an `anti-cheat` event.
   - **About `-insecure`:** it is a community report only. Valve does not document whether it removes ban risk, and the drone says so.
6. **Sending input back into a game: the player's choice** (owner, 28 Oct: "build it so the user can choose, we don't judge... have them click a box and write a word to confirm").
   - **Off by default, per game and per session.** "Relay my input" opens a dialog with three parts:
     - the anti-cheat line for that game, and what the transport can and cannot do;
     - a box ("I understand this can get my account banned in that game");
     - a word to type: **RELAY**.
     Only both turn it on. "Stop the relay" or "stop the bridge" turns it off.
   - **Only the player's own presses cross** (fire, use, jump, reload, pressed in FIDELITY). The drone and any AI never originate input into another game: in an online match that is a bot playing against people.
     - The bridge enforces this: arming returns a token that only the game tab holds. It is never posted to `/events`, and every relayed press must carry it.
   - **Transports**, declared by the game's profile (`inputRelay`), whitelisted:
     - `console-tcp`: a game console over TCP (Source 1 games launched with `-netconport`). Only `+name`/`-name` commands, so no `quit`, binds or arbitrary console.
     - `synthetic-keys`: Windows keys and mouse buttons from a short list. Delivered only while the game's own window is in front; a press with another window in front is dropped and reported.
   - **CS2:**
     - It has no remote console any more (the `-netconport` telnet console was CS:GO's; [nshud](https://github.com/daniel-zint/nshud) reports it gone). So only synthetic keys, which reach it only while its window is in front.
     - On one PC that cannot happen while you play FIDELITY. It needs a second device driving it, through a bridge that listens beyond this PC, which is not built: the bridge is loopback-only by design.
     - The dialog says this. View angles are not relayed: they would need `setang`, a cheat-protected console command, with no console.

## 2a. The input relay, built (28 Oct)
- **`@hm/gamebridge`:**
  - `InputRelaySpec` (on profiles: CS2 gets synthetic keys, honest about their limit);
  - `RELAY_CONFIRM_WORD`, `relayConsentOk`, `relayCommand`;
  - the whitelists: `+name` console commands, and the short key list;
  - `checkInputRelay` for AI profiles;
  - the fallback for games nobody declared, `DEFAULT_INPUT_RELAY`.
- **The bridge:**
  - `POST /input-relay/arm`: checks the box and the word again and returns a token, never posted to `/events`;
  - `/press`: needs the token and re-checks the whitelist;
  - `/disarm`, plus disarm on `bridge-closed`;
  - `GET /input-relay` for status, without tokens;
  - the console transport (TCP), and `scripts/input-relay.ps1` (Windows keys, pressed only while the game's own window is in front, otherwise dropped with the reason).
- **The game:**
  - "relay my input" opens the consent in the comms panel (the anti-cheat line, what crosses, what the transport cannot do, the box, the word);
  - "stop the relay" turns it off;
  - one listener relays only the player's own fire, use, jump and reload presses.
- **Measured** (`scripts/test-gamebridge-e2e.mjs` phase D):
  - the button stays disabled with only the box ticked;
  - the box plus the word turns it on;
  - the player's click reached a game console as `+attack` then `-attack`;
  - a press without the player's token, and a `quit`, were both refused;
  - "stop the relay" disarmed the bridge.
- **The key helper was checked live on this PC:** with the game not in front, every press was dropped.

## 2b. Built and measured (28 Oct)
- **Stage pieces:**
  - `BRIDGE_PAD_KIT`: deck, plinth, rims and violet trim;
  - `showBridgePad`: the flattest of eight bearings 260 m from the gate, with the deck as floor;
  - the stage ops: enter, stand-ins, the HUD and leave, with `removeMob` so stand-ins leave without drops;
  - `bridgeManifest`, `weaponStandIn`, documented CS2 gravity, `antiCheatAdvice`.
- **The e2e** `scripts/test-gamebridge-e2e.mjs` passes 21/21. For the stage:
  - a bare "bridge" puts A on the pad's deck on the Moon;
  - the manifest says rules are live, and movement, weapon, characters, names and world are stand-ins;
  - three FIDELITY monsters stand in around the pad;
  - the game's audio-measured fire (6 rounds/s) goes onto the stand-in sidearm;
  - "stop the bridge" puts A back where it stood, with the pad and stand-ins gone.
- **Found and fixed on the way:**
  1. Play re-applied the loadout weapon in three places whenever the base world changed, which on the Moon is constant. That silently overwrote any stand-in gun and any mimicked fire pattern, the older "apply the mimic" included. Now there is one weapon override.
  2. The gravity fit took its ground as the 5th percentile of height. In low gravity a body is airborne most of the time, which cut arcs into fakes (a 0.085 m/s² reading). Now the ground is the lowest height three samples share.
  3. A batch that saw no whole jump put an inherited 14.5 over a measured gravity. Now gravity and jump only change with a whole jump, and each batch carries its last 8 s into the next, so a cut arc comes back whole. Tab A then settled on tab B's Moon gravity: 1.619 against 1.619.
  4. Events were dropped when a long frame outlasted the link's 15 s grace. That lost a whole session's `bridge-active`, so the sampler never started. Events now go to any bridge that answered in the last two minutes.

## 3. Next
- The screen rung's tracker (Plan 51 §3.5) would make movement `live` for games like CS2 that send no position.
- A per-game stand-in table in the Studio, so the player can pick which FIDELITY preset stands in for what.
