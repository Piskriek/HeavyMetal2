import type { CourseId } from './types';
import { FINISH, GRAVITY, RADIUS, STADIUM_START, courseY, laneZ, type Obstacle } from './scene';

export type PowerupKind = 'fuel' | 'shield' | 'bounce';
export interface AirPickup {
  id: number;
  kind: PowerupKind;
  x: number;
  y: number;
  z: number;
  lane: number;
  collectedBy: number | null;
  collectedAt: number;
}
export const POWERUPS = {
  fuel: { name: 'Rocket Fuel', label: '+1 boost', color: '#ffc46f', description: 'Refills one boost charge and gives a small forward surge. Boost stock is capped at two.' },
  shield: { name: 'Skyward Shield', label: '1 hit / 6 sec', color: '#8cceff', description: 'Automatically protects against one rival bump for up to six seconds. Does not protect against gaps.' },
  bounce: { name: 'Air Spring', label: '+1 air bounce', color: '#a7e2ba', description: 'Refills one midair bounce charge. Press Space to use it. Bounce stock is capped at three.' },
} as const;
export const SHIELD_DURATION = 6;
export const PICKUP_RADIUS = 23;

export function createAirPickups(course: CourseId, obstacles: Obstacle[]): AirPickup[] {
  const pickups: AirPickup[] = [];
  const add = (kind: PowerupKind, x: number, lane: number, altitude: number) => {
    if (x > FINISH - 350) return;
    if (obstacles.some((obstacle) => obstacle.kind === 'loop' && obstacle.lane === lane && Math.abs(obstacle.x - x) < obstacle.height * 0.48 + 45)) return;
    pickups.push({ id: pickups.length, kind, x, y: courseY(x, course) - altitude, z: laneZ(lane), lane, collectedBy: null, collectedAt: -100 });
  };
  for (let lane = 0; lane < 4; lane++) add((['fuel', 'shield', 'bounce', 'fuel'] as const)[lane], 1060, lane, 153);
  let rampIndex = 0;
  let springIndex = 0;
  for (const obstacle of obstacles) {
    if (obstacle.x < 1800 || obstacle.x > STADIUM_START - 600 || obstacle.lane === undefined || obstacle.lane < 0) continue;
    if (obstacle.kind === 'ramp') {
      add((['shield', 'fuel', 'bounce'] as const)[rampIndex++ % 3], obstacle.x + obstacle.width + 125, obstacle.lane, Math.max(146, obstacle.height + 82));
    } else if (obstacle.kind === 'spring' && springIndex++ % 2 === 0) {
      add(course === 'sheep' ? 'bounce' : 'fuel', obstacle.x + 250, obstacle.lane, 212);
    }
  }
  for (let x = 2120, i = 0; x < STADIUM_START - 500; x += course === 'sheep' ? 1680 : 2150, i++) {
    const lane = (i + (course === 'boomtown' ? 1 : 2)) % 4;
    const blocked = obstacles.some((o) => (o.lane === lane || o.kind === 'gap' && lane >= (o.lane ?? 0) && lane < (o.lane ?? 0) + (o.laneSpan ?? 1))
      && x > o.x - 170 && x < o.x + o.width + 170);
    if (!blocked) add((['shield', 'bounce', 'fuel'] as const)[i % 3], x, lane, 106);
  }
  for (let lane = 0; lane < 4; lane++) add(lane % 2 ? 'shield' : 'fuel', STADIUM_START + 580, lane, 106);
  return pickups.sort((a, b) => a.x - b.x);
}

export function pickupY(pickup: AirPickup, time: number, reducedMotion: boolean) {
  return pickup.y + (reducedMotion ? 0 : Math.sin(time * 1.9 + pickup.id * 0.7) * 4);
}

export function pickupIntercept(
  from: { x: number; y: number; z: number }, to: { x: number; y: number; z: number },
  pickup: AirPickup, y: number,
) {
  const dx = to.x - from.x; const dy = to.y - from.y; const dz = to.z - from.z;
  const rx = from.x - pickup.x; const ry = from.y - y; const rz = from.z - pickup.z;
  const radius = RADIUS + PICKUP_RADIUS;
  const c = rx * rx + ry * ry + rz * rz - radius * radius;
  if (c <= 0) return 0;
  const a = dx * dx + dy * dy + dz * dz;
  if (a < 0.0001) return null;
  const b = 2 * (rx * dx + ry * dy + rz * dz);
  const discriminant = b * b - 4 * a * c;
  if (discriminant < 0) return null;
  const time = (-b - Math.sqrt(discriminant)) / (2 * a);
  return time >= 0 && time <= 1 ? time : null;
}

export function hopTiming(vx: number, impulse: number) {
  return Math.max(0.1, Math.min(0.39, impulse / GRAVITY * 0.75)) * Math.max(200, vx);
}

const icons = new Map<PowerupKind, string>();
export function powerupIcon(kind: PowerupKind) {
  if (icons.has(kind)) return icons.get(kind)!;
  const color = POWERUPS[kind].color;
  const symbol = kind === 'fuel' ? '<path d="m54 21-23 31h15l-5 22 25-33H51Z"/>'
    : kind === 'shield' ? '<path d="m48 23 21 8v17q-2 19-21 27-19-8-21-27V31Z" fill="none" stroke-width="6"/><path d="m38 47 8 9 15-18" fill="none" stroke-width="5"/>'
      : '<path d="M48 68V29m-14 15 14-15 14 15M29 69h38" fill="none" stroke-width="6"/><path d="m26 53-13-7 9 16m48-9 13-7-9 16" fill="none" stroke-width="4"/>';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96"><defs><radialGradient id="g"><stop stop-color="${color}" stop-opacity=".4"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></radialGradient><linearGradient id="m" x2="1" y2="1"><stop stop-color="#829a83"/><stop offset=".4" stop-color="#253d31"/><stop offset="1" stop-color="#101e1b"/></linearGradient></defs><circle cx="48" cy="48" r="47" fill="url(#g)"/><path d="M48 11 81 30v36L48 85 15 66V30Z" fill="url(#m)" stroke="#12251c" stroke-width="6"/><path d="M48 13 79 31v34L48 83 17 65V31Z" fill="none" stroke="${color}" stroke-width="3"/><g fill="${color}" stroke="${color}" stroke-linejoin="round" stroke-linecap="round">${symbol}</g><path d="m27 29 18-10" stroke="#fff3cd" stroke-width="2" opacity=".7"/></svg>`;
  const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  icons.set(kind, url); return url;
}

let iconPromise: Promise<Record<PowerupKind, HTMLCanvasElement>> | null = null;
export function preparePowerupSprites() {
  iconPromise ??= Promise.all((Object.keys(POWERUPS) as PowerupKind[]).map((kind) => new Promise<[PowerupKind, HTMLCanvasElement]>((resolve, reject) => {
    const image = new Image();
    image.onload = () => { const canvas = document.createElement('canvas'); canvas.width = canvas.height = 128; canvas.getContext('2d')!.drawImage(image, 0, 0, 128, 128); resolve([kind, canvas]); };
    image.onerror = () => reject(new Error('Could not prepare airborne pickups.'));
    image.src = powerupIcon(kind);
  }))).then((entries) => Object.fromEntries(entries) as Record<PowerupKind, HTMLCanvasElement>).catch((error: unknown) => { iconPromise = null; throw error; });
  return iconPromise;
}