// ============================================================================
// File: packages/plotsim/src/blue-sky.ts
// TICKET-13 Ruling 06 (ARGO_MASTER_PLAN_REPLY): the first heavy light projector that runs is the "blue sky" moment. It pushes
// the plot to the Rayleigh blue sky (stage 4 at least) with the stage wave, which starts at the projector.
// Pure: the scene plays the wave, the plot decides the stage. No DOM, no clock, no randomness.
// ============================================================================

/** The blue-sky push never leaves the plot below this stage. */
export const BLUE_SKY_STAGE_FLOOR = 4;

/** The leading band of the blue-sky wave takes the light metric's colour (#ffc13d). */
export const HEAVY_PROJECTOR_WAVE_BAND_HEX = '#ffc13d' as const;

export interface BlueSkyPushInput {
  /** How many heavy light projectors are running this moment. */
  readonly heavyProjectorsRunning: number;
  /** Whether a heavy light projector has already run on this plot (the push fires once). */
  readonly hadHeavyProjectorBefore: boolean;
  readonly currentStage: number;
  /** Where the wave starts: the running projector's ground position. */
  readonly projectorPos: { readonly x: number; readonly z: number };
}

export interface BlueSkyPush {
  readonly shouldTriggerBlueSkyWave: boolean;
  readonly targetStage: number;
  readonly waveOrigin: { readonly x: number; readonly z: number };
  readonly waveBandColourHex: typeof HEAVY_PROJECTOR_WAVE_BAND_HEX;
}

/** The push: once, on the first running heavy light projector; the stage goes to the floor or stays where it is if higher. */
export function evaluateHeavyProjectorBlueSkyPush(input: BlueSkyPushInput): BlueSkyPush {
  const trigger = input.heavyProjectorsRunning >= 1 && !input.hadHeavyProjectorBefore;
  return {
    shouldTriggerBlueSkyWave: trigger,
    targetStage: trigger ? Math.max(BLUE_SKY_STAGE_FLOOR, input.currentStage) : input.currentStage,
    waveOrigin: input.projectorPos,
    waveBandColourHex: HEAVY_PROJECTOR_WAVE_BAND_HEX,
  };
}
