# Game bridge permissions: what may cross, and how a game shares it (research, 28 Oct)

Purpose: the drone bridges any game the owner names from inside FIDELITY. The AI on the bridge checks that game's terms
live and writes a permission profile; only what the profile allows crosses. This note fixes the rules the profile encodes.
Earlier research it builds on: [`GUNFIRE_REBORN_BRIDGE_RESEARCH.md`](GUNFIRE_REBORN_BRIDGE_RESEARCH.md) (engine-family
mod routes, terms examples), [`GAME_IN_GAME_STREAMING_RESEARCH.md`](GAME_IN_GAME_STREAMING_RESEARCH.md) (window capture,
screen watchers), [`ENGINE_OPTIMIZATION_AND_BRIDGING_SPEC.md`](ENGINE_OPTIMIZATION_AND_BRIDGING_SPEC.md) §3-4.

## Two layers decide what may cross

1. **Copyright protects expression, not mechanics.** Game rules and mechanics are ideas and are not protected; the way a
   game expresses them (art, audio, models, text, distinctive audiovisual look and feel) is. The 2012 *Tetris Holding v.
   Xio* ruling (D.N.J.) says exactly this, while still finding Xio's close copy of Tetris's look infringing; *Data East v.
   Epyx* earlier allowed games built on the same ideas. [1][2][3] A district ruling, not binding appellate law: a guide,
   not a guarantee.
2. **A game's terms are a contract on top.** Even where copyright does not reach, a game's EULA or terms of service can
   forbid reverse engineering, plug-ins, bots, automation, or "mirroring" the service (the Duoyi terms in the Gunfire
   research are a worked example). So each game needs its own check, and the check has to be live: terms change.

**What this means for FIDELITY:**
- **Never streams:** another game's assets (art, audio, models, text). They are the protected expression, and the
  project's legal-art rule forbids them anyway.
- **Always streams (the floor, decided 28 Oct with the owner and Argon):** the *mechanics*, meaning the numbers that
  describe rules and feel (gravity, jump and dash curves, speeds, fire cadence, trigger -> action delays).
  - They cross through the floor rungs every game allows: its own official telemetry, which it sends out to be read, and
    the screen, which the player sees.
  - They cross whatever a verdict says, because they are no one's to refuse.
  - A term that forbids tools binds the deeper rungs (mods, loaders, reading the game's files) and online play, so a
    refusal keeps the floor and marks the bridge solo.
- **Streams when the terms allow:**
  - keeping or sharing the player's raw session *telemetry* samples (the mimic consumes them and keeps none);
  - *entity kinds*, meaning the game's own names for things. Without permission they cross as anonymous labels.
- **Re-expressed, not copied:** whatever crosses comes out in FIDELITY's own presets and art.

## How games share their state (the observer ladder's top rung)

- **Official game-state integrations.** Valve's Game State Integration (CS2, Dota 2) is turned on by a config file in the
  game's folder, and the game then POSTs JSON of the live match to an HTTP endpoint the player names. What it exposes is
  Valve's choice: a player sees only their own data. [4][5] This is the cleanest route there is: the game itself sends
  numbers to a local listener.
- **Other published telemetry** (to verify per game, live): racing games often publish UDP telemetry; some publish
  journal or log files; mod SDKs and community loaders sit below that; screen and audio are the last resort.

## Rules the permission profile encodes

1. **Profile per game.** Each game gets one profile with:
   - a verdict: permitted, limited, refused, or unchecked;
   - the allowed observer rungs, best first;
   - the allowed stream classes;
   - solo only (online sessions get nothing);
   - the sources read, with the quoted lines;
   - who checked it;
   - setup steps for the player (for example the telemetry config to create).
2. **The asset class is never allowed,** whatever a profile says. The validator strips it.
3. **Mechanics are never refused.** An unchecked game (no AI attached, or its check failed) gets the unchecked profile:
   - the floor rungs (its own telemetry, the screen);
   - mechanics;
   - names as anonymous labels;
   - solo;
   - every reply says nobody checked.
   A refused verdict keeps the same floor.
4. **Applying is the player's word.** That is "apply the mimic", or the "bridge this game" order, which puts every
   mimic of that game in force live until "stop the bridge". An AI on the bridge cannot open a bridge or apply a mimic.

## Anti-cheat: a third layer, and the player is told (28 Oct)
Copyright protects the assets, and the terms bind the deeper rungs. Anti-cheat is a third layer: a ban falls on the player's own account, whatever the copyright and terms say. So the drone names the risk before anything crosses (Plan 53 §2.5).
- **What each one watches:**
  - VAC guards secured servers and matchmaking; it has no process of its own.
  - Easy Anti-Cheat runs a service while a protected game runs, plus a kernel driver [6].
  - BattlEye runs `BEService` [7].
  - Riot Vanguard runs `vgc` with a kernel driver, `vgk.sys`, that starts at boot [8][9].
  - FACEIT runs an app during protected CS2 matches, with a kernel driver loaded at boot [10].
  - PunkBuster runs `PnkBstrA` and `PnkBstrB` [11].
- **What a bridge uses, and its risk:**
  - **None known:** the game's own telemetry (it sends it out to be read) and the screen.
  - **Low:** reading three keys and the game's audio level from Windows. That is not a hook into the game, but anti-cheats look at input tools.
  - **High:** loaders, memory, the game's files, and sending input into the game.
- **Safe modes for anything deeper:**
  - offline practice against bots;
  - a private or LAN server the player hosts, with cheats switched on where the game allows it (`sv_cheats 1` in Source games).
  - CS2's `-insecure`, which community reports say disables VAC and keeps the client off secured servers [12]. Valve does not document whether it removes ban risk, so the drone says that too.

## Sources
1. [Tetris Holding, LLC v. Xio Interactive, Inc. (Wikipedia)](https://en.wikipedia.org/wiki/Tetris_Holding,_LLC_v._Xio_Interactive,_Inc.)
2. [Willamette IP summary of Tetris v. Xio](https://wlo.willamette.edu/ip/2012/05/tetris-holding-llc-v-xio-interactive-inc.html)
3. [Federal Bar IP Insight, Oct/Nov 2012](https://www.fedbar.org/wp-content/uploads/2012/10/ipinsight-octnov2012-pdf-1.pdf)
4. [Dota 2 GSI wiki (MrBean355/dota2-gsi)](https://github.com/MrBean355/dota2-gsi/wiki)
5. [cs2-gsi crate docs](https://docs.rs/crate/cs2-gsi/0.1.1)
6. [Easy Anti-Cheat (Wikipedia)](https://en.wikipedia.org/wiki/Easy_Anti-Cheat)
7. [BEService.exe (file.net)](https://www.file.net/process/beservice.exe.html)
8. [vgc.exe (file.net)](https://www.file.net/process/vgc.exe.html)
9. [Riot Vanguard (League of Legends wiki)](https://wiki.leagueoflegends.com/en-us/Riot_Vanguard)
10. [What is FACEIT Anti-cheat and how does it work? (FACEIT support)](https://support.faceit.com/hc/en-us/articles/9394666828188)
11. [What is PnkBstrA.exe? (freefixer)](https://www.freefixer.com/library/file/PnkBstrA.exe-36734)
12. [CS2 -insecure discussion (Steam Community)](https://steamcommunity.com/app/730/discussions/0/6352962692739126906)
