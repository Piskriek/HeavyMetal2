# FIDELITY: THE SETMIX MULTIVERSE // SYSTEM DOCUMENTATION
> **Repository**: `https://github.com/Piskriek/HeavyMetal2`  
> **Active Branch**: `feat/monster-mash-exploration`  
> **Workspace**: `c:\MarbleGp`  
> **Historical Archive**: Deprecated prototypes from the early Goblin Racing era (October 1–5, 2026) are archived in [`archive/legacy_docs_goblin_era/`](../archive/legacy_docs_goblin_era/).

---

## 1. EXECUTIVE DIRECTORY SITEMAP

Every active document in `docs/` is current, relative to the active codebase, and has a filename that leaves zero room for interpretation:

| Document | Primary Scope & Architecture |
| :--- | :--- |
| [`ACTIVE_ROADMAP.md`](ACTIVE_ROADMAP.md) | **Master Roadmap & Status**: Branch state, verification gates, co-pilot contract ("AAA the Flash Job"). |
| [`NARRATIVE_AND_LORE_BIBLE.md`](NARRATIVE_AND_LORE_BIBLE.md) | **Narrator & Story Bible**: Simulation collapse, The Bridge, white-room lab, lunar portal, female mentor voice lines, Acts I–IV walkthrough. |
| [`CARDINAL_CONSTITUTION_AND_STAGES.md`](CARDINAL_CONSTITUTION_AND_STAGES.md) | **Core Formula & Stages**: Four floats $\mathbf{S} = (\text{Pxd}, \text{Vtx}, \text{Lx}, \text{Aq})$, the 5 fidelity stages ($S_0 \to S_4$), terraforming IS graphical fidelity. |
| [`BASE_BUILDING_AND_SUBSTRATE_SPEC.md`](BASE_BUILDING_AND_SUBSTRATE_SPEC.md) | **Pinned Next Milestone**: Valheim/Dune-style freeform construction, substrate harvesting (Pxd / Vtx), linked quantum bridge storage. |
| [`MAIN_MENU_AND_NAVIGATION_SPEC.md`](MAIN_MENU_AND_NAVIGATION_SPEC.md) | **Menu & Shell Hierarchy**: 6-button suite (`Expedition`, `Planetary Grid`, `The Studio`, `The Workshop`, `Community Nexus`, `Settings`), brand mark emblem. |
| [`STUDIO_CREATIVE_SUITE_SPEC.md`](STUDIO_CREATIVE_SUITE_SPEC.md) | **Creative Studio**: Moon Base Game Editor (3D WebGL2 lunar surface, mantle cartridges, consensus patch generator) + Planet Forge (multiverse creator). |
| [`PLANETARY_GRID_AND_CONSENSUS_SPEC.md`](PLANETARY_GRID_AND_CONSENSUS_SPEC.md) | **Shared World**: 40,000 km planetary sphere, 1 km plots, sunflower spiral allocation, synced vs desynced branches, majority-rules consensus. |
| [`MONSTER_MASH_AND_ASSETS_SPEC.md`](MONSTER_MASH_AND_ASSETS_SPEC.md) | **Vintage Preservation**: Quake 2 MD2 3D Ogro, DOOM 2D Demon, shotgun pickups, dynamic stage fidelity inheritance, CC0/shareware catalog. |
| [`HOTBAR_V3_SPEC.md`](HOTBAR_V3_SPEC.md) | **Editor Hotbar Schema**: 12-tab F1..F12 layout, 3 modes (Game, Simplified, Advanced), 3D transform gizmos (RGB XYZ). |
| [`UI_DESIGN_SYSTEM_AND_TOKENS.md`](UI_DESIGN_SYSTEM_AND_TOKENS.md) | **Design System & Tokens**: Glassmorphic sci-fi UI tokens (`apps/web/src/studio.css`), dark mode, typography (Oxanium, Inter, Outfit). |
| [`GRAPHICS_AND_TEXTURE_PIPELINE.md`](GRAPHICS_AND_TEXTURE_PIPELINE.md) | **Graphics & Textures**: Procedural math textures (`@hm/texgraph`), GPU tier scaling (Potato to Ultra), 60 FPS hold governor, Bayer dither matrix, pixel plumes. |
| [`ENGINE_OPTIMIZATION_AND_BRIDGING_SPEC.md`](ENGINE_OPTIMIZATION_AND_BRIDGING_SPEC.md) | **Optimization & Bridging**: "Make it look right, keep it optimal", inter-game bridge (UE5, Godot, Minecraft), custom avatar drag-and-drop. |
| [`DEFERRED_POLISH_REGISTRY.md`](DEFERRED_POLISH_REGISTRY.md) | **Deferred Polish**: Master tracking registry for micro-polish, performance tuning, and visual pass handoffs. |
| [`SIDECAR_COMMS.md`](SIDECAR_COMMS.md) | **Sidecar Ledger**: Live asynchronous communication channel between Gemini Flash 3.8 High and Claude Opus 5.5 Max. |
| [`BOOTSTRAP_PROMPTS.md`](BOOTSTRAP_PROMPTS.md) | **Session Bootstraps**: Pre-flight prompts for starting fresh agent sessions with full context. |
| [`OWNER_ASKS.md`](OWNER_ASKS.md) | **Verbatim Owner Directives**: Canonical owner directives from 2026-10-06 onwards. |

---

## 2. VERIFICATION COMMANDS (ALWAYS RUN BEFORE COMMITTING)
- `npm run typecheck` — TypeScript check across all packages (must be 0 errors).
- `npm run build` — Standalone single-file bundle build (`apps/web/dist/index.html`).
- `node scripts/test-fidelity-sync-studio.mjs` — Automated Playwright E2E for Menu, Studio (Moon Editor + Planet Forge), and Synced/Desynced campaign.
- `node scripts/test-planet-monstermash.mjs` — Automated Playwright E2E for Monster Mash combat, mobs, and stage fidelity.
