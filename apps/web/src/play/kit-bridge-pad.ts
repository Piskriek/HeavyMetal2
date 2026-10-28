/**
 * The bridge pad (plan 53): the stage a bare "bridge" order takes the player to, on an empty stretch of the Moon. A kit like
 * every prop:
 * - a square deck on a deep square plinth that runs down into the regolith, so it is grounded on uneven ground and never
 *   floats;
 * - square rim beams;
 * - the bridge's Ray-7 violet as thin trim along the rims and one square inlay at the centre. No lettering.
 * The linked window's screen and FIDELITY's stand-ins stand on it.
 *
 * Frame: the deck's top at y = DECK_TOP, the plinth below y 0, centred on x and z.
 */
import type { Kit } from '@hm/kitspec';

/** The deck's side, in metres. */
export const BRIDGE_PAD_SIZE = 12;
/** The plinth's depth below the deck: the most the ground under the footprint may fall away. */
export const BRIDGE_PAD_PLINTH = 3;
const DECK = 0.12;
const RIM = 0.2;
/** The deck's walking surface, in the pad's frame. */
export const BRIDGE_PAD_DECK_TOP = DECK;

const S = BRIDGE_PAD_SIZE;
export const BRIDGE_PAD_KIT: Kit = {
  parts: {
    // set into the regolith on purpose (a declared footing), so the pad stands level on uneven ground and never floats
    plinth: { source: { kind: 'box', size: [S, BRIDGE_PAD_PLINTH, S] }, material: 'darkSteel', rank: 0, footing: true },
    // its Triad sockets (plan 57 §14.2): the linked window's screen stands near the north rim, FIDELITY's stand-ins at the centre,
    // and a cable comes in at each side rim
    deck: {
      source: { kind: 'box', size: [S - 0.1, DECK, S - 0.1] }, material: 'gunmetal', rank: 0,
      sockets: { screenMount: { at: [0, DECK, -S / 2 + 1.5] }, standInMount: { at: [0, DECK, 0] } },
    },
    'rim-long': { source: { kind: 'box', size: [S + RIM, RIM, RIM] }, material: 'darkSteel', rank: 0 },
    'rim-short': { source: { kind: 'box', size: [RIM, RIM, S - RIM] }, material: 'darkSteel', rank: 0, sockets: { powerTerminal: { at: [0, RIM / 2, 0] } } },
    'trim-long': { source: { kind: 'box', size: [S - 0.4, 0.02, 0.05] }, material: 'violet', rank: 1 },
    'trim-short': { source: { kind: 'box', size: [0.05, 0.02, S - 0.4] }, material: 'violet', rank: 1 },
    inlay: { source: { kind: 'box', size: [1.2, 0.01, 1.2] }, material: 'violet', rank: 1 },
  },
  assemblies: {
    'bridge-pad': {
      children: [
        { ref: 'plinth', key: 'plinth', at: [0, -BRIDGE_PAD_PLINTH, 0] },
        { ref: 'deck', key: 'deck', at: [0, 0, 0] },
        { ref: 'rim-long', key: 'rim-north', at: [0, 0, -S / 2] },
        { ref: 'rim-long', key: 'rim-south', at: [0, 0, S / 2] },
        { ref: 'rim-short', key: 'rim-west', at: [-S / 2, 0, 0] },
        { ref: 'rim-short', key: 'rim-east', at: [S / 2, 0, 0] },
        { ref: 'trim-long', key: 'trim-north', at: [0, RIM, -S / 2] },
        { ref: 'trim-long', key: 'trim-south', at: [0, RIM, S / 2] },
        { ref: 'trim-short', key: 'trim-west', at: [-S / 2, RIM, 0] },
        { ref: 'trim-short', key: 'trim-east', at: [S / 2, RIM, 0] },
        { ref: 'inlay', key: 'inlay', at: [0, DECK, 0] },
      ],
    },
  },
};
