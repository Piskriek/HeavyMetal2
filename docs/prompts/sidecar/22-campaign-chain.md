# TASK-22: the campaign chain (Acts IV to VI, the monsters, the stage milestones)

After TASK-21. The quest (`apps/web/src/play/quest.ts`) stops at 'drill'/'done'. Continue it, in the order of the owner-approved narration (`docs/NARRATION_SCRIPT.md`). Build it on `@hm/questline` (landed, unused), with the quests as data: counts, conditions and unlocks. The game bumps counters on events (`placed:foundation`, `printed:scout`, `kill`, ...).

## The chain (each step: objective title, hint, the narration line once, and its unlock)
- **Act IV**
  1. **A4-01** Pick up the extraction rifle (from the lab rack; TASK-21).
  2. **A4-02** Mine 50 dirt with the beam and process it at the mill.
  3. **A4-03** Open the Studio terminal. This step only exists once the Studio ships (TASK-17); until then it is skipped.
  4. **A4-04** First colour bloom (stage 2).
- **Act V**
  1. **B-01** Place a foundation (the Structures tab unlocks here).
  2. **B-05** Place a linked bin.
  3. **B-04** Harvest raw pixels with the beam.
  4. **B-06** Make a blueprint at the drafting table.
  5. **B-07** Seal a room with life support.

  B-02 and B-03 are barks when a piece is refused or collapses.
- **Act VI**
  1. **F-01** Install the fabricator.
  2. **F-02** Print the scout (stage 2), get in, drive 200 m.
  3. **F-03** Build the weapon bench and make your first gun; equip it to the sidearm slot; swap one part.
  4. **F-04** The hauler unlocks at stage 4.
  5. **F-05** The crawler unlocks at stage 6.
- **The monsters:** after F-03 (once you can fight). Entities leaked from old games. The owner dropped the "Monster Mash" name and mode (2026-10-13), so never show that name.
  - Mobs (`@hm/shareware`, `monster-mash-combat.ts`) spawn on the planet: never within 30 m of the gate pad or inside a sealed base; more with each stage.
  - M-01 plays at the first sighting, M-02 at the first kill, and M-03 is the low-health bark.
  - Death: respawn at the gate with the inventory kept and the save intact.
- **Stage milestones:** the S-2 to S-6 lines, once per stage reached.
- **Synced and Solo:** the N-01 and N-02 lines on the first switch.

## Rules
- **Gates:** each unlock gates its build-menu tab, station or recipe. A locked item shows why ("Needs stage 2").
- **No soft-locks:**
  - every bill can be earned on the plot with the tools you have by then;
  - with `__dev.grant` off, a fresh player can finish Act V without a vehicle.
- **The journal:** the quest HUD shows the current step and the next. In the Esc menu, a Journal page lists the done and current steps, styled in the game's HUD (frontend-design skill).
- **Old saves:** saves past 'done' start at A4-01 if the rifle is still racked, or at the first unfinished step.

## Tests
- **Unit:**
  - the chain's data, every step reachable in order;
  - the gates (a locked item refuses with its reason);
  - the migration of old saves.
- **Extend `scripts/test-campaign.mjs`** with every step above. Use `__dev.grant` and `__dev.setStage` only to skip grinding, never to skip the action itself:
  - place the piece; print and drive the vehicle; make, equip and fire the gun;
  - kill a mob, die once and respawn;
  - each narration line once.
- **The usual green set.**

## Report
On the board:
- the chain as built;
- any step changed from this brief, and why;
- the results;
- one shot per act.
