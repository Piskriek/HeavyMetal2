# New planning session: SetMix, from scratch

The owner, 2026-10-06 evening: "you need a new session to plan everything from scratch, this has been a nightmare". Read this file whole, then the sources it names.

**Your first job is a plan, not code.** Put the plan to the owner and get a yes before building anything.

## 1. What went wrong (do not repeat it)

- **Features nobody asked for.**
  - A "Pixel Chimney" tower was made the centrepiece of the player's plot. It was taken from the Arena design document, which is a source of ideas, not a set of decisions.
  - The owner: "i dont want a chimney, ive never said put a chimney in".
  - Check every feature against the owner's own words in `docs/OWNER_ASKS.md`. Where the owner hasn't decided, ask.
- **Building before knowing what it should look like.** A planet, a lab and smooth models were built in one evening, then rejected piece by piece:
  - "one flat texture and some low poly trees is not good enough";
  - the lab's arch was set into a wall, when the gate must stand free;
  - an SVG "concept painting" was drawn by hand and rejected ("wtf was that?").

  Concept art comes first, from the Arena art agent, and the work then aims at it.
- **Spending reasoning on code that Arena models can write.** The owner: "use the battle ai to write you code to save usage for reasoning". Plan, brief, review and integrate; let Arena write the bulk.
- **Short turns, a lot of change.** The owner sends notes mid-work. Log each one first, and re-plan when the direction moves rather than carrying on.

## 2. What the owner wants: their words, gathered

All verbatim in `docs/OWNER_ASKS.md` (2026-10-06, 13:40 onwards). The essentials:

- **The SetMix game mode is the Resolution Crafter (13:40, 14:05).** Terraforming raises a planet's graphical fidelity.
  - Later: a goblin planet reached by a ship built with engineering, players opening up the galaxy.
  - Goblin Racing becomes standalone later, with its own start and world.
- **One shared planet that grows as players join (17:00).**
  - Everyone gets starting real estate.
  - You can explore other players' projects nearby instead of building.
  - Games like Goblin Racing orbit the SetMix planet, growing into solar systems, then galaxies.
- **The menu (18:40):**
  - menu items on the left, over a PBR lab;
  - a gateway on the right showing the planet "in all its glory" after terraforming;
  - excited for flora and fauna.
- **The planet (19:12, 19:20, 19:24):**
  - no low-poly plants or animals in a high-fidelity PBR scene;
  - "feel like im on a desolate planet not under a spotlight in a crator";
  - smooth models;
  - "make it look fkking good";
  - the lab should feel like Portal 2;
  - the planet feels like stepping into the 90s at first, but you can see far enough to spot other players' plots with trees and PBR scenes, so you are motivated to get started.
- **20:30, the key notes:**
  - **Models climb the stages too.** They are low poly at stage 1 and high poly over time, like their textures. The last stage is all high-fidelity PBR: textures, models and lighting. The owner said "stage 8"; the ladder has 6 stages, so confirm which.
  - **A coverage layer.** Textures reflect the growth of the flora, spreading over the ground like vines: moss, vines, leaves, dust, grass. Normal maps, not geometry.
  - **The last stage is a lush PBR forest.** Make concept art and work towards it.
  - **The gate** is a sci-fi door frame standing upright in the room, not joined to the walls, the size of two goblins stacked.
    - Wires run to control boxes and power relays, and there are machines in the room.
    - A window shows a different environment outside from the one in the doorway.
  - **Goblin Racing appears only in the Goblin Racing version**, at the top of the list; clicking it makes the doorway show the goblin planet. In the SetMix version the doorway shows a fully realised plot.
  - **When you click Play and enter the lab for the first time, the door is off.** You turn it on and things happen ("cos this is a game"). From then on the door shows your plot.
  - **"make the machines believeable, not floating butplugs please, use reasoning with this stuff".**
- **Latest:**
  - no chimney;
  - **"the machines should spew colorfull pixels while they operate, it should feel logical and connected"**;
  - paste the prompts into arena.ai yourself (the owner has it open in the built-in browser pane, Agent mode, repo `Piskriek/HeavyMetal2` on `main`);
  - use the battle AI to write code;
  - one flat texture and some low-poly trees is not good enough.

## 3. The game's own design (sources, not decisions)

- `docs/SETMIX_GAME_CONCEPT.md`:
  - the premise: a white high-fidelity lab, a freestanding gate, a low-poly moon;
  - Play mode starts in a power-starved lab;
  - the four metrics: Pixel Density, Vertex detail, Lumens, Water.
- `arena-gathered/setmix/site/src/data/gdd.ts` (the winning Arena design):
  - `LAB_MACHINES`: Material Synthesizer, Fusion Matrix, Hardware Fabricator, Planet Table, Cartridge Archive.
  - `FIELD_MACHINES`: a pixel emitter, Harmonic Mesh Vibrator, Lumen Mast, Clathrate Sublimator, Template Injector spire, Coherence Beacon, Compute Reactor, Relay Pylon. Each metric has its own colour: Pxd `#ff3d8a`, Vtx `#7cff4d`, Lx `#ffc13d`, Aq `#3dc8ff`, all `#b46bff`.
  - `RESOURCES`: Chromatic Crystal, Topology Shard, Photon Salt, Ice Clathrate, Logic Substrate and more.
  - `PLAY_ARC`: Act I "Cold Boot", where the gate draws power from everything else, through to Act VI.
  - Use these as the menu of ideas. The owner decides which become the game. Their names may also change: the owner never asked for a chimney.
- `docs/SETMIX_WORLD.md`: the shared planet over RUN's UGC, with no server of ours. Four owner decisions are still open there.

## 4. What exists in code (all on `main`; the gate and e2e pass)

**Packages** (landed and tested):
- `@hm/fidelity`: the four floats, stages, budgets per tier, demotions;
- `@hm/vault`: 50 texture cartridges;
- `@hm/texgraph`: math textures;
- `@hm/flora` and `@hm/fauna`: growth and ecology simulations, not yet drawn by the game;
- `@hm/smoothvox`: voxel to smooth mesh.

`docs/SETMIX_LANDING.md` lists every Arena drop, with what landed and what was parked.

**`apps/web/src/crafter/` (the Resolution Crafter screen):**
- `planet.ts`: a 12 km planet with plains to a 4.2 km horizon, 11 hand-placed sample neighbours, baked sun shadows and a boulder scatter.
- `world.ts`: one ground shader in three variants (PLOT, DISC, RING), a sky with the goblin planet, neighbour domes, instanced trees and boulders, the chimney and its plume.
  - **The chimney must go**, and the plot's centrepiece needs replanning.
  - The ground is one cartridge texture per stage. **The owner calls this not good enough.**
- `smooth-models.ts`: voxel boulders and trees meshed at three detail levels. **The trees read as blobs**; they need a real tree method.
- `creatures.ts`: smooth striders, tortoises and mantas moved by `@hm/fauna`.
- `shared-planet.ts`: the shared planet's slot rules (tested, not wired).
- `looks.ts`, `progress.ts`: stages, the wave, look baking.

**`apps/web/src/lab/`: the SetMix home.**
- A white panel lab with an **arch set into the back wall (wrong: the gate must stand free)**.
- A lush vista through the arch, made with a second camera.
- A goblin on the threshold.

**The shell (`shell/shell.tsx`, `goblin-front.tsx`):**
- The home is the lab; the galaxy shows only behind other screens.
- Goblin Racing is a menu entry in every version. **It should appear only in the Goblin Racing version.** There is no edition flag yet.

**Performance:** on the owner's laptop (i7-6700HQ, GTX 950M, the minimum spec) on Low, the crafter runs at 59.5 fps and the lab at 60 fps.

## 5. Working rules that stand

These are in `docs/STATUS.md` (standing limits) and in memory.

**Logging and authority:**
- Log first: every owner message goes verbatim into `docs/OWNER_ASKS.md`.
- Allowed: pushing to `main`.
- Not allowed: opening PRs, RUN deploys, scheduled tasks, paid actions, accepting terms, signing in anywhere, secrets in Arena prompts.

**Quality and performance:**
- Low holds 60 fps on the laptop.
- Preload behind a visible loading bar; never start a screen choppy.
- Load the frontend-design skill for any design task.
- Machines are believable: grounded, cabled, functional (memory: believable-machines).

**Arena:**
- Before writing an Arena prompt, read the art-agent lessons and the arena-vote memory.
- Battle mode: vote after testing to reveal the model names, and record them in `arena-gathered/README.md`.
- The owner completes any reCAPTCHA.
- Hand each agent a complete copy-paste prompt. Once it is pasted, the agent is working; stay out of its files.

**Repo gate:**
- `npm run verify`
- `E2E_GPU=1 E2E_SLOW=2 node scripts/e2e-smoke.mjs`
- Commit the build with `git add -f apps/web/dist/index.html`.
- Heredocs with apostrophes break Bash here; write scripts with the Write tool.

## 6. Open items for the plan

**Superseded briefs and chats:**
- `docs/prompts/arena-setmix-concept-art.md` has a chimney in it and is **superseded**. Rewrite it: no chimney; machines that spew colourful pixels while they run, connected logically by power, resources and cables.
- Two Arena Agent chats titled "You are the conce..." were started from older versions of that prompt today. Treat their output as unreviewed, and probably off-brief.

**Owner decisions to ask for:**
- What sits at the centre of a new player's plot, now the chimney is gone (for example, a starter machine set)?
- Is the last stage 6 or 8?
- The four questions in `docs/SETMIX_WORLD.md`.
- What "Play" is in the SetMix menu.

**Planned work not started:**
- STATUS SM14 to SM18: models by stage, the coverage layer, the free-standing gate, the editions, turning the gate on.
- The concept art set, and Arena battle prompts for the code, both written from the agreed plan.
