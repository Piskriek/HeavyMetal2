# FREE & LEGAL GAMES & ASSETS CATALOG FOR MONSTER MASH

> **Target**: SetMix: The Resolution Crafter (Monster Mash Game Jam)  
> **Status**: Comprehensive Legal & Technical Feasibility Research  
> **Objective**: Catalog all games and asset libraries that can be automatically downloaded, bundled, or launched in the background with **zero legal issues, zero copyright infringement, and 100% license compliance**.  

---

## 1. LEGAL TAXONOMY & COMPLIANCE TIERS

To ensure bulletproof legal safety, external games and assets are categorized into four distinct legal tiers:

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                          LEGAL & DISTRIBUTION TIERS                             │
├─────────────────────────────────────────────────────────────────────────────────┤
│ TIER 1: LIBRE & CC0 (Zero Restrictions — Safe for Direct Bundling & Commercial)  │
│ • Freedoom Phase 1 & 2 (BSD-3-Clause)                                           │
│ • LibreQuake (BSD-3-Clause)                                                     │
│ • Kenney.nl 3D Monsters & Blasters (CC0 / Public Domain)                        │
│ • Battle for Wesnoth Sprites (GPL-2.0)                                          │
│ • Dungeon Crawl Stone Soup Sprites (CC0 / GPL)                                  │
│ • KayKit Character & Monster Packs (CC0 / Public Domain)                        │
├─────────────────────────────────────────────────────────────────────────────────┤
│ TIER 2: OFFICIAL FREEWARE (Full Games Released Free by Original Publishers)     │
│ • Chex Quest 1 & 3 (General Mills / Digital Café official freeware)             │
│ • Hacx: Twitch 'n Kill v1.2 (Banjo Software official freeware IWAD)              │
│ • Bio Menace (Apogee / 3D Realms official freeware)                              │
│ • Alien Carnage / Halloween Harry (Apogee / 3D Realms official freeware)        │
├─────────────────────────────────────────────────────────────────────────────────┤
│ TIER 3: AUTHENTIC SHAREWARE (Freely Redistributable Episode 1 / Demo Data)      │
│ • DOOM Episode 1: Knee-Deep in the Dead (DOOM1.WAD)                             │
│ • Quake 1 Episode 1: Doomed Dimension (PAK0.PAK)                                │
│ • Heretic Episode 1: City of the Damned (HERETIC1.WAD)                          │
│ • Hexen Demo (HEXEN.WAD)                                                        │
│ • Wolfenstein 3D Episode 1 (WL1 / VSWAP.WL1)                                    │
│ • Duke Nukem 3D Shareware (DUKE3D.GRP)                                          │
│ • Rise of the Triad: The HUNT Begins (DARKWAR.WAD)                              │
├─────────────────────────────────────────────────────────────────────────────────┤
│ TIER 4: INTERNET ARCHIVE DISCOVERY (Live Terminal Ingestion & User Drag-Drop)   │
│ • archive.org MS-DOS Software Library (10,000+ titles via open CORS APIs)       │
│ • Drag-and-drop ingestion of any user-owned .wad, .pak, .md2, .vox, or .glb     │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. TIER 1: LIBRE & CC0 ASSET PACKS (100% UNRESTRICTED)

These can be bundled directly inside the repository and shipped in the single-file production bundle without any licensing ambiguity.

### A. Freedoom (Phase 1 & Phase 2)
* **License**: **Modified 3-Clause BSD License** (100% libre, permissive, commercial reuse permitted).
* **Format**: Standard DOOM IWAD (`freedoom1.wad`, `freedoom2.wad`).
* **Parser Compatibility**: 100% native with our [`@hm/shareware`](file:///c:/MarbleGp/packages/shareware) lump parser.
* **Mob Roster**:
  - **Worm**: 4-legged horned biped (Demon / Pinky equivalent).
  - **Serpentipede**: 3-eyed flame-throwing reptile (Imp equivalent).
  - **Pain Lord**: Floating horned demon (Baron / Hell Knight equivalent).
  - **Octaminator**: Multi-tentacled floating sphere (Cacodemon equivalent).
  - **Hatchling & Matribite**: Bio-mechanical insectoids (Lost Soul / Pain Elemental).
  - **Necromancer**: Skeletal summoner (Arch-Vile equivalent).
  - **Combat Slug / Minigunner**: Cybernetic heavy gunner.
* **Weapon Roster**:
  - **Pump Shotgun**: Classic 8-pellet buckshot.
  - **Double-Barrel Super Shotgun**: 20-pellet devastation blast.
  - **Minigun**: High-rate-of-fire kinetic machine gun.
  - **Missile Launcher**: Explosive projectile launcher.
  - **Polaric Energy Cannon**: Rapid plasma emitter.
  - **SKAG-1337**: Room-clearing antimatter blast (BFG equivalent).
* **Audio**: Complete set of original 8-bit / 16-bit sound effects.

### B. LibreQuake
* **License**: **3-Clause BSD License**.
* **Format**: Quake PAK file (`pak0.pak`) containing MDL / MD2 3D models and WAV audio.
* **Parser Compatibility**: 100% compatible with Three.js `MD2Loader` and our `@hm/shareware` model wrapper.
* **Mob Roster**:
  - Low-poly eldritch monsters: Shambler, Fiend, Grunt, Knight, Scrag, Vore equivalents.
* **Weapon Roster**:
  - Axe, Shotgun, Super Shotgun, Nailgun, Super Nailgun, Grenade Launcher, Rocket Launcher, Thunderbolt (Lightning Gun).

### C. Kenney.nl (Asset Jesus) — 3D Monster & Blaster Kits
* **License**: **CC0 1.0 Universal (Public Domain)** — zero restrictions, no attribution required.
* **Format**: Low-poly GLTF / OBJ / FBX with rigged animations (idle, walk, run, attack, die).
* **Mob Roster**:
  - **Animated 3D Monsters**: Bat, Ghost, Golem, Slime, Cyclops, Orc, Skeleton, Minotaur.
* **Weapon Roster (3D Blaster Kit)**:
  - Futuristic blasters, railguns, rocket launchers, laser rifles, sidearms.

### D. Battle for Wesnoth
* **License**: **GNU General Public License (GPL v2)**.
* **Format**: Thousands of transparent PNG sprite sheets with walk/attack/cast/death animation frames.
* **Mob Roster (Over 200+ High-Quality Fantasy Creatures)**:
  - Undead: Skeletons, Chocobones, Liches, Ghosts, Spectres, Walking Corpses.
  - Beasts: Giant Spiders, Scorpions, Mudcrawlers, Yetis, Gryphons, Sea Serpents, Fire Drakes.
  - Humanoids: Orcish Grunts, Goblin Spearmen, Troll Rocklobbers, Elven Archers.

### E. Dungeon Crawl Stone Soup (DCSS)
* **License**: **CC0 / Public Domain / GPL**.
* **Format**: 32x32 and 64x64 pixel art tilesets.
* **Mob Roster**:
  - Huge variety of classic roguelike monsters: Hydras, Nagas, Gargoyles, Kobolds, Tengu, Liches, Deep Elves.

---

## 3. TIER 2: OFFICIAL FREEWARE (FULL PUBLISHER-RELEASED GAMES)

These are complete commercial titles that were officially declared and released as free software by their original copyright holders.

### A. Chex Quest (Chex Quest 1 & 3)
* **Origin**: Originally bundled in cereal boxes by Ralston Purina in 1996; officially maintained and released as free software by General Mills and original creator Charles Jacobi.
* **License**: **Official Freeware** (and free-to-play on Steam).
* **Format**: DOOM IWAD (`CHEX.WAD` / `CHEX3.WAD`).
* **Mob Roster (The Flemoids)**:
  - **Common Flemoid**: Small green bipedal slime alien.
  - **Flemoidus Bipedicus**: Slime-spitting humanoid alien.
  - **Flemoidus Stridicus**: Fast-running tri-legged alien.
  - **Armored Flemoidus**: Heavy slime tank.
  - **Lord Snotfolus**: Giant boss slime monster.
* **Weapon Roster (The Zorchers — Non-Violent Repatriation)**:
  - **Bootspoon & Super Bootspork**: Melee slime scoops.
  - **Mini-Zorcher**: Laser sidearm.
  - **Large Zorcher**: Zorching shotgun equivalent.
  - **Super Zorcher**: Rapid automatic Zorcher.
  - **LAZ Device (Linear Agriculture Zorcher)**: BFG equivalent sending aliens back to Dimension Z.

### B. Hacx: Twitch 'n Kill (v1.2)
* **Origin**: Commercial Doom II total conversion released in 1997 by Banjo Software. Officially re-released in 2000 as a standalone freeware IWAD (`HACX.WAD`) by team head Nostramo.
* **License**: **Official Freeware**.
* **Format**: Standalone IWAD.
* **Mob Roster (Cyberpunk Matrix Mobs)**:
  - Android Thugs, Buzzers (flying surveillance drones), Phages, Cyber-Demons, Monstructs.
* **Weapon Roster**:
  - Kick, Tazer, Cryogun, Uzi, Photon 'Zooka, Torz-O-Gat.

### C. Apogee / 3D Realms Freeware Releases
* **Origin**: In 2005–2008, 3D Realms released several full classic DOS titles as permanent freeware:
  - **Bio Menace (1993)**: Full episodic run-and-gun platformer with mutant alien mobs.
  - **Alien Carnage / Halloween Harry (1993)**: Jetpack flame-throwing alien shooter.
  - **Major Stryker (1993)**: Vertical sci-fi shmup with alien ships.

---

## 4. TIER 3: AUTHENTIC SHAREWARE (FREELY REDISTRIBUTABLE EPISODES)

The classic 1990s shareware distribution model explicitly granted users the right to copy, redistribute, and share Episode 1 data for non-commercial evaluation.

| Game | Data File | Format | Mobs | Weapons | Legal Status |
|---|---|---|---|---|---|
| **DOOM Episode 1** | `DOOM1.WAD` (4.19 MB) | IWAD Lumps | Zombieman, Shotgunner, Imp, Demon/Pinky, Spectre, Baron of Hell | Fist, Pistol, Shotgun, Chaingun, Rocket Launcher, Plasma, BFG | Shareware license; freely redistributable for non-commercial copying. |
| **Quake 1 Episode 1** | `PAK0.PAK` (18.6 MB) | PAK (MDL/WAV) | Grunt, Enforcer, Rotfish, Rottweiler, Ogre, Fiend, Knight, Scrag | Axe, Shotgun, Super Shotgun, Nailgun, Super Nailgun, Grenade Launcher | Shareware license; freely redistributable for non-commercial copying. |
| **Heretic Episode 1** | `HERETIC1.WAD` (5.8 MB) | IWAD Lumps | Gargoyle, Golem, Undead Knight, Disciple of D'Sparil, Iron Lich | Staff, Elven Wand, Gauntlets, Ethereal Crossbow, Dragon Claw, Hellstaff | Raven / id shareware license. |
| **Hexen Demo** | `HEXEN.WAD` (8.9 MB) | IWAD Lumps | Ettin, Afrit, Centaur, Green Chaos Serpent | Class-specific weapons (Fighter, Cleric, Mage). | Raven / id shareware license. |
| **Wolfenstein 3D Episode 1** | `VSWAP.WL1` (1.4 MB) | Chunks/Sprites | Guard, Guard Dog, SS Officer, Hans Grosse (Boss) | Knife, Pistol, Machine Gun, Chaingun | id / Apogee shareware license. |
| **Duke Nukem 3D Episode 1** | `DUKE3D.GRP` (26 MB) | GRP (ART/VOC) | Pig Cop, Assault Trooper, Assault Captain, Octabrain | Mighty Boot, Pistol, Shotgun, Chaingun Cannon, RPG, Pipebomb | 3D Realms shareware license. |
| **Rise of the Triad (ROTT)** | `DARKWAR.WAD` (5.2 MB) | WAD Lumps | Low Guards, High Guards, Overpatrol, Robot Guards | Dual Pistols, MP40, Bazooka, Heatseeker, Flame Wall, Excalibat | Apogee shareware license. |

---

## 5. TIER 4: INTERNET ARCHIVE (10,000+ MS-DOS TITLES)

The Internet Archive hosts historical software under U.S. Copyright Office DMCA Section 1201 exemptions for digital preservation:
- **Search API**: `https://archive.org/advancedsearch.php?q=collection:softwarelibrary_msdos_games...`
- **Metadata API**: `https://archive.org/metadata/{identifier}`
- **CORS Status**: **100% Open CORS** (`Access-Control-Allow-Origin: *`).
- **In-Game Use**:
  - The in-game CRT terminal allows players to browse titles and descriptions in real time.
  - Players can drag and drop any file (`.wad`, `.pak`, `.md2`, `.vox`, `.zip`) directly into SetMix with zero network overhead.

---

## 6. RECOMMENDED BUILT-IN ROSTER FOR SETMIX V2.0

To ensure the game jam build works **100% out of the box with zero external downloads and zero legal exposure**, we recommend bundling the following curated roster:

### Initial Built-In Monsters:
1. **The Serpentipede (from Freedoom - BSD-3-Clause)**:
   - Ranged fireball-spitting demon with 8-direction animated sprites.
2. **The Worm (from Freedoom - BSD-3-Clause)**:
   - Fast-charging melee beast with heavy bite attack.
3. **The Quake Ogro (from Three.js MD2 Samples - BSD-3-Clause)**:
   - Low-poly 3D animated ogre with 199 animation frames (stand, run, attack).
4. **The Common Flemoid (from Chex Quest - Official Freeware)**:
   - Slime-based comedy alien.
5. **The Goblin Grunt (from SetMix Native `@hm/goblins`)**:
   - Native procedural voxel goblin with ragdoll physics.

### Initial Built-In Weapons:
1. **The Pump Shotgun (Freedoom / Shareware)**:
   - Kinetic spread weapon. Blasts craters in voxel terrain in mining mode; knocks back mobs in combat mode.
2. **The Polaric Energy Cannon (Freedoom / Shareware)**:
   - Rapid plasma weapon. Emits resolution particles that bloom color on hit.
3. **The Extraction Beam Tool (SetMix Native `@hm/beamkit`)**:
   - Precision continuous excavation laser.

---

## 7. AUTOMATED INGESTION PIPELINE ARCHITECTURE

```
┌────────────────────────────────────────────────────────────────────────┐
│                   SETMIX INGESTION & FIDELITY ADAPTER                  │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
         ┌──────────────────────────┴──────────────────────────┐
         ▼                                                     ▼
[ PURE-TS FORMAT PARSERS ]                           [ FIDELITY SHADER ]
• WAD Parser: Sprites, Palettes, PCM Sounds          • Stage 0: 1-Bit Bayer Dither
• MD2 Parser: 3D Meshes, Morph Targets               • Stage 1: 16-Color EGA Quantization
• VOX Parser: 3D Voxel Rigs                          • Stage 2: 256-Color VGA + Jitter
• Audio Decoder: 8-Bit PCM → Web Audio Buffer        • Stage 3: Lit Diffuse & Shadows
                                                     • Stage 4: Full PBR & Emissive
         │                                                     │
         └──────────────────────────┬──────────────────────────┘
                                    │
                                    ▼
                     [ THE "MONSTER MASH" LAB ]
                     • Cartridge Combiner: Splice Mobs & Fuse Weapons
                     • Deploy summonable companions and terrain excavators!
```
