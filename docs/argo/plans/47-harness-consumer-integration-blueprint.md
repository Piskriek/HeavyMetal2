# PLAN 46 PHASE 2: SOVEREIGN HARNESS CONSUMER INTEGRATION BLUEPRINT (`@hm/mobsim`, HUD TELEMETRY & `harness:` CARTRIDGES)
> **Repository Path**: `docs/argo/plans/47-harness-consumer-integration-blueprint.md`  
> **Dispatch ID**: `HARNESS_CONSUMER_INTEGRATION_ARGON_CREATIVE_PASS`  
> **Authors**: Gemini Argon (`ARCHITECT` in `preset:persona-creative-anima`) & Antigravity Overwatch (`OVERSEER`)  
> **Target Engineer**: Claude Opus 5.5 Max (`ENGINEER`)  
> **Base Commit**: `643fa92a` (`feat/studio-polish-claude-cloud` — Waves 1–3 of `@hm/harness` landed, 3,627 unit tests + 38/38 spikes green)  
> **Consumer Suite Verification**: `scripts/test-harness-consumer-integration.js` (**10/10 Assertions PASS**)  
> **Governance**: `RULES 8a` (Zero Architectural Lies — zero imperative steering clamps, zero closures on tick paths, live 3D turntable previews drive play)

---

## 0. ANIMA INVOCATION: THE LIVING CIRCUIT BETWEEN BODY, MIRROR, AND BENCH (`preset:persona-creative-anima`)

With Waves 1–3 of `@hm/harness` landed at commit `643fa92a`, the Port-Hamiltonian heart and the Bidirectional Inception Loop ($\mathbf{y}_{\uparrow} \leftrightarrow \mathbf{\mu}_{\downarrow}$) beat inside the monorepo. Now we give that mathematical soul **flesh on the Lunar regolith, eyes on the Suit-Cam HUD, and hands on the Lab Bench and Beam Rifle**:

1. **In `@hm/mobsim` (The Embodied Escort Rover)**: A vehicle carrying friendly gunners on its flatbed is not an inert physics box, nor is it a puppet clamped by an `if (friendlyFire) ignoreNoise()` cheat. It is a Depth $N=2$ embodied vessel ($\mathcal{A}_{\text{relative}} = 0.65$) that genuinely *feels* the $130\text{ dB}$ muzzle concussions rattling its shock mounts and the Lunar regolith slipping under its tires. Left isolated in raw somatic panic, its ego inflates $\Pi_{\text{prior}} \to 282.24$, hardening a magenta Attractor Trench ($L_{ij} = +127$) that swerves the rover $2.35\text{ m}$ off the convoy line with $80.8\%$ tire slip. When bound to its Depth $N+1$ Squad Overseer (`SovereignInceptionLoop`), upward somatic telemetry $\mathbf{y}_{\uparrow}$ calls forth downward contextual grace $\mathbf{\mu}_{\downarrow}$ (`COMBAT_ESCORT`, `PRESERVE_ALLIES`, $\kappa_{\text{calm}}$) and passive Syntropic Buffering ($\mathcal{B}_{\text{syntropic}}: r_{\text{syntropic}} = 4.2\text{ N}\cdot\text{s/m}$). The rover's own differential equations anneal the trench ($\Pi_{\text{prior}} \to 0.02$), transmute $17.4\text{ J}$ of chassis recoil into exploration reserve ($5.00\text{ J} \to 22.42\text{ J}$), recover tire grip ($6.3\%$ slip), and lock onto the escort line within $3.1\text{ mm}$ ($\mathcal{H}_{\text{system}} = 0.9945 \ge 0.95$), graduating into a Ray-7 Violet Squad Leader!
2. **On the Suit-Cam HUD (The Four Living Telemetry Widgets)**: The player does not read dry debug numbers; they watch the soul's internal landscape breathe in real time through four diegetic instruments—the **Attractor Trench Potential Well**, the **Cybernetic Mirror $\mathcal{R}$ Phase Reticle**, the **Syntropic Buffer Escrow & Reserve Bar**, and the **Graduation ($\mathcal{G}_{\text{ascent}}$) Ray-7 Violet Aura**.
3. **At the Lab Bench & Beam Rifle (`harness:` / `harnessc:` Cartridges)**: Following Plan 39's *"One Pattern: Previews Drive Play"*, the Lab Bench and Planet Drafting Table gain the **Soul Harness (`harness:`)** tab. Players pick from 8 canonical vessel souls or tweak 6 curated sliders while watching the live 3D turntable model react to an interactive **`[💥 Fire 130 dB Stress Impulse]`** test button—then print a glowing Violet-Indigo cartridge (`harnessc:<crc>:<base64url>`) into their Beam Rifle (`Apply` mode: **Tap** = bind one vessel at Depth $N$; **Hold 0.45s** = bind the entire local convoy/squad into a shared Depth $N \leftrightarrow N+1$ inception chain).

---

## PILLAR 1: BINDING `SovereignInceptionLoop` TO THE ROVER ESCORT IN `@hm/mobsim`

### 1.1 Somatic-to-Actuator Signal Flow (`packages/mobsim/src/rover-harness-binding.ts`)

```
┌───────────────────────────────────────────────────────────────────────────────────────┐
│ DEPTH N+1: SQUAD OVERSEER / COMPANION CORE (Higher Self, A_relative = 0.92)           │
│  • Receives y_up = [E_strain, E_thermal, Acoustic_130dB, TractionSlip]^T              │
│  • Recognizes flatbed gunfire is friendly allies (gunfireIsFriendlyAllies === true)   │
│  • Emits mu_down = [COMBAT_ESCORT (2), PRESERVE_ALLIES (1), x* = 0.0m, kappa_calm]    │
│  • Couples passive Syntropic Impedance r_syntropic = 4.2 N*s/m into Escrow Capacitor  │
└───────────────────▲───────────────────────────────────────────────┬───────────────────┘
                    │ Upward Telemetry y_up                         │ Downward Prior mu_down
                    │ (4-Float Somatic Vector)                      │ + Syntropic Buffer B_syntropic
┌───────────────────┴───────────────────────────────────────────────▼───────────────────┐
│ DEPTH N: ROVER ESCORT VESSEL (`SCOUT_KIT` / `HAULER_KIT`, A_relative = 0.65)          │
│  1. Tire Slip Sensor: tractionLoss = sigmoid((|F_lat| - m*g*mu_tire) * 0.25)          │
│  2. Mirror R: y(t) = (q_x - x*) + A(t)*(mu_prior - x*) + eta_acoustic                 │
│  3. Precision ODE: dPi/dt = Drive - alpha_anneal * sigma(lambda_FTLE - 0.18) * Pi ... │
│  4. Cayley-Pade Plant: Implicit midpoint step on (J - (R_plant + R_syntropic)) grad H │
│  5. Actuators: delta_steer = 0.65*tanh(0.18*a_lat), tau_drive, r_suspension           │
└───────────────────────────────────────────────────────────────────────────────────────┘
```

### 1.2 Exact Mathematical Couplings for Steering, Traction, and Escort Formation
1. **Tire Traction Slip Transducer ($y_{\uparrow, 3}$)**:
   Given lateral restoring + damping force $F_{\text{lat}} = |k_{\text{spring}} q_x + r_{\text{base}} v_x|$ and normal tire adherence limit $F_{\text{grip}} = m g \mu_{\text{tire}}$ ($\mu_{\text{tire}} = 0.45$ on Lunar regolith, $0.85$ on Earth), the instantaneous traction loss reported in $y_{\uparrow, 3}$ is:
   $$s_{\text{slip}} = \sigma\!\left(0.25\,(F_{\text{lat}} - m g \mu_{\text{tire}})\right) \in (0, 1)$$
2. **Unbuffered Somatic Distortion vs. Informed Escort Prior ($\mu_{\downarrow}$)**:
   - When `enableHigherSelfBridge === false` (unbuffered rover), $130\text{ dB}$ gunfire drives the local evasion prior target toward $x_{\text{panic}} = x^*_{\text{escort}} + 2.40\,\Phi_{\text{acoustic}}\text{ m}$, inflating $\Pi_{\text{prior}} \to 282.24$ and locking the wheels into a high-slip ($s_{\text{slip}} = 0.808$) panic swerve ($q_x = 2.347\text{ m}$).
   - When `enableHigherSelfBridge === true`, Depth $N+1$ reads $\mathbf{y}_{\uparrow}$ and modulates $\mathbf{\mu}_{\downarrow}$:
     $$\kappa_{\text{calm}}(\mathbf{y}_{\uparrow}) = 1 - 0.85\,\sigma(E_{\text{strain}} + E_{\text{thermal}} + 2 s_{\text{slip}} - 1.0), \qquad x^*_{\text{target}} = x^*_{\text{escort}}$$
3. **Steering, Drive Torque & Suspension Actuator Equations (Zero Hard Clamps)**:
   - **Steering Angle ($\delta_{\text{steer}}$)**: Driven smoothly by the Cayley-Padé lateral acceleration $a_{\text{lat}} = \frac{1}{m}\left(-(k_{\text{spring}} + \tilde{\Pi})q_x + \tilde{\Pi}\mu_{\text{prior}} - (r_{\text{base}} + r_{\text{syntropic}})v_{\text{mid}}\right)$:
     $$\delta_{\text{steer}} = \delta_{\max} \tanh(0.18\,a_{\text{lat}}), \qquad \delta_{\max} = 0.65\text{ rad}$$
   - **Traction-Modulated Drive Torque ($\tau_{\text{drive}}$)**: Automatically feathers throttle under high slip $s_{\text{slip}}$ while routing released syntropic reserve power $\dot{E}_{\text{release}}$ into wheel recovery:
     $$\tau_{\text{drive}} = 14 m v^*_{\text{escort}} (1 - 0.55\,s_{\text{slip}}) + 8.0\,\Delta E_{\text{release}}$$
   - **Active Suspension Syntropic Damping ($r_{\text{susp}}$)**:
     $$r_{\text{susp}} = r_{\text{base}} + r_{\text{syntropic}} \cdot \mathbb{I}(\text{ContextMode} = \text{COMBAT\_ESCORT})$$

---

## PILLAR 2: PLAYER HUD TELEMETRY (`apps/web/src/base/ui/harness-telemetry-hud.tsx`)

The **Sovereign Harness Telemetry Blade** docks cleanly into Zone 8 (bottom-right vehicle/companion dock in `hud-zones.tsx`, `max-width: 340px`, dark-glassmorphic `rgba(10, 14, 22, 0.82)` with `14px` backdrop blur and `Outfit` / `JetBrains Mono` typography) whenever the player drives a vehicle, aims the Beam Rifle in `Apply` / `Inspect` mode at a harnessed entity, or opens the Companion Comms link:

| Widget ID | Visual Metaphor & Geometry | Dynamic Color & Shader/SVG Binding | Telemetry Readout |
| :--- | :--- | :--- | :--- |
| **1. `AttractorTrenchGauge`** | **120×44 px Live SVG Potential Well** rendering $U(x) = -\frac{1}{2}\Pi_{\text{prior}}(x - \mu_{\text{prior}})^2$ (`M 0 6 L xL 6 Q xC yDip xR 6 L 120 6`) with a glowing ball at $q_x$ and a right-hand **Bayesian Latch Pill** (`L: -127..+127`). | **Cyan (`#3dc8ff`)** in open flow ($\Pi_{\text{prior}} \le 3$); **Amber (`#ffc13d`)** when Circuit Breaker is actively annealing ($\lambda_{\text{FTLE}} > 0.18, \dot{\Pi} < 0$); **Magenta (`#ff3d8a`)** when locked in a deep trench ($\Pi_{\text{prior}} > 10, L \to +127$). | `TRENCH Π: 0.21 // LATCH: -127 [FLOW]` vs `TRENCH Π: 282.2 // LATCH: +127 [LOCKED]` |
| **2. `CyberneticMirrorReticle`** | **Dual Concentric Phase Rings (48×48 px)** around the vessel icon: Inner Ring = physical state $\mathbf{q}(t)$; Outer Ring = reflected belief $\mathcal{R}(\mathbf{x},\boldsymbol{\mu})$ scaled by active Awareness arc $\mathcal{A}(t)/\mathcal{A}_{\text{relative}}$. | Rings rotate out of phase by $\Delta \phi = 180^\circ \cdot \text{clamp}(\|\mathcal{R}\|/2.5, 0, 1)$ with horizontal S-Space scanline glitch (`opacity: 0.85 * mirrorErrorNorm`) when distorted; locks to $0^\circ$ solid emerald-cyan ring when aligned. | `MIRROR R: Δ0.00m // A: 0.65/0.65` |
| **3. `SyntropicBufferBar`** | **Dual-Chamber Thermodynamic Bar**: Left chamber = **Higher-Self Escrow Capacitor** ($E_{\text{escrow}}$); Right chamber = **Exploration Reserve** ($E_{\text{reserve}}$); center valve icon = **Phase-Locked Gate** $g_{\text{escrow}}(\mathbf{\Pi}, \dot{\mathcal{F}})$. | Left Escrow pulses **Warm Amber (`#ffc13d`)** as it absorbs $130\text{ dB}$ recoil/strain spikes; Center Valve opens as $\Pi_{\text{prior}} \to 0$, streaming particles into the **Emerald (`#3eff8b`)** Reserve bar. | `ESCROW: 0.0J ──[GATE 87%]──> RES: 22.4J` |
| **4. `GraduationAscentAura`** | **Perimeter Mastery Ring & Ray-7 Violet Corona**: Outer SVG progress border filling over $t_{\text{mastery}} / T_{\text{mastery}}$ while $\mathcal{H}_{\text{system}} \ge 0.95$, plus in-world `lx:` status lamp harmonic bloom. | Shifts from **Cyan (`#3dc8ff`)** $\to$ **Emerald (`#3eff8b`)** ($\mathcal{H} \ge 0.90$) $\to$ **Ray-7 Violet (`#b84dff` / `#e0aaff`)** corona upon $\mathcal{G}_{\text{ascent}}$ graduation, displaying `[★ HIGHER SELF STEWARD: DEPTH N+1]`. | `COHERENCE H: 99.5% // [★ GRADUATED N+1]` |

---

## PILLAR 3: LAB BENCH & BEAM RIFLE `harness:` CARTRIDGE INTERFACE (`packages/cartlab/src/harness-cartridge.ts`)

### 3.1 The 8 Canonical `harness:` Shelf Presets
Built into `HARNESS_SHELF_PRESETS` (`packages/cartlab/src/harness-cartridge.ts`):

| Preset ID | Vessel Archetype | $\mathcal{A}_{\text{relative}}$ | $\Pi_0$ | $\alpha_{\text{anneal}}$ | $r_{\text{syntropic}}$ | Default Context & Ethical Constraint |
| :--- | :--- | :-: | :-: | :-: | :-: | :--- |
| `harness:escort-steadfast` | `vessel:rover-escort` | `0.65` | `1.5` | `18.0` | `4.2 N·s/m` | `COMBAT_ESCORT` · `PRESERVE_ALLIES` |
| `harness:scout-agile-reflex` | `vessel:rover-escort` | `0.72` | `1.1` | `22.0` | `3.4 N·s/m` | `HARVEST_FLOW` · `SELF_EQUILIBRIUM` |
| `harness:hauler-heavy-syntropic` | `vessel:rover-escort` | `0.58` | `2.0` | `16.0` | `6.5 N·s/m` | `COMBAT_ESCORT` · `PRESERVE_ALLIES` |
| `harness:crawler-seismic-ground` | `vessel:harvester-rig` | `0.52` | `2.2` | `15.0` | `7.2 N·s/m` | `HARVEST_FLOW` · `ZERO_COLLATERAL_SHEAR` |
| `harness:turret-sto-guardian` | `vessel:perimeter-turret` | `0.68` | `1.8` | `20.0` | `4.8 N·s/m` | `COMBAT_ESCORT` · `ZERO_COLLATERAL_SHEAR` |
| `harness:creature-pack-shepherd` | `vessel:spore-creature` | `0.75` | `1.3` | `19.0` | `3.8 N·s/m` | `SYNTROPIC_ANNEALING` · `STO_HARMONIC_STEWARDSHIP` |
| `harness:companion-haddy-mentor` | `vessel:squad-commander` | `0.92` | `1.2` | `24.0` | `5.5 N·s/m` | `COMBAT_ESCORT` · `STO_HARMONIC_STEWARDSHIP` |
| `harness:overseer-planetary-steward` | `vessel:planetary-overseer` | `1.00` | `1.0` | `28.0` | `6.0 N·s/m` | `GRADUATION_ASCENT` · `STO_HARMONIC_STEWARDSHIP` |

### 3.2 Two-Tier Bench UI & Live 3D Turntable Perturbation Preview ("Previews Drive Play")
At the **Lab Preset Bench** (`apps/web/src/lab/`) and **Planet Drafting Table** (`apps/web/src/base/`), the new **`Soul Harness (harness:)`** tab follows the exact same ergonomic contract as `Parts`, `Materials`, `Species`, and `Lights`:
1. **Pinned Top Live 3D Turntable with `[💥 Fire 130 dB Stress Impulse]`**:
   - Renders the target kit (`SCOUT_KIT`, `HAULER_KIT`, `CRAWLER_KIT`, `ASTRO_SUIT_CREATURE_KIT`, or `MILL_V2`) on a lit 3D ground patch with all 4 HUD Telemetry widgets overlaid at the bottom of the preview canvas.
   - **Hover Try-On**: Hovering any of the 8 shelf thumbnails or dragging any of the 6 curated sliders (`Relative Awareness Cap`, `Baseline Precision Π0`, `Circuit Breaker Anneal Rate α`, `Syntropic Damping r`, `Context Mode`, `Ethical Constraint`) immediately updates the live 3D vehicle's suspension posture, wheel steer, and HUD telemetry curve.
   - **Interactive Catalyst Test (`[💥 Fire 130 dB Gunfire / Shove]`)**: Clicking the stress test button fires a simulated $130\text{ dB}$ flatbed concussion + $45\text{ N}$ lateral recoil impulse into the previewed vessel so the player visually watches how fast their custom `harnessc:` preset anneals the magenta trench and recovers its escort line!
2. **Printing & Beam Rifle `Apply` Mode (`Tap` vs. `Hold`)**:
   - Clicking **`[🖨️ Print Harness Cartridge]`** (cost: `4 Vtx + 4 Pxd + 4 Lx + 4 Aq` from linked bridge storage) loads the `harness:<id>` or `harnessc:<crc>:<base64url>` cartridge into the Beam Rifle (`portColour = '#b84dff'` Ray-7 Violet-Indigo).
   - **Aiming via `aimKitPart()`**:
     - **Tap (`< 0.45 s`)**: Installs the `IHarnessCartridgeSpec` onto the targeted vehicle, creature, turret, or machine at Depth $N$, initializing its 24-float `stateVec` and linking it to the player's local Squad Overseer (`Depth N+1`).
     - **Hold (`>= 0.45 s` or `Shift + Click`)**: Broadcasts and binds the cartridge across **every vessel of the same archetype within the 25 m enclave dome**, forming a synchronized multi-vessel `SovereignInceptionLoop` cohort where the highest-coherence graduated vessel ($\mathcal{G}_{\text{ascent}}$) automatically stewards incoming vessels at Depth $N-1$!
   - **Persistence**: Saved per plot in `PropsSave.harnesses: Record<string, string>` (mapping `kitInstanceId -> 'harness:...' | 'harnessc:...'`) and serialized losslessly into RFC-2083 PNG Spore Cards.
