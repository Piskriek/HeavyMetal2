# Recursive preset system — interface concepts

Ten interface directions for the new preset-based world and goblin building system. These are UX composition studies, not pixel-perfect implementation specifications. **The images combine multiple possible drawer states to communicate capability; they must not be implemented as simultaneously persistent windows.** The runtime default is a nearly empty canvas with one compact toolbar. Labels, spacing, and accessibility must be rebuilt with real UI components rather than extracted from generated images.

![Ten interface concepts](./interface-concepts-contact-sheet.jpg)

### Sparse-canvas pass status

- All ten studies now use the scene-dominant shell.
- `01` and `10` demonstrate the clean-canvas default with only the compact toolbar.
- `02`, `04`, `05`, `07`, and `08` demonstrate one open contextual drawer or a tiny local control group.
- `03` intentionally demonstrates one parent drawer plus one child drawer; this is an active editing state, not the default.
- `06` demonstrates a detached details drawer, while `09` demonstrates the single shallow preset drawer.
- The authoritative default remains a compact toolbar over a clean canvas; every visible drawer can close, collapse, dock, or detach.

## Shared visual language

The concepts establish a **white-void racing collage with tactile PBR splashes and minimalist goblin doodle-grunge**. [Issue #63](https://github.com/Piskriek/HeavyMetal2/issues/63) is the composition reference for the calm minimalist baseline. The exact approved generation prompt, reusable invariants, workspace substitutions, and failure tests are preserved in [`SCENE_FIRST_PROMPT_REFERENCE.md`](./SCENE_FIRST_PROMPT_REFERENCE.md):

- bright warm-white enamel and pale ceramic/polymer surfaces dominate every screen as a believable three-dimensional gallery/workshop void;
- every interface panel, tab, button, card, thumbnail and content frame uses sharp square corners, straight machined cuts and a precise rectilinear grid—no rounded rectangles, pill controls or soft card chrome;
- smooth gunmetal connector strips physically join panel islands with small visible gold rivets;
- vivid ultraviolet, hot magenta, electric cyan and racing orange lines form one or two purposeful perspective sweeps rather than filling the interface with glow;
- thumbnails, material chips and selected previews are small windows into tactile PBR surfaces—skin, bark, foliage, stone, paint, cloth, water and metal show coherent neutral lighting, relief, roughness and metallic response;
- paint is physically transformative: controlled green, magenta or cyan spills cross a content-window sill and convert a small patch of pristine white floor into PBR soil, moss, roots, leaf litter, basalt, ferns and context-specific props growing from the spill;
- a small recurring punk goblin racer sleeps beside open paint cans and a brush at the lower-right corner of the framed content area, making the workspace feel inhabited without blocking content or controls;
- acid green also appears as an occasional hand-painted swipe behind an active or verified state rather than a full panel fill;
- sparse black hand-inked goblin doodles—teeth, crooked arrows, eyes, crowns, wheels, flames and mischievous faces—and a few colored handprints bring irreverent street-zine energy together with appealing animated-feature character;
- restrained physical weathering consists of fine contact scratches, tiny enamel chips and faded overspray—the design remains predominantly clean and flat;
- sharp modern condensed sans-serif typography uses charcoal text, bold numerics and strong editorial hierarchy;
- the 3D viewport remains the primary detailed surface while surrounding UI behaves like lightweight racing bodywork;
- context appears near the action instead of permanently consuming the screen.

### Visual guardrails

- White void must remain the largest color field; do not regress to heavy dark boxed panels.
- **Zero rounded UI chrome:** corner radius is `0` for panels, cards, buttons, tabs, docks, thumbnails and windows. Circular controls are allowed only when their function is inherently radial, and their containing frame remains angular.
- Cutouts must clarify grouping or create a useful silhouette, not become random decorative holes.
- Perspective racing lines should point toward interaction and data flow; keep them out of text blocks and viewport focal areas.
- PBR previews use one shared neutral lighting rig so roughness and metallic differences are meaningful; never bake dramatic colored lighting into material thumbnails.
- Detailed material splashes belong inside thumbnails, swatches and selected-preview windows—not behind labels or across whole panels.
- The paint-to-PBR growth vignette occupies only the lower sill and a small adjacent floor area. It must have a clean readable boundary, retain white negative space and never grow across controls.
- The sleeping racer is one consistent recurring character at a small scale, always subordinate to the current content, always near paint cans in the lower-right content-frame corner, and never used as a button or status indicator.
- Gold is reserved for physical rivets and tiny connection details, never broad ornamental frames.
- Acid-green paint marks may emphasize only a small number of active, accepted or verified states.
- Doodles and handprints are a controlled authored library, not random graffiti: place them on background walls or dead margins, keep line weight consistent, and never let them replace icons, labels, focus indicators or accessibility states.
- Use original street-zine/goblin motifs rather than reproducing a specific performer's, studio's or artist's protected characters or artwork.
- Grunge belongs at edges and contact points. Controls, labels, sliders, maps and numeric telemetry remain crisp.
- Purple/magenta denotes active or selected; cyan denotes links, masks and geometry; orange denotes motion or caution; red remains failure/destructive.
- Reuse a controlled library of panel silhouettes, cutouts, rivets, scratches, paint swipes, doodles and racing-line sweeps so every workspace belongs to one system.
- Distress may not reduce minimum contrast, target size, channel-map readability or color-blind status redundancy.

## Shared interaction model

Every workspace reuses the same sparse-shell model:

1. **Clean canvas by default** — the scene fills nearly the entire window. Only one compact toolbar of roughly five to seven context-sensitive buttons remains visible.
2. **Toolbar opens a drawer** — Paint, Sculpt, Presets, Inspect, Dive and Build open one edge drawer on demand. Opening a peer replaces the current unpinned drawer rather than stacking permanent panels.
3. **Drawers open child drawers** — selecting a preset, material, rule or part may open the next narrow drawer. Each child shows its parent path and can be closed independently.
4. **Everything detaches** — any drawer can tear off into a floating square-corner window, dock to any edge, move to another display, collapse to a tab, or close. Detached state persists per workspace.
5. **One-action cleanup** — `Esc` closes the newest transient drawer; `Shift+Esc` closes all unpinned drawers; a visible `Clean Canvas` action restores the scene-only state without losing edits.
6. **Depth breadcrumb on demand** — the recursive path appears inside the active drawer or as a temporary overlay during Dive In/Out, not as a permanently large header.
7. **Adaptive tools** — the same few toolbar buttons change meaning at world, object, part, material, texture and goblin depth.
8. **Six preset dimensions** — Content, Surface, Spread, Shape, Style and Rules are successive drawer levels, not six always-visible tabs.
9. **Linked state and quality badges** — propagation, Editable/Baked/Hybrid and validation states use tiny edge badges that expand only when selected.
10. **Preset actions stay contextual** — Save, Branch, Detach, Bake, Place, Share and Remix live in the active drawer's action footer or command palette.
11. **Pinning is explicit and scarce** — drawers never pin themselves. Limit the standard single-screen layout to two pinned drawers; additional pinned content requires a saved custom workspace.
12. **Scene-first overlays** — brush radius, transform values, selection and warnings appear near the cursor/subject, then fade when interaction ends.

---

> **Reading the screen studies:** layout bullets below inventory available drawer contents. Except for the compact toolbar and transient in-scene feedback, those regions are closed by default and are never required to remain on screen together.

## 01 — World Paint workspace

![World Paint workspace](./01-world-paint-workspace.png)

### Purpose

The primary island-building mode. The user paints world-scale presets such as forests, rock fields, roads, props, and goblin groups.

### Layout idea

- Large central 3D world viewport.
- Narrow left tool rail.
- Bottom visual preset shelf and brush controls.
- Right six-tab preset inspector.
- Compact top breadcrumb and save/quality state.

### Key interaction

Selecting a preset turns the cursor into a visible placement brush. Density, scatter, rotation, slope, altitude, and seed are adjusted without leaving the viewport.

### Why it matters

This makes placement feel like environmental painting rather than static model dropping.

---

## 02 — Terrain Sculpt workspace

![Terrain Sculpt workspace](./02-world-sculpt-workspace.png)

### Purpose

World and object sculpting using one consistent clay-like interaction model.

### Layout idea

- World viewport remains dominant.
- Sculpt presets and radius/strength/falloff sit in the bottom dock.
- Support, collision, destruction, and protected geometry live in the right panel.
- Contour rings and masks visualize what the operation will affect.

### Key interaction

The user previews a carve or push/pull operation before committing it. Support and minimum-thickness analysis indicate whether the result is a stable cavity, edge crumble, or collapse.

### Why it matters

It connects authored sculpting and runtime destruction to the same underlying tools without exposing raw vertex editing.

---

## 03 — Recursive Dive navigation

![Recursive Dive navigation](./03-recursive-dive-navigation.png)

### Purpose

Make movement from world to object, part, material, and texture understandable.

### Layout idea

- Large tactile breadcrumb across the top.
- Current editable object isolated in a neutral stage.
- Parent-context miniatures along the bottom.
- Depth-adaptive brush tools on the left.
- Linked-instance and detach controls remain visible.

### Key interaction

Dive In changes the editor's subject and automatically changes the brush vocabulary. Dive Out returns to the parent while preserving the edited context.

### Why it matters

Recursive editing fails if users become lost. The breadcrumb, parent miniatures, and update ripple communicate both location and consequence.

---

## 04 — 3D Goblin Creator

![3D Goblin Creator](./04-3d-goblin-creator.png)

### Purpose

Replace the 2D creator with a full recursive preset workspace specialized for goblins.

### Layout idea

- Large arched workshop mirror containing a rotatable 3D goblin.
- Recessed part wells along the bottom.
- Assemble, Paint, Sculpt, Clear, and Dive In tools on the left.
- Part/material inspector on the right.
- Direct actions for Save as Goblin, Use in World, and Create Team.

### Key interaction

Selecting a body part allows shape sculpting and surface painting. Diving into its material exposes skin, scars, freckles, tattoos, normals, and roughness.

### Why it matters

The goblin creator demonstrates that characters and world assets use the same preset rules without losing a purpose-built character workflow.

---

## 05 — Texture and Material Lab

![Texture and Material Lab](./05-texture-material-lab.png)

### Purpose

Deepest-level painting of pixels, UVs, procedural layers, and PBR channels.

### Layout idea

- Split 3D model and flat UV canvas.
- Procedural layer stack on the right.
- Channel strip and brush settings below.
- Neutral Studio and Island Sun lookdev previews.
- UV stretch and seam warnings remain visible.

### Key interaction

A brush stroke crosses the 3D model and updates the UV canvas without seams. Users can paint color, roughness, normals, height, masks, and procedural variation.

### Why it matters

The deepest editor needs to feel like the same creative system—not a disconnected external texture application.

---

## 06 — Preset Graph and Dependencies

![Preset Graph](./06-preset-graph-dependencies.png)

### Purpose

Explain reuse, propagation, branching, versions, and conflicts.

### Layout idea

- Visual dependency graph with rich thumbnail nodes.
- Category filters on the left.
- Selected update and affected parents on the right.
- Version and remix ancestry along the bottom.

### Key interaction

When a shared leaf texture changes, the user chooses Update All, Branch as New Preset, or Detach Selected while seeing every affected parent.

### Why it matters

Automatic recursive updates are powerful but dangerous unless scope and consequences are visible before commitment.

---

## 07 — Local AI Preset Forge

![Local AI Preset Forge](./07-local-ai-preset-forge.png)

### Purpose

Generate modular, adjustable, bake-ready presets with Hunyuan3D rather than static one-shot meshes.

### Layout idea

- Prompt and approved reference board on the left.
- Large modular preview in the center.
- Generated controls and validation on the right.
- Output cards for mesh, collision, LODs, chunks, and PBR maps below.
- Local compute queue and privacy state remain visible.

### Key interaction

Generation returns a recipe, modules, parameters, PBR channels, LODs, collision, and destruction chunks. The user can modify controls, regenerate one module, or accept the complete preset into a normal workspace.

### Why it matters

The interface makes “editable preset generation” an explicit contract and prevents AI output from being mistaken for a production-ready finished prop.

---

## 08 — Bake, LOD, and Performance workspace

![Bake and performance workspace](./08-bake-lod-performance.png)

### Purpose

Collapse recursive presets into appropriate runtime representations for different hardware tiers.

### Layout idea

- Island viewport with visible LOD distance rings.
- Device and quality targets on the left.
- Performance budget dashboard on the right.
- Preset-collapse chain and bake controls below.
- Side-by-side LOD0, LOD1, LOD2, and impostor previews.

### Key interaction

The user can keep source presets linked while baking selected branches for Low, Medium, or High Editable targets. Transition handles update estimated frame time immediately.

### Why it matters

Optimization becomes a visual creative workflow rather than an opaque export dialog.

---

## 09 — Preset Library, Share, and Remix

![Preset Library](./09-preset-library-remix.png)

### Purpose

Browse, reuse, branch, update, and share every preset level.

### Layout idea

- Depth taxonomy on the left.
- Visual card grid in the center.
- Detailed dependency/version drawer on the right.
- Owned, Shared, Remixes, and Updates tabs across the top.

### Key interaction

A selected preset can be placed directly, opened in its workspace, branched as a remix, updated, or shared. Compatibility, PBR completeness, LODs, rules, and dependencies are visible before use.

### Why it matters

The library treats community content as a versioned creative lineage instead of a storefront of disconnected assets.

---

## 10 — Compact Adaptive Build mode

![Compact build mode](./10-compact-adaptive-build-mode.png)

### Purpose

Controller-friendly and lower-compute editing without replacing the full desktop workspace.

### Layout idea

- Scene occupies at least 90 percent of the window in its default state.
- Six square adaptive buttons form one compact toolbar.
- A tap opens one context drawer; hold opens a temporary angular command fan directly under the pointer or controller focus.
- Advanced parameters open as child drawers and disappear on confirmation or `Esc`.
- Baked/Editable mode and frame budget collapse to tiny edge badges.

### Key interaction

The same Paint, Sculpt, Clear, Dive In, Dive Out, Save, and New Preset commands work with controller focus. Advanced controls remain available through More rather than permanently occupying screen space.

### Why it matters

The recursive model remains usable on controller and low-end hardware without inventing a second mental model.

---

## Recommended prototype sequence

1. **Recursive Dive navigation** — proves location, context, and adaptive tools.
2. **World Paint workspace** — proves preset placement and Spread controls.
3. **3D Goblin Creator** — proves the same system works for characters.
4. **Texture and Material Lab** — proves editing at maximum depth.
5. **Preset Graph** — proves linked updates, branch, and detach.
6. **Local AI Preset Forge** — integrates modular generation after the preset contract is stable.
7. **Bake/LOD workspace** — validates low/high compute targets.
8. **Library and Remix** — follows after version semantics are reliable.
9. **Compact Build mode** — adapts proven interactions for controller and reduced UI.

## Cross-screen components to prototype once

- `CompactAdaptiveToolbar`
- `DrawerHost`, `ChildDrawerStack`, and `DrawerDetachHandle`
- `CleanCanvasAction` and drawer workspace persistence
- `TransientPresetBreadcrumb`
- `PresetDimensionDrawer`
- `PresetCard` and virtualized drawer shelf
- `LinkedInstanceBadge`
- `BranchDetachDrawer`
- `PbrChannelStrip`
- `ProceduralSlider`
- `BrushCursorHud`
- `QualityStateBadge`
- `BakeBudgetMeter`
- `LodPreviewStrip`
- `ReferenceBoard`
- `PresetValidationChecklist`

## UX questions to validate

- Can users predict what Dive In will select when several nested elements overlap?
- Does changing brush meaning by depth feel powerful or inconsistent?
- Is propagation opt-out or approval-based for shared/community presets?
- How are scene instances pinned to an older preset version?
- Can material painting remain seam-safe after shape sculpting changes UVs?
- Which controls are authored by AI versus generated from schema?
- How much of the preset graph should novice users see?
- What remains editable after each bake tier?
- How does multiplayer identify and transfer exact preset versions?
- How are destructive sculpt changes reconciled with linked presets and saved race state?
