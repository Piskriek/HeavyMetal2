# Arena art agent: the human scientist (SetMix concept art, sheet 13)

The owner (2026-10-07) approved the concept art set and went with my recommendation for the human in the lab: concept art first, then an Arena Battle that builds the human procedurally. Today the avatar maker draws the human in blocky voxels, which looks wrong in the PBR lab. Everything below the line is pasted into the Arena agent (Agent mode, repo `Piskriek/HeavyMetal2`), as for sheets 01 to 12 (`docs/prompts/arena-setmix-concept-art.md`).

Design notes for this brief:
- The battle that follows builds the human from smooth rigid parts in three.js (no skinning), animated like today's avatar (breathing, waving, walking). The design must split cleanly at the joints, with clothing hiding every joint.
- The avatar maker changes colours, hair, face and build, so the sheet must show the range, not one person.
- "Walking through makes you low poly" (owner, section 2): the same human at stage 1 is chunky low poly.

**Sent 2026-10-07** in Agent mode (GitHub connected, `Piskriek/HeavyMetal2` from `main`): https://arena.ai/agent/01a116da-63c3-7a80-a4be-b02c456036d4, branch `arena/456036d4-heavymetal2`. Review log below the brief.

---

You are the concept artist for **SetMix: The Resolution Crafter** again. Your sheets 01 to 12 are approved and merged into `main` (`docs/concept/setmix/`). This task adds one sheet: **13, the human scientist**, the player's character.

**Repository:** https://github.com/Piskriek/HeavyMetal2. Start from `main`. Your session can only push to its own `arena/<id>-heavymetal2` branch, so commit there. Touch nothing outside `docs/concept/setmix/`. Add sheet 13 to the README (with every prompt verbatim, like the others) and to the contact sheet.

**Read first:** `docs/concept/setmix/README.md` (your own world bible and registry), `docs/SETMIX_PLAN.md` section 2, and look at `01-lab-first-play.png`, `02-gate-power-on.png` and `06-sheet-gate.png` for the lab and the gate it must stand beside.

## Who the human is
- The player, a SCIENTIST who runs this lab: the one who turns the gate on, makes presets at the bench and walks through the gate onto the plot. Adult, capable, practical, a little worn by long shifts; not a soldier, not a superhero, not a cartoon.
- Seen: in the avatar maker in the lab (character creation, on a turntable, before the gate is first turned on), in menus beside the gate, and, later, other players visiting your lab. In play you mostly see through their eyes.
- Height about 1.75 m. The gate's opening is 2.6 m tall; the goblins of the other game are 1.3 m.

## The look
- A stylised, SMOOTH 3D game character that belongs in the photoreal PBR lab: clean smooth forms and real materials (fabric, rubber, leather, brushed metal, skin), simplified like a modern stylised game hero. Not photoreal skin and pores, not anime, not voxels, not a mannequin.
- Outfit, practical lab and field wear: a fitted work JUMPSUIT or overalls, a short LAB COAT or a sleeveless utility vest over it, a UTILITY BELT with pouches and a cartridge holster (the presets are cartridges), GLOVES, sturdy BOOTS, SAFETY GOGGLES (on the forehead or worn), an ID badge clip. Small believable details: seams, zips, reinforced knees, a tool loop.
- It must be buildable from SMOOTH RIGID PARTS joined at the neck, shoulders, elbows, wrists, waist, hips, knees and ankles, with the clothing hiding every joint: a collar at the neck, cuffs or a glove edge at the wrists, a belt at the waist, boot tops at the ankles, sleeve and trouser seams or pads at the elbows and knees. Draw the joints so a modeller sees where one part ends and the next begins.

## Sheet 13: `13-sheet-human-scientist.png` (16:9, the same sheet style as 06, 07 and 12)
1. A TURNAROUND of one default scientist in a relaxed A-pose: front, three-quarter, side and back, neutral light, on the lab's floor colour, with a height line (1.75 m) and the 2.6 m gate opening outline behind for scale.
2. SIX VARIANTS the avatar maker can make, each a full figure: different skin tones, faces, builds and ages; hair (short crop, buzz, bun, ponytail, curls, shaved sides), facial hair on some; outfit colourways (the same garment pieces in different colours: lab-white coat over teal, slate over orange, navy over yellow, and so on); goggles up or on. Same garment construction on all, so it is one parametric character.
3. AN EXPLODED VIEW of the rigid parts (head with hair, torso with collar and coat, upper arms, forearms with cuffs, gloved hands, belt and pelvis, thighs, shins with knee pads, boots), each labelled.
4. THREE POSES for the avatar maker's turntable and the game: breathing idle, a wave, mid-stride walking.
5. THE SAME SCIENTIST AT STAGE 1 (on the planet, "walking through makes you low poly"): chunky low poly, flat shaded, the same silhouette and colours, beside the full one.
6. IN CONTEXT: the scientist standing at the console beside the gate in the lab (the 01 lab, gate off), to show scale and the look in that light.

## Rules (from the approved set)
- One rendering style with sheets 06, 07 and 12: clean presentation renders on a dark grey ground, labels in the same type.
- No text on the character, no logos, no watermark.
- Write in the README: who they are, the garment pieces, the rigid parts and where they join, the variant ranges (skin tones, hair styles, colourways), then the prompts used, verbatim.
- Commit as you go. When the sheet, the README entry and the contact sheet are done, stop.
