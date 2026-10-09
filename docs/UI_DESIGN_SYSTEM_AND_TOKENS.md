# FIDELITY // UI DESIGN SYSTEM & DESIGN TOKENS
> **Scope**: Design System, CSS Variable Tokens, Typography & Frontend Aesthetics  
> **Target Stylesheet**: `apps/web/src/studio.css`  

---

## 1. DESIGN PHILOSOPHY: SCI-FI RESEARCH LAB AESTHETICS

- **Aesthetic Voice**: Clean, balanced, state-of-the-art scientific research terminal (CERN meets Weyland-Yutani meets Teenage Engineering).
- **Surface Styling**: Frosted glassmorphism, subtle high-tech borders, glowing signal telemetry, dark mode depth.
- **Micro-Interactions**: Smooth hover transitions, tactile audio clicks, glowing active indicators, responsive feedback.
- **Cardinals**:
  - **Zero Unstyled DOM**: Never render raw browser buttons or unstyled text.
  - **No Web3 / AI Slop**: Clean structural geometry, sharp chamfers, no tacky drop shadows or comic fonts.
  - **Loading Feedback**: All heavy operations must display animated progress bars with descriptive status text.

---

## 2. DESIGN TOKENS (`apps/web/src/studio.css`, `:root`)

| Token | Semantic Purpose | Default Theme Value |
|---|---|---|
| `--bg` | Deep background environment | `#06080d` |
| `--paper`, `--panel` | Glassmorphic floating windows & cards | `rgba(13, 17, 23, 0.85)` |
| `--hm-inset` | Inset wells and depressed sockets | `rgba(0, 0, 0, 0.45)` |
| `--line` | Hairline panel borders & dividers | `rgba(255, 255, 255, 0.12)` |
| `--text` | Primary crisp legible typography | `#e6edf3` |
| `--dim` | Secondary telemetry text | `#8b949e` |
| `--faint` | Metadata labels & shortcuts | `#484f58` |
| `--accent` | Primary action signal (Go, Active, Selected) | `#38bdf8` (Cyan) / `#22c55e` (Green) |
| `--danger` | Destructive actions & critical alarms | `#f43f5e` (Crimson) |
| `--font-setmix` | High-tech architectural display font | `Oxanium`, monospace |
| `--font-display` | Secondary interface headings | `Outfit`, sans-serif |
| `--font-text` | Body typography & telemetry tables | `Inter`, sans-serif |

---

## 3. COMPONENT PATTERNS

- **Floating Windows**: Centered or docked glassmorphic containers with title bars, draggable handles, and Esc dismissal.
- **Active Pills & Badges**: Small rounded tags displaying live telemetry (`[GRID SYNCED]`, `[STAGE 4 PBR]`, `[ONLINE]`).
- **Telemetry Sliders**: Never-locking numeric sliders showing live units and parameter documentation.
- **The Esc Stack**: Esc key cleanly dismisses one UI layer at a time: Dialog $\to$ Modal $\to$ Slide-out Panel $\to$ HUD Focus.
