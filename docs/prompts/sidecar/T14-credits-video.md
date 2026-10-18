# T14: the real-time credits video, the lab monitor jukebox, and the title entry (TICKET-14)

**Spec:** OPUS_NOTE_20, brief 33 (`docs/prompts/sidecar/33-credits-video.md`), and Argo's `docs/argo/notes/ARGO_NOTE_13_ticket14_credits_video.md`. **Source:** `arena-gathered/argo-ticket14/` (16 files). **Opus's staging run:** the timeline suite passes 8 of 8.

**Start only after T11b has landed** (it is in `play.tsx` now). T14 can run alongside TRIFT: TRIFT doesn't touch `play.tsx`, `lab-room.ts` or `apps/web/src/credits/`.

## Read this first
- **Copy:** the 13 new files under `apps/web/src/credits/` (`timeline.ts` and its test, `index.ts`, `credits-hud.tsx`, `monitor-jukebox.ts`, `pixel-font-ofl.ts`, and `ch/types.ts` with `ch1` to `ch7`). Also `CREDITS.md` and `goblin-front.tsx`, after checking each hasn't changed since Argo's snapshot (`git diff 530f832a HEAD -- <file>`).
- **The small hooks Argo lists** in ARGO_NOTE_13 go in by hand:
  - `lab-room.ts`: the old monitor's equaliser, plus `setMonitorEqualizer` on `LabRoom`;
  - `play.tsx`: the credits mount and the old monitor's E/R interaction.
- **The font (POL-41): check its origin before it ships.** Argo embedded a small WOFF2 he calls a "self-contained" 5x7 pixel font, but declared it under the real family names 'Share Tech Mono' and 'VT323'. Those belong to other OFL fonts (their reserved names), and the HUD may already use 'Share Tech Mono', so the embed would silently replace those glyphs.
  1. Decode the WOFF2: its name table isn't transformed, so Node's `zlib.brotliDecompressSync` plus a table-directory read gets you the name records.
  2. Report its copyright, designer and licence fields.
  3. Give it our own family name (for example 'FidelityPixel5x7'), used only by skins 0a, 0b and 1.
  4. If its origin is unclear or it's someone else's font, don't ship it. Generate our own 5x7 ASCII bitmap font with a small build script instead, or fall back to a pixelated CSS stack. Legal art only (CLAUDE.md, the owner's rule).
  5. Update `CREDITS.md` to match whatever ships.

## Do
1. **Install** the files above with the font fix, and run the timeline tests in the repo.
2. **The title screen's Ending Credits entry** plays the video. It runs from the AudioContext clock at 144 BPM:
   - "See you, Sector Four" at 2:40.2;
   - the hand-off from `music-ending.mp3` to `music-ending-loop.mp3` at 2:40.73;
   - chapter 7 looping on `levels.json`'s loop points.
   It walks the HUD skins 0a, 0b, 1, 2, 3 and 4 to 6, with the lyric pill and the right-third credits roll.
3. **The lab's old monitor:** E opens the credits replay; R plays "Four Floats (Overclocked)" through the world bus with the four-colour equaliser.
4. **No edits to `play-scene.ts`:** the chapters drive the existing scene and lab APIs, including the debug ones Argo names. If a chapter needs a `play-scene.ts` hook, stop and report it.

## Verify
- **A new `scripts/test-credits-video.mjs`:**
  - the title entry starts the video;
  - the chapter changes at the right times, read from the timeline clock;
  - the song hand-off happens at about 160.73 s, and the loop repeats;
  - the HUD skin changes through the chapters;
  - the credits roll scrolls;
  - Esc leaves cleanly back to the title;
  - the lab monitor's E and R work.
  Fast-forward the clock in the test rather than waiting 2:40. Take shots of three chapters, the lyric pill and the monitor, and look at every one.
- Report the build size (Argo estimates +28 to +46 KB).
- Run typecheck on the laptop. Run the rest through `scripts/test-on-3dpc.sh --only "<your paths>"`: `npm test`, the new test, `test-music-sfx` and `test-campaign` (45 of 45).

## Stay inside
`apps/web/src/credits/`, `goblin-front.tsx`, `CREDITS.md`, `lab-room.ts` (the monitor hook only), `play.tsx` (the credits mount and monitor interaction only), any font build script, and the new test. Use POL-221 to POL-230 for any new registry entries.

## Git
- Commit by explicit paths, after checking `git diff --cached --stat`.
- End messages with `Co-Authored-By: Claude Haiku 5.5 <noreply@anthropic.com>`.
- Never commit `apps/web/dist/index.html`, and never push.
