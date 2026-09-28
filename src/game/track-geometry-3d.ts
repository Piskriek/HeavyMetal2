/**
 * 3D Track Geometry Builder
 *
 * Converts Arena AI's Three.js track data into our Canvas2D Mesh API.
 * Uses Catmull-Rom spline interpolation to sample the track centerline,
 * then sweeps cross-section profiles along it to build textured ribbons.
 *
 * The coordinate mapping from Arena AI (Three.js) to our engine is handled
 * in the sample() function — all consumers get data in our screen-space
 * coordinate system.
 */
import { Mesh, vec, add, mul, cross, unit, type Vec3, type Material } from './geometry';
import {
  WAYPOINTS,
  LOOP_DEFS,
  TRACK_HALF_WIDTH_3D,
  LAVA_Y,
  CAVE_BOUNDS,
  type Stage3D,
  type TrackTexKey,
  STAGE_SURFACE_TEXTURE,
  STAGE_WALL_TEXTURE,
} from './track-3d-data';

/* ---------------------------------------------------------------------------
   MATH HELPERS
   -------------------------------------------------------------------------- */
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const smoothstep = (a: number, b: number, x: number) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

/* ---------------------------------------------------------------------------
   CATMULL-ROM SPLINE
   Evaluates a centripetal Catmull-Rom curve through the waypoints.
   -------------------------------------------------------------------------- */
interface SplinePoint { x: number; y: number; z: number }

function catmullRomPoint(
  p0: SplinePoint, p1: SplinePoint, p2: SplinePoint, p3: SplinePoint,
  t: number,
): SplinePoint {
  const t2 = t * t;
  const t3 = t2 * t;
  return {
    x: 0.5 * ((2 * p1.x) + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
    y: 0.5 * ((2 * p1.y) + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
    z: 0.5 * ((2 * p1.z) + (-p0.z + p2.z) * t + (2 * p0.z - 5 * p1.z + 4 * p2.z - p3.z) * t2 + (-p0.z + 3 * p1.z - 3 * p2.z + p3.z) * t3),
  };
}

function catmullRomTangent(
  p0: SplinePoint, p1: SplinePoint, p2: SplinePoint, p3: SplinePoint,
  t: number,
): SplinePoint {
  const t2 = t * t;
  return {
    x: 0.5 * ((-p0.x + p2.x) + (4 * p0.x - 10 * p1.x + 8 * p2.x - 2 * p3.x) * t + (-3 * p0.x + 9 * p1.x - 9 * p2.x + 3 * p3.x) * t2),
    y: 0.5 * ((-p0.y + p2.y) + (4 * p0.y - 10 * p1.y + 8 * p2.y - 2 * p3.y) * t + (-3 * p0.y + 9 * p1.y - 9 * p2.y + 3 * p3.y) * t2),
    z: 0.5 * ((-p0.z + p2.z) + (4 * p0.z - 10 * p1.z + 8 * p2.z - 2 * p3.z) * t + (-3 * p0.z + 9 * p1.z - 9 * p2.z + 3 * p3.z) * t2),
  };
}

/* ---------------------------------------------------------------------------
   TRACK FRAME SAMPLING
   Walk the spline at fixed spacing, build an ortho-normal frame per sample
   with parallel-transported normals and gentle banking.
   -------------------------------------------------------------------------- */
export interface TrackFrame {
  /** World position on the centerline. */
  pos: Vec3;
  /** Forward tangent (unit). */
  tangent: Vec3;
  /** Up vector (unit, parallel-transported). */
  up: Vec3;
  /** Right vector (unit, tangent × up). */
  right: Vec3;
  /** Distance along the spline from start. */
  dist: number;
  /** Which stage this sample is in. */
  stage: Stage3D;
  /** Half-width of the track at this point. */
  halfWidth: number;
  /** Whether this sample is inside a 360° loop. */
  inLoop: boolean;
}

const SAMPLE_SPACING = 200; // lower than Arena AI's 50 for Canvas2D performance

/**
 * Build all waypoint positions, inserting loop circle points where needed.
 * Returns raw 3D positions with stage tags.
 */
function buildFullWaypoints(): { points: SplinePoint[]; stages: Stage3D[] } {
  const points: SplinePoint[] = [];
  const stages: Stage3D[] = [];
  // Insert loop waypoints at the right indices
  // In the original code, the alpine loop is inserted after waypoint index 8 (z: 14200)
  // The lava loops are inserted after specific mine waypoints
  // For simplicity, we insert all waypoints in order and add loop circles inline
  for (const wp of WAYPOINTS) {
    points.push({ x: wp.x, y: wp.y, z: wp.z });
    stages.push(wp.stage);

    // Check if any loop starts right after this waypoint
    for (const loopDef of LOOP_DEFS) {
      if (wp.label === 'alpineLoop' || wp.label === 'lavaLoop1' || wp.label === 'lavaLoop2') continue;
      // Insert loop points between the waypoint before and after the loop
      const isAlpineLoopEntry = wp.stage === 'alpine' && wp.z === 14200 && loopDef.label === 'alpineLoop';
      const isLava1Entry = wp.stage === 'mine' && Math.abs(wp.x - (-23300)) < 100 && loopDef.label === 'lavaLoop1';
      const isLava2Entry = wp.stage === 'mine' && Math.abs(wp.x - (-35700)) < 100 && loopDef.label === 'lavaLoop2';
      if (isAlpineLoopEntry || isLava1Entry || isLava2Entry) {
        // Generate 13 points around the vertical circle
        const fwd = { x: loopDef.forwardX, y: loopDef.forwardY, z: loopDef.forwardZ };
        const fwdLen = Math.hypot(fwd.x, fwd.y, fwd.z);
        fwd.x /= fwdLen; fwd.y /= fwdLen; fwd.z /= fwdLen;
        const rightX = fwd.z; // cross(fwd, up) simplified for horizontal forward
        const rightZ = -fwd.x;
        for (let k = 0; k <= 12; k++) {
          const a = (k / 12) * Math.PI * 2;
          points.push({
            x: loopDef.entryX + fwd.x * Math.sin(a) * loopDef.radius + rightX * (k / 12) * loopDef.shift,
            y: loopDef.entryY + (1 - Math.cos(a)) * loopDef.radius,
            z: loopDef.entryZ + fwd.z * Math.sin(a) * loopDef.radius + rightZ * (k / 12) * loopDef.shift,
          });
          stages.push(loopDef.stage);
        }
      }
    }
  }

  return { points, stages };
}

/**
 * Sample the track spline at regular intervals, producing ortho-normal frames.
 */
export function sampleTrack(): TrackFrame[] {
  const { points, stages } = buildFullWaypoints();
  if (points.length < 4) return [];

  // Walk along the spline at fixed spacing
  const frames: TrackFrame[] = [];
  let upVec = vec(0, 1, 0);

  let totalDist = 0;
  let prevPos: Vec3 | null = null;

  // Estimate total length
  let totalLength = 0;
  for (let i = 1; i < points.length; i++) {
    totalLength += Math.hypot(
      points[i].x - points[i - 1].x,
      points[i].y - points[i - 1].y,
      points[i].z - points[i - 1].z,
    );
  }

  const numSamples = Math.ceil(totalLength / SAMPLE_SPACING);

  for (let si = 0; si <= numSamples; si++) {
    const t = si / numSamples; // 0..1 along the whole curve
    const globalT = t * (points.length - 1);
    const segment = Math.min(Math.floor(globalT), points.length - 2);
    const localT = globalT - segment;

    // Catmull-Rom needs 4 control points: p0, p1, p2, p3
    const p0 = points[Math.max(0, segment - 1)];
    const p1 = points[segment];
    const p2 = points[Math.min(points.length - 1, segment + 1)];
    const p3 = points[Math.min(points.length - 1, segment + 2)];

    const pos3d = catmullRomPoint(p0, p1, p2, p3, localT);
    const tan3d = catmullRomTangent(p0, p1, p2, p3, localT);

    // Convert to our Vec3
    const pos = vec(pos3d.x, pos3d.y, pos3d.z);
    const tangent = unit(vec(tan3d.x, tan3d.y, tan3d.z));

    // Track distance
    if (prevPos) {
      totalDist += Math.hypot(pos.x - prevPos.x, pos.y - prevPos.y, pos.z - prevPos.z);
    }
    prevPos = pos;

    // Parallel transport up vector
    const dotTU = upVec.x * tangent.x + upVec.y * tangent.y + upVec.z * tangent.z;
    upVec = unit(vec(
      upVec.x - tangent.x * dotTU,
      upVec.y - tangent.y * dotTU,
      upVec.z - tangent.z * dotTU,
    ));

    // Gentle gravity correction when right-side-up
    const gravUp = vec(-tangent.x * tangent.y, 1 - tangent.y * tangent.y, -tangent.z * tangent.y);
    const gravLen = Math.hypot(gravUp.x, gravUp.y, gravUp.z);
    if (gravLen > 0.2) {
      const gn = mul(gravUp, 1 / gravLen);
      upVec = unit(vec(
        lerp(upVec.x, gn.x, 0.12 * clamp(upVec.y, 0, 1)),
        lerp(upVec.y, gn.y, 0.12 * clamp(upVec.y, 0, 1)),
        lerp(upVec.z, gn.z, 0.12 * clamp(upVec.y, 0, 1)),
      ));
    }

    const rightVec = unit(cross(tangent, upVec));

    // Determine stage from the nearest waypoint
    const stageIdx = Math.min(stages.length - 1, Math.round(globalT));
    const stage = stages[stageIdx];

    // Determine if we're in a loop
    const inLoop = LOOP_DEFS.some((ld) => {
      const dx = pos.x - ld.entryX;
      const dy = pos.y - ld.entryY;
      const dz = pos.z - ld.entryZ;
      return Math.hypot(dx, dy, dz) < ld.radius * 2.5;
    });

    // Half-width varies by stage
    let halfWidth = TRACK_HALF_WIDTH_3D;
    if (stage === 'canyon') halfWidth = 400;
    if (stage === 'stadium') halfWidth = lerp(TRACK_HALF_WIDTH_3D, 660, smoothstep(0, 1, (si - numSamples * 0.92) / (numSamples * 0.08)));

    frames.push({
      pos,
      tangent,
      up: upVec,
      right: rightVec,
      dist: totalDist,
      stage,
      halfWidth,
      inLoop,
    });
  }

  return frames;
}

/* ---------------------------------------------------------------------------
   GEOMETRY BUILDERS — produce Mesh instances from track frames + textures
   -------------------------------------------------------------------------- */

/**
 * Build the track surface ribbon — quads swept along the spline.
 * Returns one Mesh per stage (so different textures can be applied).
 */
export function buildTrackRibbon(
  frames: TrackFrame[],
  textures: Record<TrackTexKey, { image: CanvasImageSource; width: number; height: number }>,
): { mesh: Mesh; texture: TrackTexKey; stage: Stage3D }[] {
  const results: { mesh: Mesh; texture: TrackTexKey; stage: Stage3D }[] = [];

  // Group frames by stage runs
  let runStart = 0;
  for (let i = 1; i <= frames.length; i++) {
    const prevStage = frames[i - 1].stage;
    const currStage = i < frames.length ? frames[i].stage : null;
    if (currStage !== prevStage || i === frames.length) {
      const mesh = new Mesh();
      const texKey = STAGE_SURFACE_TEXTURE[prevStage];
      const tex = textures[texKey];

      // Build quad strip for this stage run
      for (let j = runStart; j < i - 1 && j + 1 < frames.length; j++) {
        const a = frames[j];
        const b = frames[j + 1];

        // 4 corners: left-a, right-a, right-b, left-b
        const la = add(a.pos, mul(a.right, -a.halfWidth));
        const ra = add(a.pos, mul(a.right, a.halfWidth));
        const lb = add(b.pos, mul(b.right, -b.halfWidth));
        const rb = add(b.pos, mul(b.right, b.halfWidth));

        mesh.face(
          [la, ra, rb, lb],
          {
            color: stageColor(prevStage),
            image: tex.image,
            crop: { x: 0, y: 0, width: tex.width, height: tex.height },
          },
        );
      }

      if (mesh.faces.length > 0) {
        results.push({ mesh, texture: texKey, stage: prevStage });
      }
      runStart = i;
    }
  }

  return results;
}

/**
 * Build wall/bank geometry flanking the track.
 * Each wall drops from the track edge down into the terrain.
 */
export function buildTrackWalls(
  frames: TrackFrame[],
  textures: Record<TrackTexKey, { image: CanvasImageSource; width: number; height: number }>,
  wallHeight: number = 800,
): { mesh: Mesh; texture: TrackTexKey; stage: Stage3D }[] {
  const results: { mesh: Mesh; texture: TrackTexKey; stage: Stage3D }[] = [];
  let runStart = 0;

  for (let i = 1; i <= frames.length; i++) {
    const prevStage = frames[i - 1].stage;
    const currStage = i < frames.length ? frames[i].stage : null;
    if (currStage !== prevStage || i === frames.length) {
      const texKey = STAGE_WALL_TEXTURE[prevStage];
      const tex = textures[texKey];

      // Left wall
      const leftMesh = new Mesh();
      // Right wall
      const rightMesh = new Mesh();

      for (let j = runStart; j < i - 1 && j + 1 < frames.length; j++) {
        const a = frames[j];
        const b = frames[j + 1];

        // Left wall: drops down from the left edge
        const laTop = add(a.pos, mul(a.right, -a.halfWidth));
        const lbTop = add(b.pos, mul(b.right, -b.halfWidth));
        const laBot = add(laTop, mul(a.up, -wallHeight));
        const lbBot = add(lbTop, mul(b.up, -wallHeight));

        leftMesh.face(
          [laTop, lbTop, lbBot, laBot],
          {
            color: stageColor(prevStage),
            image: tex.image,
            crop: { x: 0, y: 0, width: tex.width, height: tex.height },
          },
        );

        // Right wall
        const raTop = add(a.pos, mul(a.right, a.halfWidth));
        const rbTop = add(b.pos, mul(b.right, b.halfWidth));
        const raBot = add(raTop, mul(a.up, -wallHeight));
        const rbBot = add(rbTop, mul(b.up, -wallHeight));

        rightMesh.face(
          [raTop, rbTop, rbBot, raBot],
          {
            color: stageColor(prevStage),
            image: tex.image,
            crop: { x: 0, y: 0, width: tex.width, height: tex.height },
          },
        );
      }

      if (leftMesh.faces.length > 0) results.push({ mesh: leftMesh, texture: texKey, stage: prevStage });
      if (rightMesh.faces.length > 0) results.push({ mesh: rightMesh, texture: texKey, stage: prevStage });
      runStart = i;
    }
  }

  return results;
}

/**
 * Build the lava lake — a flat emissive plane under the mine section.
 */
export function buildLavaLake(
  texture: { image: CanvasImageSource; width: number; height: number },
): Mesh {
  const mesh = new Mesh();
  const { xMin, xMax, zMin, zMax } = CAVE_BOUNDS;

  // Large quad for the lava surface
  mesh.face(
    [
      vec(xMin, LAVA_Y, zMin),
      vec(xMax, LAVA_Y, zMin),
      vec(xMax, LAVA_Y, zMax),
      vec(xMin, LAVA_Y, zMax),
    ],
    {
      color: '#ff4400',
      image: texture.image,
      crop: { x: 0, y: 0, width: texture.width, height: texture.height },
    },
    vec(0, 1, 0),
  );

  return mesh;
}

/**
 * Build a simple box mesh for structures (grandstands, gate pillars, etc.)
 */
export function buildBox(
  center: Vec3,
  size: Vec3,
  material: Material,
): Mesh {
  const mesh = new Mesh();
  mesh.box(
    vec(center.x - size.x / 2, center.y - size.y / 2, center.z - size.z / 2),
    vec(center.x + size.x / 2, center.y + size.y / 2, center.z + size.z / 2),
    material,
  );
  return mesh;
}

/* ---------------------------------------------------------------------------
   STAGE COLORS — fallback flat colors when textures aren't loaded yet
   -------------------------------------------------------------------------- */
function stageColor(stage: Stage3D): string {
  switch (stage) {
    case 'alpine': return '#8b7651';
    case 'canyon': return '#6b5f4a';
    case 'zigzag': return '#847862';
    case 'cavern': return '#2a2a2a';
    case 'mine': return '#7a6042';
    case 'breakthrough': return '#3d3830';
    case 'stadium': return '#5a5a5a';
  }
}

/* ---------------------------------------------------------------------------
   PUBLIC: Build all 3D track geometry in one call
   -------------------------------------------------------------------------- */
export interface TrackGeometry3D {
  frames: TrackFrame[];
  ribbon: { mesh: Mesh; texture: TrackTexKey; stage: Stage3D }[];
  walls: { mesh: Mesh; texture: TrackTexKey; stage: Stage3D }[];
  lavaLake: Mesh | null;
}

export function buildTrackGeometry3D(
  textures: Record<TrackTexKey, { image: CanvasImageSource; width: number; height: number }>,
): TrackGeometry3D {
  const frames = sampleTrack();
  const ribbon = buildTrackRibbon(frames, textures);
  const walls = buildTrackWalls(frames, textures);
  const lavaLake = textures.lava ? buildLavaLake(textures.lava) : null;

  return { frames, ribbon, walls, lavaLake };
}
