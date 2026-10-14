# FIDELITY: test guide for the owner (14 October 2026 build)

## Setup (on the test PC)
1. Get the build:
   - In the repo folder: `git checkout main`, then `git pull`.
   - Once per clone: `git lfs install`, then `git lfs pull`. Without these the music, the voice and the HD models arrive as pointers, and `PLAY.bat` stops and says so.
2. Double-click **`PLAY.bat`**:
   - it builds the game (about a minute);
   - it opens http://localhost:8080 in your browser;
   - close its window to stop the game.

## Two ways in
- **From the start:** a fresh profile starts at Act I: you wake in the dark lab.
- **Jump to a checkpoint:** open the address with the checkpoint's name, for example http://localhost:8080/?checkpoint=act4-start.
  - Once you are on a checkpoint, Settings shows a "Checkpoints" list for switching between them. The list is hidden in normal play.
  - Each checkpoint loads into its own "Checkpoint" profile, so your own save is not touched.

| Checkpoint | Where it puts you |
|---|---|
| `act1-wake` | Act I: the wake, in the dark lab |
| `act4-start` | Act IV: the drill, on the Moon with the extraction tool |
| `act5-start` | Act V: the base, ready to build foundations and storage |
| `act6-start` | Act VI: the hardpoint, ready to install the fabricator and print the scout |
| `stage6-monsters` | Stage 6 with the monsters unlocked |

## What this build has (what to judge)
- **The campaign from Act I to Act VI, voiced.** The automated walkthrough passes 40 of 40 beats.
  - Act I: the lab and emergency power. Act II: the window and the gate. Act III: the Moon at stage 0. Act IV: the extraction tool and the Studio.
  - Base building, harvesting and linked storage; the fabricator and the scout rover; the monsters; the stage climb.
- **Build checks:** 0 type errors, 2,613 unit tests passing, a 14.55 MB single file (the cap is 16 MB).
- **The base-building test:** 72 checks pass, including printing the scout.

## Not in this build yet (planned, so please don't report these as missing)
- **The new stage looks:** the wireframe on arrival, the 1-bit dither, the suit-cam realism at stages 4 to 6, and HUD skins that follow the stage. These are briefs 25 to 27, next.
- **The industrial foundation frames** (the red slabs are still the prototype), the 9-zone HUD and the bottom build ribbon.
- **Acts VII to IX, and the credits music video with "Four Floats".** The song files are in, but nothing plays them yet (brief 33).
- **The song radio and the harmonic machines** (brief 34).

## Known issues (already logged; tell us if one bothers you more than we think)
- **POL-31:** sappers stop at the gate's 25 m safe dome, so they never reach a base inside it. A design ruling is pending.
- **POL-32 and POL-33:** monsters slide or stall at built walls instead of going round them, and spitter bolts fly over walls.
- **POL-35:** only "CANNOT PLACE" holds its title card; other banners can replace each other.
- **POL-37:** fight readability is not tuned yet. A monster can read as a pink smear.
- **POL-36:** not hand-tested yet: building on slopes, a full inventory, driving into monsters, reloading mid-print.

## How to report
Write in the chat, as you have been. Give the checkpoint or act, the stage, and what you expected against what happened, with a screenshot if you can. Opus logs every report in `docs/OWNER_ASKS.md` and turns it into fixes. Argo takes the creative points.
