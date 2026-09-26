import { decodePng } from './edge-magenta-lib.mjs';
import { join } from 'node:path';

const files = [
  'anim-43-explosion-fire.png',
  'anim-44-spark-burst.png',
  'anim-45-smoke-puff.png',
  'anim-46-gore-burst.png',
  'anim-47-gore-green-burst.png',
  'anim-48-ground-impact.png',
  'anim-49-dust-puff.png',
  'anim-50-firework-red.png',
  'anim-51-firework-blue.png',
  'anim-52-firework-green.png'
];

for (const name of files) {
  const filePath = join('public/art/animated/alpha', name);
  const { w, h, data } = decodePng(filePath);
  const halfW = w / 2;
  const halfH = h / 2;
  console.log(`\n=== ${name} (${w}x${h}) ===`);

  for (let frame = 0; frame < 4; frame++) {
    const col = frame % 2;
    const row = Math.floor(frame / 2);
    const startX = col * halfW;
    const startY = row * halfH;

    let nonZero = 0;
    let alphaSum = 0;
    let minA = 255, maxA = 0;
    let minX = halfW, maxX = 0, minY = halfH, maxY = 0;

    for (let y = 0; y < halfH; y++) {
      for (let x = 0; x < halfW; x++) {
        const px = startX + x;
        const py = startY + y;
        const idx = (py * w + px) * 4;
        const a = data[idx + 3];
        if (a > 0) {
          nonZero++;
          alphaSum += a;
          if (a < minA) minA = a;
          if (a > maxA) maxA = a;
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }

    const avgA = nonZero > 0 ? (alphaSum / nonZero).toFixed(1) : 0;
    console.log(`  Frame ${frame}: nonZero=${nonZero} avgAlpha=${avgA} maxAlpha=${maxA} bbox=[${minX},${minY} to ${maxX},${maxY}]`);
  }
}
