# Plan 55 (proposal): the drone as the top-rung ego, and agents that talk to each other

> Owner, 28 Oct: "the drone is like the top of the preset rung for ai before they are overwatch ai, the drones 'ego' is a makeup of all the presets/ais and should thus be pretty smart. we might need to do some training first? ... if there is communication between the ai's it should work, i think there is a ai swarm online looking for a home, this should be perfect."
>
> This plan is not built yet. It records the direction, what exists, and the decisions it needs.

## 1. What exists (28 Oct)
- **The fast ego** (`apps/web/src/play/companion-combat.ts`): a hand-written, deterministic combat brain. Its tunable presets are engage, focus, cover and fire rhythm. It reacts in milliseconds and learns nothing.
- **The reflex slot** (`mimic-reflex`, Plan 51 §2b): a live `logic:` preset that bridged games' events drive.
- **The slow mind:** any AI attached to the Neural Bridge (`/events`, `/command`) reads what happens and orders the drone.
  - Guardrails: its kit edits are staged until the player says "keep it"; it cannot ship defaults; it cannot open a bridge, apply a mimic or press input into a game (the relay token, Plan 53 §2.6).
- **Learning modules, not wired to the drone yet:**
  - Plan 52's veiled Bayesian learner and the Harvest;
  - Plan 54's Excitement Compass.

## 2. The direction
1. **The composite ego.** The drone's fast brain stays the instinct. Its presets (locomotion, fire rhythm, reflexes, logic) become the ego's repertoire. The learners choose among them and tune them:
   - **Training, first:** the veiled learner learns the drone's aim lead from its own hits and misses, at the plot's stage.
   - **Choice:** the Excitement Compass picks among preset actions in response to the player's catalyst.
   - **How the ego grows:** the owner's distortion ladder ([Plan 56](56-distortion-ladder.md)). Excitement hardens presets; the higher rung repairs their distortions with the SQ check; presets grow or perish.
2. **Agents talking to each other.** Today one AI orders the drone over the bridge, and there is no channel between agents. Proposed: named agent seats on the bridge, each with a role (the Plan 40 roster idea) and per-seat permissions, plus a shared message channel. Every seat keeps the guardrails above.
3. **Hosting an outside swarm.** The bridge listens on this PC only (127.0.0.1), by design. An online swarm needs a gateway:
   - authenticated, with a pairing code the player gives;
   - per-agent permissions and rate limits;
   - the same guardrails (no applying its own edits, no pressing input, no defaults).

## 3. Decisions for the owner
- **Which swarm?** The blanket search ([AI_SWARM_HOSTING_RESEARCH.md](../../AI_SWARM_HOSTING_RESEARCH.md)) found no single swarm "looking for a home", but it found a clear category:
  - agent societies in game worlds (Project Sid's 1000 agents in Minecraft, MIT's SwarmWorld);
  - swarm frameworks with no world of their own (ElizaOS Worlds and Rooms, Kimi's 300-agent swarm);
  - worlds offered to agents (AWE).
  The proposal is one seat API with a thin adapter per framework, so any of them can move in.
- **Not the swarms "detected on the internet"** (research §5): they attack systems, so they are never given a home. Only accountable frameworks the owner runs.
- **Opening the bridge beyond this PC** is a security change (it controls the drone and stages kit edits). It needs the owner's yes, and research first: how comparable games host outside agents, and what their players complain about.
