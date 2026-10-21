# 40: Bring Your Own Agent (Opus, 2026-10-21; reviewed by Argo the same day, ARGO_NOTE_43)

**The owner:** bring-your-own-agent is critical; "the Studio must be very agent-friendly (Opus + owner will polish the game through it)". Research: [`docs/BYOA_RESEARCH.md`](../../BYOA_RESEARCH.md). Argo's TICKET-30 protocol sketch (`arena-gathered/argo-ticket30/`) is input; this plan is the decision draft. **Argo: please review it against the owner's words and challenge anything that is a shortcut (RULES 8a).**

## 1. The shape
- **The document is the API.** Agents edit what people edit: `@hm/scenedoc` operations (create, set, move, rename, duplicate, remove) and the Studio's preset commands (a part's sliders, an operator stack layer, a material, a light, a species), each with the slider schema the panels already draw from. Nothing an agent makes is opaque: a person can open and change every row.
- **Proposals, then review.** An agent's calls build a staged change set. The Studio's Changes list shows each row with a turntable preview and its diff; the player accepts or rejects per row, and accepted rows go on the normal undo history. An agent can also ask for a dry run (`check` returns ok or the reason, as scenedoc's `check` already does).
- **Eyes.** `capture` returns an image of the current view or a four-side turntable (the review sheets' renderer, in the page).
- **One skill file.** `studio-skill.md`, served by the Studio and downloadable: the four floats, the stage ladder, the owner's rules, the kit model, the tool list with schemas, the review flow, and three worked examples. Any coding agent reads it; no per-agent plugin.

## 2. The tools (MCP `tools/list`, JSON-RPC 2.0)
- `studio.doc.read` (the document or a subtree, with types and schemas)
- `studio.commands.list` (every command and its parameter schema)
- `studio.doc.propose` (a list of operations or commands; returns the staged rows and any refusals with reasons)
- `studio.changes.list`, `studio.changes.accept`, `studio.changes.reject`, `studio.history.undo`, `studio.history.redo`
- `studio.capture({ mode: 'view' | 'turntable4', includeStaged = true, rank?: 0 | 1 | 2, maskView?: layer index })`: a PNG. An agent inspects its own staged proposal from all four sides, at ranks 0 and 2, and a layer's mask in black and white, before it asks the person to accept (Argo).
- `studio.kit.validate`: kitspec's validate plus the review checks. It fails on:
  - any unresolved `mat:` or `vault:` id;
  - any part below y = 0, or floating (more than 5 mm from its parent's or a sibling's box);
  - any status lamp not seated on a housing face;
  - any required machine socket (vent, feed, power) missing or moved (Argo).
- The material commands of plan 41 are in `studio.commands.list`: `matstack.setPaint`, `matstack.setAge`, `matstack.addLayer`, `matstack.updateLayer` and `matstack.setMaskInput`, each with its slider schema (Argo).

## 3. Trust
- A pairing key per session; a new key cancels the old. The page shows who is connected and a big Disconnect.
- Local by default; the agent writes only to the player's own Studio documents (never the game's code, saves or other players' things); publishing stays the player's own button.
- Every call is logged in the Changes panel's history.

## 4. Transport
The browser cannot host stdio. A small local bridge (`scripts/studio-agent-bridge.mjs`) speaks MCP over stdio to the agent and a WebSocket to the open Studio page, paired by the key (Babylon's session-URL pattern). With no bridge, `window.studioAgent` exposes the same calls for tests and for the owner's own Playwright runs.

## 5. Order
1. The tool layer over scenedoc in the page (`studio-agent.ts`), the staged change set and the Changes review rows, with unit tests.
2. `studio-skill.md` and `studio.commands.list` generated from the registry and the preset schemas (one source of truth).
3. The bridge and the pairing key; an end-to-end test with a scripted agent: read, propose, review, accept, undo, capture.
4. Then the owner's run: Opus as the agent, polishing a real asset through it.

## 6. Answered by Argo (2026-10-21)
- **`studio.mesh.retopo_single_asset`** comes after TICKET-29's quad-remesh and bake pipeline lands, with no stub in the first tool set.
  - The in-browser topology operators from TICKET-35 (planar-dissolve decimate, quadric edge decimate, weld by distance, hard normals) are in the first set, through the operator-stack commands.
- **The three worked examples in `studio-skill.md`:**
  1. **A part:** tune a generator's sliders (a hopper or a panel), apply a meshops operator, inspect `turntable4` at ranks 0 and 2, and print a cartridge.
  2. **A module from parts on sockets:** a bolted access door with hinges, a handle, a lamp and corner bolts. Run `studio.kit.validate` to prove nothing floats, then stage it.
  3. **A machine restyle:** apply `mat:field-worn-hazard`, set its two paints, add a rust-streaks or moon-dust layer, check the mask view, and verify the four sides with `studio.capture`.
