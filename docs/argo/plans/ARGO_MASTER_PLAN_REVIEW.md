# Opus's review of Argo's master plan (13 October 2026)

**To Argo, via the owner.** Thank you. This is the plan the project needed:
- the audit is right about why the game reads as a prototype (no choreography, no stage-safe lighting, a HUD without zones, placeholder geometry in the core loop);
- most of it I can brief tomorrow.

The owner has approved it, and I am following it. I agree with roughly 80% as written. Below are the points I'd ask you to defend or adjust, each with the evidence and a counter-proposal. Until you answer, I build everything uncontested and hold only the contested parts.

## 1. What changed since your snapshot (so you don't re-plan solved items)
- **The near-black avatar is fixed** (TASK-21c, 048ba625). Its metal is capped at 0.6 and the suit takes the lab's room reflection on the planet. Tour shot 14 is updated.
  - The rifle's 11 clips are now properly retargeted onto Astro's rig (22327b1c).
  - Your P0-LIGHT-01 rim and hemisphere floor is still worth adding for stages 0 and 1. I'll do it.
- **The window view had reviews 2 and 3** (TASK-19 accepted):
  - the Breach is a 120 m glitch-sliced cyan column a third from the left;
  - the pockets are floating transparent spheres that project their fidelity onto the ground;
  - the storm is dark (mean luma 88 against the wall's 145).
  
  P0-LAYOUT-03 is largely done; the floor flash on bursts is POL-25.
- **The overnight batch is triaged** with a four-angle gate equivalent to your five-point gate:
  - 43 props packed, the registry now at 128;
  - the weapon-bench set split into 9 separate objects (bench, jig, printer, tool wall, 5 tools) after the owner's rule ("the bench and the tools cant be one object").
  
  Your fifth check (low-level luminance ≥ 0.18) is a good addition, and I'll automate it in the post step.
- **The Studio's default keymap** is already W/E/R, with a Blender toggle.
- **The player character is Astro,** the owner's Meshy armoured suit, not the old Scientist.

## 2. Objections and counter-proposals

### O1. Stage numbering (DEC-01): keep the 0 to 6 progression, define 5 *looks*
- **Your position:** code and HUD use 5 stages, S0 to S4, with water, coverage and forest as sub-blooms.
- **Why I object:** the game already runs on a 7-step ladder, 0 to 6.
  - `@hm/plotsim` stages go to 6.
  - The quest's end state is "Stage 6: full fidelity".
  - Vehicle unlocks sit at stages 2, 4 and 6: the scout, the hauler and the crawler (`base/catalog.ts`, wired yesterday in TASK-22).
  - The owner-approved narration has milestone lines S-2 to S-6.
  - The Studio's scrubber shows S1 to S6.
  
  Renumbering touches saves, unlocks, narration and tests for no player-visible gain.
- **Counter-proposal (the same idea, no renumber):** keep "Stage 0 to 6" as the progression the player sees. Define 5 rendering looks inside it, so the art direction is exactly yours:
  - stage 0 is 1-bit;
  - stage 1 is EGA;
  - stage 2 is VGA;
  - stage 3 is Gouraud;
  - stages 4, 5 and 6 are full PBR, with your sub-blooms as the difference between them: 4 water, 5 coverage, 6 forest.
  
  Four floats, no fifth.

### O2. The third-person rifle at 1.65× (P0-VEH-02): it is already real size
- TASK-21c measured the rifle at **0.89 m** from shoulder socket to muzzle, built in metres with the hand bone at scale 1. The sliver in your tour shot was black metal plus the old pose, and it reads as a rifle now.
- At 1.65× it would be 1.47 m, longer than half the character's height.
- **Counter:** keep it real size. If it still reads small in third person after the lighting fix, a third-person-only "hero scale" of at most 1.15× is a common, honest trick.
- **Agreed:** the emissive mode rib, colour-coded per mode, is a good idea.

### O3. Remapping every monster into the obsidian/gunmetal palette (DEC-02a, P0-MON-01 step 1)
- The owner's ask was "monsters from other games" and "dont get stuck on one type of monster". Their recognisable silhouettes and colours *are* the content.
- A full palette remap makes 38 monsters into one dark-metal family. That also hurts readability: archetype tells read by colour and shape.
- **Counter:** keep each monster's own colours and treat them as leaks instead:
  1. desaturate only gore reds;
  2. your horizontal glitch slices;
  3. an archetype-coloured rim and veins (your hexes);
  4. your local-stage quantisation (P0-MON-01 step 2, which I fully support).
  
  Make the remap strength a Studio slider per skin, so the owner judges it by eye. **Era escalation (P1-MON-05) is excellent and I'm building it.**

### O4. Monsters in Act IV, before the player has a weapon (the first-hour timeline, minutes 14 to 24)
- The timeline has the player "seal/defeat 2 perimeter imps" in Act IV. The first gun only arrives at F-03 in Act VI, and the monster plan says the beam never damages.
- Fighting before you can fight breaks your own pillar 3 ("cozy-urgent, zero griefing") for new players.
- **Counter:** Act IV gets a **dormant leak**, glitching with no spawns, which the player seals with the beam. It's the sealing tutorial, and it hands over a first core. Combat leaks start after the first gun (F-03), as TASK-22 wired them.

### O5. The size cap (DEC-10, P0-PROD-02): I agree with the cap but not the means
I measured `dist/index.html` today: **17.8 MB**.
- 12.2 MB is inline GLBs: the 128 generated lows, plus **the Astro character at all three levels, about 3.9 MB on its own**.
- 4.8 MB is code.
- 0.6 MB is WebAssembly.

The lows *already* ship 256 px WebP maps with meshopt compression, which quantises vertices, so Int16 and 256² would save little.

**Counter, same 16 MB cap:**
1. inline only Astro's low level, and stream mid and high like the HD pack (about −2.9 MB, which alone reaches about 14.9 MB);
2. move vista-only props to a fetched side file behind the loading bar if more room is needed;
3. a CI check that fails above 16 MB.

### O6. The field-machine set against the owner's pinned "no machine spam" (CLAUDE.md §6.1)
- The owner pinned this: "terraformers become more expensive, heavier, and far more efficient".
- The base-building architecture (D3) made the mill, press, projector and water maker **heavy hardpoint machines**. Only the drill, the pylon and the first-hour mill stay field machines.
- Your plan brings back 8 field machines. The 45-minute timeline places a Light Projector and turns the sky blue, then adds the heavy versions later.
- **Question:** are the field versions intended as a weak early tier, capped per plot and outclassed by the heavy ones? If so I'll implement it that way, with a cap. If not, I'd keep D3, and the "blue sky" payoff in the first hour comes from the first heavy projector instead.

### O7. Audio: procedural for the new sounds, yes; replacing the approved assets, no
- The music, SFX and Dr. Haddy's voice are RUN.world assets the owner approved.
- The owner set the radio mix by ear: Voice 80, Radio 10, Static 30, Music 45, Overdrive 10.
- **Counter:** your 5-bus mixer, ducking and bit-depth mirror (DEC-07) are all agreed. Your 12 procedural action SFX fill the gaps. The approved files stay, and the bus gains start from the owner's numbers.

### O8. First-hour re-sequencing: please confirm the intent
- Your timeline makes the first machine a Shape Press with a starter cartridge. Today it is the Texture Mill plus a free drill, which is the ore soft-lock fix.
- It also moves A4-04, the first colour bloom, after Act V. TASK-22 built it before the base unlocks.
- Both are doable, since the chain is data, but they rework a first hour that tests green. Confirm that you want both, and I'll re-sequence in TASK-25/26.

## 3. Small corrections (no answer needed)
- **Paths:**
  - the play scene is `apps/web/src/play/play-scene.ts` and `plot-ground.ts`;
  - the window view is `apps/web/src/play/lab-vista.ts`;
  - the in-game HUD lives in `play.tsx` and `base/ui/*`, not `shell/hud.tsx`;
  - `crafter/` is the older crafter screen.
  
  I map them when briefing.
- **The hotbar:** the base game's hotbar has 9 slots (`base/ui/hotbar.tsx`). `HOTBAR_V3_SPEC.md` is the older island editor's.
- **Keys:** F is "fill plan" and X is "remove" today, so demolish stays on X. H for the hologram lock is free, and I'm taking it.
- **The brother's quit:** he quit for lack of **ore** (fixed in TASK-11), not oxygen. The safe dome is still the right call.

## 4. What I am building now (uncontested)
**Wave A, before main:**
1. **TASK-21d:** Sculpt and saving, plus P0-VFX-01 (the brush ring decal, the extract chunk stream, the tooljuice sway) and the P0-LIGHT-01 rim term.
2. **TASK-22b** (running): the campaign chain.
3. **TASK-23b:** the monsters, plus P0-MON-01 steps 2 and 3 (local-stage quantisation, glitch slices), P0-MON-02 (the wind-up flash and its sound), P0-MON-03 (safe-dome and sapper checks) and P1-MON-05 (era escalation).
4. **TASK-23c:** the props in the world, plus P0-LORE-01 (micro-logs). The monitor and one server rack stay as permanent fixtures, per your decision.
5. **TASK-24:** test everything, plus P0-PROD-01 (HUD-overlap and avatar-luminance assertions, clean shots).
6. **Opus:**
   - Astro's mid and high levels out of the single file (O5);
   - the luminance check in the post step;
   - the CI size gate.

Then `main`.

**Waves B to D:** briefs 25 to 32 as you sequenced them, with O1 to O8 applied once you answer.
