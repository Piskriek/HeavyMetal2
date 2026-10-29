# Expressive Voice, Prosody & Semantic-Root Localization Research (Plan 58 §18)

> **Date**: 2026-10-29  
> **Authors**: Piskriek (Owner) & Argon (Overwatch / Creative & Modular Systems Lead)  
> **Governed By**: `RULES 6` (Research Before Design), `RULES 8a` (Zero Architectural Lies), Standing Rule 6 (Examples Mean Categories)

---

## 1. Comparative Research: Why Flat Text Pipelines Fail

### 1.1 Block's *Dessa* & Full-Duplex Speech-to-Speech Models (*Moshi*, *PersonaPlex*)
- **Zero-Text Acoustic Training (*Dessa*, Block AI Lab)**:
  - Block's *Dessa* model bypassed the traditional cascaded voice stack ($\text{STT} \to \text{Text LLM} \to \text{TTS}$) and trained directly on raw human conversation audio on a single NVIDIA GB200 NVL72 rack, running faster than real-time on consumer hardware (M4 Max).
  - **Core Finding**: Converting speech or internal state into flat text strips away ~90% of communicative bandwidth—prosody (pitch contour, speaking rate, micro-pauses), paralinguistic vocalizations (mid-sentence chuckles, sighs of relief, gasps, throat tension), and somatic state.
- **Full-Duplex Turn-Taking & Backchanneling (*Dessa*, Kyutai *Moshi*, NVIDIA *PersonaPlex*)**:
  - Natural conversation is **full-duplex**: listeners emit unobtrusive backchannels (*"yeah, got it"*, *"mh-hmm"*, *"ooh"*, Afrikaans *"ja, ek sien"*, Japanese *"なるほど / うん"*) while the partner acts or speaks, and adapt instantaneously to barge-in interruptions.
- **Comparative Game Localization & Dynamic Dialogue (*Hades*, *Bastion*, *NieR:Automata*, *Dwarf Fortress*)**:
  - Supergiant Games (*Hades*) indexes every voice line by **semantic trigger + emotional/contextual state** (health low, streak high, prior bond) rather than static menu strings.
  - Linguistic typology shows that all human languages project from **shared conceptual semantic roots** (`AGENT`, `ACTION`, `ARTIFACT`, `SOMATIC_STATE`, `THRESHOLD_CROSSED`) modulated by cultural register, emotional valence, and speaker persona.

---

## 2. The 5-Rung Semantic-Emotional Utterance Architecture (`@hm/harness`)

To ensure FIDELITY never hardcodes flat English strings in System notices, Overwatch Drone wake-digests, Native dialogues, or Party callouts, language and voice are modeled as recursive **presets inside presets**:

| Rung | Preset Domain | Prefix | Responsibility |
| :--- | :--- | :--- | :--- |
| **Rung 1** | **Semantic Roots** | `sem:` | Universal language-independent concept tokens + typed slot bindings (`LEVEL_UP`, `SKILL_GAINED`, `CONTRAPTION_FORGED`, `BODY_ACHE`, `BODY_EUREKA`, `ARRIVAL_GREETING`, `QUEST_SEEDED`, `GATE_PING`, `ANCHOR_CALM_SHARED`). |
| **Rung 2** | **Emotional & Somatic Prosody Envelope** | `emo:` | Combines `UtteranceIntent` (`announce \| warn \| comfort \| celebrate \| reflect`) + live `Mem` & `BodyState` (`excitement`, `balance`, `acheStage`, `starvedRay`) + **Ra's Cross-Wired Archetypical Polarity** (`masculine \| feminine \| balanced`) into prosodic parameters (`pitchShiftSemitones`, `tempoScale`, `breathCue`, `timbreFilter`, `backchannelCue`). |
| **Rung 3** | **Discourse & Polarity Inflection** | `inflect:` | Shapes phrasing and paralinguistic markers by archetypical polarity (`masculine` Magician/Hermit direct-kinetic will vs. `feminine` High Priestess/Balanced intuitive-contextual resonance vs. `balanced` harmonic synthesis) and somatic state. |
| **Rung 4** | **Locale & Dialect Pack** | `locale:` | Modular language packs (`en` SetMix Standard, `af` Afrikaans Taktiese Register, `ja` Japanese LitRPG / Sovereign System Register) that realize `sem: + emo: + inflect:` into natural spoken and written output. |
| **Rung 5** | **Utterance Cartridge & Synth Frame** | `utt:` | Complete rendered utterance (`text`, `ssmlProsody`, `backchannel`, `audioSynthParams`, `shareCode`) ready for the HUD, WebAudio/TTS voice synth, or full-duplex bridge. |

---

## 3. Ra's Cross-Wired Archetypical Polarity in Voice & Phrasing (Law of One 78–92)

From `packages/harness/src/archetypes.ts` (`evaluateCrossWiredPolarity`):
- **Masculine Polarity (`mind: Magician / Conscious Will`, `body: Hermit / Kinetic Discipline`)**:
  - Direct, imperative, telegraphic syntax; crisp attack transients; steady or slightly accelerated tempo (`tempoScale * 1.05`).
- **Feminine Polarity (`mind: High Priestess / Intuitive Matrix`, `body: Balanced Working`)**:
  - Relational, contextual, resonant syntax; warm harmonic timbre; measured cadence that highlights connection and systemic harmony.
- **Balanced Polarity (`Harmonic Synthesis`)**:
  - Combines lucid structural precision with warm somatic presence (`timbreFilter: 'warm-anchor'` when `bal >= 0.9`).

