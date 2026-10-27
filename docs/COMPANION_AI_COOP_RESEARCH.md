# Research: In-Game AI Companions, Autonomous Co-Builders & Neural Bridges (October 2026)
> **Context**: Plan 48 — The In-Game AI Companion ("Co-Builder") for *FIDELITY: The SetMix Multiverse*.  
> **Constitutional Mandate**: RULES 6 (Research Before Design), RULES 8a (Zero Architectural Lies), Plan 40 (BYOA), Plan 46 & 47 (Sovereign Reality Harness).

---

## 1. Industry References & Architectural Paradigms

To create a genuine AI companion that can build, drive, and converse alongside the player—rather than a hollow scripted NPC—we researched leading systems across gaming and agentic simulation:

### A. Minecraft: Voyager & MindCraft (Autonomous Co-Builders)
- **Voyager (Wang et al., 2023)** demonstrated an LLM-driven embodied agent with an iterative prompting mechanism, self-reflection, and an executable skill library (stored as JavaScript code snippets).
- **Key Takeaways for SetMix**:
  1. *Sub-goal decomposition*: High-level natural language instructions ("build a mining outpost at the crater") must decompose into concrete spatial operations (`moveTo`, `placeMachine`, `mineDeposit`).
  2. *Environmental feedback*: The agent must query local bounding boxes, terrain elevation, and inventory stock before placing objects to prevent invalid collisions or floating structures (`RULES 8a`).
  3. *Zero hallucination of physics*: Locomotion and collision resolution must remain inside the game engine's physical timestep (using our `@hm/harness` and `@hm/mobsim`), not handled by LLM approximations.

### B. Project0.city & Roblox Agent Assist (Live Studio / Game Co-Creation)
- **Project0.city**: Connects Claude / Codex agents to live 3D lots via a WebSocket MCP bridge. Agents query the scene graph, propose diffs, and inspect 4-angle visual snapshots.
- **Roblox AI Assistant / Studio Coplay**: Allows real-time cooperative scene editing where actions appear as staged proposals in the scene tree with instant undo/redo.
- **Key Takeaways for SetMix**:
  1. *Co-Builder Role*: The companion acts under the established `Co-Builder` role (`apps/web/src/net/protocol.ts`), which permits drafting, crafting, building, and harvesting while preserving the player as the `Lead Architect` with override authority.
  2. *Live Staging*: When the companion builds, ghost hologram frames appear first, followed by assembly animations, giving the player immediate visual clarity on what the AI is constructing.

### C. Halo (Cortana / Arbiter) & Subnautica (PDA) Co-Op Dynamics
- **Subnautica PDA & Radio**: Atmospheric diegetic audio with bandpass filtering and static hum creates profound immersion. When the radio speaks, world ambience and music duck automatically.
- **Halo Co-Op AI Companions**: The companion stays in a tactical follow envelope (3–6 meters), avoids standing directly in the player's line of fire or reticle path, and dynamically matches the player's locomotion mode (walking, sprinting, or vehicle mounting).
- **Key Takeaways for SetMix**:
  1. *Formations & Line of Sight*: The companion must not crowd the player's crosshairs (`test-hud-zones.mjs` centre 60% rule). He shadows the player's shoulder at a 45-degree angle.
  2. *Vehicle Mounting*: When the player boards a rover, the companion either mounts the passenger seat or boards a nearby secondary vehicle running the Sovereign Harness.
  3. *Diegetic Audio*: Companion dialogue is routed through `apps/web/src/audio/mentor-voice.ts`, giving it authentic spacesuit helmet comms acoustics.

---

## 2. Technical Stack & Invariants for SetMix Plan 48

### Invariant 1: The Two Brains Separation (Reflexes vs. Intellect)
- **Reflexes (60 Hz Engine Step)**: Handled by `@hm/mobsim` and `@hm/harness`. The companion's body never falls over, clips, or waits for an API call to avoid obstacles.
- **Intellect (Asynchronous Thought)**: Handled by Antigravity / Claude Opus / Local model over WebSocket. Decides strategy, holds conversation, and dispatches high-level actions.

### Invariant 2: Diegetic Visuals & Sound
- Avatar model: High-detail Hazmat Scientist (`apps/web/src/avatar/scientist/`) with distinct **Ray-7 Violet Visor (`#b84dff`)** and overhead tactical tag `[Overwatch · Co-Builder]`.
- Voice: Routed through the Web Audio `dialogueBus` with radio bandpass and automatic music ducking.

### Invariant 3: Zero Interference with Player Controls
- The companion's actions are purely cooperative. The player's camera, movement, and reticle are never overridden.
