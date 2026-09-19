/**
 * TICKET-08 — Section 2 art. Everything the waterfall cliff needs is built ONCE per course
 * and then only drawn, exactly like `world-art.ts` does for the Stage 1 backdrop: no
 * per-frame canvas construction, no filters, no atlas rebaking driven by the camera.
 *
 * Three sources feed this module:
 *  - the predecessor game's painted props in `public/art/track-parts/` (bumpers, spring,
 *    crate, skull box, boost rings, surface strips), reused directly as alpha sprites;
 *  - procedurally painted rock outcrops, deck bands and the cliff/chasm sheets, which the
 *    reference pack has no equivalent for;
 *  - the 5-tier environmental depth stack: skybox (0.00-0.05x) → far canyon (0.15x) →
 *    midground trees and chutes (0.38-0.48x) → race wall and scaffolding (0.94-0.98x) →
 *    the track plane itself → foreground spray (1.20x).
 */
import type { GameAssets } from './assets';
import type { CourseId } from './types';
import { TRACKS } from './courses';

const TAU = Math.PI * 2;

export interface StageTwoArt {
  /** Painted props cut from the reference pack. */
  props: {
    crown: HTMLImageElement;
    spiked: HTMLImageElement;
    spring: HTMLImageElement;
    crate: HTMLImageElement;
    skull: HTMLImageElement;
    ringSpiked: HTMLImageElement;
    ringSteel: HTMLImageElement;
    ringCrown: HTMLImageElement;
  };
  /** Procedural mossy granite boulders, small → large. */
  rocks: HTMLCanvasElement[];
  /** One pre-tiled deck band per Section 2 surface, ready for a single quad per tile. */
  deck: Record<'wood' | 'moss' | 'metal' | 'hazard', HTMLCanvasElement>;
  /** Animated sheets, scrolled by source offset rather than re-rasterised. */
  water: { sheet: HTMLCanvasElement; foam: HTMLCanvasElement; mist: HTMLCanvasElement; cliff: HTMLCanvasElement };
  /** Multi-tier goblin scaffolding cladding the near cliff wall. */
  scaffolding: HTMLCanvasElement;
  /** Chasm depth bands painted behind the track. */
  chasm: HTMLCanvasElement;
}

const canvas = (width: number, height: number) => {
  const image = document.createElement('canvas');
  image.width = width; image.height = height;
  return { image, context: image.getContext('2d')! };
};

const hash = (n: number) => { const v = Math.sin(n * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };
function rng(seed: number) {
  let t = seed >>> 0;
  return () => { t = (t + 0x6d2b79f5) >>> 0; let r = Math.imul(t ^ (t >>> 15), 1 | t); r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r; return ((r ^ (r >>> 14)) >>> 0) / 4294967296; };
}

/**
 * Deck band for one Section 2 surface: the reference strip tiled into planks laid across
 * the road, damped with sheen, standing water, lichen and lane seams. The canvas covers
 * 1024 x 960 world units at 0.5 px/unit so a deck tile only needs a cheap source crop.
 */
function deckBand(strip: HTMLImageElement, surface: keyof StageTwoArt['deck'], course: CourseId) {
  const { image, context: c } = canvas(512, 480);
  const palette = TRACKS[course].palette;
  c.fillStyle = surface === 'metal' ? '#26302e' : '#33240f';
  c.fillRect(0, 0, 512, 480);
  // Planks: 128 x 192 world units each (64 x 96 px), mirrored alternately.
  const cell = { width: 64, height: 96 };
  for (let row = 0; row < 5; row++) for (let col = 0; col < 8; col++) {
    const x = col * cell.width; const y = row * cell.height;
    c.save();
    if ((row + col) % 2) { c.translate(x + cell.width, y); c.scale(-1, 1); c.drawImage(strip, 0, 0, cell.width, cell.height); }
    else c.drawImage(strip, x, y, cell.width, cell.height);
    c.restore();
  }
  // Wet veneer: a dark soak plus a cool sheen, so the surface reads as wet in every biome.
  const soak = c.createLinearGradient(0, 0, 0, 480);
  soak.addColorStop(0, '#0c1a1f9e'); soak.addColorStop(0.5, '#12303988'); soak.addColorStop(1, '#0c1a1fb0');
  c.fillStyle = soak; c.fillRect(0, 0, 512, 480);
  for (let i = 0; i < 220; i++) {
    const y = hash(i * 3.1) * 480;
    const x = hash(i * 7.7) * 512;
    const length = 18 + hash(i * 5.3) * 90;
    const gradient = c.createLinearGradient(x, 0, x + length, 0);
    const alpha = surface === 'metal' ? '3a' : '2c';
    gradient.addColorStop(0, '#dfefff00'); gradient.addColorStop(0.5, `#dfefff${alpha}`); gradient.addColorStop(1, '#dfefff00');
    c.fillStyle = gradient; c.fillRect(x, y, length, 1.1);
  }
  for (let i = 0; i < 40; i++) {
    const x = hash(i * 11.3) * 512; const y = hash(i * 13.7) * 480;
    const rx = 6 + hash(i * 17.1) * 26; const ry = 2 + hash(i * 19.3) * 7;
    c.fillStyle = surface === 'metal' ? '#9fc7d836' : '#8fb8c83a';
    c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, TAU); c.fill();
    c.strokeStyle = '#e8f6ff2a'; c.lineWidth = 1; c.stroke();
  }
  if (surface === 'moss') for (let i = 0; i < 260; i++) {
    c.fillStyle = i % 3 ? '#4f7433c9' : '#6d9445aa';
    c.beginPath(); c.ellipse(hash(i * 23.1) * 512, hash(i * 29.7) * 480, 3 + hash(i * 31.3) * 9, 2 + hash(i * 37.9) * 5, 0, 0, TAU); c.fill();
  }
  if (surface === 'hazard') for (let i = 0; i < 12; i++) {
    c.fillStyle = i % 2 ? '#e0ba4e2e' : '#2a231866';
    c.save(); c.translate(0, i * 40); c.transform(1, 0, -0.4, 1, 0, 0);
    c.fillRect(0, 0, 620, 20); c.restore();
  }
  // Lane seams: three dark grooves plus a chalk highlight, so four lanes stay readable.
  for (let lane = 1; lane < 4; lane++) {
    const y = lane * 120;
    c.fillStyle = '#120c0673'; c.fillRect(0, y - 2, 512, 4);
    c.fillStyle = `${palette.chalk}30`; c.fillRect(0, y - 1, 512, 1);
  }
  return image;
}

/** Mossy granite boulder, painted with the same light direction as the world meshes. */
function boulder(radius: number, seed: number) {
  const size = radius * 2 + 24;
  const { image, context: c } = canvas(size, size);
  const random = rng(seed);
  const cx = size / 2; const cy = size / 2 + radius * 0.24;
  const points: [number, number][] = [];
  const steps = 18;
  for (let i = 0; i < steps; i++) {
    const angle = i / steps * TAU;
    const wobble = 0.78 + random() * 0.4;
    const jag = i % 2 ? 1 : 0.9;
    points.push([cx + Math.cos(angle) * radius * wobble * jag, cy + Math.sin(angle) * radius * wobble * jag * 0.86]);
  }
  const path = () => {
    c.beginPath();
    c.moveTo(points[0][0], points[0][1]);
    for (let i = 1; i < points.length; i++) {
      const [px, py] = points[i]; const [qx, qy] = points[(i + 1) % points.length];
      c.quadraticCurveTo(px, py, (px + qx) / 2, (py + qy) / 2);
    }
    c.closePath();
  };
  path();
  const rock = c.createLinearGradient(cx - radius, cy - radius, cx + radius, cy + radius);
  rock.addColorStop(0, '#8d8b80'); rock.addColorStop(0.4, '#6b6a62'); rock.addColorStop(0.75, '#4a4a44'); rock.addColorStop(1, '#2f302c');
  c.fillStyle = rock; c.fill();
  c.save(); c.clip();
  for (let i = 0; i < 26; i++) {
    c.strokeStyle = i % 2 ? '#2b2b2666' : '#a7a49a44'; c.lineWidth = 1 + hash(i * 3.7) * 2.4;
    c.beginPath();
    const y0 = hash(i * 5.1) * size;
    c.moveTo(0, y0);
    c.bezierCurveTo(cx * 0.5, y0 + random() * 20 - 10, cx * 1.4, y0 + random() * 24 - 12, size, y0 + random() * 18 - 9);
    c.stroke();
  }
  // Green moss on the shaded shoulders, where a boulder stays damp.
  for (let i = 0; i < 40; i++) {
    const x = hash(i * 9.3) * size; const y = hash(i * 11.9) * size * 0.72;
    c.fillStyle = i % 3 ? '#48662f6e' : '#5f8639a6';
    c.beginPath(); c.ellipse(x, y, 6 + hash(i * 13.1) * 16, 4 + hash(i * 15.7) * 9, hash(i) * 3, 0, TAU); c.fill();
  }
  c.restore();
  path();
  c.strokeStyle = '#20211fdd'; c.lineWidth = 2.4; c.stroke();
  // Lit top-left rim, matching LIGHT in geometry.ts.
  path();
  c.save(); c.clip();
  c.strokeStyle = '#c9c6b926'; c.lineWidth = 7;
  c.beginPath(); c.arc(cx, cy, radius * 0.9, Math.PI * 1.05, Math.PI * 1.85); c.stroke();
  c.restore();
  return image;
}

/** The great waterfall: vertical sheets of pour with foam lanes and airborne streaks. */
function waterfallSheet() {
  const { image, context: c } = canvas(512, 1536);
  const base = c.createLinearGradient(0, 0, 0, 1536);
  base.addColorStop(0, '#cfe4ec');
  base.addColorStop(0.35, '#9dc0cf');
  base.addColorStop(0.8, '#6f93a6');
  base.addColorStop(1, '#4d6d80');
  c.fillStyle = base; c.fillRect(0, 0, 512, 1536);
  for (let i = 0; i < 190; i++) {
    const x = hash(i * 3.3) * 512;
    const width = 2 + hash(i * 5.9) * 22;
    const alpha = 0.1 + hash(i * 7.1) * 0.5;
    const gradient = c.createLinearGradient(0, 0, 0, 1536);
    gradient.addColorStop(0, `#ffffff${Math.round(alpha * 160).toString(16).padStart(2, '0')}`);
    gradient.addColorStop(0.55, `#ffffff${Math.round(alpha * 120).toString(16).padStart(2, '0')}`);
    gradient.addColorStop(1, `#dff3ffff`);
    c.fillStyle = gradient;
    c.fillRect(x, 0, width, 1536);
  }
  // Spray kicked sideways off the chute lips.
  for (let i = 0; i < 260; i++) {
    c.fillStyle = `#ffffff${Math.round(0.06 * 255).toString(16).padStart(2, '0')}`;
    c.beginPath(); c.ellipse(hash(i * 11.1) * 512, hash(i * 13.7) * 1536, 8 + hash(i * 17.3) * 30, 3 + hash(i * 19.1) * 12, 0, 0, TAU); c.fill();
  }
  return image;
}

/** Foaming whitewater band that rides the base of the falls. */
function foamSheet() {
  const { image, context: c } = canvas(512, 256);
  c.clearRect(0, 0, 512, 256);
  for (let i = 0; i < 420; i++) {
    const x = hash(i * 3.7) * 512; const y = hash(i * 5.3) * 256;
    const radius = 4 + hash(i * 7.9) * 26;
    const alpha = 0.1 + hash(i * 11.3) * 0.4;
    c.fillStyle = `#f4fbff${Math.round(alpha * 255).toString(16).padStart(2, '0')}`;
    c.beginPath(); c.ellipse(x, y, radius, radius * (0.5 + hash(i * 13.1) * 0.5), 0, 0, TAU); c.fill();
  }
  for (let i = 0; i < 60; i++) {
    c.strokeStyle = `#ffffff${Math.round((0.08 + hash(i * 17.5) * 0.2) * 255).toString(16).padStart(2, '0')}`;
    c.lineWidth = 1 + hash(i * 19.7) * 3;
    const y = hash(i * 23.1) * 256;
    c.beginPath(); c.moveTo(hash(i * 29.3) * 512, y); c.lineTo(hash(i * 31.7) * 512, y + 3); c.stroke();
  }
  return image;
}

/** Rising chasm mist: soft puffs the foreground spray is spawned from. */
function mistSheet() {
  const { image, context: c } = canvas(1024, 256);
  c.clearRect(0, 0, 1024, 256);
  for (let i = 0; i < 150; i++) {
    const x = hash(i * 3.1) * 1024; const y = hash(i * 5.7) * 256;
    const radius = 40 + hash(i * 7.3) * 130;
    const gradient = c.createRadialGradient(x, y, 1, x, y, radius);
    const alpha = 0.05 + hash(i * 11.9) * 0.13;
    gradient.addColorStop(0, `#eaf5fa${Math.round(alpha * 255).toString(16).padStart(2, '0')}`);
    gradient.addColorStop(1, '#eaf5fa00');
    c.fillStyle = gradient; c.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  }
  return image;
}

/** Wet granite cliff face for the gorge walls and the launch lip. */
function cliffSheet(course: CourseId) {
  const { image, context: c } = canvas(512, 512);
  const palette = TRACKS[course].palette;
  const rock = c.createLinearGradient(0, 0, 0, 512);
  rock.addColorStop(0, '#7d7a6f'); rock.addColorStop(0.35, '#5d5b53'); rock.addColorStop(1, '#2b2d29');
  c.fillStyle = rock; c.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 150; i++) {
    c.strokeStyle = i % 2 ? '#23242055' : '#b3ada066';
    c.lineWidth = 1 + hash(i * 3.9) * 5;
    const x = hash(i * 7.1) * 512;
    c.beginPath(); c.moveTo(x, 0);
    c.bezierCurveTo(x + hash(i * 11.3) * 40 - 20, 170, x + hash(i * 13.7) * 40 - 20, 340, x + hash(i * 17.9) * 60 - 30, 512);
    c.stroke();
  }
  for (let i = 0; i < 90; i++) {
    c.fillStyle = i % 3 ? '#3d5a2f78' : '#54763a88';
    c.beginPath(); c.ellipse(hash(i * 19.1) * 512, hash(i * 23.3) * 512, 8 + hash(i * 27.7) * 30, 5 + hash(i * 29.9) * 16, 0, 0, TAU); c.fill();
  }
  const damp = c.createLinearGradient(0, 0, 0, 512);
  damp.addColorStop(0, `${palette.middle}00`); damp.addColorStop(1, `${palette.foreground}cc`);
  c.fillStyle = damp; c.fillRect(0, 0, 512, 512);
  return image;
}

/**
 * Cliffside goblin scaffolding: three rickety tiers of timber, rope rails, banners and
 * lanterns, with a crowd of cheering silhouettes. Painted once and tiled along the wall.
 */
function scaffolding(course: CourseId) {
  const { image, context: c } = canvas(512, 460);
  const palette = TRACKS[course].palette;
  const timber = '#4a2f1b'; const timberLit = '#7a5230'; const rope = '#b7a378';
  c.clearRect(0, 0, 512, 460);
  for (let tier = 0; tier < 3; tier++) {
    const y = 120 + tier * 112;
    // Deck beams.
    c.fillStyle = timber; c.fillRect(0, y, 512, 13);
    c.fillStyle = timberLit; c.fillRect(0, y, 512, 3);
    for (let x = 0; x < 512; x += 32) {
      c.fillStyle = x % 64 ? '#3a2514' : '#55361c';
      c.fillRect(x + 6, y + 13, 4, 9);
    }
    // Rope rails and posts.
    c.strokeStyle = rope; c.lineWidth = 2.4;
    c.beginPath(); c.moveTo(0, y - 33);
    for (let x = 0; x <= 512; x += 64) c.quadraticCurveTo(x + 32, y - 24, x + 64, y - 33);
    c.stroke();
    c.strokeStyle = '#6b4a24'; c.lineWidth = 1.2;
    for (let x = 0; x <= 512; x += 64) { c.beginPath(); c.moveTo(x, y); c.lineTo(x, y - 40); c.stroke(); }
    // Diagonal braces back to the cliff.
    c.strokeStyle = '#3b2716'; c.lineWidth = 5;
    for (let x = 0; x <= 512; x += 128) { c.beginPath(); c.moveTo(x, y + 12); c.lineTo(x + 74, y + 74); c.stroke(); }
    // Crowd: chunky goblin silhouettes with banners and raised arms.
    const random = rng(0x51a7 + tier * 977);
    for (let i = 0; i < 14; i++) {
      const x = 8 + i * 36 + random() * 9;
      const height = 30 + random() * 14;
      const shade = random() < 0.5 ? '#2f3a25' : '#3d4a2c';
      c.fillStyle = shade;
      c.beginPath(); c.ellipse(x, y - height - 6, 7, 8, 0, 0, TAU); c.fill();
      c.fillRect(x - 6, y - height - 3, 12, height);
      c.fillStyle = palette.accent;
      c.fillRect(x - 6, y - height - 3, 12, 4);
      if (i % 4 === 1) {
        // Clan banner.
        c.fillStyle = i % 8 === 1 ? '#8d2f24' : '#2f5a3a';
        c.beginPath(); c.moveTo(x + 10, y - height - 42); c.lineTo(x + 30, y - height - 36); c.lineTo(x + 10, y - height - 14); c.fill();
        c.strokeStyle = '#2b2114'; c.lineWidth = 1.6;
        c.beginPath(); c.moveTo(x + 10, y - height - 44); c.lineTo(x + 10, y - height + 6); c.stroke();
      } else if (i % 4 === 3) {
        // Raised torch; the flame is drawn live so it flickers.
        c.strokeStyle = '#3a2a18'; c.lineWidth = 2.4;
        c.beginPath(); c.moveTo(x + 7, y - height - 2); c.lineTo(x + 17, y - height - 20); c.stroke();
        c.fillStyle = '#ffb765'; c.beginPath(); c.ellipse(x + 18, y - height - 24, 3.6, 6.4, 0, 0, TAU); c.fill();
      }
    }
  }
  // Lanterns hanging off the top rail.
  for (let x = 40; x < 512; x += 128) {
    c.strokeStyle = '#2b2114'; c.lineWidth = 1.6;
    c.beginPath(); c.moveTo(x, 30); c.lineTo(x, 62); c.stroke();
    c.fillStyle = '#2b2a20'; c.fillRect(x - 7, 58, 15, 20);
    c.fillStyle = '#ffc98a'; c.fillRect(x - 5, 61, 11, 13);
    c.strokeStyle = '#0f0f0a'; c.lineWidth = 1.4; c.strokeRect(x - 7, 58, 15, 20);
  }
  return image;
}

let cached: { key: string; art: StageTwoArt } | null = null;

export function buildStageTwoArt(assets: GameAssets, course: CourseId): StageTwoArt {
  const key = `${course}:${assets.dirtArt.url}`;
  if (cached?.key === key) return cached.art;
  const props = assets.trackParts;
  const art: StageTwoArt = {
    props: {
      crown: props.bumperCrown, spiked: props.bumperSpiked, spring: props.spring,
      crate: props.crate, skull: props.skull, ringSpiked: props.ringSpiked,
      ringSteel: props.ringSteel, ringCrown: props.ringCrown,
    },
    rocks: [boulder(62, 0x5eed01), boulder(86, 0x5eed02), boulder(116, 0x5eed03)],
    deck: {
      wood: deckBand(props.stripWood, 'wood', course),
      moss: deckBand(props.stripMoss, 'moss', course),
      metal: deckBand(props.stripMetal, 'metal', course),
      hazard: deckBand(props.stripHazard, 'hazard', course),
    },
    water: { sheet: waterfallSheet(), foam: foamSheet(), mist: mistSheet(), cliff: cliffSheet(course) },
    scaffolding: scaffolding(course),
    chasm: cliffSheet(course),
  };
  cached = { key, art };
  return art;
}
