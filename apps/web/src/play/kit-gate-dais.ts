/**
 * The lab gate's two-step dais as a kit (plan 49): the square steps the Quantum Archway Gate stands on and the hazard bands
 * along their top edges. They were shell geometry, so nothing in the game could change them; as a kit the beam aims at
 * them, a ping names them and a mutation (strip the bands, repaint a step) rebuilds them like any machine.
 *
 * The same boxes as the shell had: a 5 m step 0.2 m high, a 4 m step on it, and 0.22 m bands 12 mm thick inset along each
 * top edge. Walking on it is unchanged: the lab's floor height stays analytic (lab-room.ts floorHeight).
 *
 * Frame: the dais's centre on the lab floor, y up; north is -z (the lab's compass: the Power Wall is west, -x).
 * Ranks: 0 the steps, 1 the bands (the lab's Low tier draws ranks 0 and 1, so the bands always show).
 */
import type { Kit, Placement } from '@hm/kitspec';

const STEP_H = 0.2;
const LOWER = 5.0;
const UPPER = 4.0;
const BAND_W = 0.22;
const BAND_H = 0.012;

/** The four bands of one step's top: north and south run its full width, east and west fit between them. */
const bands = (step: 'lower' | 'upper', size: number, topY: number): Placement[] => {
  const inset = size / 2 - BAND_W / 2;
  return [
    { ref: `band-${step}-long`, key: `band-${step}-north`, at: [0, topY, -inset] },
    { ref: `band-${step}-long`, key: `band-${step}-south`, at: [0, topY, inset] },
    { ref: `band-${step}-short`, key: `band-${step}-east`, at: [inset, topY, 0] },
    { ref: `band-${step}-short`, key: `band-${step}-west`, at: [-inset, topY, 0] },
  ];
};

export const GATE_DAIS_KIT: Kit = {
  parts: {
    'step-lower': { source: { kind: 'box', size: [LOWER, STEP_H, LOWER] }, material: 'paint', rank: 0 },
    'step-upper': { source: { kind: 'box', size: [UPPER, STEP_H, UPPER] }, material: 'paint', rank: 0 },
    'band-lower-long': { source: { kind: 'box', size: [LOWER, BAND_H, BAND_W] }, material: 'hazard', rank: 1 },
    'band-lower-short': { source: { kind: 'box', size: [BAND_W, BAND_H, LOWER - 2 * BAND_W] }, material: 'hazard', rank: 1 },
    'band-upper-long': { source: { kind: 'box', size: [UPPER, BAND_H, BAND_W] }, material: 'hazard', rank: 1 },
    'band-upper-short': { source: { kind: 'box', size: [BAND_W, BAND_H, UPPER - 2 * BAND_W] }, material: 'hazard', rank: 1 },
  },
  assemblies: {
    'gate-dais': {
      children: [
        { ref: 'step-lower', key: 'step-lower' },
        ...bands('lower', LOWER, STEP_H),
        { ref: 'step-upper', key: 'step-upper', at: [0, STEP_H, 0] },
        ...bands('upper', UPPER, 2 * STEP_H),
      ],
    },
  },
};

/** The dais's walkable top (the gate stands on it). */
export const GATE_DAIS_TOP = 2 * STEP_H;
