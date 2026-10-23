/**
 * The tracked Mining Crawler hull as a kit (TICKET-39, ARGO_NOTE_34 §4a/4b).
 *
 * Ranks (ARGO_NOTE_34 §4a/4b):
 *  - Rank 0 (Silhouette & Structure): 4 square-section grounded track pods (`track-pod`),
 *    low-slung armored chassis tub (`chassis-tub`), rear-offset operator cab shell (`cab-shell`),
 *    and nose-mounted articulated drill arm (`crawler-arm`).
 *  - Rank 1 (Secondary Forms): Modular cab roof socket plate (`roof-socket-plate`), 4 track
 *    armor fenders (`track-fender`), 2 cross-hull bogie suspension beams (`bogie-beam`),
 *    nose hinge saddle (`nose-hinge-saddle`), and twin front work headlamp housings (`headlamp-housing`).
 *  - Rank 2 (Small Details): Bogie drive lug bolts (`bogie-lug-bolt`), rear engine cooling grille
 *    (`engine-grille`), cab roof grab rail (`grab-rail`), and nose reinforcement brackets (`nose-bracket`).
 *
 * Frame: Ground level y = 0 at the bottom of the tracks (matching `registry.json` `crawler-body`
 * 2.40 x 2.20 x 6.20 m envelope, with the nose drill arm extending forward from the front hinge).
 */
import type { Kit } from '@hm/kitspec';

export const CRAWLER_ARM_BOUNDS = {
  min: [-0.18, 0, 0],
  max: [0.8, 0.35, 0.24],
} as const;

export const CRAWLER_KIT: Kit = {
  parts: {
    'track-pod': {
      source: {
        kind: 'param',
        gen: 'can',
        params: { width: 0.48, depth: 2.28, height: 0.68, bevel: 0.03, baseBand: 0.12, bands: 2 },
      },
      material: 'accent-hardware',
      slotMaterials: { body: 'accent-hardware', trim: 'hull-steel', band: 'hull-steel' },
      rank: 0,
      sockets: {
        fenderTop: { at: [0, 0.68, 0] },
        bogieBoltRow: { at: [0, 0.68, -0.7] },
      },
    },
    'chassis-tub': {
      source: { kind: 'box', size: [1.52, 0.72, 5.16] },
      material: 'hull-steel',
      rank: 0,
      sockets: {
        cabDeck: { at: [0.22, 0.72, -1.25] },
        noseHinge: { at: [0, 0.24, 2.58] },
        bogieFront: { at: [0, 0.12, 1.45] },
        bogieRear: { at: [0, 0.12, -1.45] },
        lampLeft: { at: [-0.62, 0.56, 2.5] },
        lampRight: { at: [0.62, 0.56, 2.5] },
        rearGrille: { at: [0, 0.16, -2.58], rot: [0, 180, 0] },
        noseBracketLeft: { at: [-0.52, 0.72, 2.25] },
        noseBracketRight: { at: [0.52, 0.72, 2.25] },
      },
    },
    'cab-shell': {
      source: {
        kind: 'param',
        gen: 'can',
        params: { width: 1.76, depth: 2.24, height: 1.04, bevel: 0.035, baseBand: 0.14, bands: 1 },
      },
      material: 'hull-steel',
      slotMaterials: { body: 'hull-steel', trim: 'hull-steel', band: 'accent-hardware' },
      rank: 0,
      sockets: {
        roofPlate: { at: [0, 1.04, 0] },
        roofRail: { at: [-0.68, 1.04, 0] },
      },
    },
    'crawler-arm': {
      source: { kind: 'gen', asset: 'crawler-arm', bounds: CRAWLER_ARM_BOUNDS },
      material: 'accent-hardware',
      rank: 0,
    },
    'nose-hinge-saddle': {
      source: { kind: 'box', size: [0.64, 0.44, 0.36] },
      material: 'accent-hardware',
      rank: 1,
      sockets: {
        armPivot: { at: [0, 0.06, 0.14] },
      },
    },
    'roof-socket-plate': {
      source: {
        kind: 'param',
        gen: 'panel',
        params: { width: 1.32, depth: 1.68, thickness: 0.08, bevel: 0.01, seam: 0.03, boltsPerSide: 4, boltHead: 0.022 },
      },
      material: 'accent-hardware',
      slotMaterials: { plate: 'hull-steel', bolts: 'accent-hardware' },
      rank: 1,
    },
    'track-fender': {
      source: {
        kind: 'param',
        gen: 'panel',
        params: { width: 0.54, depth: 2.34, thickness: 0.07, bevel: 0.01, seam: 0.02, boltsPerSide: 4, boltHead: 0.02 },
      },
      material: 'hull-steel',
      slotMaterials: { plate: 'hull-steel', bolts: 'accent-hardware' },
      rank: 1,
    },
    'bogie-beam': {
      source: {
        kind: 'param',
        gen: 'beam',
        params: { length: 1.96, section: 0.18, wall: 0.016 },
      },
      material: 'accent-hardware',
      rank: 1,
    },
    'headlamp-housing': {
      source: { kind: 'box', size: [0.26, 0.2, 0.16] },
      material: 'accent-hardware',
      rank: 1,
    },
    'bogie-lug-bolt': {
      source: {
        kind: 'param',
        gen: 'bolt',
        params: { headWidth: 0.045, headHeight: 0.022, shankDia: 0.02, shankLength: 0, head: 1 },
      },
      material: 'accent-hardware',
      rank: 2,
    },
    'engine-grille': {
      source: {
        kind: 'param',
        gen: 'grille',
        params: { width: 1.08, height: 0.44, depth: 0.05, frame: 0.035, slats: 6, slat: 0.012 },
      },
      material: 'accent-hardware',
      slotMaterials: { frame: 'hull-steel', slats: 'accent-hardware' },
      rank: 2,
    },
    'grab-rail': {
      source: {
        kind: 'param',
        gen: 'duct',
        params: { length: 1.72, section: 0.08, wall: 0.008, flange: 0.02 },
      },
      material: 'accent-hardware',
      slotMaterials: { duct: 'accent-hardware', flange: 'hull-steel', bolts: 'accent-hardware' },
      rank: 2,
    },
    'nose-bracket': {
      source: {
        kind: 'param',
        gen: 'bracket',
        params: { width: 0.16, upright: 0.24, foot: 0.24, thickness: 0.018, gusset: 1 },
      },
      material: 'accent-hardware',
      slotMaterials: { steel: 'hull-steel', bolts: 'accent-hardware' },
      rank: 2,
    },
  },
  assemblies: {
    'crawler-track-module': {
      children: [
        { ref: 'track-pod', key: 'pod' },
        { ref: 'track-fender', key: 'fender', on: { child: 0, socket: 'fenderTop' } },
        {
          ref: 'bogie-lug-bolt',
          key: 'bolts',
          on: { child: 0, socket: 'bogieBoltRow' },
          repeat: { count: 3, step: [0, 0, 0.7] },
        },
      ],
    },
    crawler: {
      children: [
        { ref: 'crawler-track-module', key: 'track-fl', at: [-0.9, 0, 1.45], mirror: 'x' },
        { ref: 'crawler-track-module', key: 'track-fr', at: [0.9, 0, 1.45] },
        { ref: 'crawler-track-module', key: 'track-rl', at: [-0.9, 0, -1.45], mirror: 'x' },
        { ref: 'crawler-track-module', key: 'track-rr', at: [0.9, 0, -1.45] },
        { ref: 'chassis-tub', key: 'chassis', at: [0, 0.36, 0] },
        { ref: 'cab-shell', key: 'cab', on: { child: 4, socket: 'cabDeck' } },
        { ref: 'nose-hinge-saddle', key: 'nose-hinge', on: { child: 4, socket: 'noseHinge' } },
        { ref: 'crawler-arm', key: 'drill-arm', on: { child: 6, socket: 'armPivot' } },
        { ref: 'roof-socket-plate', key: 'roof-plate', on: { child: 5, socket: 'roofPlate' } },
        { ref: 'bogie-beam', key: 'bogie-front', on: { child: 4, socket: 'bogieFront' } },
        { ref: 'bogie-beam', key: 'bogie-rear', on: { child: 4, socket: 'bogieRear' } },
        { ref: 'headlamp-housing', key: 'lamp-left', on: { child: 4, socket: 'lampLeft' }, mirror: 'x' },
        { ref: 'headlamp-housing', key: 'lamp-right', on: { child: 4, socket: 'lampRight' } },
        { ref: 'engine-grille', key: 'rear-grille', on: { child: 4, socket: 'rearGrille' } },
        { ref: 'grab-rail', key: 'roof-rail', on: { child: 5, socket: 'roofRail' }, rot: [0, 90, 0] },
        { ref: 'nose-bracket', key: 'bracket-left', on: { child: 4, socket: 'noseBracketLeft' }, mirror: 'x' },
        { ref: 'nose-bracket', key: 'bracket-right', on: { child: 4, socket: 'noseBracketRight' } },
      ],
      sockets: {
        seat: { at: [0.35, 1.0, -1.5] },
        drill: { at: [0, 0.9, 3.6] },
        mast: { at: [0.4, 2.2, -1.5] },
        lampLeft: { at: [-0.7, 0.9, 3.0] },
        lampRight: { at: [0.7, 0.9, 3.0] },
      },
    },
  },
};
