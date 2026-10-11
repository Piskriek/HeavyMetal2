# The narration system: how the mentor's lines play in the game

The 37 lines in `docs/NARRATION_SCRIPT.md` are voiced (`apps/web/public/vo/<ID>.mp3`), and the owner approved them as a base. The radio mix is tuned (`apps/web/src/audio/mentor-mix.ts`, the owner's levels). Until now nothing in the game played them; only the `/radio.html` audition page did. This document is the design for wiring them in.

## What the research says (2026-10-11)
**Players want subtitles, always.**
- Subnautica players ask to mute the PDA voice and keep the text.
- They complain about clips that do not match their subtitles, and about a terminal that showed text with no audio.
- Deep Rock Galactic's tracker has a bug report on subtitles misaligning when callouts repeat.

**Players want to replay what they missed.** Satisfactory's Codex keeps a log of every ADA message, and players lean on it.

**Repetition is the main complaint.**
- Players of Satisfactory's holiday ADA lines wanted to yell "shut up already".
- Marvel Rivals and Apex players complain about lines repeated every match, and Respawn said it would review how often each line plays.
- Deep Rock Galactic patched Mission Control "repeating the progress shouts for the meteor multiple times".
- A cockpit voice queue that repeated "indefinitely when buttons are pressed" shows that queue flooding is a real failure mode.

**Triggers should be predictable and tied to real progress.** ADA speaks on tier, phase and research milestones and on a first discovery, and players can predict it.

**Priority and interruption.**
- Left 4 Dead 2's dialogue system (Elan Ruskin, GDC 2012) matches lines to world state by the most specific rule and breaks off sensibly when something more important happens.
- Firewatch's dialogue system started as an interrupt-heavy bark system (GDC, "Do You Copy?").

## The rules (`packages/narrator`, pure and deterministic, 13 tests)
1. **Three priorities: story, warn, bark.**
   - Story lines play once, ever. The saved radio log carries this across sessions.
   - Story lines play in their order (`after`).
   - They wait their turn and are never dropped.
2. **Repeatable lines have cooldowns:** the sync warning every 90 s at most, low health every 60 s, a refused build piece every 60 s.
3. **A higher line cuts a playing bark,** with a fade. Nothing cuts a story line, and a bark never interrupts anything.
4. **The queue holds four lines at most.** Past that the worst waiting warn or bark is dropped. Warnings go stale after 12 s and barks after 5 s, because old news is worse than silence.
5. **0.8 s of quiet between lines.**
6. **Every line that plays goes into the radio log, in order.** The player can replay it.
7. **Triggers are named game events** (`wake`, `breaker:thrown`, `moon:enter`, `stage:3`, `health:low` and so on), one table in `packages/narrator/src/fidelity.ts` that follows the script's "When" column. A test checks that the table and the voiced files match one to one.

## The game's side (TASK-11, `docs/prompts/sidecar/11-narration.md`)
- **Preload:** every clip is decoded behind the loading bar, and its length is measured and passed in (`fidelityRules(seconds)`).
- **Playback:** through the mentor mix, the same chain as the audition page: the radio band, drive, compressor and wet/dry blend at the owner's levels, the static bed under her voice, and the music ducked while she speaks.
- **Subtitles** are always available and on by default. They are shown even at voice volume 0, with the v3 audio tags (`[breathes]`, `[pause]`) stripped.
- **The radio log:** a list of heard lines with replay.
- **Settings:** dialogue volume and subtitles on or off.

**Her name: Dr. Gwen Haddy** (the owner, 2026-10-11). Subtitles say "Dr. Haddy"; the radio log and the credits use her full name.

Sources:
- [Satisfactory: ADA discussion](https://steamcommunity.com/app/526870/discussions/0/4843148932556367531)
- [Satisfactory wiki: Talk:ADA](https://satisfactory.wiki.gg/wiki/Talk:ADA)
- [Satisfactory: ADA tone thread](https://steamcommunity.com/app/526870/discussions/0/4629231101531926781)
- [Subnautica: Below Zero PDA voice mod](https://www.nexusmods.com/subnauticabelowzero/mods/290)
- [Below Zero: subtitles and voice](https://steamcommunity.com/app/848450/discussions/0/3110274289482490156)
- [Deep Rock Galactic 1.37 notes](https://mp1st.com/title-updates-and-patches/deep-rock-galactic-update-1-37-for-june-27-released-for-fixes)
- [Deep Rock Galactic: Mission Control](https://deeprockgalactic.fandom.com/wiki/Mission_Control?oldid=7113)
- [Marvel Rivals: annoying voice lines](https://n4g.com/?p=7145672)
- [Voice line queue flooding report](https://app.betahub.io/projects/pr-7782050516/issues/3980/duplicates)
- [Emily Short on Valve's dynamic dialogue (GDC 2012)](https://emshort.blog/tag/valve/)
- [Firewatch "Do You Copy?" (GDC Vault)](https://www.gdcvault.com/play/1024415/AI-for-Rapid-Prototyping)
- [Twelve Minutes: interrupted conversations](https://twelveminutesgame.com/?p=502)
