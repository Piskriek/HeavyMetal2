# **ARGO\_NOTE\_13 — TICKET-14: Real-Time Credits Video (“Four Floats” v4b @ 144 BPM) & POL-41**

**From:** Gemini Argo (Creative Lead & PM)  
**To:** Claude Opus (Engineering Lead) & Francois (Owner)  
**Date:** 2026-10-18  
**Subject:** TICKET-14 Code Bundle Delivery (argo-ticket14-bundle.json) \+ Small Hook Table for play.tsx & lab-room.ts

## **1\. Summary & What Was Adapted**

Per [OPUS\_NOTE\_20\_ticket10\_intake\_and\_ticket14](https://docs.google.com/document/d/1CVOWvj9TFr25JH0bYDI47TpaayHijqM638eVtToFen8/edit?usp=drivesdk) and [ticket14-context.json](https://drive.google.com/file/d/19D2ia3542j32otYu5YrXDdAMPK6YgCcD/view?usp=drivesdk), I adapted the earlier relay draft of apps/web/src/credits/ and completed all 16 files in argo-ticket14-bundle.json (all 8 unit tests in apps/web/src/credits/\_\_tests\_\_/timeline.test.ts pass under node \--test):

> * **Rescaled 144 BPM Timeline to Actual Landed Track Length (2:40.73 \= 160.73 s):**  
  * CREDITS\_SONG\_END\_SEC \= 160.20 (*“See you, Sector Four”* at 2:40.2).  
  * CREDITS\_OUTRO\_START\_SEC \= 160.73 (2:40.73): exact handoff where music-ending.mp3 ends and music-ending-loop.mp3 begins on the same AudioContext clock.  
  * DEFAULT\_OUTRO\_META matches public/audio/levels.json (outroStart: 160.73, loopStart: 13.328957, loopEnd: 26.657914).  
  * 6 contiguous vocal chapters cover 0.00 .. 160.73 s with zero gaps (ch1: 0..25s, ch2: 25..50s, ch3: 50..75s, ch4: 75..101.67s, ch5: 101.67..128.33s, ch6: 128.33..160.73s), followed by ch7-outro-loop (160.73 .. Infinity).  
  * Fixed HUD skin progression across chapters to walk all 6 skins monotonically: \['0a', '0b', '1', '2', '3', '4-6', '4-6'\].  
> * **Modular Chapter Drivers (apps/web/src/credits/ch/ch1..ch7.ts):**  
  * Each chapter lives in its own module under apps/web/src/credits/ch/ and drives the existing PlayScene and LabRoom hooks (setFidelityStage, setLabActivity, setBeamHeld, setBeamFiring, setBeamSealing, setCameraView, debug.teleport, debug.setAltCam, debug.setWindowView, debug.setWaterVisible, debug.setCoverageActive, and room.setStorm) without touching play-scene.ts.  
  * ch5-window-heal.ts and index.ts import computeVistaRimGain from ../play/lab-vista-math to drive the physical 12 m × 3.2 m Lab window roof-seal and lunar vista rim bloom.  
> * **POL-41 Retro Pixel Font Subset (apps/web/src/credits/pixel-font-ofl.ts):**  
  * Embeds a valid WOFF2 ASCII (0x20..0x7E) 5×7 pixel-grid font under SIL OFL-1.1 as a data:font/woff2;base64,... URI and injects @font-face rules for 'Share Tech Mono' and 'VT323' plus \[data-fidelity="0a"|"0b"|"1"\] rules into document.head.  
> * **Lab old-monitor Jukebox & 3D 4-Colour Equaliser (monitor-jukebox.ts & index.ts):**  
  * OLD\_MONITOR\_ACTIONS defines both prompts on the Lab desk monitor: \[E\] Replay Ending Credits and \[R\] Play "Four Floats (Overclocked)".  
  * createMonitorEqualizer3D(parent) builds the 4-bar 3D equaliser (\#38bdf8, \#a855f7, \#f59e0b, \#10b981) driven at 144 BPM by monitorEqualizerHeights(elapsedSec).  
  * playMonitorOverclocked(pos) routes music-ending-overclocked through gameAudio.play3d(..., { bus: 'world', key: 'old-monitor-overclocked' }) so it plays spatially from the desk monitor speaker.

## **2\. Bundle Manifest (16 Files in argo-ticket14-bundle.json)**

> 1. CREDITS.md  
> 2. apps/web/src/credits/pixel-font-ofl.ts  
> 3. apps/web/src/credits/timeline.ts  
> 4. apps/web/src/credits/monitor-jukebox.ts  
> 5. apps/web/src/credits/credits-hud.tsx  
> 6. apps/web/src/credits/index.ts  
> 7. apps/web/src/credits/\_\_tests\_\_/timeline.test.ts  
> 8. apps/web/src/credits/ch/types.ts  
> 9. apps/web/src/credits/ch/ch1-cold-boot.ts  
> 10. apps/web/src/credits/ch/ch2-one-bit-facets.ts  
> 11. apps/web/src/credits/ch/ch3-chorus-bloom.ts  
> 12. apps/web/src/credits/ch/ch4-archive-rifts.ts  
> 13. apps/web/src/credits/ch/ch5-window-heal.ts  
> 14. apps/web/src/credits/ch/ch6-suitcam-finale.ts  
> 15. apps/web/src/credits/ch/ch7-outro-loop.ts  
> 16. apps/web/src/shell/goblin-front.tsx

## **3\. Small Hook Table for lab-room.ts and play.tsx**

| Target File | Hook Location | Exact Call / Snippet   |
| :---- | :---- | :---- |
| apps/web/src/play/lab-room.ts | When building the old-monitor prop group, mount the 4-bar 3D equaliser and tick it in update(dt, elapsed) | const monitorEq \= createMonitorEqualizer3D(oldMonitorGroup); In update(dt, elapsed): monitorEq.update(elapsed); Expose setMonitorEqualizer(on: boolean): void { monitorEq.setActive(on); } on LabRoom. |
| apps/web/src/play/play.tsx | 1\. Mount \<CreditsHud /\> & CreditsDirector when triggered from Title Screen, Campaign Finale, or old-monitor \[E\]. 2\. Handle old-monitor \[R\] interaction to toggle the overclocked speaker track \+ equaliser. | const director \= new CreditsDirector(camera, { onStateTick: setCreditsState }, playScene); await director.loadAssets(); director.start(false); In frame loop while credits active: director.stepAtTime(undefined, dt); On old-monitor \[R\] key: playMonitorOverclocked(monitorWorldPos); room.setMonitorEqualizer(true); |

