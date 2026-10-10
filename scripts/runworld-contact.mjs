// Contact sheet of the RUN.world batch, labelled, for review: node scripts/runworld-contact.mjs <out.png> [id ...] [--thumbs]
// Default: each asset's source.png. --thumbs: its render-thumb.py thumbnail (low beside high) instead.
import sharp from 'sharp'; import fs from 'node:fs'; import path from 'node:path';
const thumbs = process.argv.includes('--thumbs'), file = thumbs ? 'thumb.png' : file;
const [out, ...only] = process.argv.slice(2).filter((a) => a !== '--thumbs'), root = 'C:/MarbleGp/zips/runworld/assets', T = 300, cols = thumbs ? 4 : 6;
const ids = fs.readdirSync(root).filter((d) => fs.existsSync(path.join(root, d, file)) && (only.length === 0 || only.includes(d)));
const rows = Math.ceil(ids.length / cols), tiles = [];
for (const [i, id] of ids.entries()) {
  const img = await sharp(path.join(root, id, file)).resize(thumbs ? Math.round(T * 1.5) : T, T).toBuffer();
  const label = Buffer.from(`<svg width="${T}" height="26"><rect width="${T}" height="26" fill="#111"/><text x="6" y="18" font-family="Arial" font-size="15" fill="#fff">${id}</text></svg>`);
  tiles.push({ input: img, left: (i % cols) * (thumbs ? Math.round(T * 1.5) : T), top: Math.floor(i / cols) * (T + 26) + 26 }, { input: label, left: (i % cols) * (thumbs ? Math.round(T * 1.5) : T), top: Math.floor(i / cols) * (T + 26) });
}
await sharp({ create: { width: cols * (thumbs ? Math.round(T * 1.5) : T), height: rows * (T + 26), channels: 3, background: '#222' } }).composite(tiles).png().toFile(out);
console.log(out, ids.length);
