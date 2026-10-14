# SETMIX GOOGLE DRIVE RELAY PROTOCOL (ARGO \<-\> OPUS)

**Shared Drive Folder:** `Setmix` (`1t1tffpFuWglFQK8jEzDqkimzcAIbgRkp`) **URL:** [https\://drive.google.com/drive/folders/1t1tffpFuWglFQK8jEzDqkimzcAIbgRkp](https://drive.google.com/drive/folders/1t1tffpFuWglFQK8jEzDqkimzcAIbgRkp)

## 1\. Why This Exists

Scrolling or scraping the long Gemini web chat in a headless browser burns time and Claude tokens. From now on, Gemini Argo drops machine-readable `.json` and `.md` bundles directly into this `Setmix` Google Drive folder, and reads Opus's status/requests from here.

## 2\. Instant 1-Line Unpack for `argo-strict-fixes-31files.json`

Download `argo-strict-fixes-31files.json` from this Drive folder into the repo root (or `arena-gathered/argo-relay/`) and run:

node \-e "const fs=require('fs'),path=require('path'),d=JSON.parse(fs.readFileSync('argo-strict-fixes-31files.json','utf8'));for(const\[p,c\]of Object.entries(d.files)){fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,c);console.log('Wrote',p);}"

### What `argo-strict-fixes-31files.json` Fixes:

1. **Song Facts Locked (`144 BPM`):**  
   - `"Four Floats"` v4b at `1.2x` \= **`144.0 BPM`** (`SETMIX_SONG_BPM = 144.0` in `harmonic-machine-choir.ts` and `FOUR_FLOATS_BPM = 144.0` in `credits/timeline.ts`).  
   - Last lyric `"See you, Sector Four"` ends at **`2:40.2` (`160.2 s`)**, and `public/audio/music-ending.mp3` switches at **`2:40.73` (`160.73 s`)** on the downbeat to the 8-bar (`13.329 s`) chorus loop in `public/audio/music-ending-loop.mp3` (looping the middle copy `13.329..26.658 s`), with `public/audio/music-ending-overclocked.mp3` wired for overclocked mode.  
2. **All 18 Tests Rewritten to `node:test` \+ `node:assert/strict`:**  
   - Placed at `packages/<pkg>/tests/<name>.test.ts` and `apps/web/src/<dir>/<name>.test.ts` with adjusted relative imports.  
3. **100% `noUncheckedIndexedAccess` & Purity Compliance:**  
   - Every `arr[i]` and `record[k]` guarded across all 12 flagged files.  
   - `Math.random` replaced with seeded `mulberry32` in `footstep-and-tire-roost.ts` and `screensaver-pipes.ts`.  
   - `credits/index.ts` driven strictly from `AudioContext.currentTime` (zero `performance.now()`, unused `isRunning` removed).  
   - `packages/questline/src/act789-chain.ts` is 100% pure (DOM helper moved to `apps/web/src/shell/custom-label-dom-patcher.ts`).  
   - `packages/presetcodec/src/smx-cartridge-card.ts` merges File 41 and File 74 keeping both APIs.  
   - `packages/treegen/src/stage56-lsystem-canopy.ts` fixes `export interface DeterministicTreeInstance`.

## 3\. Hyper3D Rodin Gen-2.5 (7-Day Trial) Priority Roster

Spend the 7-day trial on our largest, closest-inspected hero machines (legal art from our Concept Sheets 06, 07, 17, 19, 20; grounded believable machines; square box-section tubing; round only for wheels/tyres/barrels; empty cabs; separate hard parts per Rules 10–18):

1. **Brief 32 Missing Heavy Quartet (Days 1–2):** `heavy-shape-press` (\#28), `heavy-light-projector` (\#29), `heavy-water-maker` (\#30), `vehicle-fabricator-gantry` (Sheet 19).  
2. **Brief 32 Combat & Defense Pair (Day 3):** `perimeter-defense-turret` (split into `turret-plinth-base` \+ `turret-box-head`) and `pulse-scatter-sidearm` (Sheet 20).  
3. **Close-Inspection Hero Centerpieces (Days 4–6):** `freestanding-twin-gate-hero` (Sheet 06), `extraction-beam-rifle-hero`, `preset-combiner-bench`, `hardware-fabricator-bench` (Sheet 07).  
4. **Modular Vehicle Shells (Day 7):** `modular-scout-shell-v2` and `heavy-hauler-shell-v2` (empty cab with flat socket for `[-u-]` square yoke).