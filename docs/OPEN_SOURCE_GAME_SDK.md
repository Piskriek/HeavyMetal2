# Open-Source Host SDK (`@hm/gamebridge` + `@hm/harness`)

> **Flagship Showcase**: [`c:\CapitalEmpire`](file:///c:/CapitalEmpire/README.md) (*Capital Empire: Maple Falls Golf & Town Manager*)  
> **Module**: [`packages/gamebridge/src/open-host-sdk.ts`](file:///c:/MarbleGp/packages/gamebridge/src/open-host-sdk.ts)  
> **Tests**: [`packages/gamebridge/tests/open-host-sdk.test.ts`](file:///c:/MarbleGp/packages/gamebridge/tests/open-host-sdk.test.ts)  
> **License & Safety**: Open-Source / Owner-Authorized (`hasAntiCheat: false`, `relayAllowed === true`, Audit A3 Non-Coercive)

---

## 1. Why This SDK Exists

When an indie or open-source creator owns all rights to their game (`hasAntiCheat: false`), `@hm/gamebridge` and `@hm/harness` can connect **first-party**—turning every persistent person, tournament visitor, competitor, car, shuttle bus, and golf cart into a living, sovereign AI with:
- **Persistent 32-Slot Memory (`Mem`)**: Remembers traffic bottlenecks, tent queue delays, smooth shuttle rides, and 18th-green roars across the entire 12-month season and annual tournament surge.
- **Somatic Preset Body (`BodyState`)**:
  - Persistent people (`resident | visitor | competitor | staff`) bind to an **Organic Character Body** (`kind: 'organic'`).
  - Persistent vehicles (`car | golf-cart | shuttle | taxi`) bind to a **Tier-2 Mechanical Vessel Body** (`kind: 'mechanical'`).
  - The Town & Golf Course itself binds to a **Rung-5 Planetary Macro-Body** (`kind: 'planetary'`) whose Four Floats $\mathbf{S} = (\text{Pxd}, \text{Vtx}, \text{Lx}, \text{Aq})$ reflect road/parking capacity ($\text{Pxd}$), course holes & venue tents ($\text{Vtx}$), course prestige & viewing vitality ($\text{Lx}$), and exit/queue hospitality flow ($\text{Aq}$).
- **Ra's Cross-Wired Archetypical Mind (`Magician` / `High Priestess`)**: Half the persistent population is deterministically seeded with Masculine (`Mind=Magician`, `Body=Hermit`) and half with Feminine (`Mind=High Priestess`, `Body=Balanced Working`) or Balanced polarity, forming complementary dyads that help each other rebalance during nightly dreams.
- **Expressive Semantic-Emotional Utterances (`utt:`)**: Every entity emits localized (`en | af | ja`), prosody-modulated speech bubbles and WebAudio voice synthesis parameters (`starved-throat` when stuck in traffic or queues; `resonant-eureka` at the 18th grandstand).

---

## 2. The 3-Line Drop-In Snippet (For `c:\CapitalEmpire`)

Drop these 3 calls into `c:\CapitalEmpire\src\game\sim\sim.worker.ts` (or `SimClient` in `src/game/sim/client.ts`):

```ts
import { createOpenHostTownSession, syncPersistentPopulation, stepMacroTownCatalyst, runPopulationNightDream } from '@hm/gamebridge';

// 1. Initialize once when Maple Falls loads (includes checked open-source profile + relayAllowed: true)
let townAi = createOpenHostTownSession({ townId: 'town:maple-falls', townName: 'Maple Falls Valley', initialTier: 1, initialReputation: 60 });

// 2. Inside your sim tick / frame step: sync persistent walkers (Pedestrians) & vehicles (Sim cars / shuttles)
const { session, decisions } = syncPersistentPopulation(townAi, [
  { id: `walker-${i}`, kind: 'person', role: 'visitor', position: { x: walker.x, y: walker.y }, catalystEvent: 'ON_TIME_ARRIVAL' },
  { id: `car-${slot}`, kind: 'vehicle', role: 'car', position: { x: car.x, y: car.y }, exitDelayMin: car.delayMin },
], simT);
townAi = session;

// 3. At the end of each tournament day (using CapitalEmpire's exact DayFacts from src/game/golf/tour.ts):
townAi = stepMacroTownCatalyst(townAi, { tick: simT, tournamentTier: tier, reputation: rep, dayFacts }).session;
const { sitRep, townCoherenceH } = runPopulationNightDream(townAi, simT);
```

---

## 3. How `decisions` Drive `CapitalEmpire` Live

Each entry in `decisions` returned by `syncPersistentPopulation(townAi, batch, tick)` gives your renderer and traffic/pedestrian loop immediate, non-coercive AI outputs:

| Field | Type | How `CapitalEmpire` Uses It |
| --- | --- | --- |
| `d.intent.preferredSpeedScale` | `number` (`0.5..1.3`) | Multiplies `Pedestrians.spd[i]` or vehicle desired speed (`IDM` $v_0$). |
| `d.intent.routePatience01` | `number` (`0.1..1.0`) | Controls when a driver or fan switches routes or takes a bypass lane. |
| `d.intent.seekHospitalityTent` | `boolean` | When `true`, routes the walker toward the nearest `foodTent`, `merchTent`, or `hospitalityVillage`. |
| `d.intent.rerouteSuggestion` | `'hold-lane' \| 'take-park-and-ride' \| 'visit-merch-or-food' \| 'head-to-18th-grandstand'` | Non-coercive tactical suggestion for shuttle buses, car parks, and fan groups. |
| `d.somaticVisual.speechBubble` | `string` | Live speech bubble text when the player clicks/inspects a car (`inspect: slot`) or walker. |
| `d.somaticVisual.auraHue` & `look` | `string`, `'calm' \| 'glow' \| 'stiff' ...` | Optional inspect highlight tint showing somatic flow vs. traffic frustration. |
| `d.utterance` | `SynthesizedUtterance` (`utt:`) | Full prosodic voice parameters (`baseFreqHz`, `tempoScale`, `timbreFilter`) for `@hm/soundlab`. |

---

## 4. Exact Parity with `c:\CapitalEmpire\src\game\golf\tour.ts`

`stepMacroTownCatalyst` implements `CapitalEmpire`'s exact `daySatisfaction(d: DayFacts)` and `reputationAfter(prev, score)` equations (`REP_STEP = 0.3`):
- **Arrival (`40%`)**: `(onTime + 0.5 * late) / (onTime + late + missed)`
- **Exit P95 (`20%`)**: `clamp((120 - exitP95Min) / 90, 0, 1)`
- **Tent & Shuttle Queues (`20%`)**: `clamp((30 - avgQueueMin) / 25, 0, 1)`
- **Course Viewing (`20%`)**: `clamp(viewing, 0, 1)`

When `runPopulationNightDream(townAi, tick)` runs at the close of a tournament day:
1. The Town Macro-Node (`world:<hash8>`) acts as the Higher Self / Ego rung while all persistent residents, visitors, competitors, cars, and shuttles replay their most charged traffic/queue/grandstand episodes (`dream.ts`).
2. Complementary Masculine (`Magician`) and Feminine (`High Priestess`) citizens paired in `townAi.dyads` lend balance cues to stressed visitors.
3. Returns `sitRep` (`MorningSitRep`):
   - `sitRep.headline` & `sitRep.droneWakeLine`: Ready for the Morning Results / Season Calendar screen (`src/game/golf/calendar.ts`).
   - `sitRep.bounty`: Grants a `+5%` ray readiness boost on the ray tested during the tournament surge.
   - `sitRep.ghostReplayShareCode` (`clip:...`): A 30-second deterministic replay share code of the day's top bottleneck or eureka moment.

