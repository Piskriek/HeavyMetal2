# Running or streaming one game inside FIDELITY: research

Date: 2026-10-27. Status: research only, nothing installed or changed. Tags: **[V]** verified (a page or file I read), **[I]** inferred or computed by me, **[U]** unknown. Numbers in brackets point to the sources at the end. Builds on `docs/GUNFIRE_REBORN_BRIDGE_RESEARCH.md`. The route here never modifies, injects into or reads the memory of Gunfire Reborn.

## The short answer

Showing the game inside FIDELITY is easy, because it is only a picture on a surface. Playing it inside FIDELITY is the hard half, because a browser page cannot send keyboard, mouse or gamepad input to another window. The AI drone can work from the picture alone.

## 1. The category and how the known examples are built

- **Tony Hawk example:** I searched several ways for Call of Duty streamed inside a Tony Hawk game and found no such video. The only crossover I found is the reverse, a Tony Hawk tease inside Call of Duty: Black Ops 6 [9]. I treat the example as the category. [U]
- **CraftVM (Minecraft, updated 2026-10-09):** runs your own VirtualBox 7.2 virtual machines and streams the screen to in-world screens. Right-clicking a screen enters "use mode", which sends your keyboard and mouse to the VM. Others only get the picture [1]. [V]
- **MapVNC (Minecraft, MIT, beta):** draws a VNC desktop onto in-game maps and sends clicks back over VNC, with no published frame rate or latency [2]. MCVmComputers did Doom on Windows 95 inside Minecraft in 2020 [3]. [V]
- **Resonite:** its desktop share (beta) relays through a local MediaMTX server, so the host's bandwidth pays for every viewer; input and latency are undocumented [4]. The DesktopBuddy mod puts single windows on panels using Windows Graphics Capture, with VR-controller and touch input [5]. [V]
- **VRChat:** VRC Screen Bridge sends PC video as HLS to a world's video player, view-only [6]. [V]
- **Engine plugins:** Unreal's WindowCast [7] and Unity's UnityGraphicsCapture [8] turn any desktop window, including another game, into a texture through Windows Graphics Capture. [V]
- **Valve, 2026:** the Steam Frame headset streams PC games through Steam Link [34]. [V]

The pattern is: capture the window with an OS API, make it a texture or stream, then either the player uses the real window or a forwarding layer sends input back (CraftVM's use mode, VNC clicks). Capture is the easy half. [I]

## 2. Browser capture of a game window

- **Picking:** `getDisplayMedia` needs a user gesture and a secure context, prompts on every call, and cannot persist permission [10]. The page cannot narrow the picker; `displaySurface` is only a hint [11][12]. So FIDELITY can offer a "Link game screen" button, but the player ticks the game window each launch. [V]
- **Frame rate and cursor:** the frame-rate maximum reflects the surface's own rate, and `cursor` takes `never`, `always` or `motion` [11]. Read `track.getSettings().frameRate` to see what you got. [V]
- **Audio:** off by default, and the browser may return video only [10][11]. Tab audio and full-screen system audio have long worked on Windows [13]. A `windowAudio` option exists in the spec and was reported in Chrome 141; Windows behaviour is unconfirmed [11][13]. [V partly, U on Windows]
- **Browsers:** MDN calls it limited availability and the extras are Chrome-documented [10][12]. Target Chrome or Edge. [V]
- **Into three.js:** drei's `useVideoTexture` accepts a `getDisplayMedia` stream [14]. A three.js forum thread reports wrong colours on a screen-capture VideoTexture and suggests a colour-space change I could not confirm [15]. Test sRGB against linear. [V thread, fix U]
- **Cost:** I found no measured low-end GPU numbers. A 1080p RGBA frame is about 8.3 MB (about 500 MB/s at 60 fps) against about 110 MB/s for 720p at 30 fps, so ask for 720p. [I, my arithmetic]
- **Black frames:** exclusive fullscreen is a known cause in OBS threads, contested for newer Windows [16]. Run the game borderless windowed. [V as reports]
- **Important:** `getDisplayMedia` only displays. Input goes to the focused window, so the player plays in the real game window while FIDELITY mirrors it. [I]

## 3. Streaming from the faster PC, and input back

| Route | Page can embed it | Input back | Licence and notes |
|---|---|---|---|
| Steam Remote Play / Steam Link | No browser client; clients are Windows, Linux, Mac, mobile, TV, Pi, Quest [21] | Controller input; keyboard and mouse can be shared in Remote Play Together [21] | Official and free. The game's page tags Remote Play on Phone and Tablet only [33] |
| Sunshine + Moonlight | No (native clients) | Virtual gamepads via ViGEmBus or Virtual HID Broker, plus keyboard and mouse [17] | GPL-3.0; latest v2026.914.233613, 2026-09-15 [17] |
| moonlight-web-stream | Yes, as its own page; iframes undocumented, a fork merged an iframe-auth fallback 2026-10-02 [18] | Gamepad API and Keyboard Lock, both needing a secure context [18] | GPL-3.0, 735 stars, created 2025-08-24, pushed 2026-10-26; a newer-Sunshine bug was fixed in a prerelease [18] |
| linckosz/moonlight-web | Same idea | Keyboard, mouse, gamepad | GPL-3.0, 150 stars; "under 20 ms" is one author's setup; README looks AI-assisted and mentions telemetry and UPnP [19] |
| Parsec web app | Its own page, no embedding docs | Yes | Chrome only, WebRTC, no hardware decode; Parsec says it is worse than the app [22] |
| OBS WHIP out, WHEP in | Yes, a `<video>` plays it | None | Video only; latency claims about 150 to 400 ms, none measured here [23] |

- **Anti-cheat on virtual input:** a Helldivers 2 thread says Sunshine and Moonlight input stopped under nProtect GameGuard, and an Apollo issue says kernel anti-cheat does not recognise high-level virtual HID input [20]. User reports. [V as reports]
- **Steam versus Sunshine:** I found no source on how anti-cheat treats Steam's Remote Play input, so "official is safer" is a guess. [U]
- **Gunfire Reborn:** the EULA requires cheat detection (clause 2.6) [33], and whether virtual input trips it is unknown. The earlier report found `SendInput` failed in-game for one author, so test mouse-look and controller on each route. [U]

## 4. An AI watching the picture

- **Frames to the bridge:** draw the video to a 640x360 canvas, encode JPEG, POST every 1 to 2 s. `companion-bridge.mjs` caps bodies at 64 KB [35]; 640x360 at quality 0.6 is probably 25 to 45 KB, 720p would not fit. A `/frame` route needs its own cap, about 256 KB. [V cap, I sizes]
- **Claude vision:** cost is `ceil(w/28) x ceil(h/28)` tokens, so 640x360 is 299, 960x540 is 700 and 1280x720 is 1,196. Haiku 4.5 is $1 per million input tokens [24]. One 640x360 frame every 2 s for an hour is about $0.55 in image tokens, plus prompt and output. Anthropic says to resize before upload to minimise latency, and that lossy compression can hurt text [24]. [V formula, I totals]
- **Latency:** I found no solid time-to-first-token figure; a 6-request sample showed 0.92 s and Artificial Analysis lists about 106 output tokens per second [27]. I expect 1 to 3 s per short callout plus 0.5 to 1 s for speech: fine for "two enemies left, chest ahead", not reflexes. [I]
- **Gemini Live API:** takes video at 1 FPS, best at 768x768 [25]. A forum report says sessions dropped after a few minutes on the experimental tier [26]. It is the nearest ready-made "companion who watches and talks". [V, report old]
- **Local detectors:** no low-end-GPU YOLO benchmark turned up. The earlier report cites a YOLOv8n at 6.6 ms with TensorRT and 43 ms on CPU on an RTX 4060 laptop, trained on 357 screenshots [36]. A GTX 950M would be slower and I found no public labelled dataset. Use the vision model for v1. [I, U]
- **Products:** Microsoft Gaming Copilot takes gameplay screenshots when used from Game Bar; Microsoft says they are not used for training, which critics dispute [28]. NVIDIA G-Assist is a local Llama-based model with no screen awareness that I saw [29]. Razer Project AVA was a CES 2025 concept claiming screen analysis and callouts, with no confirmed release [30]. Gemini Live screen sharing reached all Android users in 2025 [31]. Google's SIMA 2 (November 2025) plays from screen pixels with no game internals [32]. [V]
- **ToS read:** all are screen-only by design and none touches game memory. That is the category FIDELITY would join; it is not a publisher ruling. [I]

## 5. Legal and terms of service

- **Duoyi EULA** (updated 2025-07-07, read through a summariser, so re-read it) [33]:
  - The licence is personal and non-commercial, and excludes "public performance, broadcasting, or competitive use" (4.1).
  - It forbids "framing or mirroring the Services on external platforms without prior written consent" (4.3(b)(iv)).
  - It forbids automated tools that monitor or copy content, with a search-engine carve-out (4.3(b)(iii)).
  - It forbids cheating programs, bots and scripts (7.1(g)).
  - It never mentions capture, streaming, overlays or accessibility. [V via summariser]
- **Reading, not legal advice:** a private picture of your own session on your own LAN is personal use, and an observer that only talks fits no listed prohibition. [I]
- **Three edges:**
  - Never sync the screen texture over FIDELITY's co-op network; that is public display.
  - "Mirroring on external platforms" could be stretched to a game picture inside another app. I think it targets websites, but it is unresolved, and 4.3(b)(iv) invites prior written consent, so the owner can ask Duoyi.
  - The drone must never send input to the game; that is a bot under 7.1(g).
- I found no Duoyi statement on streaming or creators. [U]

## Recommended route for FIDELITY

**Stage 0, view-only, the minimum viable path.**
1. On the faster PC, run the game borderless windowed at 720p and FIDELITY in Chrome. Add a "Link game screen" button on the Moon scene calling `getDisplayMedia({video:{displaySurface:'window', frameRate:30, cursor:'never'}, audio:false})`.
2. Feed it to a `<video>` and a `THREE.VideoTexture` on the surface. The player plays in the real game window and the 3D screen mirrors it.
3. Sample 640x360 JPEG at 0.5 to 1 Hz and POST to a new loopback-only `/frame` bridge route. Claude answers with the existing `say` and `hover-at` commands. Keep the bridge on loopback by running Claude on that PC or using an SSH reverse tunnel.
4. Needs: Chrome or Edge and the game, nothing else. Expect a mirror delay of 2 to 4 frames and callouts every 2 to 4 s. [I]

**Stage 1, this laptop shows the rig's game.** Steam Remote Play (official) streams to this laptop's Steam client and FIDELITY captures that window. Input goes to the Steam window, so a "console mode" that fills the view suits it. Wired LAN usually adds tens of milliseconds, and the capture hop adds one or two frames to the mirror only. [I]

**Stage 2, play inside the page, only after Stages 0 and 1 work.** Sunshine on the rig plus a separately run moonlight-web-stream server. Both are GPL, so keep them as separate processes, never bundled into the single-file build. Embedding is undocumented and must be tried. [I]

**Not the main route:** OBS WHEP (no input path) and Parsec's web app (section 3).

**What to verify, in order**
1. Chrome captures the Gunfire Reborn window in borderless mode without black frames; record the real frame rate.
2. Capture survives the window being covered, alt-tabbed or minimised.
3. VideoTexture colour and upload cost on the GTX 950M at 720p.
4. Mouse-look and controller through Steam Remote Play, then Sunshine, with no cheat-detection reaction in solo.
5. Real frames at 640x360 versus 960x540: callout quality, text legibility, measured time-to-first-token.
6. The `/frame` route's cap, rate limit and off switch.
7. moonlight-web-stream against Sunshine v2026.914, inside an iframe, with pointer lock.
8. The live EULA wording, and whether to ask Duoyi for written consent.

## Sources

1. https://www.curseforge.com/minecraft/mc-mods/craftvm
2. https://modrinth.com/mod/mapvnc
3. https://www.pcgamesn.com/minecraft/virtual-pc-mod-doom
4. https://wiki.resonite.com/Screen_sharing
5. https://thunderstore.io/c/resonite/p/DevL0rd/DesktopBuddy/
6. https://booth.pm/en/items/8360573
7. https://forums.unrealengine.com/t/alpha-xp-windowcast/2842165
8. https://github.com/ruccho/UnityGraphicsCapture
9. https://www.espn.com/gaming/story/_/id/44009981/tony-hawk-pro-skater-3-4-call-duty-easter-egg
10. https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getDisplayMedia
11. https://www.w3.org/TR/screen-capture/
12. https://developer.chrome.com/docs/web-platform/screen-sharing-controls
13. https://lists.w3.org/Archives/Public/public-webapps-github/2025Jun/0114.html and https://blog.addpipe.com/getdisplaymedia-allows-capturing-the-screen-with-system-sounds-on-chrome-on-macos.md
14. https://drei.docs.pmnd.rs/loaders/video-texture-use-video-texture
15. https://discourse.threejs.org/t/capture-screen-with-getusermedia-works-but-texture-colors-wrong/64787
16. https://obsproject.com/forum/threads/whoa-why-is-display-capture-able-to-capture-old-fullscreen-games-now-like-thief-this-is-cool.36765/latest and https://clip.dor.gg/en/blog/fullscreen-recording-not-working
17. https://github.com/LizardByte/Sunshine and https://api.github.com/repos/LizardByte/Sunshine/releases/latest
18. https://github.com/MrCreativ3001/moonlight-web-stream , https://api.github.com/repos/MrCreativ3001/moonlight-web-stream , https://github.com/MrCreativ3001/moonlight-web-stream/issues/96 , https://github.com/MemeMC-Network/moonlight-web-stream/pull/1
19. https://github.com/linckosz/moonlight-web
20. https://steamcommunity.com/app/553850/discussions/1/7599331177368790999 , https://github.com/ClassicOldSong/Apollo/issues/1202 , https://docs.lizardbyte.dev/projects/sunshine/v2026.214.224301/md_docs_2troubleshooting.html
21. https://store.steampowered.com/remoteplay
22. https://support.parsec.app/hc/en-us/articles/32381650129300-Use-the-Web-App-browser (read through a search snippet; my fetch returned 403)
23. https://obs-versions.com/blog/obs-webrtc-whip-streaming , https://medium.com/@contact_45426/ultra-low-latency-streaming-with-obs-whip-whep-and-broadcast-box-fa649bf87fbe , https://webrtchacks.com/webrtc-cracks-the-whip-on-obs/
24. https://platform.claude.com/docs/en/build-with-claude/vision
25. https://docs.cloud.google.com/vertex-ai/generative-ai/docs/live-api/send-audio-video-streams
26. https://discuss.ai.google.dev/t/multimodal-live-api-with-gemini-2-0-keeps-disconnecting-after-few-minutes/55599
27. https://langdb.ai/app/models/analytics/anthropic/claude-haiku-4.5 and https://artificialanalysis.ai/models/claude-4-5-haiku-reasoning
28. https://www.tomsguide.com/ai/copilot/gaming-copilot-ai-under-fire-but-microsoft-says-its-not-training-ai-models-on-your-data
29. https://www.nvidia.com/en-us/geforce/news/g-assist-ai-companion-for-rtx-ai-pcs/ and https://itc.ua/en/news/nvidia-updates-g-assist-ai-assistant-more-features-faster-responses-and-40-less-memory-consumption
30. https://www.pcworld.com/article/2570095/razers-project-ava-ai-esports-coach-could-make-you-an-esports-superstar.html and https://gigazine.net/gsc_news/en/20250108-razer-project-ava
31. https://9to5google.com/2025/03/03/gemini-live-video-screen-sharing/ and https://androidcentral.com/apps-software/android-os/gemini-live-real-time-screen-sharing-now-available-to-all-android-users
32. https://www.infoq.com/news/2025/12/sima-2-gemini-agent and https://www.technologyreview.com/2025/11/13/1127921/google-deepmind-is-using-gemini-to-train-agents-inside-goat-simulator-3/
33. https://store.steampowered.com/eula/1217060_eula_0 , https://store.steampowered.com/app/1217060/Gunfire_Reborn/ , https://steamcommunity.com/app/1217060/discussions/0/2274827383927435597 (the developer says mainstream controllers work)
34. https://en.wikipedia.org/wiki/Steam_Frame and https://www.wareable.com/vr/valve-steam-frame-standalone-headset-announcement-release-date
35. `scripts/companion-bridge.mjs` in this repo (64 KB body cap, loopback only, port 8220)
36. https://github.com/MiddleAgeMage/GunfireReborn-auto_aim_fire (numbers as quoted in `docs/GUNFIRE_REBORN_BRIDGE_RESEARCH.md` section 6)
