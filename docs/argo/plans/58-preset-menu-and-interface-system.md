# Plan 58: Unified Preset Menu & Interface System (Tactile Industrial UI Built in & for The Studio)

> **Status**: Active Implementation (Argon Overwatch)  
> **Research**: [`docs/UI_DESIGN_SYSTEM_RESEARCH.md`](../../UI_DESIGN_SYSTEM_RESEARCH.md), [`docs/UI_EDITOR_RESEARCH.md`](../../UI_EDITOR_RESEARCH.md), [`docs/MENU_HOLODECK_RESEARCH.md`](../../MENU_HOLODECK_RESEARCH.md)  
> **Invariants**: **RULES 6** (Research Before Design), **RULES 8a** (Zero Architectural Lies / Presets Inside Presets: The Game & Studio Are Built by the Studio), **Standing Rule 6** (Examples Mean Categories), **Previews Drive Play** (hover try-on across all UI styles and widgets)

---

## 1. Problem Statement & Root-Cause Diagnosis (`sq-distortion-check`)

The screenshot audit (`docs/UI_DESIGN_SYSTEM_RESEARCH.md` §1) exposed two critical failures across our interface layer:
1. **Cross-Stylesheet Contrast Bug**: `shell.css` set global `button { background: #1d2530; color: var(--text); }` while `studio.css` overwrote `:root { --panel: #fbfaf6; --text: #242722; }`. Any dialog using `.shell-window` (such as `ManageProfilesModal`) rendered dark `#242722` text inside dark `#1d2530` buttons on muddy grey rows over a cream panel — making buttons unreadable.
2. **Mismatched "AI Slop" Visual Collage**: Five disconnected stylesheets (`shell.css`, `studio.css`, `dark-modal.css`, `planetary-grid.css`, and inline hex styles in `studio-app.tsx` / `goblin-front.tsx`) mixed glowing `#00e5ff` neon cyan logos/badges, `#38bdf8` sky-blue pills, `#b84dff` neon purple Game Bridge borders, `#a855f7` purple Studio buttons, and `#fbfaf6` light cream modals on the same screen.

Under **Standing Rule 6 (Examples Mean Categories)** and **RULES 8a**, we replace this piecemeal CSS with a single **5-Rung `ui:` Preset Architecture** authored in **The Studio**, applied to **The Studio itself**, and driving **every menu, modal, overlay, and HUD**.

---

## 2. The 5-Rung Preset Interface Architecture (`@hm/hudlayout`)

Every screen in FIDELITY and The Studio is a validated `UiScreen` (`uic:` share code) built from the 5-rung hierarchy in `packages/hudlayout/src/ui.ts`:

| Rung | Kind | Type | Role |
| :---: | :---: | :--- | :--- |
| **1** | **Atoms & Style Tokens** | `UiTokens` / `UiStylePreset` | Surface chassis (`bg`, `paper`, `inset`, `line`), typography (`ink`, `dim`, `font`), functional state colors (`accent`, `ok`, `warn`, `danger`), corner radius (`0..6px`), and Four-Float vector $\mathbf{S} = (\text{Pxd}, \text{Vtx}, \text{Lx}, \text{Aq})$. |
| **2** | **Widget Stack** | `UiWidget` | Typed primitives (`pill`, `bar`, `text`, `stat`, `action`) with `tone`, `frame`, `size`, and validated `source` or `command` binding. |
| **3** | **Panel Clip** | `UiPanel` | Anchored 9-zone container (`top-left` .. `bottom-right`) holding `UiPanelPart[]` with 8 px grid-snapped offsets (`dx`, `dy`). |
| **4** | **Screen Assembly** | `UiScreen` | Complete interface layout (`HOME_HOLODECK_SCREEN`, `PLAY_HUD_SCREEN`, `META_SHELL_SCREEN`, `STUDIO_SHELL_SCREEN`) combining Rung-1 `tokens` with Rung-3 `panels`, validated by `validateScreen` (Lens Rule: zero dead buttons or unbound data sources) and round-tripped via `uic:` codes. |
| **5** | **World / Campaign Cartridge** | `MultiverseGamePresetSpec` | Binds the active `UiStylePreset` and screen overrides to the world save (`hm.setmix.ui.style`, `hm.setmix.ui.homeScreen`, `hm.setmix.ui.playScreen`). |

---

## 3. Anti-Slop Tactile Industrial Style Shelf (`UI_STYLE_SHELF`)

To eliminate "AI slop" (unfocused cyan/purple neon glows, fake glassmorphism blobs, rainbow buttons), `UI_STYLE_SHELF` provides **6 tactile industrial & diegetic presets**, defaulting to **`ui-style:braun-atelier`**:

| Style ID | Name | Inspiration & Palette | S = (Pxd, Vtx, Lx, Aq) |
| :--- | :--- | :--- | :--- |
| `ui-style:braun-atelier` *(Default)* | **Braun Atelier** | Dieter Rams / Teenage Engineering matte warm-carbon (`#141513` bg, `#1c1e1b` panel, `#252824` inset, `#343832` hairline, `#f2f0e8` bone ink, `#d96b43` tactile terracotta accent, `2px` chamfer, zero glow). | `(0.88, 0.85, 0.72, 0.30)` |
| `ui-style:rams-paper` | **Rams Drafting Vellum** | Clean warm-white architectural studio (`#f4f3ee` bg, `#fbfaf6` panel, `#eae8df` inset, `#d6d4cb` hairline, `#20221e` charcoal ink, `#c56443` terracotta accent, `0px` square corners). | `(0.92, 0.86, 0.90, 0.25)` |
| `ui-style:nier-monolith` | **YoRHa Monolith** | *NieR:Automata* computational data-craft (`#1a1917` ash-black, `#23221f` panel, `#2e2c28` inset, `#46433b` hairline, `#dad4c4` parchment ink, `#c4b89b` brass-ivory accent, `0px` corners). | `(0.90, 0.88, 0.65, 0.22)` |
| `ui-style:nasa-amber` | **Apollo Telemetry** | *Starfield* NASA-punk command module (`#121417` anodized slate, `#181b20` panel, `#21262d` inset, `#323842` hairline, `#ede8dc` cream ink, `#e09f3e` instrument amber accent, `2px` corners). | `(0.84, 0.80, 0.78, 0.28)` |
| `ui-style:system-sovereign` | **Sovereign Ledger** | LitRPG System archival frame (`#111418` obsidian, `#171b21` panel, `#1f252d` inset, `#2e3642` hairline, `#eef2f6` crisp ink, `#d4a359` burnished gold accent, `2px` corners). | `(0.90, 0.84, 0.82, 0.45)` |
| `ui-style:high-contrast` | **High-Contrast Blueprint** | WCAG AAA accessible engineering blueprint (`#000000` black, `#0a0a0a` panel, `#171717` inset, `#ffffff` rule, `#ffffff` ink, `#ffbe0b` high-vis amber-gold, `0px` corners). | `(1.00, 0.90, 1.00, 0.20)` |

### Single Root CSS Variable Bridge (`uiTokensToCssVars`)
`uiTokensToCssVars(tokens)` outputs both `--ui-*` variables AND maps `--bg`, `--paper`, `--panel`, `--hm-inset`, `--line`, `--text`, `--dim`, `--accent`, `--ok`, `--danger` so that **every stylesheet in the repo** (`shell.css`, `studio.css`, `dark-modal.css`, `dark-forms.css`, `planetary-grid.css`) shares one authoritative palette with guaranteed button and modal contrast.

---

## 4. Built in The Studio, for The Studio, and Applied to the Menus

1. **4 Canonical `UiScreen` Presets (`packages/hudlayout/src/ui.ts`)**:
   - `HOME_HOLODECK_SCREEN` (`ui:home-holodeck-default`): Home Menu navigation, profile/credits bar, warm-up status, and Game Bridge card.
   - `PLAY_HUD_SCREEN` (`ui:play-hud-default`): In-game 9-zone HUD.
   - `META_SHELL_SCREEN` (`ui:meta-shell-default`): Rung-6 Wanderer Meta-Shell (Anchor Calm, Party Doubling, Guild Complex, Auto-Mimicry & Clip Share).
   - `STUDIO_SHELL_SCREEN` (`ui:studio-shell-default`): The Studio's own workspace bar, 5-rung breadcrumb, inspector dock, and action bar.
2. **Studio `UI & Menus (ui:)` Inspector Tab (`apps/web/src/studio/inspectors/ui-preset-inspector.tsx`)**:
   - Accessible directly in **The Studio** (`UI & Menus (ui:)` tab in `StudioApp`).
   - Lets the creator or AI agent select any of the 4 screens (`Home Menu`, `Play HUD`, `Meta-Shell`, `Studio Chrome`), switch or customize `UiStylePreset` tokens with **live hover try-on**, toggle/re-anchor panels and widgets on an 8 px grid, inspect live **Lens Rule (`validateScreen`)** & **9-Zone Overlap** checks, and copy/paste **`uic:` share codes**.
   - **Self-Hosting Studio**: Changing the UI style preset in The Studio immediately updates The Studio's own chrome (`StudioApp`) AND persists to the Home Menu and Play HUD.
3. **Preset-Driven Home Menu & Unified Modals**:
   - `SetMixHome` (`goblin-front.tsx`) reads the Studio-saved `HOME_HOLODECK_SCREEN` preset so panel visibility, action labels, and style tokens edited in the Studio drive the live Home menu.
   - `ManageProfilesModal`, `ProfileChip`, `GridRoom`, `DarkModal`, and `PlanetaryGridScreen` use the unified `--ui-*` tokens with crisp 1px hairlines and zero neon slop.
