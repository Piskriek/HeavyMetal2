# Argo's relay drop (14 October 2026): triage

Argo wrote these 90 files in his Gemini chat while Opus's and the Haiku sidecars' shared usage was spent (owner, 14 October: "argo was kind enough to demonstrate how far we can stretch his usage and wrote all the code he could think off"). Opus collected them from the chat (checksums verified, 90 of 90) into this tree, which mirrors the repo's paths. `INDEX.txt` lists them by Argo's number; his own map, with the brief each one serves, is `docs/argo/plans/32-code-drop-index.md` (landed verbatim).

**Nothing here is wired into the game, and nothing here is reviewed.** It is the parts list for briefs 25 to 34. The brief that uses a file lands it, reviews it against the code it plugs into, and wires it (CLAUDE.md §0: never take a drop as finished code).

## Landing a file
1. Copy it to its path in the repo.
2. Make it pass the strict tsconfig.
3. Convert its test:
   - from vitest to `node:test` + `node:assert/strict`, as every other test in the repo is written;
   - move it from `src/__tests__/` to the package's `tests/`, or beside the app file;
   - add its folder to `TEST_FILES` in `scripts/test.mjs` if it is new.
4. Wire it into the game, and check it in the browser.

To typecheck this tree as a whole: `node_modules/.bin/tsc -p arena-gathered/argo-relay/tsconfig.json`.

## State at collection

**Syntax.** One typo, fixed here: `export interfaceDeterministicTreeInstance` in `packages/treegen/src/stage56-lsystem-canopy.ts`.

**Types.** 122 strict errors remain:
- 72 are possibly-undefined index reads (`noUncheckedIndexedAccess`) and 13 are possibly-undefined objects;
- 18 are the missing `vitest` module, which the repo does not use;
- the rest are small mismatches.

The most errors are in `apps/web/src/play/footstep-and-tire-roost.ts` (28) and `apps/web/src/credits/index.ts` (16).

**Purity.** The constitution's purity rule binds the simulation packages. Visual code in the app may use the wall clock, but it should still use a seeded generator so screenshots repeat. Flags to fix on landing:
- `Math.random` in `apps/web/src/play/footstep-and-tire-roost.ts` and `apps/web/src/play/screensaver-pipes.ts`: use a seeded generator;
- `performance.now()` in `apps/web/src/credits/index.ts`: the credits must follow the audio clock (`AudioContext.currentTime`), so the picture stays on the beat;
- DOM or Web Audio inside packages:
  - `packages/questline/src/act789-chain.ts` must be pure, so move the DOM part out;
  - in `packages/audio/src/five-bus-mixer.ts`, `packages/shareware/src/sub-bass-reinforcer.ts` and `packages/soundscape/src/stage-ambience-and-machine-loops.ts`, check that the package is meant to own an AudioContext before landing.

**Revisions.** Two files came twice:
- `presetcodec/src/smx-cartridge-card.ts`: file 41 is at the path; file 74, the later revision with `encodeSmxBundle` and `decodeSmxBundle`, is saved as `smx-cartridge-card.v2.ts`, and the lattice test (76) expects it. Merge the two when landing.
- `lab/planet-table-hologram.ts`: file 77 replaced file 24 (24 is in the chat if needed).

**Facts to correct on landing:**
- The ending song is 144 BPM:
  - it is "Four Floats" v4b at 1.2x tempo;
  - her last line, "See you, Sector Four", ends at 2:40.2, and the instrumental chorus loop starts on the next downbeat, 2:40.73;
  - the files are `public/audio/music-ending.mp3` (the song to the switch), `music-ending-loop.mp3` (three copies, loop `levels.json` start..end, the middle copy) and `music-ending-overclocked.mp3`;
  - `scripts/music-outro.py` writes `outro.json` with these numbers.
- Anything in the drop that assumes 112 BPM or a 1:57 outro is wrong. `packages/musicbox/src/harmonic-machine-choir.ts` has `SETMIX_SONG_BPM = 112`.
- **Briefs 25 to 32:** Argo's short versions are kept here in `docs/prompts/sidecar/` for their file lists only. The briefs in the repo, already agreed with him, stay the spec.
