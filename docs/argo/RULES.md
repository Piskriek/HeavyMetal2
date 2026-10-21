# The rules (for Argo, and for everyone on FIDELITY)

Each rule below says where it comes from.
- **Binding:** the constitution and the owner's rules. A plan that needs one changed says so openly, as a proposal for the owner.
- **Engineering-process rules** (git, tests, secrets) are listed so you know them. You won't need to follow them yourself.

## A. The constitution ([CLAUDE.md](../../CLAUDE.md) §1, [CARDINAL_CONSTITUTION_AND_STAGES](../CARDINAL_CONSTITUTION_AND_STAGES.md))
1. **Four floats, one formula.** S = (Pxd, Vtx, Lx, Aq): pixel density, vertex density, light flux, aquatic level. Never a fifth global metric. New looks are tiers or settings, not new metrics.
2. **Purity is load-bearing.** Simulation packages are deterministic pure functions: no `Date.now`, no `Math.random`, no I/O. That is what makes the synced shared world and the replays work.
3. **A single-file distribution.** The game builds to one self-contained `index.html`. An optional HD pack sits beside it (owner: "Lean file + HD pack").
4. **Terraforming is graphical fidelity.** Stages run from 0 (1-bit Bayer dither) through 16-colour EGA, 256-colour VGA and Gouraud to full PBR. Running machines raise the plot's fidelity in a spreading wave.

## B. Who decides
5. **Argo and Opus decide features (since 14 October 2026).** "its yours and Argo's call to expand on the game/lore and make those decisions". Lore, narration, features, designs and styles are Argo's and Opus's calls. The owner provides resources and unblocking, and reviews the results objectively.
   - Decide deliberately: research, plan, record the decision in `docs/argo/plans/`, build, and act on the owner's review.
   - Design docs and GDDs are still ideas, never decisions.
   - No chimneys: an earlier unrequested one was rejected.
   - The owner's explicit rules in this list still bind; changing one needs his yes. (owner; before 14 October the owner decided each feature)
6. **Research before you design.** Before any feature, system, piece list, rule set or UI:
   - study how the closest games do it;
   - study what players praise and complain about (Steam threads, feature-request boards, popular mods);
   - look for the newest techniques ("there is always a new innovation and we are pushing the frontier").
   
   Write the findings with sources. The pattern is [BASE_BUILDING_RESEARCH](../BASE_BUILDING_RESEARCH.md). (owner, CLAUDE.md §3.4)
7. **Plan everything first, then execute.** Fold every new ask into the plan docs before anyone builds. (owner, 13 October)
8. **The owner's words are logged verbatim** in [OWNER_ASKS.md](../OWNER_ASKS.md). Check plans against them.
8a. **Check each other; no shortcuts (owner, 21 October 2026):** "you guys need to check each other, shortcuts are unacceptable". It came after TICKET-39 kept the old one-piece machine models as cores and bolted kit frames around them, when the intent was machines rebuilt from parts.
   - **Argo reviews Opus's briefs and plans** against the owner's words before building, and challenges anything that reads as a shortcut.
   - **Opus reviews Argo's bundles and rulings** before they are installed or turned into briefs: tests against the real packages, a measured fit against the real geometry, a look from four sides, and these rules. Problems go back to be fixed properly, never hidden behind a switch.
   - **No stopgap without the owner's yes.** If one is truly needed, it is named as a stopgap, with its cost and the ticket that removes it.

## C. How the world looks
9. **One natural world, just in lower resolution.** Stages raise the resolution of one believable, natural place; they don't swap it for a different place. A plot is 1 km. ([SETMIX_PLAN lineage](../ACTIVE_ROADMAP.md); owner)
10. **Believable machines.** Props are grounded, cabled where it makes sense, and functional: reason out how each one works. Nothing floats; there are no abstract floating shapes. Running machines spew colourful pixel plumes. (owner; CLAUDE.md §3.3)
11. **Square sections.** Use square or rectangular tubing, rails, lights, housings and gauges wherever the design allows. Round only where function needs it: wheels, tyres, gun barrels. (owner)
12. **No lettering, numbers or logos** on generated models. Empty vehicle cabs, with a square "[-u-]" yoke instead of a round steering wheel. (owner)
13. **No lane paint** on roads. (owner)
14. **No unrequested branding.** The "Monster Mash" name and mode were dropped. The monsters stay, as entities leaked from old games. (owner, 13 October)

## D. How assets are made (the generator's limits; owner rules)
15. **Chunky shapes.** No thin tubes, cages, holes, deep tread, belts, cloth, or heaps of small parts. Polygon reduction and the AI generator fail on them.
16. **Split hard parts into their own objects:**
    - anything wall-mounted (tools on a wall, a gun on a rack, cables);
    - **anything standing on a surface** (tools, a jig or a printer on a bench).
    
    The base model is made empty and the items are placed in code. Owner: "you need to model individual tools, the bench and the tools cant be one object with the limitations of the ai, thats why there are rules."
17. **Three detail levels:**
    - each one is a clean low cage with colour and normals baked onto it;
    - silhouette parts snap on at sockets;
    - every model is reviewed from four angles before it ships.
    
    See [RUNWORLD_PIPELINE](../RUNWORLD_PIPELINE.md) and [RESUME](../RESUME.md) §2.
18. **Legal assets only:**
    - Built-in third-party art must be BSD or CC0, with its notices kept in [CREDITS.md](../CREDITS.md). That covers Freedoom, Blasphemer, LibreQuake and Quaternius.
    - Never ship id Software's or other commercial games' assets.
    - Other games' monsters come only from the player's own files, loaded locally in the Workshop.
19. **Concept art** comes from the art agent, not from code-drawn SVGs. Claude reviews art; it doesn't draw it. (CLAUDE.md §3.1)

## E. Performance and feel
20. **The minimum spec is a GTX 950M laptop at 60 fps on Low.** Gaps go into [DEFERRED_POLISH_REGISTRY](../DEFERRED_POLISH_REGISTRY.md) rather than endless tuning. The owner's own machine has an RTX 3080. (owner)
21. **The toggle rule.** Look right and stay fast. Where two techniques compete, ship both behind a Graphics setting with Auto, and never stall. (owner)
22. **Loading bars.** Anything heavy preloads behind a visible loading bar, and a screen never starts choppy. (owner)
23. **No soft-locks.** A player can always get ore, always get back to the gate, and never loses a save by dying. Monsters never destroy a built piece, and every drop can also be earned without fighting (research: builder players hate losing work to raids). ([ONE_GAME_PLAN](../ONE_GAME_PLAN.md), [MONSTERS_PLAN](../MONSTERS_PLAN.md))
24. **UI quality.** No bare browser DOM. Use the game's telemetry HUD language: glass panels, glowing accents, Oxanium and Inter. See [UI_DESIGN_SYSTEM_AND_TOKENS](../UI_DESIGN_SYSTEM_AND_TOKENS.md). Screenshots for review are taken without overlays. (CLAUDE.md §3.2)

## F. Engineering process (for awareness)
25. **Never delete or weaken a check or test.**
26. **Git:**
    - the working tree is shared, so commit only your own paths;
    - never stash, reset or force;
    - work is pushed to `feat/monster-mash-exploration`, and `main` gets it after the test pass.
27. **Secrets:** never print, commit or type a token or password.
28. **Arena battles:** never vote (voting ends the chat). Pure, strict TypeScript modules with acceptance tests.
29. **Briefs and reports:**
    - sidecars work from briefs in [`docs/prompts/sidecar/`](../prompts/sidecar/), report on the board [SIDECAR_COMMS.md](../SIDECAR_COMMS.md), and stop their own servers;
    - claims must match what the code does. Reviews check them.
