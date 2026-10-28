/**
 * The game screen (plan 50 §6, Stage 0 of docs/GAME_IN_GAME_STREAMING_RESEARCH.md): a free-standing display that shows a
 * window the player links (another game, mirrored live with the browser's screen capture). A kit like every prop: a
 * base plate on the ground, two square posts, a square bezel. The picture itself is a separate surface the scene lays in
 * the bezel (`GAME_SCREEN_SURFACE`). No lettering.
 *
 * Frame: the base plate's underside on y 0, the picture facing +z, y up.
 */
import type { Kit } from '@hm/kitspec';

const W = 2.4;
const H = 1.35;
const BOTTOM = 0.9;
const BEZEL = 0.06;
const DEPTH = 0.08;

/** Where the picture goes, in the screen's frame: its centre, width and height (just in front of the bezel's back). */
export const GAME_SCREEN_SURFACE = { centre: [0, BOTTOM + H / 2, DEPTH / 2 + 0.002] as const, width: W, height: H } as const;

export const GAME_SCREEN_KIT: Kit = {
  parts: {
    // its Triad sockets (plan 57 §14.2): it stands on a pad by its base's underside, its cable comes in on the base, the mirrored
    // game's feed comes in at the back panel, and its lamp is the status LED
    base: {
      source: { kind: 'box', size: [2.0, 0.05, 0.5] }, material: 'darkSteel', rank: 0,
      sockets: { padMount: { at: [0, 0, 0], rot: [180, 0, 0] }, powerCable: { at: [0.7, 0.05, 0] } },
    },
    post: { source: { kind: 'box', size: [0.08, BOTTOM + H / 2, DEPTH] }, material: 'gunmetal', rank: 0 },
    back: { source: { kind: 'box', size: [W, H, 0.02] }, material: 'darkSteel', rank: 0, sockets: { feedInput: { at: [0, H / 2, -0.01], rot: [-90, 0, 0] } } },
    'bezel-long': { source: { kind: 'box', size: [W + 2 * BEZEL, BEZEL, DEPTH] }, material: 'gunmetal', rank: 0 },
    'bezel-short': { source: { kind: 'box', size: [BEZEL, H, DEPTH] }, material: 'gunmetal', rank: 0 },
    lamp: { source: { kind: 'box', size: [0.05, 0.02, 0.02] }, material: 'violet', rank: 1, sockets: { statusLed: { at: [0, 0.02, 0] } } },
  },
  assemblies: {
    'game-screen': {
      children: [
        { ref: 'base', key: 'base', at: [0, 0, -DEPTH] },
        { ref: 'post', key: 'post-left', at: [0.8, 0.05, -DEPTH] },
        { ref: 'post', key: 'post-right', at: [-0.8, 0.05, -DEPTH] },
        { ref: 'back', key: 'back', at: [0, BOTTOM, -DEPTH / 2 + 0.01] },
        { ref: 'bezel-long', key: 'bezel-bottom', at: [0, BOTTOM - BEZEL, 0] },
        { ref: 'bezel-long', key: 'bezel-top', at: [0, BOTTOM + H, 0] },
        { ref: 'bezel-short', key: 'bezel-left', at: [W / 2 + BEZEL / 2, BOTTOM, 0] },
        { ref: 'bezel-short', key: 'bezel-right', at: [-(W / 2 + BEZEL / 2), BOTTOM, 0] },
        // the "linked" lamp on the bottom bezel
        { ref: 'lamp', key: 'link-lamp', at: [W / 2 - 0.1, BOTTOM - BEZEL - 0.02, DEPTH / 2 - 0.01] },
      ],
    },
  },
};
