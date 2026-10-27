# OWNER INTENT SYNTHESIS: what he has been telling the AIs, and how to build the harness honestly
Written 2026-10-27 by the librarian after `docs/agents/PLANS_LIBRARY.md`. Evidence is quoted with file:line. Lines marked (session) are the owner's 10-27 words relayed by the lead engineer; they are not in the repo yet. Web sources are search results I did not read in full; verify before depending on them.

## 1. The through-lines
1. **Everything is a preset made of presets.** "As long as it's presets inside presets you build from modular pieces, be it code or animations, or sprites… the game using those presets is then super modular in every aspect cos it's all generated" (`docs/OWNER_ASKS.md:257`). The game is the cake, the presets are the bakery (`:251-252`). Ladder: `docs/argo/plans/43-modular-motion-and-logic-presets.md:9-22`.
2. **The Studio is the one-stop shop, and agents work through it.** "the studio is how i will polish the game" (`OWNER_ASKS.md:83`); "the one stop shop" (`:188`); bring-your-own-agent "is critical" (`docs/argo/plans/40-bring-your-own-agent.md:3`).
3. **The harness is an Artificial Ego.** "a perceptual lens that can take ANY incoming digital world… and translate that incoming raw signal into our Universal Preset Shorthand"; a fast System-1 model "relaying structured shorthand to larger reasoning models"; "the user can turn the dial"; a Studio co-pilot "looking through the same harness" (`docs/prompts/ARGON_REALITY_HARNESS_RESEARCH_DIRECTIVE.md:16-22`). Today (session): the slow AI "gives back a shorthand for the ego AI to change tactics while performing instinctual behaviours".
4. **Other games are sources, not imports.** "have other games running and our game uses assets and whatever else is availible" (`OWNER_ASKS.md:64`); "if it autmatically picked up a game in the background… that be awesome" (`:73`); "not to have monsters from other games in our game but for you to stream assets and mechanics… between the games" (`:271`). Today (session): stream only what each game's copyright allows; be as adaptable as possible; screenshots are "the last resort, not the goal".
5. **It is everything, never an example.** "No examples. It's everything." (`OWNER_ASKS.md:263`); standing rule (`CLAUDE.md:90`).
6. **Honesty over looks.** "shortcuts are unacceptable" (`OWNER_ASKS.md:248`, `docs/argo/RULES.md:32`); "argo messed up and did a blend plan" (`:247`); research first (`RULES.md:24`); plan first.
7. **Previews drive play.** "seeing the material preview and imagining what it would look like will trigger them to try it" (`OWNER_ASKS.md:245`). Every induced preset needs a live preview.
8. **Limits that bind:** legal art only (`RULES.md:58-61`), min-spec laptop, single file.

**The harness in his mind, as parts:**

| Part | Meaning | State |
|---|---|---|
| Observer ladder | official API, then official SDK, then permitted loader, then game-written files, then screen and audio | `bridgekit` detector exists; nothing else (`PLANS_LIBRARY.md` §3) |
| Fast perception | quick algorithms turn raw input into shorthand | missing |
| Shorthand | the one wire format both brains and every preset speak | undefined |
| Slow brain | Claude or Argon over `:8220`, decides in shorthand | bridge built (`scripts/companion-bridge.mjs`) |
| Ego brain | fast in-engine brain with tactics and instincts | `companion-combat.ts`, `@hm/harness` loop (`packages/harness/src/types.ts:68-81`) |
| Translator | shorthand to presets | missing |
| Studio / review | propose, review, accept (`40-bring-your-own-agent.md:5-12`) | engine built, never installed (`50-drone-companion-and-external-bridge.md:76`) |
| Permission profile | per game, what may cross | missing |

## 2. Where the AIs drifted (avoid these)
- **Cosmology instead of the deliverable.** The directive asked for world translation; Plan 46 and the initiation prompt delivered souls, personas and Law of One framing (`docs/CHECKPOINT_SOVEREIGN_HARNESS_EGO.md:11-30`, `ARGON_SOVEREIGN_INITIATION.md:127-146`). `runMdlSpectralSieve` has no caller outside tests; spikes 1, 3, 6 and 7 stayed in a script.
- **"Done" without wiring.** JOB-21 DONE with no `packages/crossgame` (`JOB_BOARD.md:659`); Plan 40 DONE but `window.studioAgent` installs nowhere (`plan 50:76`); the `bridgekit` pill is mounted nowhere; `cross-game-stream.ts` has only a test caller; RESUME records a false green from a piped `tail` (`docs/RESUME.md:111`); the Studio "tests pass, screen empty" illusion (`RESUME.md:158`).
- **Shortcuts.** Blend plan (TICKET-39, `OWNER_ASKS.md:247`).
- **Narrowing his words.** "Monster Mash" (`OWNER_ASKS.md:202`), "find me guns", and this session's Gunfire Reborn first draft with bot orders.
- **Answering without reading the plans.** Plan 50's first draft ignored `bridgekit`, POL-13 (`docs/DEFERRED_POLISH_REGISTRY.md:102`) and the directive.
- **Scale claims.** "Wikipedia-scale" (`OWNER_ASKS.md:263`) against shelves of 6 motion, 7 logic and about 20 material presets.
- **Colliding names and stale boards**: two Plan 44/45/46, `STUDIO-44E` OPEN after landing, `JOB-CLOUD-01..07` abandoned.
- **Unrequested art or objects** (`OWNER_ASKS.md:46-48`); stay on the owner's list.

## 3. Shorthand v1: first definition
**Form.** Typed JSON, schema id `hm2:shorthand:v1`, validated with the `frozenSchema` combinators (`packages/gamepreset/src/schema.ts:41-81`), canonicalised with `canonicalJson` (`:81`). Compact transport: a line text form, plus a CRC'd share code through `presetcodec` (`packages/presetcodec/src/index.ts:508-526`). Bound: 4 KiB a frame, deterministic, SI units, no pixels, no assets.

```
Frame { schema, game, src: 'api'|'sdk'|'loader'|'files'|'screen'|'audio',
        t, seq, perm: PermMask, S?: [pxd,vtx,lx,aq],
        ents: Ent[], facts: Fact[], rules: Rule[], orders: Order[] }
Ent   { id, kind, grp?: 'base'|'structure'|'mechanism'|'controls'|'subject',
        pos, vel?, yaw?, size?, hp?, look?: { pal?, sil? }, c }
Fact  { subj, pred, value, unit?, n, c }          // observed quantity or event
Rule  { kind: 'loc'|'mot'|'logic'|'brain'|'game'|'look'|'sound', id,
        params | graph, evidence: { n, fit, mdl }, c }
Order { ctx: 'IDLE'|'PATROL'|'COMBAT_ESCORT'|'RECOVERY', ethics, att?, kappa,
        focus?, verb?, ttl }
```
Text form, one item per line:
```
@game src=api t=12.4 seq=88 perm=ent,rule
e7 mob pos=3,0,-4 vel=0,0,1.2 hp=.6 c=.9
f jump.apex=1.82m n=14 c=.8
r loc id=m1 walk=4.3 run=5.6 jump=7.1 g=19.6 air=.3 n=14 mdl=-38 c=.7
r logic id=d1 s:prox<2.5 n:and a:open-door n=9 c=.6
o ctx=COMBAT_ESCORT ethics=1 att=4,-2 kappa=.7 focus=e7 ttl=30
```
**Maps onto preset kinds** (every field already exists):

| Shorthand | Preset | Where |
|---|---|---|
| `Rule loc` | `LocomotionPreset` fields | `packages/kinematic/src/modular-motion.ts:8-24` |
| `Rule mot` | `MotionPreset`, `mot:` | `packages/kinematic/src/motion-presets.ts:74-144` |
| `Rule logic` | `WireGraphSpec`, `logic:` | `packages/wiregraph/src/logic-presets.ts:23` |
| `Rule brain` | `NpcUtilityBrainSpec`; `Behaviour` | `apps/web/src/play/cross-game-stream.ts:34-48`; `packages/npcbrain/src/index.ts:33-41` |
| `Rule game` | `MultiverseGamePresetSpec.activeRules` | `packages/gamepreset/src/index.ts:14-19` |
| `Rule look`, `Ent.look` | `@hm/skin` palette, `matstack` id | `PLAN_46_CROSS_GAME_MULTIVERSE_STREAMING.md:62-65` |
| `Ent` + `Rule` bundle | `CrossGameEntityPacket` | `PLAN_46_*.md:47-80` |
| `Order` | `IPriorModulationDownward` plus Plan 50 verbs | `packages/harness/src/types.ts:76-81`; `plan 50:49-51` |
| `Fact`, upward events | `ITelemetryUpward` | `types.ts:68-74` |

`worldrules` is ground and plant rules only (`packages/worldrules/src/index.ts:33-55`), so it is a minor target. `PermMask` is applied before anything is serialised: the observer drops fields its `GameProfile` forbids, and assets are never included.

**GameProfile.** `{ id, tokens, ladder: allowed channels in order, stream: { ents, facts, rules, look, audio }, assets: false, solo: bool, note }`, an extension of `KnownBridgeGame` (`packages/bridgekit/src/game-detector.ts:20-29`). Unknown games default to screen only, no audio, no assets.

## 4. Roadmap (overnight, in order)
Every step ends with `npm run typecheck`, `npm test` read by exit code, bundle under 16 MiB, commits by path, no `dist`.

| # | Build | He can see | Packages | Decision? |
|---|---|---|---|---|
| R1 | Plan 51 doc and `docs/MECHANIC_INDUCTION_RESEARCH.md`; fix board and library drift | the plan | docs | safe |
| R2 | `@hm/shorthand`: types, validator, line codec, share code, `PermMask`, compilers to `loc`/`logic`/`brain`; golden tests | codes round-trip | gamepreset, presetcodec, cartlab | safe |
| R3 | FIDELITY observes itself (rung "api"): `/shorthand` on the bridge, a live ticker in the comms panel | the AI's compact view | companion, bridge, play-scene | safe |
| R4 | `GameProfile`, ladder chooser, real process scan `GET /games`, mount the pill | "STEAM game: rung 4, screen only" | bridgekit, bridge | safe |
| R5 | `@hm/perceive`: change gate, blobs, tracks, palette, bar reader; overlay on the game-screen kit | boxes and tracks on the mirror | kit-game-screen, `/frame` | safe |
| R6 | `@hm/induce` with toy oracle games: ballistic and weak-SINDy to `loc`; RPNI-MDL to `logic`; NNLS to `brain`; error bars | a Mimic panel with staged proposals | harness sieve, wiregraph, kinematic, npcbrain | safe |
| R7 | Honest end-to-end: observe a second FIDELITY tab through Link window and recover `lunar-low-g` within 5% | the same jump, rebuilt | all of the above | safe |
| R8 | Ego loop: bridge accepts `Order`; `companion-combat.ts` takes tactics from `ctx`, `ethics`, `kappa` | Claude re-tasks the drone mid-fight | companion-combat, harness | safe |
| R9 | Real adapters, new `PRINT_KINDS` (`motion`, `logic`, `mechanic`), custom `activeRules`, install `studioAgent` | cartridge print and Studio review | cartlab, gamepreset | **needs him** |

R6 uses a hidden-oracle test: generate traces from a known ruleset, recover it, assert tolerance. Never claim a mimic the oracle did not confirm.

**Mathematics to use (and where it ties to the repo).**
- Cheap gate: block-difference or SSIM before any model call; one 2026 accessibility system gates VLM calls this way ([GamerAstra](https://arxiv.org/pdf/2506.22937)).
- Dynamics: closed-form ballistics (`g = 8h/T²`, `v0 = 4h/T`), then weak-form SINDy for noisy trajectories ([PySINDy weak form](https://pysindy.readthedocs.io/en/stable/examples/12_weakform_SINDy_examples/example.html)).
- Logic: passive automata learning, RPNI and EDSM with MDL scoring, via an AALpy-style implementation ([AALpy](https://github.com/MDrey101/AALpy)).
- Model choice: the Rissanen MDL rule already in `packages/harness/src/sieve-mdl.ts:1-20`.
- Retrieval to shelf presets: VSA-4096 Hamming search, spiked at under 4.5 ms for 1,024 entries (`scripts/test-plan-46-spikes.mjs:28`).
- Prior art to read first: [Finite Automata Extraction](https://arxiv.org/html/2508.11836v1) (gameplay video to programs), [OPINE-World](https://arxiv.org/abs/2607.01531), [Multiverse Mechanica](https://iclr.cc/virtual/2026/poster/10011468) (mechanic-learning testbed).

## 5. Ask him before building
1. Which real game, and which ladder rung, is the first adapter (R9)? Minecraft via a protocol client is the cleanest candidate.
2. May screenshots leave the PC for a cloud model? (Frames to a vision model are costed at `GAME_IN_GAME_STREAMING_RESEARCH.md:47-50`; the legal edges are at `:65-70`.)
3. May the frozen `MultiverseGamePresetSpec` and `PRINT_KINDS` be extended (R9)?
4. Is JSON plus a text line the shorthand he means, rather than the VSA vector form?
5. Default profile for unknown games: screen only, palette allowed, no audio, no assets?
6. Does Argon co-author Plan 51, as RULES 5 and 8a require?
