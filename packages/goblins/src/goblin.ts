import { IDENTITY, quatFromAxisAngle } from './quat.js';
import type {
  EarKind,
  GoblinLook,
  HatKind,
  Mood,
  Part,
  PartRole,
  Quat,
  Vec3,
} from './types.js';

function sp(rx: number, ry: number, rz: number, size: number): Part {
  return {
    id: '',
    role: 'body',
    shape: 'sphere',
    size,
    position: [rx, ry, rz],
    rotation: IDENTITY,
    scale: [1, 1, 1],
    color: '#000000',
    metalness: 0,
    roughness: 0.5,
    opacity: 1,
  };
}

function box(
  rx: number,
  ry: number,
  rz: number,
  size: number,
  scale: Vec3,
  rot: Quat,
): Part {
  return {
    id: '',
    role: 'body',
    shape: 'box',
    size,
    position: [rx, ry, rz],
    rotation: rot,
    scale,
    color: '#000000',
    metalness: 0,
    roughness: 0.5,
    opacity: 1,
  };
}

function cyl(
  rx: number,
  ry: number,
  rz: number,
  size: number,
  scale: Vec3,
  rot: Quat,
): Part {
  return {
    id: '',
    role: 'body',
    shape: 'cylinder',
    size,
    position: [rx, ry, rz],
    rotation: rot,
    scale,
    color: '#000000',
    metalness: 0,
    roughness: 0.5,
    opacity: 1,
  };
}

function finalize(p: Part, id: string, role: PartRole, color: string): Part {
  return { ...p, id, role, color: color.toLowerCase() };
}

/**
 * Build a goblin (plus a transparent glass shell) for the given look.
 * All positions and sizes are in units of the ball radius R.
 * The goblin and its hat must fit inside the glass ball.
 */
export function goblinParts(look: GoblinLook, ballRadius: number): Part[] {
  const R = ballRadius;
  const skin = look.color.toLowerCase();
  const accent = look.accent.toLowerCase();
  const mood: Mood = look.mood ?? 'happy';
  const parts: Part[] = [];

  // --- Glass shell (single sphere, always at origin) ----------------------------
  parts.push({
    id: 'glass',
    role: 'glass',
    shape: 'sphere',
    size: R,
    position: [0, 0, 0],
    rotation: IDENTITY,
    scale: [1, 1, 1],
    color: '#bfe8ff',
    metalness: 0,
    roughness: 0.08,
    opacity: 0.22,
  });

  // --- Body (lower-middle) -----------------------------------------------------
  const bodyR = 0.34 * R;
  const bodyY = -0.28 * R;
  parts.push(
    finalize(
      {
        ...sp(0, bodyY, 0, bodyR),
        scale: [1, 0.85, 1],
      },
      'body',
      'body',
      skin,
    ),
  );
  // The body uses roughness 0.55, metalness 0.
  const bodyPart = parts[parts.length - 1]!;
  bodyPart.roughness = 0.55;
  bodyPart.metalness = 0;

  // --- Head (above body, shifted toward +x) ------------------------------------
  const headR = 0.3 * R;
  const headY = 0.18 * R;
  const headX = 0.04 * R;
  parts.push(
    finalize(
      sp(headX, headY, 0, headR),
      'head',
      'head',
      skin,
    ),
  );
  const headPart = parts[parts.length - 1]!;
  headPart.roughness = 0.55;
  headPart.metalness = 0;

  // --- Eyes + pupils -----------------------------------------------------------
  // Mood affects eye size and shape.
  let eyeSize = 0.06 * R;
  let eyeScale: Vec3 = [1, 1, 1];
  if (mood === 'surprised') eyeSize = 0.078 * R;
  if (mood === 'angry') eyeScale = [1, 0.7, 1];

  const eyeOffsetX = headX + 0.21 * R;
  const eyeOffsetY = headY + 0.05 * R;
  const eyeOffsetZ = 0.11 * R;
  const pupilOffsetX = headX + 0.255 * R;
  const pupilOffsetY = headY + 0.05 * R;
  const pupilSize = 0.025 * R;
  const pupilOffsetZ = 0.115 * R;

  parts.push(
    finalize(
      { ...sp(eyeOffsetX, eyeOffsetY, eyeOffsetZ, eyeSize), scale: eyeScale },
      'eye-a',
      'eye',
      '#ffffff',
    ),
  );
  parts.push(
    finalize(
      { ...sp(eyeOffsetX, eyeOffsetY, -eyeOffsetZ, eyeSize), scale: eyeScale },
      'eye-b',
      'eye',
      '#ffffff',
    ),
  );
  parts.push(
    finalize(sp(pupilOffsetX, pupilOffsetY, pupilOffsetZ, pupilSize), 'pupil-a', 'pupil', '#1a1a1a'),
  );
  parts.push(
    finalize(sp(pupilOffsetX, pupilOffsetY, -pupilOffsetZ, pupilSize), 'pupil-b', 'pupil', '#1a1a1a'),
  );

  // --- Nose (slightly darker shade of skin) ------------------------------------
  // Darken by mixing toward black at 25%.
  const noseColor = darken(skin, 0.25);
  parts.push(
    finalize(
      sp(headX + 0.24 * R, headY - 0.04 * R, 0, 0.045 * R),
      'nose',
      'nose',
      noseColor,
    ),
  );

  // --- Mouth (mood-dependent) --------------------------------------------------
  const mouthColor = mood === 'surprised' ? '#3a0d0d' : '#1a1a1a';
  if (mood === 'surprised') {
    // round open mouth, sphere
    parts.push(
      finalize(
        sp(headX + 0.24 * R, headY - 0.15 * R, 0, 0.06 * R),
        'mouth',
        'mouth',
        mouthColor,
      ),
    );
    // A tongue inside the mouth so the surprised face is recognisable.
    parts.push(
      finalize(
        sp(headX + 0.245 * R, headY - 0.18 * R, 0, 0.035 * R),
        'tongue',
        'mouth',
        '#c2364a',
      ),
    );
  } else if (mood === 'angry') {
    // Frown: thin dark box, plus two angled brows (role 'mouth' per spec note).
    const mouthR = 0.05 * R;
    parts.push(
      finalize(
        {
          ...cyl(headX + 0.24 * R, headY - 0.17 * R, 0, mouthR, [1, 0.5, 0.4], IDENTITY),
        },
        'mouth',
        'mouth',
        mouthColor,
      ),
    );
    // Angry brows: two thin dark boxes tilted inward (sloping down toward the centre).
    // Placed above the eyes, mirrored in z.
    const browTilt = quatFromAxisAngle([0, 0, 1], 0.35); // tilt about z
    const browTiltMirror = quatFromAxisAngle([0, 0, 1], -0.35);
    const browY = headY + 0.13 * R;
    const browX = headX + 0.2 * R;
    const browZ = 0.1 * R;
    parts.push(
      finalize(
        box(browX, browY, browZ, 0.05 * R, [0.5, 0.18, 0.18], browTilt),
        'brow-a',
        'mouth',
        mouthColor,
      ),
    );
    parts.push(
      finalize(
        box(browX, browY, -browZ, 0.05 * R, [0.5, 0.18, 0.18], browTiltMirror),
        'brow-b',
        'mouth',
        mouthColor,
      ),
    );
  } else {
    // happy: smiling mouth (a flattened dark cylinder lying along z) + 2 teeth.
    const mouthY = headY - 0.16 * R;
    const mouthX = headX + 0.24 * R;
    parts.push(
      finalize(
        cyl(mouthX, mouthY, 0, 0.04 * R, [1.1, 0.5, 0.7], IDENTITY),
        'mouth',
        'mouth',
        mouthColor,
      ),
    );
    // Two small teeth
    parts.push(
      finalize(
        box(mouthX + 0.01 * R, mouthY + 0.018 * R, 0.025 * R, 0.022 * R, [0.4, 0.4, 0.5], IDENTITY),
        'tooth-a',
        'tooth',
        '#f5f5f0',
      ),
    );
    parts.push(
      finalize(
        box(mouthX + 0.01 * R, mouthY + 0.018 * R, -0.025 * R, 0.022 * R, [0.4, 0.4, 0.5], IDENTITY),
        'tooth-b',
        'tooth',
        '#f5f5f0',
      ),
    );
  }

  // --- Ears (mirrored in z) ----------------------------------------------------
  addEars(parts, look.ears, headX, headY, R, skin);

  // --- Hat ---------------------------------------------------------------------
  addHat(parts, look.hat, headX, headY, headR, R, accent, skin);

  return parts;
}

// ---------------------------------------------------------------------------
// Ears
// ---------------------------------------------------------------------------
function addEars(
  parts: Part[],
  kind: EarKind,
  headX: number,
  headY: number,
  R: number,
  skin: string,
): void {
  // Each kind defines: position offsets from head centre, base size, scale, rotation axis & angle.
  // Mirrored in z: the second ear uses opposite z and opposite rotation handedness.
  let aPos: Vec3;
  let aSize: number;
  let aScale: Vec3;
  let aRot: Quat;
  let aShape: 'sphere' | 'box' | 'cylinder' = 'box';

  switch (kind) {
    case 'small': {
      // tiny cones/boxes close to the head
      aPos = [headX + 0.12 * R, headY + 0.2 * R, 0.28 * R];
      aSize = 0.05 * R;
      aScale = [0.5, 0.7, 0.5];
      aRot = quatFromAxisAngle([0, 0, 1], -0.2);
      aShape = 'box';
      break;
    }
    case 'big': {
      // large flat boxes/cylinders sticking out sideways
      aPos = [headX - 0.02 * R, headY + 0.05 * R, 0.42 * R];
      aSize = 0.12 * R;
      aScale = [0.4, 1.2, 0.7];
      aRot = quatFromAxisAngle([1, 0, 0], 0.0);
      aShape = 'box';
      break;
    }
    case 'floppy': {
      // long and hanging, low centre
      aPos = [headX + 0.0 * R, headY - 0.18 * R, 0.3 * R];
      aSize = 0.08 * R;
      aScale = [0.5, 1.4, 0.45];
      aRot = quatFromAxisAngle([0, 0, 1], 0.6);
      aShape = 'box';
      break;
    }
    case 'pointy': {
      // tall, tilted up/outward
      aPos = [headX + 0.05 * R, headY + 0.3 * R, 0.2 * R];
      aSize = 0.09 * R;
      aScale = [0.45, 1.3, 0.45];
      aRot = quatFromAxisAngle([0, 0, 1], -0.5);
      aShape = 'cylinder';
      break;
    }
  }

  // Build ear-a (z positive, rotation as defined).
  if (aShape === 'box') {
    parts.push(
      finalize(
        box(aPos[0], aPos[1], aPos[2], aSize, aScale, aRot),
        'ear-a',
        'ear',
        skin,
      ),
    );
  } else {
    parts.push(
      finalize(
        cyl(aPos[0], aPos[1], aPos[2], aSize, aScale, aRot),
        'ear-a',
        'ear',
        skin,
      ),
    );
  }

  // Mirror in z: negate z position and use the opposite-handed rotation (negate
  // angle on a z-axis rotation; for our purposes we just mirror via z-flip quat).
  // For the ears here every rotation is about +z, so mirroring = negating the
  // angle. The cleanest mirror is to construct the inverse (conjugate) rotation.
  const aRotMirror = conjugate(aRot);
  const bPos: Vec3 = [aPos[0], aPos[1], -aPos[2]];

  if (aShape === 'box') {
    parts.push(
      finalize(
        box(bPos[0], bPos[1], bPos[2], aSize, aScale, aRotMirror),
        'ear-b',
        'ear',
        skin,
      ),
    );
  } else {
    parts.push(
      finalize(
        cyl(bPos[0], bPos[1], bPos[2], aSize, aScale, aRotMirror),
        'ear-b',
        'ear',
        skin,
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Hats
// ---------------------------------------------------------------------------
function addHat(
  parts: Part[],
  hat: HatKind,
  headX: number,
  headY: number,
  headR: number,
  R: number,
  accent: string,
  _skin: string,
): void {
  switch (hat) {
    case 'none':
      return;
    case 'cap': {
      // Squashed dome in accent: half-sphere flattened along y, plus a brim.
      const domeY = headY + headR * 0.85;
      parts.push(
        finalize(
          {
            ...sp(headX, domeY, 0, headR * 0.95),
            scale: [1.05, 0.6, 1.05],
          },
          'hat-dome',
          'hat',
          accent,
        ),
      );
      const hatPart = parts[parts.length - 1]!;
      hatPart.roughness = 0.7;
      hatPart.metalness = 0;
      // Brim: thin flattened cylinder/disc in front (+x)
      parts.push(
        finalize(
          cyl(headX + 0.2 * R, headY + headR * 0.45, 0, headR * 0.95, [1, 0.15, 1], IDENTITY),
          'hat-brim',
          'hat',
          accent,
        ),
      );
      const brim = parts[parts.length - 1]!;
      brim.roughness = 0.7;
      brim.metalness = 0;
      break;
    }
    case 'helmet': {
      // Grey metallic dome + rim.
      const domeY = headY + headR * 0.85;
      parts.push(
        finalize(
          {
            ...sp(headX, domeY, 0, headR * 1.0),
            scale: [1.05, 0.7, 1.05],
          },
          'hat-dome',
          'hat',
          '#9aa3ad',
        ),
      );
      const dome = parts[parts.length - 1]!;
      dome.metalness = 0.9;
      dome.roughness = 0.35;
      // Rim
      parts.push(
        finalize(
          cyl(headX, headY + headR * 0.45, 0, headR * 1.05, [1, 0.18, 1], IDENTITY),
          'hat-rim',
          'hat',
          '#9aa3ad',
        ),
      );
      const rim = parts[parts.length - 1]!;
      rim.metalness = 0.9;
      rim.roughness = 0.35;
      break;
    }
    case 'crown': {
      // Gold band + 5 spikes (hat-detail)
      const bandY = headY + headR * 0.4;
      parts.push(
        finalize(
          cyl(headX, bandY, 0, headR * 1.05, [1, 0.3, 1], IDENTITY),
          'hat-band',
          'hat',
          '#ffd24a',
        ),
      );
      const band = parts[parts.length - 1]!;
      band.metalness = 0.9;
      band.roughness = 0.25;
      // 5 spikes on top, distributed around the head
      const spikeOffsets: Array<[number, number]> = [
        [0, headR * 0.95],
        [headR * 0.6, headR * 0.5],
        [-headR * 0.6, headR * 0.5],
        [headR * 0.35, -headR * 0.55],
        [-headR * 0.35, -headR * 0.55],
      ];
      spikeOffsets.forEach(([dz, dx], i) => {
        parts.push(
          finalize(
            cyl(headX + dx, bandY + 0.08 * R, dz, 0.04 * R, [0.6, 1.4, 0.6], IDENTITY),
            `hat-spike-${i}`,
            'hat-detail',
            '#ffd24a',
          ),
        );
      });
      break;
    }
    case 'bandana': {
      // Thin band around the head in accent + 2 tail boxes at the back (-x).
      const bandY = headY + headR * 0.15;
      parts.push(
        finalize(
          cyl(headX, bandY, 0, headR * 1.0, [1.02, 0.18, 1.02], IDENTITY),
          'hat-band',
          'hat',
          accent,
        ),
      );
      const band = parts[parts.length - 1]!;
      band.roughness = 0.7;
      band.metalness = 0;
      // Two tails at back (-x)
      const tailBaseX = headX - 0.45 * R;
      const tailBaseY = headY - 0.05 * R;
      parts.push(
        finalize(
          box(tailBaseX, tailBaseY, 0.1 * R, 0.18 * R, [0.7, 0.5, 0.18], quatFromAxisAngle([0, 0, 1], 0.4)),
          'hat-tail-a',
          'hat',
          accent,
        ),
      );
      parts.push(
        finalize(
          box(tailBaseX, tailBaseY, -0.1 * R, 0.18 * R, [0.7, 0.5, 0.18], quatFromAxisAngle([0, 0, 1], -0.4)),
          'hat-tail-b',
          'hat',
          accent,
        ),
      );
      const t1 = parts[parts.length - 2]!;
      const t2 = parts[parts.length - 1]!;
      t1.roughness = 0.7;
      t2.roughness = 0.7;
      break;
    }
    case 'horns': {
      // 2 mirrored 'hat' parts, bone colour.
      const hornR = 0.06 * R;
      const hornY = headY + headR * 0.7;
      const hornZ = headR * 0.45;
      parts.push(
        finalize(
          cyl(headX, hornY, hornZ, hornR, [0.55, 1.4, 0.55], quatFromAxisAngle([1, 0, 0], 0.4)),
          'hat-horn-a',
          'hat',
          '#efe6d2',
        ),
      );
      parts.push(
        finalize(
          cyl(headX, hornY, -hornZ, hornR, [0.55, 1.4, 0.55], quatFromAxisAngle([1, 0, 0], -0.4)),
          'hat-horn-b',
          'hat',
          '#efe6d2',
        ),
      );
      const h1 = parts[parts.length - 2]!;
      const h2 = parts[parts.length - 1]!;
      h1.roughness = 0.6;
      h2.roughness = 0.6;
      break;
    }
    case 'leaf': {
      // Big green leaf: 2 flattened spheres.
      const leafY = headY + headR * 0.7;
      parts.push(
        finalize(
          {
            ...sp(headX, leafY, 0, headR * 0.8),
            scale: [1.3, 0.2, 1.0],
          },
          'hat-leaf-bottom',
          'hat',
          '#3f9d4a',
        ),
      );
      parts.push(
        finalize(
          {
            ...sp(headX, leafY + 0.04 * R, 0, headR * 0.7),
            scale: [1.1, 0.18, 0.85],
          },
          'hat-leaf-top',
          'hat',
          '#3f9d4a',
        ),
      );
      const l1 = parts[parts.length - 2]!;
      const l2 = parts[parts.length - 1]!;
      l1.roughness = 0.6;
      l2.roughness = 0.6;
      break;
    }
    case 'pot': {
      // Upside-down grey cooking pot (cylinder, metalness 0.7) + handle detail.
      const potY = headY + headR * 0.55;
      parts.push(
        finalize(
          cyl(headX, potY, 0, headR * 0.9, [0.9, 0.9, 0.9], IDENTITY),
          'hat-pot',
          'hat',
          '#7a7a7a',
        ),
      );
      const pot = parts[parts.length - 1]!;
      pot.metalness = 0.7;
      pot.roughness = 0.45;
      // A handle (small cylinder arch) on top, in skin/accent? Use accent to vary.
      parts.push(
        finalize(
          cyl(headX, potY + 0.22 * R, 0, 0.04 * R, [0.5, 0.5, 0.5], quatFromAxisAngle([0, 0, 1], Math.PI / 2)),
          'hat-pot-handle',
          'hat-detail',
          '#5a5a5a',
        ),
      );
      const handle = parts[parts.length - 1]!;
      handle.metalness = 0.7;
      handle.roughness = 0.4;
      break;
    }
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Conjugate of a unit quaternion (the inverse for unit quats). */
function conjugate(q: Quat): Quat {
  return [-q[0], -q[1], -q[2], q[3]];
}

/** Darken a #rrggbb colour by `amount` in [0, 1] (toward black). */
function darken(hex: string, amount: number): string {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!m) return hex;
  const r = parseInt(m[1]!, 16);
  const g = parseInt(m[2]!, 16);
  const b = parseInt(m[3]!, 16);
  const dr = Math.max(0, Math.round(r * (1 - amount)));
  const dg = Math.max(0, Math.round(g * (1 - amount)));
  const db = Math.max(0, Math.round(b * (1 - amount)));
  return (
    '#' +
    dr.toString(16).padStart(2, '0') +
    dg.toString(16).padStart(2, '0') +
    db.toString(16).padStart(2, '0')
  );
}


