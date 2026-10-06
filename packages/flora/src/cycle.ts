// The water cycle that feeds the plants (from the SetMix Arena drop): sun lifts water, it rains, soil grows flora,
// flora breathes water back into the air.
import { normalised, type FidelityState } from "@hm/fidelity";
import { clamp01 } from "./util";

/* ═══════════════════════════════════ 7 · THE HYDROLOGICAL CYCLE ══ */

export interface CycleState {
  /** 0..1 — water held in the atmosphere */
  humidity: number;
  /** 0..1 — cloud cover, lags humidity */
  cloud: number;
  /** mm/s falling now */
  rainfall: number;
  /** 0..1 — soil moisture, the thing flora actually reads */
  soilMoisture: number;
  /** 0..1 — standing water / lake level contribution */
  surfaceWater: number;
  /** total biomass, which feeds back into evapotranspiration */
  biomass: number;
  tick: number;
}

/**
 *  THE UNBROKEN LOOP, as four coupled ODEs:
 *
 *      evaporation   ∝ Lx · surfaceWater · (1 − humidity)
 *      condensation  ∝ max(0, humidity − dewPoint)
 *      infiltration  ∝ rainfall · (1 − soilSaturation)
 *      transpiration ∝ biomass · soilMoisture · Lx
 *
 *  Sun lifts water, water becomes cloud, cloud becomes rain, rain feeds
 *  soil, soil grows flora, flora transpires back into humidity — and more
 *  flora means more rain, which is why a terraformed continent gets WETTER
 *  as it gets greener. The player discovers positive feedback by causing it.
 */
export function stepCycle(c: CycleState, fi: FidelityState, dtSec: number): CycleState {
  const n = normalised(fi);
  const lx = n.lx, aq = n.aq;

  const surfaceWater = clamp01(aq * 1.15);
  const evaporation = lx * surfaceWater * (1 - c.humidity) * 0.055;
  const transpiration = c.biomass * c.soilMoisture * lx * 0.018;

  const dewPoint = 0.62 - lx * 0.1;
  const condensation = Math.max(0, c.humidity - dewPoint) * 0.42;
  const cloud = c.cloud + (clamp01(c.humidity * 1.3) - c.cloud) * 0.25 * dtSec;
  const rainfall = condensation * cloud * 3.2;

  const humidity = clamp01(c.humidity + (evaporation + transpiration - condensation) * dtSec);
  const infiltration = rainfall * (1 - c.soilMoisture) * 0.9;
  const drainage = c.soilMoisture * (0.012 + lx * 0.02);
  const soilMoisture = clamp01(c.soilMoisture + (infiltration - drainage - transpiration * 0.4) * dtSec);

  // biomass grows where soil is wet and lit, and decays otherwise
  const growth = soilMoisture * lx * 0.03 - c.biomass * 0.004;
  const biomass = clamp01(c.biomass + growth * dtSec);

  return {
    humidity, cloud: clamp01(cloud), rainfall, soilMoisture,
    surfaceWater, biomass, tick: c.tick + Math.round(dtSec * 120),
  };
}

export function initialCycle(): CycleState {
  return { humidity: 0.08, cloud: 0, rainfall: 0, soilMoisture: 0.05, surfaceWater: 0, biomass: 0.01, tick: 0 };
}
