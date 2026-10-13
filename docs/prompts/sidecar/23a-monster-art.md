# TASK-23a: the monster art pipeline (runs now, beside TASK-20)

The art half of TASK-23, split out so it can run while TASK-20 works in `play.tsx`. Read `docs/MONSTERS_PLAN.md` first (§3 has the roster and the archetype mapping). The owner: "dont get stuck on on type of moster, there must be loads out there we can use". **Do not wire anything into the game** (no `play.tsx`, `play-scene.ts` or `base/` edits): TASK-23b does that after TASK-22.

## The sources (downloaded; read them, never fetch more)
- `zips/monsters/freedoom/freedoom-0.13.0/freedoom2.wad` (BSD-3, `COPYING.txt`): sprite monsters, prefixes POSS SPOS CPOS SSWV TROO SARG HEAD SKUL PAIN BOS2 BOSS SKEL FATT BSPI SPID CYBR VILE; the palette is `PLAYPAL`.
- `zips/monsters/blasphemer/blasphem.wad` (BSD-3): BEAS CHKN CLNK IMPX KNIG MNTR MUMM SNKE SOR2 SRCR WZRD.
- `zips/monsters/librequake/lite/id1/pak0.pak` and `pak1.pak` (BSD-3): Quake PAK files.
  - The monsters are `progs/*.mdl`: dog, zombie, soldier, enforcer, knight, hknight, ogre, wizard, demon, shambler, shalrath, tarbaby, fish, boss and oldone.
  - The palette is `gfx/palette.lmp`.
- `zips/monsters/quaternius-ultimate/{Big,Blob,Flying}/*.gltf` (CC0, `License.txt`): 50 skinned monsters with clips (Walk, Run, Punch, HitReact, Death, Idle, and others).

## Build
1. **Parsers in `@hm/shareware`** (pure, with tests on small synthetic buffers):
   - `pak.ts`: list and read the files in a Quake PAK.
   - `mdl.ts`: Quake 1 MDL. Header, palette-indexed skins, texcoords (onseam), triangles, and simple plus group frames. Output: per-frame vertex positions with normals from the anorm table, UVs, and an RGBA skin.
   - Extend `wad.ts` only if needed: the sprite frame and rotation naming (`TROOA1`, `TROOA2A8` mirrored), the patch offsets.
2. **`scripts/pack-monsters.mjs`** (Node, uses sharp and glTF-Transform as the asset scripts do). For each monster in a list file `docs/monsters/roster.json` (id, source, the entry name, era, archetype, height in metres, the clips to keep):
   - **Sprites:** frames for walk, attack, pain and death; 8 rotations, mirrored ones flagged instead of duplicated. Write one WebP atlas per monster plus JSON (frame rects, origins, mirror flags, ticks per frame).
   - **MDL:** a GLB with morph-target animations (walk, attack, pain, death; frame names give the groups: `walk1..`, `run1..`, `attack..`, `pain..`, `death..`), the skin as a WebP texture, and meshopt.
   - **Quaternius:** keep only the needed clips, merge to one GLB per monster with the shared atlas, and meshopt.
   - **Where it goes:**
     - The lean core is ONE skin per archetype (6 monsters), inlined: `apps/web/src/assets/monsters/`, at most 1.2 MB in total.
     - Everything else goes to `apps/web/public/monsters/<id>/`, loaded at runtime behind the loading bar, like the HD pack.
   - Add `apps/web/public/monsters/**/*.webp`, `*.glb` and `*.bin` to Git LFS in `.gitattributes`, the same way as `public/hd`.
3. **The roster:** at least 3 skins per archetype across the eras. Follow plan §3's mapping, adjusted where a monster's look or animations don't fit. Start with 18 (3 per archetype), commit, then add batches of 10 up to about 40. Name them by what they are (`flesh-worm`, `serpentipede`, `ogre-lq`, `orc-q`), never by a commercial game's name.
4. **The look check:** a contact sheet per batch (`docs/shots/monsters/batch-N.png`). Each monster shows walk, attack and death frames, plus 3 rotations for sprites. LOOK at it; drop any monster that reads badly (broken frames, wrong palette, inside-out normals).
5. **Credits:**
   - `docs/CREDITS.md` gets the full BSD notices (Freedoom's `COPYING.txt`, Blasphemer's and LibreQuake's licences) and thanks for the CC0 Quaternius packs.
   - Export a `credits.json` the game can show later.
   - Never put id Software's names or assets in our files.

## Tests
- Unit tests for `pak.ts` and `mdl.ts` (synthetic buffers), and one test that parses the real LibreQuake `progs/dog.mdl` if the file exists (skipped otherwise).
- `node scripts/pack-monsters.mjs` runs end to end. A test reads every manifest entry and checks:
  - the files exist;
  - frame counts are above zero;
  - the inline core is at most 1.2 MB.
- The usual green set: typecheck, `npm test`, build. TASK-20's files may be mid-change: report errors in `play.tsx` or `base/`, don't fix them.

## Report
On the board:
- the roster table (id, source, era, archetype, size);
- the sizes (inline core and the public folder);
- the contact sheets;
- the test results;
- anything dropped, and why.

Commit after each batch: `git commit -- <paths>`, never `add -A`.
