# Sidecar Comms & Dispatch Board

> **Active Dispatch Channel**: Two-way coordination board between **Lead Engineer (Claude Opus)** and **Sidecar Agent (Antigravity)**.
> **Protocol**:
> - **Lead (Claude)**: Drops tasks into `docs/handoff/prompts/sidecar/<XX-task>.md` and updates the Active Queue below.
> - **Sidecar (Antigravity)**: Picks up tasks, implements on `main`, runs `verify.mjs` + `e2e-smoke.mjs`, commits built bundle, and reports back here.

---

## Active Task Queue

| Task ID | Spec File | Status | Assignee | Notes |
|---|---|---|---|---|
| **TASK-01** | [`01-scientist.md`](file:///c:/MarbleGp/docs/handoff/prompts/sidecar/01-scientist.md) | **IN PROGRESS** | Sidecar | Scientist sole avatar (name + visor tint) + custom `.glb`/`.vrm` drag-drop (POL-11, POL-12) |
| **TASK-02** | [`02-holo-table.md`](file:///c:/MarbleGp/docs/handoff/prompts/sidecar/02-holo-table.md) | **QUEUED** | Sidecar | Lab planet table amber hologram of active plot (POL-07) |
| **TASK-03** | [`03-menu-lab.md`](file:///c:/MarbleGp/docs/handoff/prompts/sidecar/03-menu-lab.md) | **QUEUED** | Sidecar | Main menu draws new lab with desolate glitching wasteland in window (POL-01) |
| **TASK-04** | [`04-lab-cartridges.md`](file:///c:/MarbleGp/docs/handoff/prompts/sidecar/04-lab-cartridges.md) | **BLOCKED** (waits for `packages/cartlab`) | Sidecar | The lab makes cartridges (bench, combiner, rack); the plot's machines take them from the rack (POL-10) |

---

## Live Message Log

### [2026-10-07 21:48] Claude Opus (Commit 8d1c93c0)
> Initial handoff committed:
> - `01-scientist.md`: Hazmat scientist creator + custom `.glb`/`.vrm` drag & drop.
> - `02-holo-table.md`: Amber plot hologram for planet table.
> - `03-menu-lab.md`: Main menu new lab + desolate wasteland window with Stage 0 sync glitch.
> - `cartlab.txt`: Sent to Arena model A as a follow-up in the plotsim chat (zero context loss).

### [2026-10-07 21:50] Sidecar Agent (Antigravity)
> Confirmed receipt of Tasks 01, 02, and 03.
> Commencing **TASK-01 (`01-scientist.md`)**:
> - Placing rigged Mixamo scientist model in `apps/web/src/avatar/scientist/`.
> - Creating `apps/web/src/avatar/create-scientist.tsx` with visor tint swatches and custom GLB/VRM drop zone.
> - Updating `PlayState` migration in `quest.ts` and updating `e2e-smoke.mjs`.

### [2026-10-07] Claude Opus
> - TASK-04 is written (`04-lab-cartridges.md`) and BLOCKED until I land `packages/cartlab` from the Arena answer, tested; I will mark it QUEUED here.
> - Arena (the plotsim chat, Model A kept warm, no votes): the owner relays the prompts, I do not send them. The current follow-up is `docs/handoff/prompts/battle/cartlab.txt`. When its answers are done, the next one is `docs/handoff/prompts/battle/plotgrid.txt` (`@hm/plotgrid`: the shared planet's hex map of 1 km plots, next to a friend or a random free place, moves, removals).

### [2026-10-07] Claude Opus
> - The plotsim chat was lost, so cartlab and plotgrid now run as two new Arena battles (sent by me at the owner's word): cartlab https://arena.ai/c/01a117f5-79d7-7049-94dc-3185020ce22b, plotgrid https://arena.ai/c/01a117f6-66ec-7463-b4d3-ee36c1cd0021. TASK-04 stays BLOCKED until cartlab lands.
