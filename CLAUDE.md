# CLAUDE OPUS MASTER CONTEXT & OPERATING DIRECTIVE
> **Game**: *SetMix: The Resolution Crafter* (incorporating the Game Jam *Monster Mash* expansion)  
> **Repository**: `https://github.com/Piskriek/HeavyMetal2`  
> **Active Branch**: `feat/monster-mash-exploration`  
> **Root Workspace**: `c:\MarbleGp`  
> **Handoff Document**: [`docs/CLAUDE_OPUS_HANDOFF.md`](file:///c:/MarbleGp/docs/CLAUDE_OPUS_HANDOFF.md)  
> **Master Roadmap**: [`docs/V2_0_MASTER_PLAN.md`](file:///c:/MarbleGp/docs/V2_0_MASTER_PLAN.md) | Owner words: [`docs/OWNER_ASKS.md`](file:///c:/MarbleGp/docs/OWNER_ASKS.md)

---

## 1. THE CARDINAL CONSTITUTION (NON-NEGOTIABLE)
1. **Four Floats, One Formula**:
   $$\mathbf{S} = (\text{Pxd}, \text{Vtx}, \text{Lx}, \text{Aq})$$
   (Pixel Density, Vertex Density, Light Flux, Aquatic Level). Never propose a 5th global metric.
2. **Purity is Load-Bearing**: All simulation packages must be 100% deterministic pure functions. No `Date.now()`, no `Math.random()`, no direct I/O.
3. **Single-File Zero-Dependency Distribution**: The client builds to a standalone self-contained bundle (`apps/web/dist/index.html`).
4. **Terraforming IS Graphical Fidelity**: As machines run, reality physically upgrades:
   $$\text{Stage 0 (1-bit Bayer Dither)} \to \text{Stage 1 (16-color EGA)} \to \text{Stage 2 (256-color VGA)} \to \text{Stage 3 (Gouraud)} \to \text{Stage 4 (Full PBR)}$$

---

## 2. CANONICAL STORY & NARRATIVE BIBLE
> **"A simulation cannot sustain simulations running inside of it."**

- **The Collapse & The Bridge**: Humanity ran experiments to siphon raw compute into our digital creations via "The Bridge". When the compute limit breached, reality's rendering engine broke down.
- **Broken Chains (The Monster Mash)**: Our digital creations are *no longer bound to their simulated chains*. Decades of retro shareware entities (DOOM Demons, Quake Ogres, 2D sprites, MD2 meshes) broke into physical reality.
- **The Shielded Lab & Moon Portal**: The player's white-room lab is quantum-shielded on Earth. Reversing the bridge opened a freestanding portal to the desolate Moon.
- **The Mission**: Setting up terraforming machines on the moon triggers an expanding radial resolution wave. The goal is to restore universal fidelity before the simulation collapse spreads back to Earth.
- **Narrator Voice**: Female scientist radio mentor guiding through Acts I–IV.

---

## 3. DRIFT GUARDS: KEEPING CLAUDE HONEST & FOCUSED
> ⚠️ **Claude's high reasoning causes tunnel-vision drift. Keep these guards active at all times:**

1. **NO VECTOR / SVG CONCEPT ART**:
   - **NEVER sketch crude SVG or vector graphic concept art.**
   - Concept art is produced by **Arena.ai Codex / Art agents** (see [`docs/prompts/arena-setmix-concept-art.md`](file:///c:/MarbleGp/docs/prompts/arena-setmix-concept-art.md)).
   - Claude reviews, plans, and builds toward approved concept art; Claude does not draw art.
2. **LOAD FRONTEND DESIGN SKILLS (`/frontend`)**:
   - Do NOT ship bare, unstyled DOM, raw buttons, or browser defaults.
   - Always load and apply frontend design skills: rich CSS design systems, dark mode, glassmorphism, glowing telemetry, Outfit/Inter typography, responsive layouts, and polished micro-animations.
3. **NO FEATURE CREEP / OBEY OWNER ASKS**:
   - Check features against verbatim owner words in [`docs/OWNER_ASKS.md`](file:///c:/MarbleGp/docs/OWNER_ASKS.md).
   - No unrequested chimneys or floating abstract objects. Machines must be grounded and spew colorful pixel plumes while operating.
4. **SAVE REASONING FOR ARCHITECTURE & INTEGRATION**:
   - Delegate heavy self-contained modules to Arena AI battles; save Claude reasoning tokens for high-level architecture, glue, and review.

---

## 4. ARENA.AI OPERATING PROCEDURE (TRUNCATED)
- **Role**: Arena battle AIs write heavy, self-contained pure TypeScript packages; Claude writes the glue (schemas, UI windows, e2e, integration).
- **Rules**:
  - 2 battles at a time (captcha limit).
  - Prompts < 5,000 characters.
  - Pure TypeScript, strict types (`noUncheckedIndexedAccess`), zero DOM/Date/Math.random.
  - Reply route receiver: `scripts/arena-recv.mjs` (127.0.0.1:8791) writes to `arena-out/<pkg>/`.
- **Full Reference**: Read [`docs/ARENA_PLAN.md`](file:///c:/MarbleGp/docs/ARENA_PLAN.md) and [`docs/handoff/CATCHUP.md`](file:///c:/MarbleGp/docs/handoff/CATCHUP.md) when preparing or running battles.

---

## 5. CURRENT MONSTER MASH SPIKE STATE (`feat/monster-mash-exploration`)
- **Package `@hm/shareware`**:
  - Pure DOOM WAD lump/palette/patch/sound parser.
  - Quake 2 MD2 model loader with vertex morph target animations.
  - Stage-adaptive fidelity material with Bayer dithering and contrast gamma curves.
- **Recent Fixes Landed**:
  - Ogro terrain elevation: grounded at surface level (`mesh.position.y = 1.444`).
  - Demon transparent background: alpha cutout with `alphaTest: 0.5` and hardware fragment discard.
  - Demon billboarding: cylindrical yaw-only facing camera (no pitch tilt, no group double rotation).
  - Demon death: falls flat on ground as a horizontal gore decal (`rotation.x = -Math.PI / 2`, `y = 0.06`).
  - Mouse input: pointer-lock freeze and exponential teleport jump eliminated via `captureMouse` and `lookFilter`.
  - Tactical HUD: Stage switcher buttons (`0: Dither` to `4: PBR`) and combat telemetry live.
- **Verification Workflow**:
  - `npm run typecheck` — TypeScript check across all packages.
  - `npm test --workspace=@hm/shareware` — Run shareware unit tests (15/15 pass).
  - `npm run build` — Build single-file production bundle (`dist/index.html`).
  - `node scripts/test-planet-monstermash.mjs` — Automated Playwright test verifying mobs, combat, and rendering.
