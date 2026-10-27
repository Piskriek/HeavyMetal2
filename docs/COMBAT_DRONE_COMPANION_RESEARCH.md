# Combat drone companion research

Date 2026-10-27. Scope: a hovering Overwatch drone (Ray-7) that fights, finds things, supports the player, helps with utility tasks and edits modular game content. Bracketed numbers are sources, listed at the end. "Verified" means a cited source states it. "Inference" is my own conclusion. (weak) marks search-result summaries, forum posts and low-authority blogs.

## 1. Comparable companions

**Deep Rock Galactic, Bosco (solo only).** Verified: you mark with a laser pointer and he acts. Mark an enemy to attack, ore to mine, a spot to light for up to 20 s, a node to repair, a vehicle to guard. A shout recalls him and cancels the task. He revives you (40% health, 2 to 4 charges), fires at threats within range of both of you, is invincible, and is weak against large creatures, so players must help [1]. Closest match to FIDELITY.

**Helldivers 2 Guard Dog.** Verified: no commands. Engages out to 30 m, holds a target until line of sight is lost for several seconds, cannot hit past about 45 degrees vertically, fires the player's rifle round at 660 rpm [3]. Complaints: floats too low and shoots the owner in the head, height follows the crosshair, the laser variant burns teammates, it sometimes "just floats there" or spins between targets. Others call it a fine free auto-aiming turret [2].

**Warframe sentinels.** Verified: ranked precepts where higher ones interrupt lower ones; postures such as Protector (enemies within 15 m of you), Persistent (one target until down) and Frenzied (spreads hits); teleport to catch up [4]. Complaints (weak): confused pathing, standing still under fire [5]. No ping.

**Remnant 2 Handler dog.** Verified: one context button; press attacks or heals, double tap recalls, hold buffs [8]. Praised for aggro and revives [7]. Called too strong, yet weak against flyers (weak) [7].

**Others.** Titanfall 2 Titans use a follow or guard toggle [16]. Mass Effect gives attack, move and rally orders plus pause-and-power; players report ignored orders and squadmates shooting cover (weak) [14]. Ghost Recon: Future Soldier lets you tag four enemies so teammates focus fire; reviewers praised it, but easy difficulty "practically plays itself" [15]. Far Cry 5 Boomer marks enemies and fetches weapons but fights weakly [29]. Destiny Ghost mods detect caches and resources at 20 to 75 m [26]. Deathtrap is a timed melee decoy (weak) [20].

**NVIDIA ACE (PUBG Ally, inZOI).** Verified: a 2B-parameter on-device model handles speech and intent while a behavior tree runs movement, aiming and combat at tick rate; reflex actions never wait for the model. It is limited to one map, one mode and a fixed item list, and output is non-deterministic [9]. Coverage doubts novelty [36]. This is FIDELITY's fast and slow split.

Ping or tag to command: Bosco, Future Soldier, Boomer, Apex-style pings [30].

## 2. Failure modes and fixes

- **Blocking shots.** Skyrim followers step into the player's path (weak) [18]; Left 4 Dead bots walk into fire (weak) [19]; Guard Dog fires through the owner [2]. Fix: sit off the aim line, check the fire lane.
- **Too strong or kill stealing.** Handler [7]; Future Soldier [15]. Bosco is deliberately weak against big targets [1]. Fix: cap damage share.
- **Useless or silent.** Guard Dog "won't shoot"; Dog Breath is near-universally disliked [2]. Fix: reliable output with tracers.
- **Ignoring orders.** Mass Effect [14]. Fix: persistent orders, visible acknowledgement, a recall.
- **Bad pathing.** Warframe [5], Palworld stuck workers (weak) [32]. A flyer avoids most of it; add a teleport leash [4].
- **Target thrashing.** Re-picking the nearest every frame makes AI flip-flop (weak) [12]; Guard Dog laser spins [2]. Fix: sticky target.
- **Chatter spam.** No cited complaint found. Valve's dialogue is interruptible and remembers history [37]. Inference: cap barks.

## 3. Technique

**Targets.** Verified: a McGill study found "threat ordering" best (quick to kill, hurts a lot), beating closest, strongest and weakest, and found allies should focus one enemy because switching wastes time [10]. Uncharted 2 weighted distance, cover, who the enemy targets, a negative weight when allies share a target, and a stickiness factor [10]. A scorer sums proximity, recent damage, visibility and designer bias (-1 to 1), with a sticky bonus of about 10 to 20% and threat decay of 8 to 12 s (weak) [11].

**Hysteresis.** Keep the target unless a challenger beats it by a margin and holds the lead for a dwell time (weak) [12]. Use separate enter and exit thresholds, for example 10 m in and 13 m out [13].

**Fairness.** Human visual reaction is about 200 to 300 ms (weak) [23]. Designers add "grace" misses; Mutant Year Zero lowers hit chance after a hit to avoid streaks [22]. A vendor note says a single line trace is wrong for a bullet with width and allies should be predicted forward (weak) [24].

**Damage share.** Bosco does 4 damage per round in 5 to 12 round bursts with a 0.4 to 1.0 s gap; rockets deal 10% friendly fire [1]. Guard Dog matches the player's rifle and is limited only by magazine size [3]. Inference: no one publishes a tuned percent of player DPS, so my figure below is a playtest starting point.

## 4. Beyond combat

**Finding and marking.** Verified: Warframe Vacuum auto-pulls pickups, ammo and mods from 8.5 to 13.5 m [6]; Carrier converts ammo pickups [25]. Apex pings are contextual (enemy, loot, location, ammo request), cut the need for voice, and the character speaks the callout; Borderlands 3 copied this [30][31]. Dogmeat takes point-and-command orders (Get, Go, Inspect, Stay) and a search command [28]. No Man's Sky scans in a cooldown pulse, Satisfactory's object scanner beeps faster as you close in; players reported scanner onboarding confusion [27]. I found nothing on a Gunfire Reborn loot companion.

**Support.** Bosco revives with limited charges [1]; Handler heals, revives and pulls aggro [8]; Warframe companions cannot die and recover after 60 s [4]. Aggro-pulling is praised but fuels "too strong" complaints [7].

**Utility.** Bosco lights, mines, repairs and guards on a ping [1]. Palworld workers automate base tasks, with idle-worker complaints (weak) [32]. I found no verified precedent for companion door-opening or hacking.

## 5. Companions and agents that edit the world

**Verified.**
- **Minecraft agents.** Voyager has an LLM write executable skills, refined by game feedback, errors and self-verification [38]. Mindcraft bots take chat orders, can pursue a "blueprint to construct" goal, and keep code execution off by default because of injection risk; the README mentions no confirm or undo [39]. A blog says builds land where the bot stands, often awkwardly (weak) [39].
- **Ghost then build.** Litematica-family mods show a schematic as a ghost and place blocks; Baritone builds from those schematics. Known faults: wrong blocks placed and phantom items (weak) [41].
- **Worker NPCs.** Palworld Handiwork pals build any blueprint the player places, faster at higher suitability, and repair damage [42]. Enshrouded NPCs do not build; the player places pieces and a builder NPC is only a request (weak) [43]. Nothing found on Valheim, Garry's Mod or Dreams.
- **Blueprint projectors.** Space Engineers projects a hologram that welders fill in. Complaints (weak): no multi-grid blueprints, grid size must match, loads fail. Satisfactory players complain the designer is small, blueprints do not auto-connect and need real materials [44].
- **Room tools.** The Sims 4 lets you stretch a room while the house snaps around it, aiming for LEGO-like ease. Townscaper is click to build, right-click to remove, with procedural details praised, though its curved grid makes exact shapes hard; no undo details found for either [45].
- **In-editor AI.** Roblox Studio's Planning Mode turns a prompt into a reviewable, editable plan before any change; the article does not cover undo [46]. Third-party Studio plugins wrap each AI change in one Ctrl+Z step (weak) [47]. UEFN's 2026 AI tools author NPC personalities and Verse code, not geometry [48].
- **Reception.** Minecraft text-to-build app OSU.ai drew mostly negative reaction for automating the creative core (weak) [49]. I found no source on "wrong scale" or unasked edits.

**Inference.** Selection should be a ping on the target module plus a spoken or typed intent. The drone proposes a translucent violet ghost diff (added walls, moved rooms), the player confirms, and each confirmed proposal is one undo step. Snap to the module grid, run kit validation before showing the ghost, and never edit unrequested. The drone builds visibly by flying material to the site.

## 6. Drone body and readability

- **Anatomy.** Verified: a central body holds payload, power, sensors and flight controller; arms carry motors and rotors; guards surround propellers; the camera sits on a gimbal [33]. Ducted rotors are safer and quieter, with design-dependent efficiency [33].
- **Moon problem.** Inference: rotors give no lift in vacuum. Helldivers uses rocket thrusters [3]. Use square thruster pods with plumes on the Moon and ducted rotors on Earth plots.
- **Readability.** Verified: distinct silhouettes, strong value contrast and a restricted team palette let players read allies instantly [34][35]. Inference: wide square quad frame, forward sensor box, violet #b84dff emissive strip against warm DOOM reds and grey regolith. Show state with light pulse and thruster glow, never text.

## Recommendations for FIDELITY

All numbers are inference, for playtest tuning.

**Behavior.**
- **Engage range:** acquire at 25 m, drop at 30 m, only targets within 30 m of both drone and player; 45 degree vertical limit.
- **Fire:** 4 round bursts at 10 rounds per second, 0.6 s between bursts.
- **Damage:** 40% of the player's matching weapon per shot, about 30% of player sustained DPS, scaled 0.2 to 0.4 by difficulty. No friendly fire on the player.
- **Reaction:** 250 ms to acquire, 400 ms slew after a switch. Aim error 2.5 degrees at 20 m, tightening to 1 degree after 1 s of tracking; the first burst may miss.
- **Hysteresis:** sticky bonus 15%; challenger needs a 20% lead held for 400 ms; minimum 1.5 s per target; hold until death, 2 s without line of sight, or beyond 30 m; threat decays over 10 s.
- **Score:** threat ordering, plus proximity to the player and damage taken by the player. Kill-steal guard: skip an enemy the player is aiming at within 5 degrees if its health is below the player's burst kill threshold.
- **Position:** hover at player eye height plus 0.6 m, 2.5 m right of and 1.5 m behind the player. Rest distance 3 m (2 to 5 m), in combat 4 to 7 m, teleport leash at 25 m.
- **Aim-cone keep-out:** body stays outside a 15 degree half-angle cone around the aim ray. Fire only when a 0.4 m capsule lane is clear of the player's predicted position; hold fire within 2 degrees of the player.
- **Dodge:** strafe every 1 to 2 s while targeted.
- **Orders:** the slow brain sets a standing order with a 60 s default expiry; reflexes never wait on it [9]. Chatter: one bark per 8 s, 60 s per line, danger first, silent during narration.

**Commands.** Follow, Hold, Cover left/right/rear, Focus (target or "the big one"), Hold fire, Weapons free, Scavenge (leashed), Scout, Guard, Light, Fetch, Open, Mine, Propose edit, Recall (cancels all, like Bosco's shout). Pings: enemy gives Focus for 8 s; item gives Fetch or mark; spot gives Hold or Move; door gives Open; ore gives Mine; module gives Propose edit.

| Category | Drone does | Command | Priority |
|---|---|---|---|
| Enemies | Call out, mark, shoot | Automatic; ping to Focus | P0 |
| Weapons, ammo, health, armor, shields | Highlight within 30 m, fetch on request | Auto mark; ping to Fetch | P0 |
| Objectives, exits, portals, waypoints | Marker and route line | Ping or LLM order | P0 |
| Hazards, traps | Warn and mark | Automatic | P1 |
| Find guns | Search a radius, return | "Go find weapons" | P1 |
| Revive, heal | Revive at 40%, 2 charges | Automatic | P1 |
| Light | Spot-light for 20 s | Ping a dark spot | P1 |
| Keys, doors, chests | Mark; open on request | Ping | P1 |
| Edit modular content (lab layout, add room) | Ghost diff, apply after confirm, one undo step | Ping module plus intent | P1 |
| Build from preset or blueprint | Ghost, then drone builds over time | Order | P2 |
| Currency, mods, ore | Pull within 10 m by visible tether | Auto; Mine on ping | P2 |
| Scan, secrets | Cooldown pulse, hints only | Hold key | P2 |
| Buff, decoy, carry, resupply | Brief decoy; carry; convert ammo | Order | P2 |

## Sources

[1] https://deeprockgalactic.wiki.gg/wiki/APD-B317
[2] https://steamcommunity.com/app/553850/discussions/0/4697909843219983781
[3] https://helldivers.wiki.gg/wiki/AX/AR-23_Guard_Dog
[4] https://wiki.warframe.com/w/Pet
[5] https://forums.warframe.com/topic/1310622-companions-need-better-survivability/
[6] https://wiki.warframe.com/w/Vacuum
[7] https://twinfinite.net/guides/remnant-2-archetype-tier-list-all-classes-ranked/ ; https://steamcommunity.com/app/1282100/discussions/0/3807282428858525248
[8] https://www.ginx.tv/en/best-handler-archetype-build
[9] https://developer.nvidia.com/blog/how-krafton-built-pubg-ally-a-co-playable-character-powered-by-nvidia-ace/
[10] https://www.cs.mcgill.ca/~jtremb59/Papers/fdg2014_paper_32.pdf
[11] https://www.strayspark.studio/blog/ai-threat-tables-target-selection-ue5
[12] https://bugnet.io/blog/how-to-fix-enemy-aggro-switching-to-the-nearest-target-every-frame
[13] https://bugnet.io/blog/how-to-fix-fsm-flicker-without-hysteresis
[14] https://forums.ea.com/discussions/mass-effect-franchise-discussion-en/squadmates-unreliable-bugged/9174020 ; https://www.gamerevolution.com/?p=45303
[15] https://pcgamer.com/ghost-recon-future-soldier-review
[16] https://primagames.com/eguides/titanfall-eguide/training/titan-fundamentals
[18] https://steamcommunity.com/app/489830/discussions/0/282992646986872499
[19] https://steamcommunity.com/app/550/discussions/0/598517032946774870
[20] https://www.gamerevolution.com/originals/3863-borderlands-2-mechromancer-skill-tree-tips-and-analysis
[22] https://www.gamebanshee.com/k4rck
[23] https://trtc.io/blog/details/average-reaction-time
[24] https://www.fab.com/listings/f7750967-218a-40c1-bb86-44b59f65c02c
[25] https://warframe.fandom.com/wiki/Carrier
[26] https://www.gfinityesports.com/article/destiny-2-beyond-light-ghost-mods-guide-all-experience-tracking-economic-and-activity-mods-ps4-xbox-pc
[27] https://gamerguides.com/no-mans-sky/guide/walkthrough/tips-and-tricks/how-to-use-the-analysis-visor ; https://satisfactory.wiki.gg/wiki/Object_Scanner
[28] https://www.gamerevolution.com/?p=11899
[29] https://primagames.com/eguides/far-cry-5-eguide/for-hire-roster/fangs-for-hire
[30] https://www.pcgamer.com/au/apex-legends-ping-system-is-a-tiny-miracle-for-fps-teamwork-and-communication/
[31] https://www.pcgamesn.com/borderlands-3/ping-system
[32] https://neonsect.com/palworld/pals-not-working-base/
[33] https://image-ppubs.uspto.gov/dirsearch-public/print/downloadPdf/9599992 ; https://doaj.org/article/a4271aba57564bc0a42e4eba8241f7f1
[34] https://80.lv/articles/comparing-team-fortress-2-and-overwatch-art-direction
[35] https://www.cookandbecker.com/en/article/378/designing-overwatch.html
[36] https://www.digitaltrends.com/gaming/inzoi-pubg-ai-cpc-characters-ces-2025/
[37] https://emshort.blog/2012/03/16/gdc-2012-talk-on-dynamic-dialogue/
[38] https://arxiv.org/abs/2305.16291v2
[39] https://cdn.jsdelivr.net/gh/mindcraft-bots/mindcraft@develop/README.md ; https://blogs.novita.ai/mindcraft-unleashing-novita-ai-llm-api-in-minecraft
[41] https://github.com/IceTank/litematica-printer ; https://modrinth.com/mod/buildprint
[42] https://palworld.wiki.gg/wiki/Handiwork
[43] https://enshrouded.featureupvote.com/suggestions/718834/add-a-dedicated-builder-npc-architect-to-buy-building-blocks
[44] https://steamcommunity.com/app/244850/discussions/0/2243301553218556336 ; https://steamcommunity.com/app/526870/discussions/0/4030223299348317320
[45] https://shacknews.com/article/84681/the-sims-4-gets-creative-with-a-new-build-mode ; https://djcube.co.uk/review-townscaper/
[46] https://about.roblox.com/newsroom/2026/04/roblox-studio-going-agentic
[47] https://github.com/madebyshaurya/stud
[48] https://respawn.outlookindia.com/gaming/gaming-news/epic-launch-ai-voice-npcs-via-gemini-elevenlabs-in-fortnite-uefn
[49] https://respawn.outlookindia.com/gaming/gaming-news/tsm-osuai-minecraft-ai-app-automatic-builds
