Review of your first pass (185e9d7e), from the lead engineer. The kit reads well. The pieces are grounded, hazard skirts and floor cables are in, the heavy mill pours pixels from its vent, the scale figure is there and there are no chimneys. Please fix the following, in this session, on your branch.

1. RESTORE THE README. Your commit deletes about 569 lines of `docs/concept/setmix/README.md`: the world bible and the verbatim prompts of sheets 01–12. Those are canon and must stay word for word. Restore the file exactly as it is on `feat/monster-mash-exploration`, then only APPEND rows for 13 and 14 and their prompts. Check with `git diff feat/monster-mash-exploration -- docs/concept/setmix/README.md`: it must show additions only. Do the same check for `tools/contact.sh` (keep the old behaviour, only add 13 and 14).

2. STAGE 6 IS NOT "DECADES LATER". Fidelity stages raise the RESOLUTION of one and the same world (canon: sheet 08). They are not the passage of time, and the game is about restoring the world, not decay.
   - Each S6 panel is the same piece, in the same condition, rendered at full PBR: clean painted steel and ceramic, crisp decals, light honest wear at most. No rust sheets, no peeling, no ruin.
   - The ground around it is the lush, terraformed plot of sheets 08 and 10 at stage 6. Grass and wildflowers at its feet are good.
   - Update the sheet text ("the S6 row is the same piece, decades later") to say this.

3. ONE DESIGN PER PIECE. S1 must be the S6 design simplified, with the same silhouette, the same parts in the same places and the same proportions, just low poly and about 16 flat colours. These pairs differ today:
   - heavy mill: a tall box with a hopper at S1, a horizontal drum crusher at S6
   - pillar: a slender I-beam post at S1, a thick concrete column at S6
   - hardpoint: a flat socket ring at S1, a tall drum at S6
   - quantum bin: a small dish at S1, a large ring dish at S6
   Pick the stronger design of each pair (I suggest the S1 mill with its hopper and rear pixel vent, since it reads like the field mill grown up), and redo the other stage to match. Check every pair side by side before keeping it.

4. SCENE 14 MUST SHOW A SEALED OUTPOST, as briefed.
   - Two to four cells fully enclosed: walls on every side, roof panels on top, and the airlock as the only way in.
   - Every cable runs inside low ribbed steel floor cable covers (canon, sheet 06), never loose on the slabs.
   - Show where the mill's power comes from: a cable run in covers back toward the gate's junction box, or a repeater pylon beside the base.
   - Keep everything else: the stage-3 look, the gate in the distance, Earth in the sky, the mill on its 2 x 2 pad pouring pixels.

Same hard rules as before: no chimneys, nothing floating, no baked text in images, no goblins. Look at every render before you keep it. Rebuild sheet 13 and the contact sheet, push, and reply with the commit, plus a line saying how you checked items 1 and 3.
