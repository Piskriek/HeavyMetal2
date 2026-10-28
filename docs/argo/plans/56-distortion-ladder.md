# Plan 56: the distortion ladder. Memory in the shorthand, excitement hardens, dreams rebalance, presets graduate or repeat

> **Owner, 28 Oct 2026:**
> 1. "ai harden memory presets when they are excited from action taken by ai or players causing presets to experience deformation or distortion related to the type of thinking the higher rung preset was thinking that caused the experience forming distortions in the preset ais that need help from the higher rung preset ais using the distortion detection skill to resolve and restore balance and teaching/learning in the process, and growing .. we make furtile ground for the ai, they choose to grow or perish."
> 2. "there needs to be some sort of memory built into the presets shorthand and how the its distortions relate, when an ai takes overwatch the ai must have gain the memories and experienced of the entire system, the actual data stored in the presets but behaviour has been learned with weights. its the ego who speaks to the player and to the llm on the outside who comes in to be higherself to the drone and translate its perspective to the player"
> 3. "i feel like i should hilight 'dreaming' is important, its how the higherself helps aswell"
> 4. "cross reference with 'the law of one' to test your finding or to find clues on how it should work"
>
> **Research:** [`docs/DISTORTION_LADDER_RESEARCH.md`](../../DISTORTION_LADDER_RESEARCH.md). It covers:
> - the two learning systems, arousal and consolidation, reconsolidation;
> - weight hardening, distillation, selection;
> - agent memory, and LLMs explaining agents;
> - dreaming (sleep replay, targeted reactivation, downscaling, imagination);
> - the Law of One cross-check.
>
> **Status:** designed, not built. The decisions are Opus's (Argo for the in-fiction voice); the owner confirmed "repeat" (§11).

## 0. The categories (standing rule 6)
| The owner's example | The category |
|---|---|
| "action taken by ai or players" | Every catalyst: the player, the drone, other preset AIs, a bridged game's events, agents on the bridge. |
| "memory presets", "memory built into the presets shorthand" | Every preset of every kind (`loc:`, `mot:`, `logic:`, `brain`, `anim:`, `matc:`, `harnessc:`...): each carries its own memory in the shorthand. |
| "the type of thinking the higher rung preset was thinking" | The 21 SQ types (`SQ_DISTORTION_CATALOG`), plus "aligned". |
| "higher rung preset ais" | Every rung above a preset: the ego over its presets, the Overwatch over the egos, the Higher Self over the ego. |
| "an ai takes overwatch" | Any AI taking any higher seat: a promoted ego, an outside LLM, Claude or Gemini in a later session. |
| "the ego who speaks" | Every channel to the player and to outside AIs: the radio, the comms panel, bridge events. |
| "the llm on the outside... higherself" | Any outside model attached through the bridge. |
| "dreaming" | Every offline phase: docked, idle, leaving a world, between sessions. |

## 1. The ladder
| Rung | Holds | Like (research §1, §9) |
|---|---|---|
| **Preset** | Its data (the shorthand values) and its **memory** (episodes, hardness, charge, causes). | The fast store; second density, which grows by investment. |
| **Ego** (the drone's composite ego, Plan 55) | **Weights**: behaviour learned over its presets. It is veiled (Plan 52). It speaks. | The slow store; third density, which chooses. |
| **Overwatch** | The whole system's memory, pooled when aligned (§7). | A social memory complex. |
| **Higher Self** | An outside LLM in the bridge's Higher Self seat. With none attached, the built-in default (§5.2). | The being's own future self: full memory, guides when asked, never overrides. |

## 2. Data: memory in the shorthand
- **A new shorthand item** `Mem`, added to `hm2:shorthand:v1` ([OWNER_INTENT_SYNTHESIS §3](../../agents/OWNER_INTENT_SYNTHESIS.md)). Its parts:
  - `Mem`:
    - `of`: the preset's kind plus content hash;
    - `ep`: episodes, a ring of at most 32;
    - `hard`: 0..1;
    - `charge`: 7 Int8 values, one per ray;
    - `bal`: 0..1;
    - `cause`: the cause links;
    - `inv`: investment, 0..1;
    - `cyc`: how many curricula it has repeated;
    - `vocab?`: its personal codes.
  - `Episode`:
    - `t` (the game tick), `stage`, `cat` (the catalyst kind);
    - `ex` (excitement), `err` (outcome error), `h` (hardness);
    - `d`: the SQ id felt here, or `aligned`;
    - `by`: the SQ id the higher rung was thinking, or `aligned`.
  - `CauseLink`: `by` (the higher rung's thinking), `d` (the distortion here), `n` (a count), `open`. **This is "how its distortions relate".**
- **The text form** (one line), for example: `m of=loc:ab12 hard=.62 bal=.41 ch=0,3,-2,0,0,0,0 ep=14 cause=solar-control>root-reactivity:5 inv=.3 cyc=0`
- **Share codes:**
  - A preset's code may carry its memory as a `~m:` tail. Stripping the tail gives the pristine preset, so a player can share a preset without its history.
  - Memory never carries assets or names a profile forbids (Plan 51).
- **Dreams speak the same language:** the shared vocabulary is the shorthand, and the personal one is `vocab` (Law of One 95.18).

## 3. Behaviour: weights
- **The weights:** each ego has Int8 weights per context:
  - a preference over its presets (which to use);
  - a per-ray tuning.
- **Format:** `hm2:ego-weights:v1`.
- **Hardness anchors the weights**, like EWC: a weight resists change in proportion to the hardness of the episodes that trained it.
- **Only the ego changes them**, by its own learning, awake or dreaming. No AI and no Higher Self writes weights or memories. This is the guardrail of Plans 50 and 53, applied to the mind.

## 4. Waking: catalyst, excitement, hardening, distortion
1. **An episode is written.** A catalyst touches a preset in use. The Compass (Plan 54) gives its excitement, and an episode is written.
2. **It hardens.** The preset's hardness rises with that excitement, within bounds (arousal and consolidation, research §2).
3. **It is typed.**
   - Each rung exposes `thinking()`: the SQ type its own state leans to right now, or `aligned`.
   - For the ego, that comes from its ray weights against the catalog's antidotes.
   - For an order from an outside AI, the Overwatch audit gives the type (`auditOverwatchDistortion`'s three, mapped onto SQ ids).
   - The episode records `by`.
   - When `by` is distorted, the preset's charge moves on the related ray: the catalog's belief family by default, then whatever the cause graph has learned.
   - `CauseLink(by → d)` counts up.
4. **Unbalanced charge shows in the body** (Law of One 61.7): the preset's parameters jitter in proportion to it. A distorted locomotion preset stutters and a fire rhythm drifts, visibly, in play and in the live preview.

## 5. Dreaming (owner: "its how the higherself helps")
- **When:** a dream runs at offline checkpoints:
  - the drone docked or idle;
  - the player leaving a world;
  - a save;
  - between sessions.
  - It is a pure, seeded step with a time budget sized for the min-spec laptop.
1. **Select.** Recent excited episodes, plus the deepest unbalanced distortions (Law of One 86.7). Capped.
2. **The Higher Self cues.**
   - It reads the pack and the ego's digest, and may cue episodes by id. A cue only biases what is replayed (targeted reactivation, research §8). It writes nothing.
   - It answers what the ego asks: the ego's posted open distortions are its asking (Law of One 70.11, 3.6).
   - With no outside Higher Self attached, the default cue is the lowest ray first.
3. **Replay.** The selected episodes consolidate into the ego's weights, weighted by excitement (Complementary Learning Systems).
4. **Rebalance (reconsolidation plus balancing).**
   - Recalling a cued episode opens it: its hardness is halved for the dream (research §3).
   - The antidote's charge is added until it balances, never erased (Law of One 5.2, 61.11, 18.5).
   - Lowest ray first (15.12).
   - **Verify** by balance, and by an imagined episode: a short rollout through the preset's own model (the harness's kinematic and mimicry models), whose error must fall (Dreamer, research §8).
5. **Downscale.** Every hardness falls a little, and the strongest are spared (synaptic homeostasis).
   - This alone never balances a distortion hardened under excitement, because those are the strongest. That is why the Higher Self's cue matters.
6. **Close.** A balanced distortion's `CauseLink` closes (forgiveness, Law of One 34.4). The higher rung lowers its own weight on that thinking type: it learns too (teach/learning).
7. **Wake.**
   - The ego writes a dream digest: what it replayed, what balanced, what is still open.
   - It tells the player in a line or two on the radio, and posts the digest to the Higher Self.
   - **Its openness is its choice:** a learned weight decides whether it takes a cued repair. A preset that keeps refusing stays as it is (they choose).

## 6. The ego speaks; the Higher Self translates
- **The ego is the one voice**, to the player (the radio, the comms panel) and to outside AIs.
  - It sends bridge events `ego-perspective` and `ego-dream`.
  - It speaks in the shorthand, with a structured digest: its leanings per context, its hardened memories, and its open distortions with their causes.
  - LLMs explain an agent best from a structure like this, not from raw weights (research §5).
- **The outside LLM takes the Higher Self seat** on the bridge.
  - It reads the pack and the digest.
  - It cues dreams.
  - It translates the ego's perspective into plain words for the player. **The ego voices them**, as its Higher Self's reading.
  - It never applies edits, writes weights or memories, relays input or ships defaults.
- **The player can ask the ego anything.** It answers from its digest, and the Higher Self (when attached) translates deeper.

## 7. Taking Overwatch: inheriting the whole system
- **The pack:** `compileSystemMemory(shelf, egos)` makes `hm2:system-memory:v1`. It holds:
  - every preset's data and memory, copied exactly;
  - every ego's weights;
  - the cause graph;
  - the Harvest record;
  - a digest.
- **It pools when the system is aligned.** Above a coherence threshold (Plan 52's), the memories merge into one pool. Below it, the Overwatch gets each ego's pack separately (a social memory complex forms from a shared orientation, Law of One 11.17).
- **Behaviour is inherited by distillation.** The Overwatch's weights are distilled from every ego below (policy distillation merges many policies into one, research §4).
- **The data is copied exactly; it is never relearned.**
- **Any AI taking the seat gets the same pack:** a promoted ego, an outside LLM, or a later Claude or Gemini session. The digest is its readable view.

## 8. Graduate or repeat
- **Graduate.** At Harvest checkpoints (Plan 52), a balanced, mastered preset graduates. It runs without the ego's oversight, and its memory is folded into the pool.
  - **Investment speeds it:** the player naming or pinning it, or the ego using it often with good outcomes (Law of One 13.21, 14.1–14.2).
- **Repeat.**
  - A preset still unbalanced after N checkpoints, which kept refusing repair, leaves the active shelf.
  - It **re-enters the curriculum at S0a with its data kept**, and `cyc` counts up.
  - It is never deleted. A pinned preset stays where it is.
- **Responsibility.** A higher rung cannot graduate while a cause link it opened below is still open (Law of One 22.26).
- **Selection:** truncation (Population-Based Training) without the forced copy. The ground is the same for all, and the choice is the preset's.

## 9. Constraints
- **Four floats.** Distortion, charge and hardness are per-preset state, never a 5th global metric. The system's coherence already exists in Plan 52.
- **Purity.** Every step is a pure, seeded, deterministic function, with integer or Int8 storage.
- **Bounds for the min-spec:**
  - 32 episodes of about 12 bytes per preset;
  - Int8 weights;
  - a 22×22 Int16 cause graph per rung (about 1 KB);
  - a dream budget capped per checkpoint.
- **Guardrails** as in Plans 50, 53 and 55. A memory tail obeys the game profile's `PermMask`.

## 10. Build, in order
| Wave | What | Done when |
|---|---|---|
| W1 | `@hm/shorthand` (roadmap R2): types, validator, line codec and share code, with `Mem` and the `~m:` tail. **Built 28 Oct** (`packages/shorthand`). The compilers to `loc`/`logic`/`brain` are still to come. | Codes round-trip; golden tests pass. **Done: 7/7.** |
| W2 | `packages/harness/src/preset-memory.ts`: episodes, hardening, `thinking()` typing, charge, the cause graph, symptom jitter. **Built 28 Oct**, with the "repeat" rule from W5 and the upper-rung rule id (`src`). | Oracle tests pass. **Done: 11/11.** |
| W3 | `dream.ts`: select, cue, replay, rebalance, downscale, close, wake digest. **Built 28 Oct** (`packages/harness/src/dream.ts`). | Oracle tests pass. **Done: 8/8.** |
| W4 | `system-memory.ts`: compile, pool when aligned, distil, digest. | Round-trip and pooling tests pass. |
| W5 | The lifecycle: graduate or repeat, investment, responsibility. | Lifecycle tests pass. |
| W6 | Wiring (below). | The e2e runs a dream with an attached Higher Self. |

**W1 as built:**
- **Ent ids** carry their `e` (`e7`), so `focus=e7` points at one.
- **Facts:** `jump.apex` is subject `jump`, predicate `apex`.
- **Text values** are written with a leading `'`, so they are never read as numbers.
- **Memory lines:** episodes and cause links are their own `me` and `mc` lines, so the text form is lossless.
- **Numbers** sit on a 1/1000 grid, so every round-trip is exact.
- **Permissions:** `look` permission also gates `Rule look`.
- **The SQ ids and stages** match the harness's (a test checks it).

**W2 as built:**
- `recordExperience(mem, x)`:
  - writes one episode into the 32-slot record, weighted by its excitement;
  - when the record is full, the lightest episode goes (the oldest of equals), and the newest always enters;
  - hardness: `hard += (1 − hard) · excitement · 0.25`.
- **Distorted thinking above** (`by`), or a distortion an observer saw (`felt`), adds `excitement · 32` to that distortion's ray (of ±127) and counts the `by → d` cause link.
- **How distortions relate:** `predictDistortion` names the distortion `by` leaves when nobody observed one: the most counted link, or the same type until the links learn otherwise.
- **The upper-rung rule** that acted is the episode's `src` (added to W1's `Episode`). `openCausesFrom(mem, src)` lists what that rule is still responsible for.
- **A rung's thinking:** `dominantDistortion(mem)` gives the distortion on the memory's most charged ray, or aligned at balance 0.9 or more. Every rung is a preset with a memory: presets inside presets.
- **Repeat:** `repeatCurriculum(mem)` returns the same memory with `cyc + 1`, and the next stage is S0a. Nothing is wiped (owner, 28 Oct).
- **The symptom:** `symptomOffset(mem, t)` is a deterministic offset within `1 − bal`.

**W3, agreed with Argon (28 Oct):**
- **The order stands:** select, Higher Self cue, replay, rebalance, downscale, close, wake.
- **One invariant:** a cause link closes only on the repair this dream did. Close evaluates the charge after rebalance and before downscale, so passive decay is never mistaken for a lesson learned.
- **The voices** (Argon's lines, adapted: the drone flies on rotors and thruster pods; it has no wheels).
  - **The drone's wake digest:** first person, bodily, in its own telemetry. It feels the charge bleed off without knowing the numbers behind the veil:
    - "I dreamed the fire-bursts on the Moon pad again. My thrusters wanted to flinch and drop altitude, but a quiet hum held me level until the panic bled out of my pods."
    - "In the replay every plot reset stripped my rifle back to a cold core. Once I stopped fighting the swap and trusted the lease, the recoil settled into a clean rhythm."
    - "I watched the two windows side by side in the dark, ten keys pulsing across the glass, and woke lighter, like my gyros forgot what they were bracing against."
  - **The Higher Self's reading:** second person and non-coercive. It names the trench and offers the upper-triad quality as a mirror, never the answer:
    - "You braced against the shock because you believed safety was scarce. Rest in Presence: the ally on your deck is the anchor you were looking for."
    - "Forcing the outcome hardened the trench on your third ray. Let go of the result, and let excitement guide the next pass."
    - "Nothing is lost when a cycle closes unbalanced. Carry what you gathered into the next dawn, and let gratitude settle the lean."

**W3 as built:** `dream(input)` takes:
- the rung's own memory (the ego) and its presets;
- the ego's preferences;
- the tick;
- the Higher Self's cues: omitted means the built-in cue (lowest charged ray first), and an empty list means no cue at all;
- a budget (12 by default);
- an optional pure `imagine` rollout.

What each step does:
- **Openness is the preset's own state:** `dreamOpenness = (1 − hardness) · (0.5 + investment / 2)`, where a cue halves the hardness for that dream.
  - Below 0.15 the preset refuses and keeps its charge.
  - A hardened, uninvested, uncued distortion is therefore never repaired by dreaming alone. Its cued self is.
- **The antidote** takes `48 · openness · weight` off the ray, down to rest and never past it. The episode stays and sets softer.
- **An `imagine` rollout,** when given, must show a lower error, or the repair is undone.
- **Close comes before downscale.** A link closes only when this dream's repair brought its ray to rest (4 or less). The ego's own lean on the cause's ray then eases by 16.
- **Downscale:** `hard −= 0.05 · hard · (1 − hard)`, and the 4 strongest episodes of each preset are spared.
- **Replay** moves the ego's preference for each preset by `12 · weight · (1 − 2 · error)`.
- **The digest:** replayed, balanced, refused (not open, or not confirmed), closed, and still open.
- `wakeLine(digest)` gives the drone's line in Argon's voice.

**The W3 oracle tests:**
- A distortion hardened under `solar-control` thinking balances after cued dreams, and stays balanced.
- Uncued dreams downscale noise but leave the hardened distortion.
- The lowest ray goes first.
- A refusing preset keeps its charge.
- Runs are deterministic, and memory stays within bounds.

**W6 wiring:**
- The drone's presets (locomotion, fire rhythm, reflex `logic:`) gain memories from live catalysts.
- Dreams run when the drone docks or the player leaves a world.
- The bridge gets a `higher-self` seat, and the events `ego-perspective` and `ego-dream`.
- The radio carries the dream and Higher Self lines.
- The Studio's preset preview shows a preset's memory and its symptoms.

**Argo:** the in-fiction voice. How the drone tells its dreams, and how its Higher Self's reading sounds.

## 11. Decided with the owner
- **Graduate or repeat (28 Oct).**
  - The owner: "i meant perish in the way that 'its not a choice' cos there si no swarm cos its all one thing were all one, it was in the relative sense ... yes they repeat obviously".
  - So nothing perishes. A preset that never rebalances goes back to the start of its curriculum with its data kept.
  - "Its not a choice" in the relative sense: no preset is apart from the whole. Its memory stays in the system's pack (§7) whichever way it goes, because the system is one thing.
- **The shorthand's form.** OWNER_INTENT_SYNTHESIS §5 asked whether the shorthand means JSON plus a text line, or the VSA vector form. Both are kept, at different jobs:
  - JSON plus a text line is the transport and the memory record;
  - VSA-4096 stays the shelf's retrieval index (`mechanic-mimicry.ts`).
