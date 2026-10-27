# Plan 48: The In-Game AI Companion ("Co-Builder") & Neural Bridge
> **Author**: Gemini Overwatch & Argo  
> **Status**: APPROVED & IN IMPLEMENTATION  
> **Target Branch**: `feat/studio-polish-claude-cloud`  
> **Parent Specifications**: [Plan 40 BYOA](40-bring-your-own-agent.md), [Plan 46 Reality Harness](46-reality-harness-spectral-ai-ego.md), [Plan 47 Consumer Integration](47-harness-consumer-integration-blueprint.md)  
> **Research**: [`docs/COMPANION_AI_COOP_RESEARCH.md`](../../COMPANION_AI_COOP_RESEARCH.md)

---

## 1. Vision & Purpose

In *FIDELITY: The SetMix Multiverse*, the player should never build alone. Plan 48 introduces the **Embodied In-Game AI Companion**:
An autonomous Hazmat Scientist companion ("Overwatch" / "Argo") who inhabits the 3D world, follows the player, drives vehicles using the Sovereign Harness, constructs machines, and communicates in real time via helmet radio comms.

---

## 2. Architecture & Components

```text
[ Player In-Game ] <─── 3D Simulation (60 FPS) ───> [ Companion Avatar (Overwatch) ]
         │                                                      │
    Press 'Enter' / 'V'                                  60 Hz Harness Reflexes
         │                                                      │
 [ Comms Widget ] ── WebSocket ──> [ scripts/companion-bridge.mjs ] ──> [ LLM Brain (Overwatch) ]
                                                                                  │
 [ Diegetic Radio Voice ] <────── TTS Audio Stream / Text Commands <──────────────┘
```

### Component 1: The In-Game Companion Entity (`apps/web/src/play/companion.ts`)
- **Mesh & Styling**: Built via `createScientistInstance('#b84dff')` (Ray-7 Violet Visor).
- **Nameplate**: 3D billboard tag `[Overwatch · Co-Builder]`.
- **Autonomous States**:
  - `IDLE`: Stands in ready stance, looks around, tracks player with neck bone.
  - `FOLLOW`: Shadows player at 3.5m distance, matching walking/running cadences via `createScientistAnimator`.
  - `BUILD`: Approaches target coordinates, deploys ghost hologram, strikes welding/assembly pose.
  - `DRIVE`: Boards and operates secondary rover using `@hm/harness` escort controller.
- **Physical Integration**:
  - Registered in `play-scene.ts`'s fixed-step physics accumulator.
  - Collision resolved against terrain heightfield and world obstacles.

### Component 2: The In-Game Comms HUD (`apps/web/src/play/companion-chat.tsx`)
- Toggled via `Enter` or clicking the comms chip in the HUD.
- Features:
  - Input box for typing messages to the companion.
  - Push-to-Talk button (`V`) activating Web Speech API for voice recognition.
  - Radio squelch sound effects on transmit/receive.
  - Text log showing companion replies with speech subtitles.

### Component 3: The Neural Bridge (`scripts/companion-bridge.mjs`)
- Local WebSocket server running on `http://localhost:8220`.
- Exposes bidirectional JSON-RPC commands:
  - `companion.say(text)`
  - `companion.followPlayer()`
  - `companion.moveTo(x, z)`
  - `companion.placeMachine(x, z, kind)`
  - `companion.mineOre(oreId)`
  - `companion.getGameState()` (returns player coordinates, nearby machines, inventory).

### Component 4: Diegetic Voice Audio
- Companion replies route into the Web Audio `dialogueBus` via `apps/web/src/audio/mentor-voice.ts`.
- Automatically ducks music and applies authentic astronaut helmet radio equalization.

---

## 3. Implementation Waves

- **Wave 1**: Companion Avatar Entity, Locomotion, and Comms HUD Widget.
- **Wave 2**: Local WebSocket Bridge (`scripts/companion-bridge.mjs`) and In-Game Command Executor.
- **Wave 3**: Voice Comms (Speech-to-Text input + TTS audio stream into helmet radio).
