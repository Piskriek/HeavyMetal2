/**
 * M01 · T0 — run the eye-level audit and write `docs/FP_SPIKE.md`.
 *
 *   node --import tsx scripts/eye-level-audit.mjs [--course ridge] [--spacing 200] [--json]
 *
 * The eye path is the real thing: `placementFromEngine` lifts the ball centre 62 world units above
 * the ribbon and the cockpit eye sits 24 above that, so the samples are exactly where the T3 camera
 * will be — not an approximation. Props come from the builder's own saved documents
 * (`backups/props/track-props-*.json`, read-only) mapped through `PROP_DEFINITIONS`, which is where
 * the painted sizes live.
 *
 * The output file keeps any human decision between the `<!-- decision:start -->` markers, so
 * re-running the audit never erases what the human wrote.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { getTrackSpace, placementFromEngine, engineXFromDistance, engineFromWorld } from '../src/game/track-space.ts';
import { courseY, laneZ, RADIUS, START_X, TRACK_DISTANCE } from '../src/game/scene.ts';
import { PROP_DEFINITIONS } from '../src/game/track-builder-3d.ts';
import {
  AUDIT_EYE_LIFT, DECAL_RANGE, THIN_RANGE, runEyeLevelAudit, serializeEyeAudit,
} from '../src/game/eye-level-audit.ts';

const root = fileURLToPath(new URL('../', import.meta.url));
const args = process.argv.slice(2);
const argValue = (name, fallback) => {
  const index = args.indexOf(`--${name}`);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
};
const course = argValue('course', 'ridge');
const spacing = Number(argValue('spacing', '200'));
const asJson = args.includes('--json');

const map = getTrackSpace();
const definitionByType = new Map(PROP_DEFINITIONS.map((definition) => [definition.type, definition]));

/* -------------------------------------------------------------------------- */
/* 1. The eye path                                                            */
/* -------------------------------------------------------------------------- */

const samples = [];
for (let s = map.D_START; s <= map.D_END; s += spacing) {
  const distance = ((s - map.D_START) / (map.D_END - map.D_START)) * TRACK_DISTANCE;
  const x = engineXFromDistance(distance);
  const placement = placementFromEngine(map, {
    x, distance, y: courseY(x, course) - RADIUS, z: 0, grounded: true,
  });
  const frame = placement.frame;
  const stage = frame.stage ?? 'unknown';
  samples.push({
    s,
    stage,
    halfWidth: frame.halfWidth - RADIUS * 1.2,
    eye: {
      x: placement.world.x + frame.up.x * AUDIT_EYE_LIFT,
      y: placement.world.y + frame.up.y * AUDIT_EYE_LIFT,
      z: placement.world.z + frame.up.z * AUDIT_EYE_LIFT,
    },
  });
}

/* -------------------------------------------------------------------------- */
/* 2. The props the game actually draws                                       */
/* -------------------------------------------------------------------------- */

function loadSavedProps() {
  const byId = new Map();
  for (const file of ['track-props-default.json', 'track-props-latest.json']) {
    const path = `${root}backups/props/${file}`;
    if (!existsSync(path)) continue;
    let document;
    try { document = JSON.parse(readFileSync(path, 'utf8')); } catch { continue; }
    for (const prop of document.props ?? []) {
      if (!prop || typeof prop.id !== 'string') continue;
      // `latest` wins over `default` when both describe the same prop.
      byId.set(prop.id, { ...(byId.get(prop.id) ?? {}), ...prop, document: file });
    }
  }
  return [...byId.values()];
}

const items = [];
const unprojected = [];
for (const prop of loadSavedProps()) {
  const definition = definitionByType.get(prop.type);
  if (!definition) continue;
  const scale = typeof prop.scale === 'number' && prop.scale > 0 ? prop.scale : 1;
  const halfWidth = (definition.defaultWidth * scale) / 2;
  const halfHeight = (definition.defaultHeight * scale) / 2;
  // The classification must match how `track-builder-3d.ts` builds the object, or the audit would
  // report hazards that do not exist: a decal lies flat, a ramp/slingshot is a mesh, a
  // camera-facing prop is a sprite, and only the remaining case is a fixed vertical plane.
  const kind = definition.isDecal === true || prop.isDecal === true ? 'decal'
    : definition.isRamp === true || definition.isSlingshot === true || definition.is3DModel === true ? 'model'
      : prop.cameraFacing === false ? 'plane'
        : 'billboard';
  let y = prop.y;
  if (prop.alignToTrack) {
    // Sits on the road: take the ribbon height under its world (x, z) footprint. A bottom-anchored
    // plane is drawn from its origin upward, so the centre the audit measures from is lifted by half
    // its height; a decal or a sprite is already centred on the origin.
    const projected = engineFromWorld(map, { x: prop.x, y: prop.y, z: prop.z });
    if (!projected.ambiguous && Number.isFinite(projected.distance)) {
      const surfaceY = placementFromEngine(map, {
        distance: projected.distance,
        y: courseY(engineXFromDistance(projected.distance), course) - RADIUS,
        z: projected.laneZ,
        grounded: true,
      }).world.y;
      y = kind === 'plane' ? surfaceY + halfHeight : surfaceY;
    } else {
      unprojected.push(prop.id);
    }
  }
  items.push({
    id: prop.id,
    kind,
    name: prop.name ?? definition.name ?? prop.type,
    position: { x: prop.x, y, z: prop.z },
    halfWidth,
    halfHeight,
    yaw: typeof prop.rotY === 'number' ? prop.rotY : 0,
    source: 'builder',
  });
}

const report = runEyeLevelAudit({ samples, items, spacing, limit: 20 });
const payload = {
  generatedAt: new Date().toISOString(),
  course,
  spacing,
  eyeLift: AUDIT_EYE_LIFT,
  uncovered: [
    'Code-built scenery in renderer-3d.ts (rock cones, cliff ribbons, stadium, cavern, mine)',
    'The alpine heightfield silhouette and the painted skydome',
    'Painted course textures and the dirt/decal material as seen face-on',
  ],
  unprojectedProps: unprojected.sort(),
  ...JSON.parse(serializeEyeAudit(report)),
};

if (asJson) {
  process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
  process.exit(0);
}

/* -------------------------------------------------------------------------- */
/* 3. The report                                                              */
/* -------------------------------------------------------------------------- */

const pct = (value) => `${(value * 100).toFixed(0)}%`;
const fixed = (value) => value.toFixed(0).padStart(7);

const lines = [];
lines.push('# M01 · T0 — FP eye-level audit');
lines.push('');
lines.push(`Generated ${payload.generatedAt} from \`scripts/eye-level-audit.mjs --course ${course} --spacing ${spacing}\`.`);
lines.push('');
lines.push('This file is produced by the audit. The **Decision** section at the bottom is the human\'s');
lines.push('and is preserved verbatim when the audit is re-run.');
lines.push('');
lines.push('## What the audit can see');
lines.push('');
lines.push('| Measured | Value |');
lines.push('| --- | --- |');
lines.push(`| Eye path samples | ${report.eye.samples} every ${spacing} spline units |`);
lines.push(`| Eye pose | ribbon + 62 (ball centre) + ${AUDIT_EYE_LIFT - 62} along frame up, 6 forward |`);
lines.push(`| Vertical FOV / aspect | ${report.eye.fov}° / ${report.eye.aspect.toFixed(3)} |`);
lines.push(`| Props inspected | ${report.totals.items} (${report.totals.planes} fixed planes, ${report.totals.billboards} camera-facing, ${report.totals.decals} decals, ${report.totals.models} meshes) |`);
lines.push(`| Fixed planes seen edge-on within ${THIN_RANGE} | ${report.totals.thin} |`);
lines.push(`| Road-edge distance ahead | worst ${report.totals.worstEdgeDistance.toFixed(0)}, median ${report.totals.medianEdgeDistance.toFixed(0)} world units |`);
lines.push(`| Decals/landmarks under ${DECAL_RANGE} | ${report.totals.decalsNear} |`);
lines.push('');
lines.push('## Per stage');
lines.push('');
lines.push('`edge distance` is how far ahead the eye can see past the drivable edge — smaller means the');
lines.push('road runs out sooner in the frame, and whatever is behind the edge (terrain, void, sky) shows.');
lines.push('');
lines.push('| Stage | Samples | Min edge distance | Thin billboards | Decals near |');
lines.push('| --- | --- | --- | --- | --- |');
for (const stage of report.stages) {
  lines.push(`| ${stage.stage} | ${stage.samples} | ${fixed(stage.minEdgeDistance)} | ${stage.thin} | ${stage.decals} |`);
}
lines.push('');
lines.push('## Most exposed sample per stage');
lines.push('');
lines.push('| Stage | s | Drivable half-width | Edge distance |');
lines.push('| --- | --- | --- | --- |');
for (const entry of report.stageWorst) {
  lines.push(`| ${entry.stage} | ${entry.s.toFixed(0)} | ${entry.halfWidth.toFixed(0)} | ${entry.edgeDistance.toFixed(0)} |`);
}
lines.push('');
lines.push('## Fixed planes seen edge-on (worst first)');
lines.push('');
if (report.thin.length === 0) {
  lines.push('None: every fixed-plane prop stays more than ' + pct(1 - 0.2) + ' off edge-on from the eye path.');
} else {
  lines.push('| Prop | Source | min \\|n·v\\| | s | Distance |');
  lines.push('| --- | --- | --- | --- | --- |');
  for (const item of report.thin) {
    lines.push(`| ${item.name} | ${item.source} | ${item.minFacing.toFixed(3)} | ${item.s.toFixed(0)} | ${item.distance.toFixed(0)} |`);
  }
}
lines.push('');
lines.push('## Decals and landmarks under the nose');
lines.push('');
if (report.decals.length === 0) {
  lines.push('None.');
} else {
  lines.push('| Item | s | Distance | Angular size |');
  lines.push('| --- | --- | --- | --- |');
  for (const item of report.decals) {
    lines.push(`| ${item.name} | ${item.s.toFixed(0)} | ${item.distance.toFixed(0)} | ${item.angularSizeDeg.toFixed(1)}° |`);
  }
}
lines.push('');
lines.push('## What this audit cannot see');
lines.push('');
lines.push('Anything that exists only once the scene graph is built and rasterised:');
lines.push('');
for (const gap of payload.uncovered) lines.push(`- ${gap}`);
if (unprojected.length > 0) {
  lines.push('');
  lines.push(`Props whose world position could not be projected onto the road (alignment kept the stored`);
  lines.push(`height): ${unprojected.sort().join(', ')}.`);
}
lines.push('');
lines.push('## How to look at it yourself');
lines.push('');
lines.push('```');
lines.push('npx vite --config vite.preview.config.ts --host 0.0.0.0 --port 5173');
lines.push('# open the printed URL with ?fp=1 appended, start a Quick Race');
lines.push('```');
lines.push('');
lines.push('The flag is read once per renderer, so a reload is enough to switch back and forth.');
lines.push('');
lines.push('<!-- decision:start -->');
lines.push('## Decision (human)');
lines.push('');
lines.push('- [ ] **Go** — the world holds up at eye level; T3 starts as planned.');
lines.push('- [ ] **Go with dressing** — the frame reads, but listed items need work first (say which).');
lines.push('- [ ] **No-go** — the cockpit needs a different approach (say what is wrong).');
lines.push('');
lines.push('_Not yet recorded. The numbers above are the evidence; the preview URL is the verdict._');
lines.push('<!-- decision:end -->');
lines.push('');

const target = `${root}docs/FP_SPIKE.md`;
const previous = existsSync(target) ? readFileSync(target, 'utf8') : '';
const kept = /<!-- decision:start -->([\s\S]*?)<!-- decision:end -->/.exec(previous);
let body = lines.join('\n');
if (kept) {
  body = body.replace(/<!-- decision:start -->[\s\S]*?<!-- decision:end -->/, `<!-- decision:start -->${kept[1]}<!-- decision:end -->`);
}
mkdirSync(`${root}docs`, { recursive: true });
writeFileSync(target, body);

console.log(`[eye-audit] ${report.eye.samples} samples · ${report.totals.items} props · ` +
  `${report.totals.thin} thin · ${report.totals.decalsNear} decals near · ` +
  `worst edge ${report.totals.worstEdgeDistance.toFixed(0)}`);
console.log(`[eye-audit] wrote docs/FP_SPIKE.md`);
console.log(`[eye-audit] eye at lane centre z=0 from x=${START_X}; first sample s=${samples[0].s} stage=${samples[0].stage}`);
console.log(`[eye-audit] lane-2 grid z=${laneZ(2)} (the player's lane)`);
