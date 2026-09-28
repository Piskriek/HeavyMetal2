Title: **Art wave 1: painted goblin parts, garage decals, track obstacles and race effects**
Base: `fix/flash-followups` · Head: `art/generated-wave-1` · Open as a **draft**.

---

Generated art for the Goblin Creator, the Ball Garage and the racetrack. **Four Codex agents work on
this branch at the same time** (ART-B1, ART-B2, ART-B3a, ART-B3b). Each pushes its own images and
reports in a PR comment; the owner ticks this checklist from those comments. Rules, style bible and
the agent prompt: `docs/tickets/art/README.md`. Each batch file has the exact prompt for every image.

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

### ART-B3a: track textures, obstacle and barrier sprites (13)
- [ ] 1–12 (boost pad, gap, ramp textures; obstacle and barrier sprites)
- [ ] 22 (shield bubble)
- [ ] B3a done: `check:edges` 0 failures, results table posted

### ART-B3b: animated race effects (9)
- [ ] 13–15 (pinball spinner, nitro flame, boost-pad flash)
- [ ] 16–18 (pickup burst, shield shatter, spring puff)
- [ ] 19–21 (landing shockwave, tree splinters, speed lines)
- [ ] B3b done: every sheet passes the §10.4 gates, results table posted

### Failed or regenerated images
(Agents list them here with their QA notes.)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
