import { copyFileSync } from 'node:fs';
import { decodePng, encodePng } from './edge-magenta-lib.mjs';

const bezelFile = 'public/art/cockpit/cockpit-bezel.png';
const backupFile = 'art-src/cockpit/cockpit-bezel.pre-aperture-expand.png';

try {
  copyFileSync(bezelFile, backupFile);
  console.log('Backed up original bezel to', backupFile);
} catch (e) {
  console.log('Backup already exists or error:', e.message);
}

const { w, h, data } = decodePng(bezelFile);
console.log('Loaded bezel:', w, 'x', h);

const targetBottomY = 845;
const cornerRadius = 55;
const leftX = 163;
const rightX = 1757;
const cornerCy = targetBottomY - cornerRadius;
const leftCx = leftX + cornerRadius;
const rightCx = rightX - cornerRadius;

let clearedCount = 0;

for (let y = 600; y <= targetBottomY; y++) {
  for (let x = leftX; x <= rightX; x++) {
    // Check bottom-left corner
    if (y > cornerCy && x < leftCx) {
      const dist = Math.hypot(x - leftCx, y - cornerCy);
      if (dist > cornerRadius) continue;
    }
    // Check bottom-right corner
    if (y > cornerCy && x > rightCx) {
      const dist = Math.hypot(x - rightCx, y - cornerCy);
      if (dist > cornerRadius) continue;
    }

    const idx = (y * w + x) * 4;
    if (data[idx + 3] !== 0) {
      data[idx + 3] = 0; // Transparent opening
      clearedCount++;
    }
  }
}

console.log(`Cleared ${clearedCount} pixels to extend aperture down to y=${targetBottomY}`);

encodePng(bezelFile, w, h, data);
console.log('Saved updated bezel to', bezelFile);
