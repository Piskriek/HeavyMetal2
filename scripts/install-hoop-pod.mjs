/**
 * Installs the Hoop-Pod racers (v2) into the game and the Ball Garage.
 *
 * Serialized files (docs/CONTRACTS.md, "Ownership rules") get the smallest possible anchored edits
 * instead of whole-file replacements:
 *
 *   src/game/renderer-3d.ts
 *     E1 import HoopPodFleet                 (E5 retired: M7 batches stay empty)
 *     E2 `pods` field                        E6 feed each racer to the fleet (replaces shield block)
 *     E3 construct before ensureRacerMeshes  E7 commit AFTER the camera is placed (screen-space LOD,
 *     E4 size the fleet with the pool           frustum culling) with the canvas height
 *                                            E8 dispose with the renderer
 *   src/components/garage/BallShowroom.tsx
 *     G1 default export → PodShowroom (the sphere stays exported as `SphereShowroom`)
 *   scripts/check.mjs
 *     C1 register tests/hoop-pod.test.ts and tests/hoop-pod-lod.test.ts
 *
 * Handles a fresh `main` and a checkout that already carries the v1 integration (upgrades it).
 * All-or-nothing: if any anchor is missing nothing is written and it exits with E_HOOP_POD_ANCHOR.
 *
 * Usage:  node scripts/install-hoop-pod.mjs          (apply)
 *         node scripts/install-hoop-pod.mjs --check  (report only; exit 1 if anything is pending)
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const checkOnly = process.argv.includes('--check');
const V1 = '/* hoop-pod:v1 */';
const V2 = '/* hoop-pod:v2 */';

const COMMIT = '    this.pods.commit(this.camera, dt, frame.reducedMotion, this.renderer.domElement.clientHeight || 720);\n';
const SKY = '    this.sky.position.copy(this.camera.position);\n    this.sky.rotation.y += dt * 0.0012;';

/** [id, anchor, replacement] */
const rendererFresh = [
  ['E1-import',
    "import { CAP_RADIUS_SCALE, CAP_THETA, TAU, gyroFrameFor, gyroPose } from './gyro-ball';",
    `import { CAP_RADIUS_SCALE, CAP_THETA, TAU, gyroFrameFor, gyroPose } from './gyro-ball';\nimport { HoopPodFleet } from './pod'; ${V2}`],
  ['E2-field',
    '  private readonly gyroQuat = new THREE.Quaternion();',
    '  private readonly gyroQuat = new THREE.Quaternion();\n  /** Hoop-Pod racers: one instanced fleet draws the whole field, LOD by screen size (docs/HOOP_POD.md). */\n  private readonly pods: HoopPodFleet;'],
  ['E3-construct',
    '    // Racers\n    this.ensureRacerMeshes(4);',
    '    // Racers\n    this.pods = new HoopPodFleet(this.scene);\n    this.ensureRacerMeshes(4);'],
  ['E4-count',
    '    while (this.racers3D.length > count) this.releaseRacerMesh();\n  }',
    '    while (this.racers3D.length > count) this.releaseRacerMesh();\n    this.pods.setCount(count);\n  }'],
  // Rebased onto the instanced racers (M7): feed the fleet in drawRacers instead of the legacy batches.
  ['E6-feed',
    "      const shielded = (racer.shieldUntil ?? 0) > frame.runTime;\n      // A slow spin on the bubble, held still under reduced motion.\n      if (shielded && !frame.reducedMotion) slot.shieldSpin += dt * 0.9;\n      // T0/T3: the eye sits inside the player's own ball, so the ball is not drawn in first person.\n      if ((firstPerson && i === 0) || racer.hidden) continue;\n\n      // T3 (IF-GYRO): the shell rolls, the caps and the rider do not. The pose is arithmetic from\n      // the sim's own roll phase (no renderer-side integration), copied into the reused quaternions.\n      const gyro = gyroPose(racer.rollPhase ?? 0, this.worldFrame(placement.frame));\n      this.coreQuat.set(gyro.core[0], gyro.core[1], gyro.core[2], gyro.core[3]);\n      this.gyroQuat.set(gyro.gyro[0], gyro.gyro[1], gyro.gyro[2], gyro.gyro[3]);\n\n      const core = slot.core.mesh;\n      core.setMatrixAt(core.count, m.compose(position, this.coreQuat, one));\n      if (!slot.canvas) core.setColorAt(core.count, slot.color);\n      if (slot.layer !== null) slot.core.layers?.setX(core.count, slot.layer);\n      core.count++;\n      shared.caps.setMatrixAt(shared.caps.count++, m.compose(position, this.gyroQuat, one));\n      if (shielded) {\n        this.shieldQuat.setFromAxisAngle(WORLD_UP, slot.shieldSpin);\n        shared.shields.setMatrixAt(shared.shields.count++, m.compose(position, this.shieldQuat, one));\n      }\n      // P5: the contact shadow lies on the road under the ball, tilted with the road (banks and\n      // drops), fading and spreading as the ball leaves it.\n      const f = placement.frame; const lateral = placement.lateral;\n      const groundX = f.pos.x + f.right.x * lateral; const groundY = f.pos.y + f.right.y * lateral + lift; const groundZ = f.pos.z + f.right.z * lateral;\n      const clearance = (placement.world.x - groundX) * f.up.x + (placement.world.y + lift - groundY) * f.up.y + (placement.world.z - groundZ) * f.up.z - BALL_DRAW_RADIUS;\n      const look = shadowAt(clearance);\n      if (look.fade > 0) {\n        position.set(groundX + f.up.x * SHADOW_LIFT, groundY + f.up.y * SHADOW_LIFT, groundZ + f.up.z * SHADOW_LIFT);\n        this.shadowQuat.setFromUnitVectors(PLANE_NORMAL, this.shadowUp.set(f.up.x, f.up.y, f.up.z).normalize());\n        const n = shared.shadows.count++;\n        shared.shadows.setMatrixAt(n, m.compose(position, this.shadowQuat, this.shadowScale.setScalar(look.scale)));\n        shared.shadows.setColorAt(n, this.shadowFade.setRGB(look.fade, look.fade, look.fade));\n      }\n    }\n",
    "      // Hoop-Pod (IF-GYRO): the fleet draws the racer, its shield and its blob shadow; the legacy\n      // batches stay empty. The hoops take the shell roll, the inner ball and caps the level basis;\n      // the fleet copies numbers the sim already owns and writes nothing back. hoop-pod:v2\n      // T0/T3: the eye sits inside the player's own pod, so it is not drawn in first person.\n      const gyro = gyroPose(racer.rollPhase ?? 0, this.worldFrame(placement.frame));\n      this.gyroQuat.set(gyro.gyro[0], gyro.gyro[1], gyro.gyro[2], gyro.gyro[3]);\n      const shown = !((firstPerson && i === 0) || racer.hidden);\n      this.pods.setRacer(i, racer, position, this.gyroQuat, racer.rollPhase ?? 0, shown, frame.runTime, dt);\n    }\n"],
  ['E7-commit', SKY, `    // Hoop-Pod: pack after the camera is placed, so LOD and culling use this frame's view.\n${COMMIT}${SKY}`],
  ['E8-dispose',
    '    this.destroyed = true;\n    this.disposeRacerPool();',
    '    this.destroyed = true;\n    this.disposeRacerPool();\n    this.pods.dispose();'],
];

/** v1 → v2: only the marker and the commit position/arguments changed. */
const rendererUpgrade = [
  ['U1-marker', `import { HoopPodFleet } from './pod'; ${V1}`, `import { HoopPodFleet } from './pod'; ${V2}`],
  ['U2-old-commit', '    this.pods.commit(this.camera, dt, frame.reducedMotion);\n\n', ''],
  rendererFresh.find((e) => e[0] === 'E7-commit'),
];

const showroomEdits = [
  ['G1-default',
    'export default function BallShowroom({ baked, capFinish, onSurface, onCap, label }: Props) {',
    `// Hoop-Pod: the garage shows the race pod, painted by the same bake (PodShowroom.tsx). hoop-pod:v2\nexport { default } from './PodShowroom';\n\n/** The original sphere showroom, kept for comparison and fallback. */\nexport function SphereShowroom({ baked, capFinish, onSurface, onCap, label }: Props) {`],
];

const checkEdits = [
  ['C1-tests', "    'tests/gyro-ball.test.ts',", "    'tests/gyro-ball.test.ts',\n    'tests/hoop-pod.test.ts', 'tests/hoop-pod-lod.test.ts',"],
];

function apply(source, edits) {
  let next = source;
  const missing = [];
  for (const [id, anchor, replacement] of edits) {
    const at = next.indexOf(anchor);
    if (at < 0) { missing.push(id); continue; }
    if (next.indexOf(anchor, at + anchor.length) >= 0) { missing.push(`${id} (ambiguous)`); continue; }
    next = next.slice(0, at) + replacement + next.slice(at + anchor.length);
  }
  return { next, missing };
}

function plan(file, choose) {
  const path = root + file;
  const source = readFileSync(path, 'utf8').replace(/\r\n/g, '\n');
  const { state, edits } = choose(source);
  if (state === 'installed') return { file, path, state, next: source, missing: [] };
  const { next, missing } = apply(source, edits);
  return { file, path, state, next, missing };
}

const plans = [
  plan('src/game/renderer-3d.ts', (s) =>
    s.includes(V2) ? { state: 'installed' } : s.includes(V1) ? { state: 'upgrade', edits: rendererUpgrade } : { state: 'fresh', edits: rendererFresh }),
  plan('src/components/garage/BallShowroom.tsx', (s) => (s.includes('hoop-pod:v2') ? { state: 'installed' } : { state: 'fresh', edits: showroomEdits })),
  plan('scripts/check.mjs', (s) =>
    s.includes('tests/hoop-pod-lod.test.ts') ? { state: 'installed' }
      : s.includes("'tests/hoop-pod.test.ts',")
        ? { state: 'upgrade', edits: [['C2-lod-test', "    'tests/hoop-pod.test.ts',", "    'tests/hoop-pod.test.ts', 'tests/hoop-pod-lod.test.ts',"]] }
        : { state: 'fresh', edits: checkEdits }),
];

const refused = plans.filter((p) => p.missing.length);
if (refused.length) {
  for (const p of refused) console.error(`E_HOOP_POD_ANCHOR ${p.file} (${p.state}): ${p.missing.join(', ')}`);
  console.error('Nothing was changed. Rebase the anchors in scripts/install-hoop-pod.mjs against main.');
  process.exit(2);
}
if (checkOnly) {
  for (const p of plans) console.log(`${p.state === 'installed' ? 'installed' : `pending (${p.state})`.padEnd(9)} ${p.file}`);
  process.exit(plans.some((p) => p.state !== 'installed') ? 1 : 0);
}
for (const p of plans) {
  if (p.state === 'installed') { console.log(`already installed ${p.file}`); continue; }
  writeFileSync(p.path, p.next);
  console.log(`${p.state === 'upgrade' ? 'upgraded' : 'patched '} ${p.file}`);
}
console.log('Hoop-Pod v2 installed. Next: npm run check && npm run build (see docs/HOOP_POD.md).');
