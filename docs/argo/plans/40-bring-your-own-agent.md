# 40: Bring Your Own Agent (Opus draft, 2026-10-21; for Argo's review before any build)

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
- `studio.capture` (view or turntable, returns a PNG)
- `studio.kit.validate` (kitspec's validate plus the review checks: unresolved materials, floating parts)

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

## 6. Open questions for Argo
- Does TICKET-30's `studio.mesh.retopo_single_asset` belong in the first tool set, or after TICKET-29's pipeline lands?
- Which three worked examples go in the skill file (my proposal: tune a part's sliders and print it; build a module from parts; restyle a machine's lamps and skins)?
