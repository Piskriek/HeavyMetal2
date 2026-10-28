# Menu holodeck research: cheap 3D main menu and warm-up

Date: 2026-10-28. Owner goal: a main menu that costs less CPU and GPU, built as a grid room, where the game's presets (materials, kits, shaders, sounds) compile and preload behind a visible progress bar. Minimum spec: i7-6700HQ with GTX 950M (see the low-end target rule). The current menu renders the lab behind it (`docs/prompts/sidecar/28-lab-choreography-and-vista.md:65`); the grid room would replace that.

Categories covered (owner examples rule): menus that over-consume (New World, Microsoft Flight Simulator); light 3D hub menus (Destiny 2 orbit, Rocket League garage, Hades hub, VR lobbies); shader and asset warm-up (Unreal, three.js, WebGL); on-demand rendering, frame caps, hidden tabs, reduced motion; holodeck vocabulary and its name.

Every claim below comes from a page I opened. Search snippets alone are not cited. Gaps are listed at the end.

## 1. Menus that cost too much

- **New World (2021).** Amazon said it would "implement a patch today that caps frames per second on our menu screen" after reports that the beta "causes the cards to overheat". The article points at the beta's "uncapped frame rate option, which lets the GPUs render as high as they can", and says the exact cause isn't known [1].
- **Microsoft Flight Simulator.** Players reported near-100% GPU load in the main menu, which several linked to the animated hangar scene behind it. Workarounds were user-made, not official: V-Sync, a 20 fps or 30 fps menu cap, or a driver-level limit [2].
- **Why menus burn GPU.** MDN says requestAnimationFrame calls "will generally match the display refresh rate", so an uncapped menu on a 120 to 144 Hz panel renders that many frames a second [3].
- **Fixes in the sources:** a menu-only frame cap, and no work while hidden. MDN says rAF calls "are paused in most browsers when running in background tabs" [3].

## 2. Light 3D hub menus

- Meta's WebXR guide: for fully static setups, bake lighting into lightmaps, and use light probes for dynamic objects. Shadow maps cost draw calls: drawing for a shadow map "counts against your overall scene budget for draw calls and triangles", and a shadow-casting point light needs six maps every frame [5].
- three.js says the most obvious fix is to "render once at the start and then render only when something changes" [6].
- **Destiny 2 orbit, Rocket League garage, Hades hub:** I did not open a source on their render costs. Searches returned a news piece on the Unreal 6 reveal and an unverifiable LinkedIn post. Treat any claim about these hubs as unverified. The design below rests on the platform sources only.

## 3. Shader and asset warm-up

- **Unreal.** Epic's PSO docs say global PSOs compile at startup, which "normally happens while navigating the main menu". PSO precaching "performs automatic PSO collection and async compilation for all PSOs that could be used during rendering". The loading screen should wait for outstanding precache requests [7]. GamingOnLinux summarizes this as moving most of the work to load time [9].
- **Stutter and warm-up.** Game World Observer, relaying Digital Foundry: games "will stutter fiercely for every user regardless of their hardware if shaders are set to compile at render time". Asynchronous compile adds CPU load but moves work to background or loading screens. More games compile shaders from the main menu on first launch, taking "a couple of minutes to tens of minutes" (Atomic Heart is one example) [8].
- **three.js.** compile() is "useful to precompile shaders before the first rendering", but "the (target) scene's lighting and environment must be configured before calling this method". compileAsync() resolves "when the given scene can be rendered without unnecessary stalling due to shader compilation" and uses KHR_parallel_shader_compile [4].
- **KHR_parallel_shader_compile.** It adds a non-blocking poll (COMPLETION_STATUS_KHR). The spec does not require asynchronous compile: "Implementations are free to optimize shader compilation and program linking via concurrency with or without this extension" [10]. The motivation was "long shader compile times on Windows" [11].
- **Workers.** OffscreenCanvas can be moved to a worker with transferControlToOffscreen(), keeping heavy work off the main thread. MDN lists it as Baseline, widely available since March 2023 [12]. Measure it on the GTX 950M before relying on it.
- **Splitting work.** web.dev: a main-thread task over 50 ms blocks input, so split work and yield between chunks. scheduler.yield() is limited (Chrome and Edge 129+, Firefox 142+, no Safari), so keep a setTimeout fallback [13].
- **Idle work.** MDN: requestIdleCallback is for low-priority work, and "a timeout option is strongly recommended for required work". MDN marks it limited availability because it "does not work in some of the most widely-used browsers" [14]. The page does not name Safari, so check the compatibility table before use.

## 4. On-demand rendering, caps, hidden tabs, reduced motion

- three.js OrbitControls: call render from the change event with a "render requested" flag. With damping on, calling render directly from change loops forever. Re-render on resize too [6].
- three.js says to use setAnimationLoop, not raw requestAnimationFrame, "for best compatibility" [4].
- MDN: visibilityState is "hidden" for a background tab, a minimized window, or a screen lock, and a visibilitychange event fires on change. MDN does not say what to pause [15].
- MDN: derive progress from the timestamp, not the frame count, because "the animation will run faster on high refresh-rate screens" [3].
- `prefers-reduced-motion` signals that the user prefers an interface that "removes, reduces, or replaces motion-based animations" [16].

## 5. The holodeck look and name

- The holodeck is a Star Trek device. Its first appearance was a "recreation room" in The Animated Series episode "The Practical Joker" [17].
- **Trademark:** I did not find a source showing who owns the word HOLODECK. The Justia and TrademarkElite records I tried returned 403. Search snippets listed third-party HOLODECK filings, but I could not open them, so they are unverified. Wikipedia's trademark footer concerns Wikipedia, not the term. Recommendation: do not use "Holodeck" in shipped UI, and run a USPTO TSDR search before any public name.
- **Look (my call, not sourced):** a generic sci-fi grid room, with a dark floor grid, emissive lines and a curved backdrop. Avoid Star Trek set layouts, insignia and colour codes.

## Design implications (proposals)

Owner rules that bind: low-end target (GTX 950M); loading bars rule (never start a screen choppy; preload behind a visible bar); toggle rule (competing techniques behind a Graphics setting with Auto).

1. **Static scene.** Baked lightmap or unlit shader, no real-time shadows, instanced grid, few materials. No dynamic lights, so the scene compiles once.
2. **Render on demand.** Render on start, input, hover and camera tween only. Idle means zero renders.
3. **Frame cap.** A menu-cap setting: Auto (30 on low-end detection, 60 otherwise), 30, 60, Off. Gate frames by timestamp inside setAnimationLoop.
4. **Hidden.** On visibilityState "hidden", stop the ambient loop and pause warm-up. rAF already stops in background tabs, but chunked setTimeout jobs do not, so they check visibility.
5. **Warm-up manifest.** Each preset (material, kit shader, sound) is a weighted job. Compile after the lights and environment are set. Use compileAsync where the KHR extension exists; otherwise compile one program per frame. The progress bar tracks completed weight. "Play" unlocks when the required set is done, and optional jobs continue behind it.
6. **Chunking.** Keep chunks well under 50 ms; I propose about 8 ms per frame. Yield with scheduler.yield() where present, setTimeout otherwise. Use requestIdleCallback only for optional prefetch, always with a timeout.
7. **Off-thread.** Procedural mesh, texture and audio generation go in a Worker. Adopt OffscreenCanvas only after a measured win.
8. **Reduced motion.** Under reduce, stop drift and pulses, hold a still frame, and fade rather than move.
9. **Measure on the min-spec laptop.** Record CPU ms and GPU ms per menu frame before and after, warm-up duration, and idle GPU use (should be near zero after warm-up).

## Gaps (not verified)

- Destiny 2 orbit, Rocket League garage and Hades hub render costs: no opened source.
- Tom's Hardware and PC Gamer returned headlines only. The New World quotes come from The Outer Haven [1].
- Epic's tech blog returned 403, so the streamed-object behaviour is unverified. Digital Foundry is cited only through Game World Observer.
- KHR_parallel_shader_compile browser support: MDN not opened.
- Battlefield 2042 and Elder Scrolls Online menu cases: search only, not opened.
- The "six draw calls" and "8 ms chunk" figures are my proposals, not sourced budgets.

## Sources

1. https://www.theouterhaven.net/?p=207327 (New World menu FPS cap, July 21, 2021)
2. https://forums.flightsimulator.com/t/100-gpu-load-in-the-main-menu/170096?page=2 (MSFS menu GPU load, user reports)
3. https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame
4. https://threejs.org/docs/pages/WebGLRenderer.html
5. https://developers.meta.com/horizon/documentation/web/webxr-perf-bp/
6. https://threejs.org/manual/pages/rendering-on-demand.html
7. https://dev.epicgames.com/documentation/en-us/unreal-engine/pso-precaching-for-unreal-engine
8. https://gameworldobserver.com/2023/04/07/shader-compilation-stuttering-pc-games-explained
9. https://www.gamingonlinux.com/2025/02/epic-games-devs-talk-about-solutions-to-the-unreal-engine-stuttering-issues-in-games/
10. https://registry.khronos.org/webgl/extensions/KHR_parallel_shader_compile/
11. https://www.khronos.org/webgl/public-mailing-list/public_webgl/1904/msg00000.php
12. https://developer.mozilla.org/en-US/docs/Web/API/OffscreenCanvas
13. https://web.dev/articles/optimize-long-tasks
14. https://developer.mozilla.org/en-US/docs/Web/API/Window/requestIdleCallback
15. https://developer.mozilla.org/en-US/docs/Web/API/Document/visibilityState
16. https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion
17. https://en.wikipedia.org/wiki/Holodeck
