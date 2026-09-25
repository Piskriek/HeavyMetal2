Title: **Art wave 1: painted goblin parts, garage decals, track obstacles and race effects**
Base: `fix/flash-followups` · Head: `art/generated-wave-1` · Open as a **draft**.

---

Generated art for the Goblin Creator, the Ball Garage and the racetrack. **Three Codex agents work on
this PR one after another** (ART-B1 → ART-B2 → ART-B3), each pushing its images to this branch as it
goes. Rules, style bible and the agent prompt: `docs/tickets/art/README.md`. Each batch file has the
exact prompt for every image.

This PR only adds image files (plus the regenerated `src/game/meta/painted-parts.generated.ts` and
the new sheet names in `scripts/process-generated-animated.mjs`). Wiring the art into the game is
ART-I1, ART-I2 and ART-I3, after merge.

### ART-B1: painted goblin parts, part 1 (30)
- [ ] 1–10 (the six original parts + four eyewear)
- [ ] 11–20 (headgear, neck, first mouths)
- [ ] 21–30 (mouths, noses, ears, mohawk)
- [ ] B1 done: `check:edges` 0 failures, art budget passes, results table posted

### ART-B2: painted parts, part 2, and the Ball Garage (26)
- [ ] 1–11 (hair, eyes, four backgrounds)
- [ ] 12–21 (emblems, pressure gauge, band decals)
- [ ] 22–26 (patch plate, louver, roundel, garage backdrop, cradle)
- [ ] B2 done: band decals tile, `check:edges` 0 failures, results table posted

### ART-B3: track obstacles, barriers and race effects (22)
- [ ] 1–12 (boost pad, gap, ramp textures; obstacle and barrier sprites)
- [ ] 13–21 (effect sheets anim-53 … anim-61)
- [ ] 22 (shield bubble)
- [ ] B3 done: effect gates pass, `check:edges` 0 failures, results table posted

### Failed or regenerated images
(Agents list them here with their QA notes.)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
