/**
 * Overwatch's drone body (plan 50): the companion as a believable small quad drone, a kit like every machine.
 *
 * One frame, two propulsion modules, because lift has to be honest (docs/COMBAT_DRONE_COMPANION_RESEARCH.md: rotors give
 * no lift in vacuum):
 *  - `drone` (air: the shielded lab on Earth): four rotors in square shrouds, each on its own motor block;
 *  - `drone-vacuum` (the Moon): four square thruster pods with downward nozzles; the scene puts a pixel plume under each
 *    nozzle only while it thrusts.
 * The frame: a square hull with a battery pack under it, square-section arms, a sensor housing with the Ray-7 violet lens
 * at the nose, a square-barrelled weapon pod slung between the landing skids, and a violet nav lamp on each corner.
 * Square sections throughout; a spinning blade bar reads as a disc. No lettering.
 *
 * Frame: the skids' underside on y 0, front toward +z (the lens), y up. Facing +z, the drone's left is +x.
 * The `rotor-*` blades are left out of the air build and spun on their own pivots (`DRONE_ROTOR_PIVOTS`).
 */
import type { Kit, Placement, Vec3 } from '@hm/kitspec';

const HULL = { w: 0.3, h: 0.11, d: 0.38, y: 0.14 } as const;
const BATTERY = { w: 0.18, h: 0.05, d: 0.2, y: 0.09 } as const;
const ARM = { w: 0.05, h: 0.035, len: 0.36, y: 0.2, centre: 0.3 } as const;
/** Each propulsion module's centre, along the diagonal from the hull's middle. */
const POD_DIAG = 0.46;
const POD_XZ = POD_DIAG / Math.SQRT2; // 0.325
const SHROUD = { side: 0.3, wall: 0.018, h: 0.05, y: 0.2 } as const;
// the motor stands proud of the arm (arm top 0.235 m), so the blade (on the motor's top, 0.24 m) clears it
const MOTOR = { side: 0.05, y: 0.19 } as const;
const BLADE = { len: 0.26, h: 0.006, w: 0.03 } as const;
const THRUSTER = { side: 0.1, h: 0.08, y: 0.17 } as const;
const NOZZLE = { side: 0.06, h: 0.04 } as const;

/** The four corners, front-left first: [x sign, z sign, name, arm yaw in degrees]. */
const CORNERS = [
  [1, 1, 'front-left', 45],
  [-1, 1, 'front-right', -45],
  [1, -1, 'back-left', 135],
  [-1, -1, 'back-right', -135],
] as const;

/** Where each rotor spins (the air module), in the drone's frame: the motor's top. */
export const DRONE_ROTOR_PIVOTS: readonly { readonly name: string; readonly at: Vec3 }[] = CORNERS.map(([sx, sz, name]) => ({
  name,
  at: [sx * POD_XZ, MOTOR.y + MOTOR.side, sz * POD_XZ] as Vec3,
}));

/** Where each thruster's nozzle opens (the vacuum module), in the drone's frame: the plume starts here and points down. */
export const DRONE_NOZZLES: readonly { readonly name: string; readonly at: Vec3 }[] = CORNERS.map(([sx, sz, name]) => ({
  name,
  at: [sx * POD_XZ, THRUSTER.y - NOZZLE.h, sz * POD_XZ] as Vec3,
}));

/** Where the weapon pod's barrel ends (the tracer starts here), in the drone's frame. */
export const DRONE_MUZZLE: Vec3 = [0, 0.061, 0.18];
/** The hull's middle above the skids' underside: the point the drone holds at a height by. */
export const DRONE_CENTRE_Y = HULL.y + HULL.h / 2;

/** What every corner carries whatever lifts it: the arm. */
const arm = (sx: number, sz: number, name: string, yaw: number): Placement => {
  const at = ARM.centre / Math.SQRT2;
  return { ref: 'arm', key: `arm-${name}`, at: [sx * at, ARM.y, sz * at], rot: [0, yaw, 0] };
};

/** The air module at one corner: motor, square shroud, nav lamp on the shroud's outer wall, and the blade. */
const rotorPod = (sx: number, sz: number, name: string): Placement[] => {
  const cx = sx * POD_XZ;
  const cz = sz * POD_XZ;
  const half = SHROUD.side / 2 - SHROUD.wall / 2;
  return [
    { ref: 'motor', key: `motor-${name}`, at: [cx, MOTOR.y, cz] },
    { ref: 'shroud-long', key: `shroud-${name}-front`, at: [cx, SHROUD.y, cz + half] },
    { ref: 'shroud-long', key: `shroud-${name}-back`, at: [cx, SHROUD.y, cz - half] },
    { ref: 'shroud-short', key: `shroud-${name}-left`, at: [cx + half, SHROUD.y, cz] },
    { ref: 'shroud-short', key: `shroud-${name}-right`, at: [cx - half, SHROUD.y, cz] },
    { ref: 'nav-lamp', key: `lamp-${name}`, at: [cx + sx * (SHROUD.side / 2 - 0.02), SHROUD.y + SHROUD.h, cz + sz * half] },
    { ref: 'rotor', key: `rotor-${name}`, at: [cx, MOTOR.y + MOTOR.side, cz], rot: [0, 30, 0] },
  ];
};

/** The vacuum module at one corner: a square thruster pod on the arm's end, its nozzle under it, the nav lamp on top. */
const thrusterPod = (sx: number, sz: number, name: string): Placement[] => {
  const cx = sx * POD_XZ;
  const cz = sz * POD_XZ;
  return [
    { ref: 'thruster', key: `thruster-${name}`, at: [cx, THRUSTER.y, cz] },
    { ref: 'nozzle', key: `nozzle-${name}`, at: [cx, THRUSTER.y - NOZZLE.h, cz] },
    { ref: 'nav-lamp', key: `lamp-${name}`, at: [cx + sx * 0.03, THRUSTER.y + THRUSTER.h, cz + sz * 0.03] },
  ];
};

/** The frame both modules share: skids, struts, battery, weapon pod and barrel, hull, cap, radio masts, sensor housing and lens. */
const FRAME: readonly Placement[] = [
  { ref: 'skid', key: 'skid-left', at: [0.08, 0, 0] },
  { ref: 'skid', key: 'skid-right', at: [-0.08, 0, 0] },
  ...([[1, 1], [1, -1], [-1, 1], [-1, -1]] as const).map(([sx, sz], i): Placement => ({
    ref: 'strut', key: `strut${i}`, at: [sx * 0.08, 0.025, sz * 0.08],
  })),
  { ref: 'battery', key: 'battery', at: [0, BATTERY.y, 0] },
  { ref: 'pod', key: 'pod', at: [0, 0.035, 0] },
  { ref: 'barrel', key: 'barrel', at: [0, 0.05, 0.13] },
  { ref: 'hull', key: 'hull', at: [0, HULL.y, 0] },
  { ref: 'cap', key: 'cap', at: [0, HULL.y + HULL.h, 0] },
  // its radio (its voice, plan 56 §20.10; Argon's spec named left and right masts): a square mast each side at the hull's
  // back, behind the cap, each on its own footing block, with a lit tip
  ...([[1, 'left'], [-1, 'right']] as const).flatMap(([sx, side]): Placement[] => [
    { ref: 'mast-base', key: `mast-base-${side}`, at: [sx * 0.1, HULL.y + HULL.h, -0.16] },
    { ref: 'mast', key: `mast-${side}`, at: [sx * 0.1, HULL.y + HULL.h + 0.015, -0.16] },
    { ref: 'mast-tip', key: `mast-tip-${side}`, at: [sx * 0.1, HULL.y + HULL.h + 0.115, -0.16] },
  ]),
  { ref: 'sensor-housing', key: 'sensor-housing', at: [0, 0.15, HULL.d / 2 + 0.04] },
  { ref: 'lens', key: 'lens', at: [0, 0.175, HULL.d / 2 + 0.08 + 0.006] },
  ...CORNERS.map(([sx, sz, name, yaw]) => arm(sx, sz, name, yaw)),
];

export const DRONE_KIT: Kit = {
  parts: {
    hull: { source: { kind: 'box', size: [HULL.w, HULL.h, HULL.d] }, material: 'gunmetal', rank: 0 },
    cap: { source: { kind: 'box', size: [0.22, 0.03, 0.26] }, material: 'darkSteel', rank: 1 },
    battery: { source: { kind: 'box', size: [BATTERY.w, BATTERY.h, BATTERY.d] }, material: 'darkSteel', rank: 0 },
    'sensor-housing': { source: { kind: 'box', size: [0.14, 0.1, 0.08] }, material: 'darkSteel', rank: 1 },
    lens: { source: { kind: 'box', size: [0.09, 0.05, 0.012] }, material: 'violet', rank: 0 },
    arm: { source: { kind: 'box', size: [ARM.w, ARM.h, ARM.len] }, material: 'darkSteel', rank: 0 },
    motor: { source: { kind: 'box', size: [MOTOR.side, MOTOR.side, MOTOR.side] }, material: 'gunmetal', rank: 0 },
    'shroud-long': { source: { kind: 'box', size: [SHROUD.side, SHROUD.h, SHROUD.wall] }, material: 'darkSteel', rank: 0 },
    'shroud-short': { source: { kind: 'box', size: [SHROUD.wall, SHROUD.h, SHROUD.side - 2 * SHROUD.wall] }, material: 'darkSteel', rank: 0 },
    rotor: { source: { kind: 'box', size: [BLADE.len, BLADE.h, BLADE.w] }, material: 'rotor', rank: 0 },
    thruster: { source: { kind: 'box', size: [THRUSTER.side, THRUSTER.h, THRUSTER.side] }, material: 'gunmetal', rank: 0 },
    nozzle: { source: { kind: 'box', size: [NOZZLE.side, NOZZLE.h, NOZZLE.side] }, material: 'darkSteel', rank: 0 },
    'nav-lamp': { source: { kind: 'box', size: [0.025, 0.025, 0.025] }, material: 'violet', rank: 2 },
    'mast-base': { source: { kind: 'box', size: [0.03, 0.015, 0.03] }, material: 'darkSteel', rank: 1 },
    mast: { source: { kind: 'box', size: [0.01, 0.1, 0.01] }, material: 'gunmetal', rank: 2 },
    'mast-tip': { source: { kind: 'box', size: [0.016, 0.016, 0.016] }, material: 'violet', rank: 2 },
    strut: { source: { kind: 'box', size: [0.02, 0.065, 0.02] }, material: 'gunmetal', rank: 1 },
    skid: { source: { kind: 'box', size: [0.025, 0.025, 0.3] }, material: 'darkSteel', rank: 0 },
    pod: { source: { kind: 'box', size: [0.06, 0.055, 0.16] }, material: 'gunmetal', rank: 1 },
    barrel: { source: { kind: 'box', size: [0.022, 0.022, 0.1] }, material: 'darkSteel', rank: 2 },
  },
  assemblies: {
    /** Air: the lab, and any world with an atmosphere. */
    drone: { children: [...FRAME, ...CORNERS.flatMap(([sx, sz, name]) => rotorPod(sx, sz, name))] },
    /** Vacuum: the Moon. */
    'drone-vacuum': { children: [...FRAME, ...CORNERS.flatMap(([sx, sz, name]) => thrusterPod(sx, sz, name))] },
    /** One rotor's blade bar on its own (the runtime spins four of these on the motors' tops). */
    'drone-rotor': { children: [{ ref: 'rotor', key: 'blade' }] },
  },
};

/** True for the blades the runtime builds on their own pivots (left out of the air build so they can spin). */
export const isDroneRotor = (path: string): boolean => path.startsWith('rotor-');
