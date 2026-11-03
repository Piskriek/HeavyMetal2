# Fidelity: Syntropic Flow & Warden (World of Warcraft Addon)

[![CurseForge](https://img.shields.io/badge/CurseForge-Available-orange.svg)](#)
[![Wago.io](https://img.shields.io/badge/Wago.io-Verified-blue.svg)](#)
[![Blizzard ToS Compliant](https://img.shields.io/badge/Blizzard_ToS-100%25_Compliant-brightgreen.svg)](#)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**Fidelity WoW** is a next-generation player flow companion and transparent kinematic verifier built on the **4-Node Tetrahedral Holon**. It combines somatic flow optimization (preventing frantic over-clicking and RSI/fatigue) with deterministic mathematical verification of player movement splines and action cadence.

---

## Features

### 1. Somatic Flow & Ergonomic Assistance
- **APM Shannon Entropy ($H$):** Measures the true information entropy of your rotation cadence in **bits**. Healthy human play exhibits fractal $1/f$ noise ($H \ge 0.80\,\text{bits}$); rigid bots exhibit flat deterministic cadence ($H < 0.80\,\text{bits}$).
- **Strain Prevention Gauge:** Measures accumulated neuromuscular strain ($\Delta E_{\text{strain}}$ in Joules) when frantically over-clicking skills on cooldown. Helps you relax into smooth rhythmic timing to avoid repetitive strain injury (RSI).

### 2. Kinematic Trajectory Invariant (Lyapunov FTLE)
- Calculates trajectory curvature and Finite-Time Lyapunov Exponent ($\lambda_{\text{FTLE}} \le 0.010$) on continuous movement splines.
- Demonstrates deterministic proof that your character movement adheres to continuous physical velocity and acceleration bounds.

### 3. Neuromuscular Latency Verification
- Measures precise reaction time (via microsecond `debugprofilestop()`) between enemy cast starts and confirmed interrupts (`SPELL_INTERRUPT`).
- Validates authentic human reflexes ($130 - 350\,\text{ms}$) while flagging unnatural sub-$60\,\text{ms}$ robotic triggers.

### 4. Epistemic Consent & Opt-In Gate
- **Strictly Opt-In:** Telemetry logging and export are disabled by default (`optIn = false`). Enable only if you wish to export data for local companion analysis.
- **Instant Kill Switch:** `/fidelity enable` halts all sampling and event processing immediately.

---

## In-Game HUD

```
+--------------------------------------------------------+
| FIDELITY SYNTROPIC FLOW                                |
| Coherence: 99%  | Strain: 0.00 J                       |
| Active Rung: D3 (Somatic Vessel)                       |
| λ(FTLE): 0.005  | H: 2.85 bits                         |
| Invariant: NOMINAL (Organic Flow)                      |
| S=(0.20, 0.55, 0.98, 0.28) | OptIn: OFF                |
+--------------------------------------------------------+
```

---

## Installation

### For Live World of Warcraft (Retail, Classic Era, Cataclysm Classic):
1. Download or copy the `packages/wow-syntropic/` directory.
2. Rename the folder to `FidelityWoW`.
3. Place it into your World of Warcraft AddOns directory:
   - **Retail:** `World of Warcraft/_retail_/Interface/AddOns/FidelityWoW/`
   - **Classic Era:** `World of Warcraft/_classic_era_/Interface/AddOns/FidelityWoW/`
   - **Classic:** `World of Warcraft/_classic_/Interface/AddOns/FidelityWoW/`
4. Launch the game and enable `Fidelity Syntropic Flow & Warden` in the AddOns menu!

### Slash Commands:
- `/fidelity` - Display command menu
- `/fidelity toggle` - Show/hide the on-screen Syntropic HUD
- `/fidelity optin` - Toggle telemetry export opt-in gate
- `/fidelity enable` - Toggle addon sampling on/off
- `/fidelity audit` - Print instant in-game Kinematic & APM Invariant audit

---

## 100% Blizzard ToS Compliance

- **No Protected Functions:** Does not tamper with secure execution or auto-cast.
- **No Memory Reading:** Operates 100% inside Blizzard's sandboxed Lua environment.
- **Zero Kernel Drivers:** Pure information theory, physics splines, and standard combat log events.
