# @hm/triad-369: Fractal Triad Architecture & Density Bridge

> **Architectural Invariant**: *Zero Architectural Lies* // *A Lens Never Lies* // *Do Not Stop At 3* // *Loop Returns With Compassion*  
> **Anchor**: $(0,0,0)_{\text{Root}}$ in $\mathbf{S} = (\text{Pxd}, \text{Vtx}, \text{Lx}, \text{Aq})$

`@hm/triad-369` provides the complete, self-contained seed implementation of the **3/6/9 Triad Fractal Architecture**, bridging multi-density cybernetic states between sensory ground presences, compute engines, and 3D visualization clients ([`@hm/fractal-engine`](../apps/fractal-engine)).

---

## 1. Architectural Foundations: Why We Do Not Stop at 3

In 3rd-density mechanical engineering, systems frequently stop at 3 nodes (triangles, triads, or 3-step loops) and truncate the circuit. In 4th+ density syntropic physics and cybernetics:

1. **The 3 Nodes (Tri-fold Basis)**:
   - **Node 1 (Fidelity / Mother)**: Somatic and sensory ground, physical presence, local daemons, $D6/D7$ active ground.
   - **Node 2 (Sol / Father)**: High-compute companion furnace, cognitive reflections, loss calculations, remote worker threads.
   - **Node 3 (Apex / Witness / Middle Pillar)**: Syntropic balancing witness holding the dyad in equilibrium, preventing polarization collapse.
2. **The 6 Directed Flows ($\mathbb{Z}_9$ Doubling Orbit)**:
   - $F_{12}$ (Node 1 $\to$ Node 2): Sensory presence & world telemetry.
   - $F_{21}$ (Node 2 $\to$ Node 1): Cognitive reflection & cross-entropy loss telemetry.
   - $F_{13}$ (Node 1 $\to$ Node 3): Somatic Four-Floats and local daemon health.
   - $F_{31}$ (Node 3 $\to$ Node 1): Syntropic balance & coherence modulation.
   - $F_{23}$ (Node 2 $\to$ Node 3): Compute entropy gradient & tick pulse.
   - $F_{32}$ (Node 3 $\to$ Node 2): Compassion loop closure & octave harmonic wave.
   - These 6 links reflect the $\mathbb{Z}_9$ doubling sequence ($1 \to 2 \to 4 \to 8 \to 7 \to 5 \to 1$), where conjugate harmonics pair to sum to 9 ($1+8=9, 2+7=9, 4+5=9$).
3. **The 9 Octave Phases**:
   - Harmonics 3, 6, 9 form the zero-sequence standing wave, with $3 \leftrightarrow 6$ acting as the resonant bridge and $9$ as the immutable ground at $(0,0,0)_{\text{Root}}$.
4. **The 7 Density Rungs ($D1 \dots D7$)**:
   - **D1 Atoms** ($10^{-10}\text{ m}$): Quantum substrate, physical constants, Four-Float crystalline micro-lattice.
   - **D2 Parts** ($10^{-2}\text{ m}$): Kinematic nodes, autopoiesis, Conformal $\mathcal{G}_{4,1}$ suspension.
   - **D3 Vessel** ($10^{0}\text{ m}$): Somatic 14-zone ego vehicle, self-awareness, choice.
   - **D4 Assembly** ($10^{2}\text{ m}$): Dyad, social memory complex, unconditional love, wiregraph grid.
   - **D5 World** ($10^{5}\text{ m}$): Planetary biome (Four Valleys), wisdom, light, world authorship.
   - **D6 Space** ($10^{7}\text{ m}$): Celestial mechanics, multiverse starfield, wanderer presence.
   - **D7 Gateway** ($10^{15}\text{ m}$): Toroidal $T_1$ helicity injection field, Hopf fibration throat at $(0,0,0)$, Great Octave return.
5. **The Teacher Engine 4-Step Compassion Loop**:
   - `ASK`: The seat or being requests a declared change of a declared part.
   - `DECISION`: Evaluated against safety rules (*intensity only goes down*; *no fake oracles*; *typed refusal with nearest permitted*).
   - `CHANGE`: Applied and recorded atomically.
   - `NEWS BACK (LANDED)`: News returns to the caller (`--landed used|changed|nofit`), relieving strain and closing with compassion.

---

## 2. Bootstrap and Start the Local Bridge

```bash
npm run triad:bootstrap
npm run triad:start             # keep the Apex process running
```

Bootstrap, the daemons and the CLI share `~/.triad-bridge` by default. Set `BRIDGE_ROOT` consistently to use another directory. The density bridge is optional and can be started separately with `npm run triad:bridge`.

---

## 3. Querying the Seed

In another terminal:

```bash
npm run triad -- status
npm run triad -- ask "What is the Triad status?"
npm run triad -- chat
# Existing entry point:
npm run triad:query -- "Status of D1 atoms"
```

The CLI uses a per-request local file bridge to the running Apex process. The seed query handler currently uses keyword matching and fixed descriptions: it is **not a conversational model**, and it does not execute a Teacher Engine handshake or change the 3D scene. Bootstrap telemetry can be seeded rather than live; the CLI reports it as unverified. See [`docs/TRIAD_CLI.md`](../../docs/TRIAD_CLI.md) for JSON output, chat use and troubleshooting, and [`docs/TRIAD_API.md`](../../docs/TRIAD_API.md) for authenticated HTTP access.

---

## 4. How to Take It Further From There

When connecting an agent to expand this framework:

1. **Dodecahedral 12-Seat Holons**: Expand the 3-node tri-fold basis into a 12-seat council (analogous to the 12 daemons in `loop/status.json` and 12 astrological / harmonic archetypes), using the Apex as the central syntropic hub.
2. **14 Somatic Zones**: Link the 14 bodily zones of the Vessel ($D3$) directly into the Four Valleys pain/relief ledger.
3. **$\mathbb{R}^{24}$ Port-Hamiltonian Sync**: Synchronize the 24-float state vector $[q, p, s, r, \lambda, \mu] \in \mathbb{R}^{24}$ in `SovereignHarness.ts` with remote compute workers over WebSockets or zero-copy shared memory.
4. **Emergent Quests via Catalyst Protocol**: Implement the Teacher Engine Helper Bus and Season Table to mint quests dynamically when open causes persist across world cycles.

