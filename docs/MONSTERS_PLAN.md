# The monsters: entities leaked from old games (plan, 2026-10-13)

The owner: "i want the monsters in the game but forget this tacky \"monster mash\" idea", and "flesh out the mobs from other games". Their earlier idea (2026-10-12): junked or broken models are **containment leaks** that you seal and restore with a fidelity tool. Anything here beyond the owner's words is a proposal for them, marked **(P)**.

## 1. What exists (the Flash spike, 9 October)
- **`@hm/mobsim`:** two kinds (ogro, demon); chase, attack, pain and death; a shotgun; deterministic.
- **`monster-mash-combat.ts`** (1,548 lines): spawns and draws them on the planet. Behind `?mash` there is a sandbox panel with a 👹 button; TASK-20 removes it.
- **The assets:**
  - the **Ogro** MD2 from the three.js examples;
  - the **Demon** sprites read at runtime out of `apps/web/public/shareware/doom1.wad`, id Software's shareware WAD.

## 2. Research (sources)
- **Legal: never ship id's art.**
  - The DOOM shareware licence forbids derivative works. The long-standing WAD FAQ says material extracted from an IWAD "may not be extracted or re-distributed"; only the whole shareware game may be passed on, unmodified. ([licence text](https://github.com/ChrisJan00/WarrensDream/blob/master/doom-wad-shareware-license.txt), [Quinet's WAD FAQ](https://people.montefiore.uliege.be/quinet/games/sellingwads-en.html))
  - The Ogro's readme names its author but grants no rights. ([Ogro.txt](https://pages.cs.wisc.edu/~lizy/mrdoob-three.js-ef5f05d/examples/models/animated/ogro/Ogro.txt))
  - So `doom1.wad` and the Ogro must leave the shipped game.
- **What we can ship:**
  - **Freedoom**'s whole roster is BSD-3. Reuse by other projects is an explicit goal, and its monsters are original replacements (the Serpentipede for the Imp, the Flesh Worm for the Demon). The BSD notice must be kept. ([Doom Wiki](https://doomwiki.org/wiki/Freedoom))
  - **LibreQuake** replaces Quake's models under BSD-3. ([Debian review](https://dfsg-new-queue.debian.org/reviews/librequake), [ModDB](https://www.moddb.com/company/librequake))
  - **Kenney** and **KayKit** monster packs are CC0.
- **"Monsters from other games", legally:** source ports (GZDoom and others) load the player's *own* IWAD. We can do the same: the player drops their own `.wad`, `.pak`, `.md2` or `.mdl`; it is read in their browser, stays on their machine and is never uploaded.
- **What players say about enemies in builder games:**
  - **Raids split players.** Some want them ("more fun and scary"; a base needs a reason to exist). Others won't buy a game unless raids can be turned off, and they hate coming back to a wrecked base without warning. ([Nightingale](https://steamcommunity.com/app/1928980/discussions/0/7221029098485685452), [Dragonwilds](https://steamcommunity.com/app/1374490/discussions/0/604154603520473114), [The Survivalists](https://steamcommunity.com/app/897450/discussions/0/2972897380395865498))
  - **Enshrouded's developer:** terrain-damaging raids destroy hours of building, and immune bases let players hide; raids are trivial for veterans and frustrating for casuals. ([Enshrouded](https://steamcommunity.com/app/1203620/discussions/0/3877093932378016555))
  - **Factorio** ships peaceful and no-enemies settings, and popular mods remove enemies entirely. Lesson: never gate progress on kills alone. ([Factorio forum](https://forums.factorio.com/viewtopic.php?p=622218), [Peace Mod](https://forums.factorio.com/viewtopic.php?p=69094))
  - **Satisfactory** players play "for building and exploring" and push back on base attacks. ([Steam](https://steamcommunity.com/app/526870/discussions/0/2284960483089466650))

## 3. The design
- **Each monster is a leak from an era of rendering.** It keeps its own era's look whatever the plot's stage: a 2D sprite on a PBR plot reads as wrong, and that is the point. A small aura around it drops the ground to its era, using the window scene's pocket shader (`{centre, radius, S}`).
- **The archetypes**, all with built-in art from legal sources:

  | Archetype | Era and source | Behaviour |
  |---|---|---|
  | Charger | sprite, Freedoom (Flesh Worm) | Telegraphed lunge; strong up close. |
  | Spitter | sprite, Freedoom (Serpentipede) | Keeps its distance, lobs slow bolts you can dodge. |
  | Swarmer | sprite, Freedoom (its small flier) | Packs of 4 to 6, fast, fragile. |
  | Flyer | sprite, Freedoom (its large floater) | Hovers and strafes, ignores walls. |
  | Brute | early 3D, LibreQuake | Slow tank; ground slam with a long wind-up. |
  | Sapper **(P)** | early 3D, LibreQuake, or our own generated model | Ignores you and drains a machine's output (it glitches) until killed. It never destroys anything. |
- **Leaks (the owner's idea) are where they come from:**
  - A leak is a janky zone around a junked model (we keep every junked model).
  - Hold the beam on it to seal it **(P: Extract held on the leak, or a "seal" cartridge in Apply)**. A sealed leak stays sealed and its junk model is restored up the fidelity ladder.
  - New leaks open as the plot's stage rises.
- **Raids, following the research:**
  - No built piece is ever destroyed.
  - Sappers only stall machines while alive.
  - Dr. Haddy warns over the radio, and a HUD marker shows, at least 20 s before a leak surges.
  - Nothing spawns within 30 m of the gate pad or inside a sealed base.
- **A setting: Monsters Off / Calm / Normal / Hard** (Normal by default).
  - Off: no monsters.
  - Calm: they fight back only when hit.

  Every drop can also be earned without fighting.
- **Drops:** sprite monsters burst into raw pixels and 3D monsters into raw vertices (Dr. Haddy's M-02: "It came apart in pixels"). They feed the substrate chain: refinery, primitives and maps.
- **Combat:** guns from the weapon bench. The beam is a tool, not a weapon (in Sculpt you can wall a monster off).
- **Budgets on Low:**
  - 8 active monsters (16 on Medium, 24 on High);
  - one draw call per sprite type (instanced billboards);
  - vertex animation on the GPU for the 3D era.
- **The Workshop: bring your own monsters.**
  - Drop your own game files. Known games get presets mapping their monsters to the archetypes (DOOM, Heretic, Quake); anything else is mapped by hand.
  - The files are stored only in your browser.
  - On the synced grid, other players see the built-in stand-in.

## 4. How it gets built
1. **The Arena battle `@hm/leaksim`** (brief: `docs/prompts/battle/leaksim.txt`): the pure, deterministic brain. Archetypes, telegraphed attacks, bolts, machine-draining sappers, leaks with waves and sealing, the aggression levels, safe zones, drops, encode and decode. It replaces `@hm/mobsim` in the game; mobsim stays for its own tests.
2. **The assets (needs the owner's OK to download):**
   - the Freedoom release (freedoom1 and freedoom2 WADs, BSD) from its GitHub releases;
   - the LibreQuake release (BSD) from its GitHub;
   - a Quake `.mdl` parser beside the existing WAD and MD2 parsers in `@hm/shareware`.
   - Only the frames we use are packed (sprite sheets and baked vertex animations), with the BSD notices in the credits.
3. **TASK-23 (sidecar):** wire leaksim into the planet: the renderers per era, the leak zones on junked models, the seal, the aura, the drops, the setting, the warnings, and the budgets. Remove `doom1.wad` and the Ogro from the shipped build. The `?mash` fixture then uses Freedoom.
4. **The Workshop's bring-your-own import:** TASK-25, after main, alongside the Studio. It reuses the parsers.
