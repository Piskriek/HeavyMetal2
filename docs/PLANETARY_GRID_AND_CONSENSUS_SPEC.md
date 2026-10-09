# FIDELITY // PLANETARY GRID & CONSENSUS SPECIFICATION
> **Scope**: 40,000 km Shared Sphere, 1 km Plots, Synced vs Desynced Mechanics, and Weekly Consensus Protocol  
> **Repository**: `https://github.com/Piskriek/HeavyMetal2`  

---

## 1. THE 40,000 KM PLANETARY GRID

### Shared World Architecture
The universe provides a shared 40,000 km planetary sphere where all players participate in a single expanding world without requiring centralized heavy servers:
- **1 km Standard Plots**: Each player commands an active plot 1 km across, centered on their quantum portal exit.
- **Sunflower Spiral Allocation**: Plots populate outward along a golden angle sunflower spiral ($r = 1050 \sqrt{n + 0.5}\text{ m}$), ensuring even expansion without displacing existing claims.
- **Seamless Neighbour Horizons**: Players can look across the horizon from their plot to observe neighbouring claims in various stages of terraformation.

---

## 2. SYNCED VS. DESYNCED CAMPAIGN BRANCHES

Players have total freedom to play offline/privately or as part of the live world:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        CAMPAIGN BRANCH MODES                           │
├───────────────────────────────────┬────────────────────────────────────┤
│ EXPEDITION [DESYNCED]             │ PLANETARY GRID [SYNCED]            │
│ • Private local simulation branch │ • Live 40,000 km shared substrate  │
│ • Full offline capability         │ • Real-time player claims & builds │
│ • Safe sandbox experimentation    │ • Majority-rules network consensus │
│ • Can resync to grid at any time  │ • Can desync to solo at any time   │
└───────────────────────────────────┴────────────────────────────────────┘
```

### In-Game HUD Switching
The top HUD exposes a live branch status pill:
- `[GRID SYNCED]` (Cyan status glow)
- `[SOLO DESYNCED]` (Amber warning glow)
Clicking the badge seamlessly forks or queues a merge into the live simulation.

---

## 3. THE WEEKLY CONSENSUS UPDATE PROTOCOL

### Majority-Rules Evolution
Instead of top-down developer patches dictating game changes, reality is governed by player consensus:
1. **Schema Tweaks & Custom Presets**:
   - Players using The Studio or the meta-editor can tune simulation variables, create custom mantle cartridges, or alter entity parameters.
2. **Weekly Consensus Patch Submission**:
   - When saving changes, the game generates an authenticated **Consensus Patch Diff** (JSON schema difference, cryptographic hash, author signature).
   - Patches enter the weekly consensus review queue.
3. **Consensus Merging**:
   - At the end of each weekly cycle, patches that achieve majority community adoption merge into the canonical default baseline for the entire 40,000 km grid.
