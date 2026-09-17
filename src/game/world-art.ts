import type { GameAssets } from './assets';
import { TRACKS, type CourseDefinition } from './courses';
import type { CourseId } from './types';

export interface CourseArt {
  sky: HTMLCanvasElement;
  dirt: HTMLCanvasElement;
  bank: HTMLCanvasElement;
  blimp: HTMLCanvasElement;
  landmarks: HTMLCanvasElement[];
}
const cache = new Map<CourseId, CourseArt>();
const canvas = (width: number, height: number) => {
  const image = document.createElement('canvas'); image.width = width; image.height = height;
  return { image, context: image.getContext('2d')! };
};
const noise = (n: number) => { const v = Math.sin(n * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };

function dirtMaterial(track: CourseDefinition) {
  const { image, context: c } = canvas(512, 512);
  const p = track.palette;
  c.fillStyle = p.dirt; c.fillRect(0, 0, 512, 512);
  // Broad wrapped value patches create earth without repeating high-frequency planks.
  for (let i = 0; i < 26; i++) {
    const x = noise(i + 3) * 512; const y = noise(i + 61) * 512;
    c.fillStyle = i % 2 ? `${p.dirtLight}24` : `${p.bank}0d`;
    for (const shift of [-512, 0, 512]) {
      c.beginPath(); c.ellipse(x + shift, y, 35 + noise(i + 90) * 94, 16 + noise(i + 39) * 29, 0, 0, Math.PI * 2); c.fill();
    }
  }
  for (let lane = 0; lane < 4; lane++) {
    for (const offset of [43, 85]) {
      const y = lane * 128 + offset;
      const rut = c.createLinearGradient(0, y - 5, 0, y + 5);
      rut.addColorStop(0, `${p.bank}00`); rut.addColorStop(0.5, `${p.bank}20`); rut.addColorStop(1, `${p.bank}00`);
      c.fillStyle = rut; c.fillRect(0, y - 5, 512, 10);
    }
  }
  c.fillStyle = `${p.bank}29`;
  for (let i = 0; i < 120; i++) {
    const y = noise(i + 580) * 512;
    if (y > 28 && y < 484 && i % 4) continue;
    c.beginPath(); c.ellipse(noise(i + 450) * 512, y, 0.9 + noise(i + 730) * 1.5, 0.7, 0, 0, Math.PI * 2); c.fill();
  }
  for (const y of [0, 506]) { c.fillStyle = `${p.bank}40`; c.fillRect(0, y, 512, 6); }
  for (const y of [128, 256, 384]) {
    c.strokeStyle = `${p.chalk}9c`; c.lineWidth = 2.5; c.setLineDash([66, 62]);
    c.beginPath(); c.moveTo(0, y); c.lineTo(512, y); c.stroke();
  }
  c.setLineDash([]);
  return image;
}

function bankMaterial(track: CourseDefinition) {
  const { image, context: c } = canvas(512, 128);
  const p = track.palette;
  const shade = c.createLinearGradient(0, 0, 0, 128);
  shade.addColorStop(0, p.dirt); shade.addColorStop(0.14, p.bank); shade.addColorStop(1, '#15231b');
  c.fillStyle = shade; c.fillRect(0, 0, 512, 128);
  for (let i = 0; i < 7; i++) {
    c.fillStyle = i % 2 ? '#d8c6a40a' : '#171c170c';
    c.beginPath(); c.moveTo(0, 18 + i * 15);
    c.bezierCurveTo(160, 16 + i * 15, 300, 23 + i * 15, 512, 18 + i * 15);
    c.lineTo(512, 23 + i * 15); c.lineTo(0, 22 + i * 15); c.fill();
  }
  c.fillStyle = `${p.chalk}15`; c.fillRect(0, 0, 512, 2);
  return image;
}

function forestTree(c: CanvasRenderingContext2D, x: number, y: number, height: number, color: string) {
  c.fillStyle = color;
  c.fillRect(x - height * 0.015, y - height * 0.15, height * 0.03, height * 0.18);
  for (let i = 0; i < 4; i++) {
    const top = y - height + i * height * 0.15;
    const width = height * (0.16 + i * 0.041);
    c.beginPath(); c.moveTo(x, top); c.lineTo(x - width, top + height * 0.43); c.lineTo(x + width * 0.95, top + height * 0.43); c.fill();
  }
}

function background(track: CourseDefinition, assets: GameAssets) {
  const { image, context: c } = canvas(1792, 768);
  const p = track.palette;
  const sky = c.createLinearGradient(0, 0, 0, 650);
  sky.addColorStop(0, p.sky); sky.addColorStop(0.63, p.horizon); sky.addColorStop(1, p.middle);
  c.fillStyle = sky; c.fillRect(0, 0, 1792, 768);
  if (track.biome === 'forest') {
    c.globalAlpha = 0.65; c.drawImage(assets.mountains.image, 0, 0, 1792, 768); c.globalAlpha = 1;
    c.fillStyle = `${p.horizon}19`; c.fillRect(0, 0, 1792, 768);
  } else {
    const sun = c.createRadialGradient(1280, 140, 8, 1280, 140, 205);
    sun.addColorStop(0, '#f4ddb25e'); sun.addColorStop(1, '#f4ddb200');
    c.fillStyle = sun; c.fillRect(1060, 0, 440, 365);
    for (let layer = 0; layer < 3; layer++) {
      c.fillStyle = [p.distant, p.middle, p.foreground][layer];
      if (track.biome === 'canyon') {
        const y = 410 + layer * 109;
        c.beginPath(); c.moveTo(-60, 800);
        for (let x = -80, i = 0; x < 1850; x += 200, i++) {
          const top = y - 90 - noise(i + layer * 23) * (160 - layer * 20);
          c.lineTo(x, y); c.lineTo(x + 36, top + 35); c.lineTo(x + 65, top);
          c.lineTo(x + 144, top + 9); c.lineTo(x + 183, y + 20);
        }
        c.lineTo(1860, 800); c.fill();
        c.strokeStyle = `${p.horizon}12`; c.lineWidth = 8;
        for (let x = 70; x < 1792; x += 200) {
          c.beginPath(); c.moveTo(x, y - 36); c.lineTo(x + 72, y - 31); c.stroke();
        }
      } else {
        const y = 370 + layer * 110;
        c.beginPath(); c.moveTo(-20, 800); c.lineTo(-20, y);
        for (let x = -20; x < 1800; x += 340) c.bezierCurveTo(x + 100, y - 125 - layer * 7, x + 235, y - 92, x + 340, y + 10);
        c.lineTo(1830, 800); c.fill();
        if (layer > 0) for (let x = 80; x < 1792; x += 230) forestTree(c, x, y - 23, 30 + noise(x) * 30, [p.distant, p.middle, p.foreground][layer]);
      }
    }
  }
  if (track.biome === 'forest') for (let i = 0; i < 20; i++) forestTree(c, i * 97 - 35, 710, 88 + noise(i + 6) * 115, p.foreground);
  const mist = c.createLinearGradient(0, 440, 0, 768);
  mist.addColorStop(0, `${p.haze}00`); mist.addColorStop(0.68, `${p.haze}30`); mist.addColorStop(1, `${p.foreground}9e`);
  c.fillStyle = mist; c.fillRect(0, 440, 1792, 328);
  return image;
}

function blimpArt(track: CourseDefinition) {
  const { image, context: c } = canvas(520, 270);
  const p = track.palette;
  c.fillStyle = '#263528'; c.strokeStyle = '#1b2b23'; c.lineWidth = 4;
  c.beginPath(); c.moveTo(101, 76); c.lineTo(41, 31); c.lineTo(66, 101); c.lineTo(16, 122); c.lineTo(92, 131); c.fill(); c.stroke();
  const envelope = c.createLinearGradient(0, 40, 0, 175);
  envelope.addColorStop(0, '#e2c698'); envelope.addColorStop(0.36, p.accent); envelope.addColorStop(1, '#73563b');
  c.fillStyle = envelope;
  c.beginPath(); c.ellipse(271, 105, 193, 76, -0.025, 0, Math.PI * 2); c.fill(); c.stroke();
  c.save(); c.beginPath(); c.ellipse(271, 105, 190, 72, -0.025, 0, Math.PI * 2); c.clip();
  c.fillStyle = `${p.sky}a8`; c.fillRect(105, 88, 357, 32);
  for (const x of [159, 238, 323, 398]) {
    c.strokeStyle = '#d4b78580'; c.lineWidth = 4;
    c.beginPath(); c.ellipse(x, 105, 24, 91, 0, 0, Math.PI * 2); c.stroke();
  }
  c.strokeStyle = '#463e2aa6'; c.lineWidth = 3;
  for (const x of [124, 425]) { c.beginPath(); c.ellipse(x, 105, 16, 88, 0, 0, Math.PI * 2); c.stroke(); }
  c.restore();
  c.strokeStyle = '#4c4935'; c.lineWidth = 3;
  for (const x of [194, 351]) { c.beginPath(); c.moveTo(x, 170); c.lineTo(x + (x < 250 ? 28 : -21), 215); c.stroke(); }
  c.fillStyle = '#403e2e'; c.beginPath(); c.moveTo(196, 211); c.lineTo(358, 205); c.lineTo(333, 242); c.lineTo(226, 245); c.closePath(); c.fill(); c.stroke();
  c.fillStyle = p.accent; c.fillRect(232, 200, 54, 20); c.fillStyle = '#496c59'; c.fillRect(239, 203, 18, 13); c.fillRect(263, 203, 17, 13);
  c.strokeStyle = '#cdb67a'; c.lineWidth = 3; c.beginPath(); c.moveTo(201, 215); c.lineTo(351, 209); c.stroke();
  c.fillStyle = '#2b3c30'; c.fillRect(364, 211, 35, 9);
  c.strokeStyle = '#6e795b'; c.lineWidth = 4; c.beginPath(); c.moveTo(400, 197); c.lineTo(400, 234); c.moveTo(385, 215); c.lineTo(416, 215); c.stroke();
  c.fillStyle = '#bf9a5c'; c.beginPath(); c.arc(271, 105, 17, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#354736'; c.beginPath(); c.moveTo(260, 96); c.lineTo(271, 112); c.lineTo(284, 94); c.lineTo(279, 120); c.lineTo(263, 120); c.closePath(); c.fill();
  return image;
}

function landmark(track: CourseDefinition, variation: number) {
  const { image, context: c } = canvas(270, 330);
  const p = track.palette;
  if (track.biome === 'forest') {
    forestTree(c, 144, 305, variation ? 239 : 285, p.foreground);
    forestTree(c, 123, 297, variation ? 216 : 252, '#496b48');
    c.fillStyle = '#8a815053'; c.beginPath(); c.ellipse(137, 309, 62, 8, 0, 0, Math.PI * 2); c.fill();
  } else if (track.biome === 'canyon') {
    if (!variation) {
      c.fillStyle = '#504231'; c.beginPath(); c.moveTo(74, 306); c.lineTo(101, 84); c.lineTo(161, 64); c.lineTo(188, 310); c.fill();
      c.fillStyle = '#9b724e'; c.beginPath(); c.moveTo(100, 293); c.lineTo(114, 84); c.lineTo(145, 72); c.lineTo(160, 298); c.fill();
      c.strokeStyle = '#ba8a5b5c'; c.lineWidth = 8; for (let y = 131; y < 290; y += 43) { c.beginPath(); c.moveTo(99, y); c.lineTo(170, y + 3); c.stroke(); }
    } else {
      c.fillStyle = '#373f30'; c.fillRect(83, 92, 50, 221); c.fillRect(153, 139, 35, 174);
      c.fillStyle = '#7e7851'; c.fillRect(80, 88, 57, 12); c.fillRect(149, 136, 42, 10);
      c.fillStyle = '#56604643'; for (let i = 0; i < 4; i++) { c.beginPath(); c.ellipse(105 + i * 13, 71 - i * 16, 23 + i * 4, 15 + i * 3, 0, 0, Math.PI * 2); c.fill(); }
    }
  } else {
    c.fillStyle = '#484b2f'; c.beginPath(); c.moveTo(111, 310); c.lineTo(123, 109); c.lineTo(159, 110); c.lineTo(174, 310); c.fill();
    c.fillStyle = '#ac9d6b'; c.beginPath(); c.moveTo(130, 304); c.lineTo(137, 113); c.lineTo(153, 115); c.lineTo(158, 304); c.fill();
    c.strokeStyle = '#524f34'; c.lineWidth = 5;
    c.save(); c.translate(140, 119); c.rotate(variation ? 0.38 : 0.2);
    for (let i = 0; i < 4; i++) { c.rotate(Math.PI / 2); c.beginPath(); c.moveTo(0, 0); c.lineTo(0, -91); c.stroke(); c.fillStyle = '#d5c79e'; c.beginPath(); c.moveTo(5, -26); c.lineTo(5, -92); c.lineTo(27, -88); c.lineTo(22, -29); c.closePath(); c.fill(); }
    c.restore(); c.fillStyle = '#cfb47a'; c.beginPath(); c.arc(140, 119, 8, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#8f8b5380'; c.beginPath(); c.ellipse(138, 313, 57, 7, 0, 0, Math.PI * 2); c.fill();
  }
  return image;
}

export function buildCourseArt(id: CourseId, assets: GameAssets): CourseArt {
  const existing = cache.get(id); if (existing) return existing;
  const track = TRACKS[id];
  const art = { sky: background(track, assets), dirt: dirtMaterial(track), bank: bankMaterial(track),
    blimp: blimpArt(track), landmarks: [landmark(track, 0), landmark(track, 1)] };
  cache.set(id, art); return art;
}

const previews = new Map<CourseId, string>();
export function coursePreview(id: CourseId) {
  if (previews.has(id)) return previews.get(id)!;
  const track = TRACKS[id]; const p = track.palette;
  const land = track.biome === 'canyon'
    ? `<path d="M0 130 20 63 75 57 91 106 132 116 161 40 209 42 228 130 282 134 315 62 367 69 400 143v77H0Z" fill="${p.middle}"/><path d="M0 153 27 95 68 89 90 162 189 165 236 88 271 87 293 161 351 169 377 113 400 145v75H0Z" fill="${p.foreground}"/>`
    : `<path d="M0 150Q53 38 128 104T271 100T400 113v107H0Z" fill="${p.distant}"/><path d="M0 169Q88 92 160 144T300 133T400 158v62H0Z" fill="${p.middle}"/>${track.biome === 'forest' ? `<path d="m24 139 26-83 28 83H62l27 39H12l28-39Zm271-21 23-82 31 82h-17l24 38h-70l23-38Z" fill="${p.foreground}"/>` : ''}`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="220" viewBox="0 0 400 220"><defs><linearGradient id="s" x2="0" y2="1"><stop stop-color="${p.sky}"/><stop offset="1" stop-color="${p.horizon}"/></linearGradient></defs><path fill="url(#s)" d="M0 0h400v220H0Z"/>${land}<path d="M0 201Q140 125 241 161T400 133v87H0Z" fill="${p.soil}"/><path d="M85 220Q141 158 281 151T400 137v19q-183 25-227 64" fill="${p.dirt}"/><path d="M157 220Q208 165 396 149" fill="none" stroke="${p.chalk}" stroke-opacity=".45" stroke-width="2" stroke-dasharray="14 14"/></svg>`;
  const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`; previews.set(id, url); return url;
}